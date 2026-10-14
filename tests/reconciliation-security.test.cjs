const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const TENANT = '11111111-1111-1111-1111-111111111111'
const OTHER_TENANT = '33333333-3333-3333-3333-333333333333'
const CLIENT = '22222222-2222-2222-2222-222222222222'
const FINANCE_PERMISSION = 'Faturação & Contas Correntes'
const finance = { role: 'employee', tenant_id: TENANT, permissions: [FINANCE_PERMISSION] }
const items = [
  { id: 'DB123456789PT', cttPrice: 5.5, cttDate: '2026-10-14' },
  { id: 'DB987654321PT', cttPrice: 10, cttDate: '2026-10-14' },
]

function authModule(ctx) {
  const user = ctx ? { id: 'fixture-actor', email: 'fixture@example.invalid', app_metadata: {
    role: ctx.role, permissions: ctx.permissions || [], client_id: CLIENT,
  } } : null
  const authDb = fakeSupabase({ colaboradores: [], client_users: [] })
  // Exercise the existing requirePermission implementation, rather than copying
  // its role policy into the tests. The mocked session is server-managed metadata.
  return createLoader({
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    'next/headers': { cookies: async () => ({ getAll: () => [], get: () => null }) },
    react: { cache: fn => fn },
    'next/navigation': { redirect: () => { throw new Error('Acesso negado: login necessário') } },
    '@/lib/supabase/server': { createAdminClient: () => authDb.createAdminClient() },
    '@/app/ops/entidades/colaboradores/types': { DEFAULT_COLABORADORES: [] },
  })('lib/auth/context.ts')
}

function harness(ctx = finance, failure) {
  const tables = {
    shipments: [
      { id: 'shipment-own', tenant_id: TENANT, client_id: CLIENT, tracking_number: items[0].id,
        buy_price: 5.5, sell_price: 9, sender_name: 'Fixture sender', created_at: '2026-10-14T10:00:00Z' },
      { id: 'shipment-other', tenant_id: OTHER_TENANT, client_id: CLIENT, tracking_number: items[1].id,
        buy_price: 88, sell_price: 99, sender_name: 'Foreign private sender', created_at: '2026-10-14T10:00:00Z' },
    ],
    clients: [
      { id: CLIENT, tenant_id: TENANT, name: 'Fixture table name' },
      { id: CLIENT, tenant_id: OTHER_TENANT, name: 'Foreign private client' },
    ],
    audit_log: [
      { tenant_id: TENANT, action: 'client_data', created_at: '2026-10-14', details: { id: CLIENT, short_name: 'Fixture latest name' } },
      { tenant_id: TENANT, action: 'client_data', created_at: '2026-10-01', details: { id: CLIENT, short_name: 'Fixture old name' } },
      { tenant_id: OTHER_TENANT, action: 'client_data', created_at: '2026-12-01', details: { id: CLIENT, short_name: 'Foreign private name' } },
      { id: 'own-history', tenant_id: TENANT, action: 'ctt_reconciliation_audit', created_at: '2026-10-14', details: { filename: 'Fixture.xls' } },
      { id: 'other-history', tenant_id: OTHER_TENANT, action: 'ctt_reconciliation_audit', created_at: '2026-10-15', details: { filename: 'Foreign private invoice.xls' } },
    ],
  }
  const db = fakeSupabase(tables, failure)
  const auth = authModule(ctx)
  const calls = { permissions: [], filesystem: 0, workbook: 0, input: 0 }
  const load = createLoader({
    '@/lib/auth/context': { requirePermission: async permission => {
      calls.permissions.push(permission)
      const authorized = await auth.requirePermission(permission)
      // Current production auth is single-tenant. Vary the trusted tenant in
      // these fixtures to independently verify reconciliation query isolation.
      return { ...authorized, tenant_id: ctx.tenant_id }
    } },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    'next/cache': { revalidatePath() {} },
    fs: {
      existsSync: () => { calls.filesystem++; return true },
      readFileSync: () => { calls.filesystem++; return Buffer.from('fixture workbook') },
    },
    path,
    xlsx: { read: () => { calls.workbook++; return {} } },
    '@/app/ops/tesouraria/reconciliacao/parser': {
      normalizeParcelId: value => String(value || '').replace(/\s/g, '').toUpperCase(),
      parseCttItemsFromWorkbook: () => items,
    },
  })
  const actions = load('app/actions/reconciliacao-ctt.ts')
  const payload = { get items() { calls.input++; return items }, filename: 'Fixture.xls' }
  function form(mode = 'upload') {
    return { get(key) {
      calls.input++
      if (key === 'sample_mode') return mode === 'sample' ? 'true' : null
      if (key === 'parsed_items') return mode === 'parsed' ? JSON.stringify(items) : null
      if (key === 'file') return { name: 'Fixture.xls', async arrayBuffer() { calls.input++; return new ArrayBuffer(0) } }
      return null
    } }
  }
  return { db, calls, actions, payload, form }
}

const entries = [
  ['parsed items', h => h.actions.reconcileCttParsedItemsAction(h.payload)],
  ['sample workbook', h => h.actions.reconcileCttSampleAction()],
  ['uploaded workbook', h => h.actions.reconcileCttInvoiceAction(h.form())],
  ['history', h => h.actions.getReconciliacaoHistoryAction()],
]

for (const [name, invoke] of entries) {
  test(`reconciliation ${name}: rejects callers without finance access before any resource or input read`, async () => {
    for (const ctx of [null, { role: 'client', tenant_id: TENANT, permissions: [FINANCE_PERMISSION] },
      { role: 'employee', tenant_id: TENANT, permissions: [] },
      { role: 'employee', tenant_id: TENANT, permissions: [], client_id: CLIENT },
      { ...finance, tenant_id: '' }]) {
      const h = harness(ctx)
      await assert.rejects(invoke(h), /Acesso negado/)
      assert.deepEqual(h.calls.permissions, [FINANCE_PERMISSION])
      assert.equal(h.db.adminClients, 0)
      assert.equal(h.db.queries.length, 0)
      assert.equal(h.db.writes.length, 0)
      assert.equal(h.calls.filesystem + h.calls.workbook + h.calls.input, 0)
    }
  })
  test(`reconciliation ${name}: allows finance employees and administrators`, async () => {
    for (const ctx of [finance, { role: 'admin', tenant_id: TENANT, permissions: [] }]) {
      const h = harness(ctx)
      const result = await invoke(h)
      if (name === 'history') assert.deepEqual(result.map(row => row.id), ['own-history'])
      else assert.equal(result.success, true)
      assert.ok(h.calls.permissions.every(permission => permission === FINANCE_PERMISSION))
      for (const query of h.db.queries.filter(q => !q.write)) {
        assert.ok(query.filters.some(f => f.field === 'tenant_id' && f.value === TENANT), query.table)
      }
    }
  })
}

test('reconciliation calculations and client names use only the authorized tenant', async () => {
  for (const tenant of [TENANT, OTHER_TENANT]) {
    const h = harness({ ...finance, tenant_id: tenant })
    const result = await h.actions.reconcileCttParsedItemsAction(h.payload)
    assert.equal(result.success, true)
    const matched = result.result.items.filter(item => item.shipmentId)
    assert.equal(matched.length, 1)
    assert.equal(matched[0].shipmentId, tenant === TENANT ? 'shipment-own' : 'shipment-other')
    assert.equal(matched[0].clientName, tenant === TENANT ? 'Fixture latest name' : 'Foreign private name')
    if (tenant === TENANT) {
      assert.equal(matched[0].status, 'ok')
      assert.equal(matched[0].lnkPrice, 5.5)
      assert.doesNotMatch(JSON.stringify(result), /Foreign private/)
    }
    const audit = h.db.writes[0].value
    assert.equal(audit.tenant_id, tenant)
    assert.equal(audit.details.actor_user_id, 'fixture-actor')
  }
})

test('reconciliation JSON and sample FormData paths enforce the same tenant scope', async () => {
  for (const mode of ['parsed', 'sample']) {
    const h = harness()
    const result = await h.actions.reconcileCttInvoiceAction(h.form(mode))
    assert.equal(result.success, true)
    assert.equal(result.result.items.filter(item => item.shipmentId).length, 1)
    assert.doesNotMatch(JSON.stringify(result), /Foreign private/)
  }
})

test('reconciliation database failures never expose technical details or report an unrecorded success', async () => {
  const failures = [
    q => q.table === 'shipments',
    q => q.table === 'clients',
    q => q.table === 'audit_log' && !q.write,
    q => !!q.write,
  ]
  for (const fails of failures) {
    const h = harness(finance, q => fails(q) ? { message: 'private database detail' } : null)
    const result = await h.actions.reconcileCttParsedItemsAction(h.payload)
    assert.equal(result.success, false)
    assert.doesNotMatch(result.error, /private database detail/)
    assert.equal(h.db.writes.length, 0)
  }
  const h = harness(finance, () => ({ message: 'private database detail' }))
  assert.deepEqual(await h.actions.getReconciliacaoHistoryAction(), [])
})
