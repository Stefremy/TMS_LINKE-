const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { createLoader } = require('./helpers/load-typescript.cjs')
const client = { id: 'fixture', short_name: 'Loja A', address: 'Rua do Armazém 1', postal_code: '4000-001', city: 'Porto', phone: '912345678', email: 'loja@example.pt' }
const request = { id: '44444444-4444-4444-4444-444444444444', reference: 'PR-444444444444', client_id: client.id, client_name: client.short_name,
  status: 'pending', created_at: '2026-11-12T12:00:00Z', pickup: { date: '2099-12-01', period: '13:00-16:00', carrier: 'correos_express', volumes: 2, weightKg: 5, heaviestWeightKg: 3,
    name: client.short_name, address: client.address, city: client.city, postal: client.postal_code, contact: 'Ana', phone: client.phone, email: client.email, notes: 'Porta das traseiras' } }
const fields = { inputClass: 'input', primaryButton: 'primary', secondaryButton: 'secondary' }
const mocks = {
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'), zod: require('zod'), 'lucide-react': require('lucide-react'),
  'next/navigation': { useRouter: () => ({ refresh() {} }), usePathname: () => '/app/fixture/recolhas' },
  'next/link': { __esModule: true, default: ({ children, ...props }) => { delete props.prefetch; return React.createElement('a', props, children) } },
  '@/app/actions/client-pickup-requests': {}, '@/components/shipments/form/fields': fields,
}
const load = createLoader(mocks)
const { ClientScopeProvider } = load('app/app/components/ClientScope.tsx')
const { ClientRequestPickup } = load('app/app/components/ClientRequestPickup.tsx')
const page = status => ({ requests: [{ ...request, status }], total: 1, page: 0 })

test('client pickup page uses real store data, offers requests only and distinguishes pending from a booked pickup', () => {
  for (const status of ['pending', 'completed']) {
    const html = renderToStaticMarkup(React.createElement(ClientScopeProvider, { value: { client, basePath: '/app/fixture', isEmployee: false } }, React.createElement(ClientRequestPickup, { initialPage: page(status) })))
    for (const text of ['Enviar pedido à Linke', 'Rua do Armazém 1', '4000-001', 'PR-444444444444', 'não confirma o levantamento da mercadoria']) assert.ok(html.includes(text), text)
    assert.match(html, status === 'completed' ? /Efetuado<\/span>/ : /Pendente<\/span>/)
    assert.doesNotMatch(html, /O estafeta CTT passará|Confirmar Pedido de Recolha CTT|REC-CTT-/)
  }
})

test('Ops queue displays all operational request data with prepare and manual-completion actions', () => {
  const { ClientPickupRequestsPanel } = load('app/ops/envios/recolhas/ClientPickupRequestsPanel.tsx')
  const html = renderToStaticMarkup(React.createElement(ClientPickupRequestsPanel, { initialPage: page('pending'), onSchedule() {} }))
  for (const text of ['Pedidos dos clientes (1)', 'Preparar recolha', 'Marcar efetuado', 'Referência confirmada', 'Porta das traseiras', '912345678']) assert.ok(html.includes(text), text)
  const claimed = renderToStaticMarkup(React.createElement(ClientPickupRequestsPanel, { initialPage: page('processing'), onSchedule() {} }))
  assert.match(claimed, /Em tratamento/); assert.match(claimed, /Repor pendente após verificação/); assert.doesNotMatch(claimed, /Preparar recolha/)
})

test('pickup requests are discoverable in the shared desktop and mobile client menu', () => {
  const { ClientSidebarNav } = load('app/app/components/ClientSidebarNav.tsx')
  const html = renderToStaticMarkup(React.createElement(ClientScopeProvider, { value: { client, basePath: '/app/fixture' } }, React.createElement(ClientSidebarNav)))
  assert.match(html, /href="\/app\/fixture\/recolhas"/); assert.match(html, /Pedir recolha/)
})

const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : node && typeof node === 'object' ? [node, ...flatten(node.props?.children)] : []
test('preparing a client request prefills the existing Ops booking form and submits through the guarded request endpoint', async t => {
  const slots = []; let cursor = 0; const calls = []
  const react = { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }] }, useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial } } }
  const jsx = (type, props) => ({ type, props: props || {} })
  const isolated = createLoader({ ...mocks, react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': new Proxy({}, { get: (_, key) => key }),
    '@/app/actions/ctt': { scheduleCttPickupAction: () => { throw Error('Client requests must use guarded scheduling') } },
    '@/app/actions/client-pickup-requests': { scheduleClientPickupRequestAction: async (...args) => { calls.push(args); return { success: true, pickupNumber: 'CEX-FIXTURE', carrier_name: 'Correos Express' } } },
    './PickupManagement': { PickupDetailsDialog: () => null, PickupSearchPanel: () => null },
    './PickupCutoffNotice': { PickupCutoffNotice: () => null }, './PickupStatus': { PickupStatus: () => null },
    './ClientPickupRequestsPanel': { ClientPickupRequestsPanel: function Requests() {} },
  })
  const { RecolhasClient } = isolated('app/ops/envios/recolhas/RecolhasClient.tsx')
  const render = () => { cursor = 0; return flatten(RecolhasClient({ recolhas: [], clients: [{ ...client, code: 'A', name: client.short_name }], carrierConnections: [{ id: 'correos', carrier_code: 'correos_express' }], clientRequests: page('pending') })) }
  render().find(node => node.type?.name === 'Requests').props.onSchedule(request)
  const form = render()
  for (const [name, value] of [['senderName', client.short_name], ['senderAddress', client.address], ['senderZip', client.postal_code]]) {
    assert.ok(form.some(node => node.type === 'input' && node.props.value === value), name)
  }
  const previous = { FormData: global.FormData, window: global.window }, events = []
  global.window = { dispatchEvent: event => events.push(event.type) }
  global.FormData = class { get(name) { return { pickupPhone: client.phone, pickupMobilePhone: '', requesterName: 'Linke', requesterPhone: '912345678', requesterMobile: '' }[name] || '' } }
  t.after(() => { global.FormData = previous.FormData; global.window = previous.window })
  await form.find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: {} })
  assert.equal(calls.length, 1); assert.equal(calls[0][0], request.id)
  assert.equal(calls[0][1].client_id, client.id); assert.equal(calls[0][1].volumes, 2); assert.equal(calls[0][1].weightKg, 5)
  assert.equal(calls[0][1].sender.address, client.address); assert.equal(calls[0][1].observations, 'Porta das traseiras')
  assert.ok(events.includes('linke:pickup-requests-changed'))
})
