const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const constants = createLoader({})('lib/pickup-request-notifications.ts')

function notificationHarness(permissions = ['Pedidos de Recolha & Distribuição'], role = 'employee') {
  const request = (id, status, tenant_id = 'own') => ({ id, tenant_id, action: constants.PICKUP_REQUEST_ACTION, created_at: '2026-11-12T12:00:00Z', details: { reference: `PR-${id}`, client_name: 'Loja A', status, pickup: { phone: 'PRIVATE-PHONE' }, created_by: 'PRIVATE-ACTOR' } })
  const tables = { audit_log: [request('pending', 'pending'), request('processing', 'processing'), request('completed', 'completed'), request('foreign', 'pending', 'other')], shipments: [] }
  const db = fakeSupabase(tables)
  const load = createLoader({
    '@/lib/supabase/server': { createAdminClient: () => db.client },
    '@/lib/auth/context': { requireEmployee: async () => { if (role === 'client') throw Error('Forbidden'); return { tenant_id: 'own', role, permissions, user: { id: 'operator' } } } },
    '@/lib/supabase/schema-capabilities': { supportsDatabaseFeature: async () => false },
    '@/app/actions/clientes': { getClientesAction: async () => [] }, '@/app/actions/ctt': { getCarrierConnectionsAction: async () => [] },
    './calendar': { fetchCalendarEventRange: async () => ({ events: [] }) },
  })
  return { api: load('app/actions/notifications.ts'), db, tables }
}

test('the notification bell exposes pending client requests only to authorized Ops staff, with a link to Recolhas', async () => {
  const h = notificationHarness(), list = await h.api.getOperationalNotificationsAction()
  const pickups = list.filter(row => row.type === 'pickup')
  assert.equal(pickups.length, 2)
  assert.deepEqual(new Set(pickups.map(row => row.id)), new Set(['pickup-request-pending', 'pickup-request-processing']))
  assert.ok(pickups.every(row => row.link === '/ops/envios/recolhas' && row.actionLabel === 'Tratar pedido'))
  assert.doesNotMatch(JSON.stringify(pickups), /PRIVATE|foreign|completed/)
  const query = h.db.queries.find(row => row.filters.some(filter => filter.value === constants.PICKUP_REQUEST_ACTION))
  assert.equal(query.limit, 10); assert.doesNotMatch(query.projection, /pickup|created_by|\*/)
  h.tables.audit_log[0].details.status = 'completed'
  assert.equal((await h.api.getOperationalNotificationsAction()).filter(row => row.type === 'pickup').length, 1)
})

test('staff without pickup permission receive no pickup details or lookup; client sessions cannot call Ops notifications', async () => {
  const h = notificationHarness(['Faturação & Contas Correntes'])
  assert.ok((await h.api.getOperationalNotificationsAction()).every(row => row.type !== 'pickup'))
  assert.ok(!h.db.queries.some(row => row.filters.some(filter => filter.value === constants.PICKUP_REQUEST_ACTION)))
  const denied = notificationHarness([], 'client')
  await assert.rejects(denied.api.getOperationalNotificationsAction(), /Forbidden/)
  assert.equal(denied.db.queries.length, 0)
})

function uiLoad() {
  return createLoader({ react: React, 'react/jsx-runtime': require('react/jsx-runtime'), 'lucide-react': require('lucide-react'),
    'next/link': { __esModule: true, default: ({ children, ...props }) => { delete props.prefetch; return React.createElement('a', props, children) } },
    'next/image': { __esModule: true, default: props => { const p = { ...props }; delete p.priority; return React.createElement('img', p) } },
    'next/navigation': { usePathname: () => '/ops' },
    '@/components/shipments/quotations/useQuotationUnread': { useQuotationUnread: enabled => enabled ? 2 : 0 },
    '@/components/pickups/usePickupRequestCount': { usePickupRequestCount: enabled => enabled ? 3 : 0 },
  })
}

test('Recolhas has a red pending badge in expanded, collapsed and mobile navigation; permissions hide it', () => {
  const load = uiLoad(), { SidebarNav } = load('app/ops/components/SidebarNav.tsx')
  for (const collapsed of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(SidebarNav, { collapsed, pickupRequestCount: 3, access: { role: 'admin', permissions: [] } }))
    assert.match(html, /href="\/ops\/envios\/recolhas"/); assert.match(html, /aria-label="3 pedidos de recolha pendentes"/)
    assert.match(html, /rounded-full bg-red-600/)
  }
  const { OpsSidebar } = load('app/ops/components/OpsSidebar.tsx')
  const mobile = renderToStaticMarkup(React.createElement(OpsSidebar, { access: { role: 'admin', permissions: [] } }))
  assert.match(mobile, /aria-label="5 alertas de navegação"/)
  assert.ok((mobile.match(/aria-label="3 pedidos de recolha pendentes"/g) || []).length >= 2)
  const denied = renderToStaticMarkup(React.createElement(SidebarNav, { pickupRequestCount: 3, access: { role: 'employee', permissions: ['Faturação & Contas Correntes'] } }))
  assert.doesNotMatch(denied, /href="\/ops\/envios\/recolhas"|pedidos de recolha pendentes/)
  const { PickupRequestBadge } = load('components/pickups/PickupRequestBadge.tsx')
  assert.equal(renderToStaticMarkup(React.createElement(PickupRequestBadge, { count: 0 })), '')
  assert.match(renderToStaticMarkup(React.createElement(PickupRequestBadge, { count: 105 })), />99\+<\/span>/)
})

test('the pending poll pauses in hidden tabs, queues refreshes without concurrent calls, and discards stale responses after completion', async t => {
  const previous = { document: global.document, window: global.window }
  t.after(() => Object.assign(global, previous))
  const effects = [], updates = [], tasks = [], resolvers = [], events = [], listeners = {}
  let calls = 0, interval, cleared = false
  global.document = { visibilityState: 'hidden', addEventListener: (name, fn) => { listeners[name] = fn }, removeEventListener: name => { delete listeners[name] } }
  global.window = { addEventListener: (name, fn) => { listeners[name] = fn }, removeEventListener: name => { delete listeners[name] }, dispatchEvent: event => events.push(event.type), setInterval: (fn, ms) => { assert.equal(ms, 30000); interval = fn; return 1 }, clearInterval: () => { cleared = true } }
  const load = createLoader({ react: { useState: () => [0, value => updates.push(value)], useEffect: fn => effects.push(fn), startTransition: fn => tasks.push(fn()) },
    '@/app/actions/client-pickup-requests': { getPendingClientPickupRequestsCountAction: async () => { calls++; return new Promise(resolve => resolvers.push(resolve)) } },
  })
  const { usePickupRequestCount } = load('components/pickups/usePickupRequestCount.ts')
  usePickupRequestCount(true); const cleanup = effects[0]()
  assert.equal(calls, 0)
  document.visibilityState = 'visible'; listeners.visibilitychange(); await new Promise(resolve => setImmediate(resolve)); assert.equal(calls, 1)
  listeners[constants.PICKUP_REQUESTS_CHANGED_EVENT](); assert.equal(calls, 1)
  resolvers[0](5); await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(updates, []); assert.equal(calls, 2)
  resolvers[1](2); await Promise.all(tasks)
  assert.deepEqual(updates, [2])
  interval(); await new Promise(resolve => setImmediate(resolve)); resolvers[2](0); await Promise.all(tasks)
  assert.deepEqual(updates, [2, 0]); assert.ok(events.includes(constants.OPERATIONAL_NOTIFICATIONS_CHANGED_EVENT))
  document.visibilityState = 'hidden'; interval(); assert.equal(calls, 3)
  cleanup(); assert.equal(cleared, true); assert.deepEqual(Object.keys(listeners), [])
})

test('pickup updates refresh the notification bell and older responses cannot restore a completed pickup alert', async t => {
  const previous = { window: global.window, setTimeout: global.setTimeout, setInterval: global.setInterval, clearTimeout: global.clearTimeout, clearInterval: global.clearInterval }
  t.after(() => Object.assign(global, previous))
  const effects = [], updates = [], listeners = {}, resolvers = []
  global.window = { addEventListener: (name, fn) => { listeners[name] = fn }, removeEventListener: name => { delete listeners[name] } }
  global.setTimeout = () => 1; global.setInterval = () => 2; global.clearTimeout = () => {}; global.clearInterval = () => {}
  const jsx = (type, props) => ({ type, props: props || {} })
  const load = createLoader({ react: { useState: value => [value, next => updates.push(next)], useRef: value => ({ current: value }), useEffect: fn => effects.push(fn), useCallback: fn => fn, useMemo: fn => fn() },
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': new Proxy({}, { get: (_, key) => key }),
    'next/navigation': { useRouter: () => ({ push() {} }) }, '@/components/ui/refresh-icon': { RefreshIcon: 'i' },
    '@/app/actions/notifications': { getOperationalNotificationsAction: () => new Promise(resolve => resolvers.push(resolve)) },
  })
  const { NotificationBell } = load('app/ops/components/NotificationBell.tsx')
  const element = NotificationBell(), cleanup = effects[1]()
  element.props.children[0].props.onClick()
  assert.equal(resolvers.length, 1)
  listeners[constants.OPERATIONAL_NOTIFICATIONS_CHANGED_EVENT]()
  assert.equal(resolvers.length, 2)
  resolvers[1]([]); await new Promise(resolve => setImmediate(resolve))
  resolvers[0]([{ id: 'outdated-pickup-alert' }]); await new Promise(resolve => setImmediate(resolve))
  assert.ok(updates.some(value => Array.isArray(value) && value.length === 0))
  assert.ok(!updates.some(value => Array.isArray(value) && value.some(row => row.id === 'outdated-pickup-alert')))
  cleanup(); assert.equal(listeners[constants.OPERATIONAL_NOTIFICATIONS_CHANGED_EVENT], undefined)
})
