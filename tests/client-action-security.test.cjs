const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const TENANT = '11111111-1111-1111-1111-111111111111'
const FOREIGN = '99999999-9999-9999-9999-999999999999'
const A = '22222222-2222-2222-2222-222222222222'
const B = '33333333-3333-3333-3333-333333333333'
const PERMISSION = 'Faturação & Contas Correntes'
const client = { role: 'client', tenant_id: TENANT, client_id: A, permissions: [] }
const ops = { role: 'employee', tenant_id: TENANT, permissions: [] }
const finance = { ...ops, permissions: [PERMISSION] }
const admin = { role: 'admin', tenant_id: TENANT, permissions: [] }
const recipientInput = { name: 'Updated address', address: 'Fixture street', postal_code: '4000-001', city: 'Fixture city' }

function actualAuth(ctx) {
  const user = ctx ? { id: 'fixture-user', email: 'fixture@example.invalid', app_metadata: {
    role: ctx.role, permissions: ctx.permissions || [], client_id: ctx.client_id,
  } } : null
  const db = fakeSupabase({ colaboradores: [], client_users: [] })
  return createLoader({
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    'next/headers': { cookies: async () => ({ getAll: () => [], get: () => null }) },
    react: { cache: fn => fn },
    'next/navigation': { redirect: () => { throw new Error('Acesso negado: login necessário') } },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    '@/app/ops/entidades/colaboradores/types': { DEFAULT_COLABORADORES: [] },
  })('lib/auth/context.ts')
}

function harness(ctx = client, failure) {
  const recipient = (id, owner, tenant = TENANT) => ({ id: `row-${id}-${tenant}`, tenant_id: tenant,
    action: 'saved_recipient', details: { id, name: id, client_id: owner, address: 'Fixture street', postal_code: '4000-001' } })
  const batch = (id, tenant = TENANT, action = 'reembolso_batch') => ({ id, tenant_id: tenant, action,
    created_at: '2026-10-14', details: { id, filename: id, clientSummaries: [{ clientId: A, isPaid: false }, { clientId: B, isPaid: false }] } })
  const tables = {
    clients: [
      { id: A, tenant_id: TENANT, name: 'Store A' }, { id: B, tenant_id: TENANT, name: 'Store B' },
      { id: FOREIGN, tenant_id: FOREIGN, name: 'Foreign private store' },
    ],
    audit_log: [recipient('recipient-a', A), recipient('recipient-b', B), recipient('recipient-global', undefined),
      recipient('recipient-foreign', A, FOREIGN), recipient('recipient-a', A, FOREIGN),
      batch('batch-own'), batch('batch-foreign', FOREIGN), batch('wrong-action', TENANT, 'billing_statement'),
      { tenant_id: TENANT, action: 'client_data', created_at: '2026-10-14', details: { id: A, short_name: 'Store A', iban: 'Fixture IBAN' } },
      { tenant_id: FOREIGN, action: 'client_data', created_at: '2026-12-01', details: { id: A, short_name: 'Foreign private store', iban: 'Foreign private IBAN' } },
    ],
    shipments: [
      { id: 'shipment-a', tenant_id: TENANT, client_id: A, tracking_number: 'TRACK-A', carrier_tracking_number: 'CARRIER-A', recipient_name: 'Recipient A', created_at: '2026-10-14' },
      { id: 'shipment-b', tenant_id: TENANT, client_id: B, tracking_number: 'TRACK-B', carrier_tracking_number: 'CARRIER-B', recipient_name: 'Recipient B', created_at: '2026-10-14' },
      { id: 'shipment-foreign', tenant_id: FOREIGN, client_id: A, tracking_number: 'FOREIGN-TRACK', carrier_tracking_number: 'FOREIGN-CARRIER', recipient_name: 'Foreign private recipient' },
    ],
  }
  const db = fakeSupabase(tables, failure)
  const auth = actualAuth(ctx)
  const calls = { filesystem: 0, parser: 0, revalidations: [] }
  const load = createLoader({
    'server-only': {},
    '@/lib/auth/context': {
      requireUser: async () => ({ ...await auth.requireUser(), tenant_id: ctx.tenant_id }),
      requirePermission: async permission => ({ ...await auth.requirePermission(permission), tenant_id: ctx.tenant_id }),
    },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    'next/cache': { revalidatePath: p => calls.revalidations.push(p) },
    '@/lib/services/geo/postal-code.service': { lookupPostalCode: () => null },
    path,
    fs: { existsSync: () => { calls.filesystem++; return true }, readFileSync: () => { calls.filesystem++; return 'fixture' } },
    '@/lib/services/reembolsos/ctt-reembolso-parser': { parseCttReembolsoFile: () => {
      calls.parser++
      return { items: [{ carrierTracking: 'CARRIER-A', clientReference: '', amount: 10 },
        { carrierTracking: 'FOREIGN-CARRIER', clientReference: 'FOREIGN-TRACK', amount: 99 }] }
    } },
  })
  return { db, tables, calls, recipients: load('app/actions/destinatarios.ts'), payouts: load('app/actions/reembolsos.ts') }
}

const payoutEntries = [
  ['upload', h => h.payouts.processReembolsoUploadAction('fixture', 'fixture.xls')],
  ['sample', h => h.payouts.loadSampleCttFileAction()],
  ['history', h => h.payouts.getReembolsoBatchesAction()],
  ['paid status', h => h.payouts.markClientReembolsoPaidAction('batch-own', B, true)],
  ['delete', h => h.payouts.deleteReembolsoBatchAction('batch-own')],
]

for (const [name, invoke] of payoutEntries) {
  test(`payout ${name}: clients, anonymous callers and staff without finance permission are denied before resources`, async () => {
    for (const ctx of [null, client, { ...client, permissions: [PERMISSION] }, ops, { ...finance, tenant_id: '' }]) {
      const h = harness(ctx)
      await assert.rejects(invoke(h), /Acesso negado/)
      assert.equal(h.db.adminClients, 0)
      assert.equal(h.db.queries.length, 0)
      assert.equal(h.calls.filesystem + h.calls.parser + h.calls.revalidations.length, 0)
    }
  })
  test(`payout ${name}: finance employees and administrators retain access`, async () => {
    for (const ctx of [finance, admin]) {
      const h = harness(ctx)
      const result = await invoke(h)
      if (name === 'history') assert.deepEqual(result.map(r => r.id), ['batch-own'])
      else assert.equal(result.success, true)
      for (const q of h.db.queries.filter(q => !q.write || q.write.kind !== 'insert')) {
        assert.ok(q.filters.some(f => f.field === 'tenant_id' && f.value === TENANT), q.table)
      }
      if (name === 'paid status') {
        assert.equal(h.tables.audit_log.find(r => r.id === 'batch-own').details.clientSummaries[1].isPaid, true)
        assert.equal(h.db.writes[0].value.details.updated_by_user_id, 'fixture-user')
      }
    }
  })
}

test('payout status and deletion reject other companies, wrong record types, missing batches and missing summaries', async () => {
  for (const id of ['batch-foreign', 'wrong-action', 'missing']) {
    const h = harness(finance)
    const original = structuredClone(h.tables.audit_log)
    assert.equal((await h.payouts.markClientReembolsoPaidAction(id, A, true)).success, false)
    assert.equal((await h.payouts.deleteReembolsoBatchAction(id)).success, false)
    assert.deepEqual(h.tables.audit_log, original)
    assert.equal(h.calls.revalidations.length, 0)
  }
  const h = harness(finance)
  assert.equal((await h.payouts.markClientReembolsoPaidAction('batch-own', 'missing-client', true)).success, false)
  assert.equal(h.db.writes.length, 0)
  assert.equal((await h.payouts.markClientReembolsoPaidAction('batch-own', A, 'true')).success, false)
})

test('payout upload matches only company shipments and uses persisted company bank details', async () => {
  const h = harness(finance)
  const result = await h.payouts.processReembolsoUploadAction('fixture', 'fixture.xls')
  assert.equal(result.success, true)
  assert.equal(result.batch.matchedCount, 1)
  assert.equal(result.batch.unmatchedCount, 1)
  assert.equal(result.batch.clientSummaries.find(c => c.clientId === A).clientIban, 'Fixture IBAN')
  assert.doesNotMatch(JSON.stringify(result), /Foreign private/)
  assert.equal(h.db.writes[0].value.tenant_id, TENANT)
  assert.equal(h.db.writes[0].value.details.actor_user_id, 'fixture-user')
  assert.equal(h.db.writes[0].value.id, result.batch.id)
})

test('recipient actions deny anonymous accounts and clients without an assigned store before any data access', async () => {
  for (const ctx of [null, { ...client, client_id: null }, { ...client, tenant_id: '' }]) {
    const h = harness(ctx)
    for (const invoke of [() => h.recipients.getDestinatariosAction(),
      () => h.recipients.saveDestinatarioAction(recipientInput), () => h.recipients.deleteDestinatarioAction('recipient-a')]) {
      await assert.rejects(invoke(), /Acesso negado/)
    }
    assert.equal(h.db.adminClients, 0)
  }
})

test('recipient listing ignores a client-submitted store and excludes other companies and shared staff records', async () => {
  const h = harness()
  const result = await h.recipients.getDestinatariosAction(B)
  assert.ok(result.length >= 2)
  assert.ok(result.every(r => r.client_id === A))
  assert.doesNotMatch(JSON.stringify(result), /Foreign private|recipient-b|recipient-global|Recipient B/)
  for (const q of h.db.queries) assert.ok(q.filters.some(f => f.field === 'tenant_id' && f.value === TENANT))
})

test('client recipient updates reject forged foreign, shared, missing and wrong-action IDs without writes', async () => {
  for (const id of ['recipient-b', 'recipient-foreign', 'recipient-global', 'missing', 'batch-own']) {
    const h = harness()
    const original = structuredClone(h.tables.audit_log)
    const result = await h.recipients.saveDestinatarioAction({ ...recipientInput, id, client_id: B })
    assert.equal(result.success, false, id)
    assert.equal(h.db.writes.length, 0)
    assert.deepEqual(h.tables.audit_log, original)
    assert.equal(h.calls.revalidations.length, 0)
  }
})

test('client recipient deletes cannot change another store, company, shared record or unrelated action', async () => {
  for (const id of ['recipient-b', 'recipient-foreign', 'recipient-global', 'missing', 'batch-own']) {
    const h = harness()
    const original = structuredClone(h.tables.audit_log)
    assert.equal((await h.recipients.deleteDestinatarioAction(id)).success, false)
    assert.deepEqual(h.tables.audit_log, original)
    assert.equal(h.calls.revalidations.length, 0)
  }
})

test('client can save, update and delete its own recipients, ignoring forged ownership fields', async () => {
  const h = harness()
  const created = await h.recipients.saveDestinatarioAction({ ...recipientInput, client_id: B })
  assert.equal(created.success, true)
  assert.equal(created.destinatario.client_id, A)
  const updated = await h.recipients.saveDestinatarioAction({ ...recipientInput, id: 'recipient-a', client_id: B })
  assert.equal(updated.success, true)
  assert.equal(updated.destinatario.client_id, A)
  assert.equal(h.tables.audit_log.find(r => r.details?.id === 'recipient-a' && r.tenant_id === FOREIGN).details.name, 'recipient-a')
  assert.equal((await h.recipients.deleteDestinatarioAction('recipient-a')).success, true)
  assert.ok(h.tables.audit_log.some(r => r.details?.id === 'recipient-a' && r.tenant_id === FOREIGN))
})

test('staff can manage both company stores and shared recipients while remaining bounded to their company', async () => {
  for (const ctx of [ops, { ...ops, client_id: A }, admin]) {
    const h = harness(ctx)
    const result = await h.recipients.getDestinatariosAction()
    assert.ok(result.some(r => r.client_id === A))
    assert.ok(result.some(r => r.client_id === B))
    assert.doesNotMatch(JSON.stringify(result), /Foreign private/)
    assert.equal((await h.recipients.saveDestinatarioAction({ ...recipientInput, id: 'recipient-b', client_id: B })).success, true)
    assert.equal((await h.recipients.deleteDestinatarioAction('recipient-global')).success, true)
    assert.equal((await h.recipients.saveDestinatarioAction({ ...recipientInput, id: 'recipient-foreign', client_id: A })).success, false)
    assert.equal((await h.recipients.saveDestinatarioAction({ ...recipientInput, client_id: FOREIGN })).success, false)
  }
})

test('one-store ownership applies equally to Store A and Store B logins', async () => {
  for (const [owner, ownId, otherId] of [[A, 'recipient-a', 'recipient-b'], [B, 'recipient-b', 'recipient-a']]) {
    const h = harness({ ...client, client_id: owner })
    assert.equal((await h.recipients.saveDestinatarioAction({ ...recipientInput, id: otherId })).success, false)
    assert.equal((await h.recipients.deleteDestinatarioAction(otherId)).success, false)
    assert.equal((await h.recipients.saveDestinatarioAction({ ...recipientInput, id: ownId, client_id: owner === A ? B : A })).success, true)
    assert.equal((await h.recipients.deleteDestinatarioAction(ownId)).success, true)
  }
})

test('saving a history address creates a fresh saved-recipient ID rather than targeting a supplied ID', async () => {
  const h = harness()
  const result = await h.recipients.saveDestinatarioAction({ ...recipientInput, id: 'dest_history', client_id: B })
  assert.equal(result.success, true)
  assert.notEqual(result.destinatario.id, 'dest_history')
  assert.equal(result.destinatario.client_id, A)
  assert.equal(h.db.writes[0].kind, 'insert')
})

test('deleted or missing persisted client profiles cannot authorize recipient creation', async () => {
  for (const mode of ['missing', 'deleted']) {
    const h = harness()
    if (mode === 'missing') {
      h.tables.clients = h.tables.clients.filter(r => r.id !== A)
      h.tables.audit_log = h.tables.audit_log.filter(r => r.action !== 'client_data')
    } else h.tables.audit_log.push({ tenant_id: TENANT, action: 'deleted_client', details: { id: A } })
    assert.equal((await h.recipients.saveDestinatarioAction(recipientInput)).success, false)
    assert.equal(h.db.writes.length, 0)
  }
})

test('database failures do not report success, revalidate pages or expose internal errors', async () => {
  const cases = [
    [finance, q => q.table === 'shipments', h => h.payouts.processReembolsoUploadAction('fixture', 'fixture.xls')],
    [finance, q => q.table === 'clients', h => h.payouts.processReembolsoUploadAction('fixture', 'fixture.xls')],
    [finance, q => !!q.write, h => h.payouts.processReembolsoUploadAction('fixture', 'fixture.xls')],
    [finance, q => !!q.write, h => h.payouts.markClientReembolsoPaidAction('batch-own', B, true)],
    [client, q => q.table === 'clients', h => h.recipients.saveDestinatarioAction(recipientInput)],
    [client, q => !!q.write, h => h.recipients.saveDestinatarioAction({ ...recipientInput, id: 'recipient-a' })],
    [client, q => !!q.write, h => h.recipients.deleteDestinatarioAction('recipient-a')],
  ]
  for (const [ctx, fails, invoke] of cases) {
    const h = harness(ctx, q => fails(q) ? { message: 'private database information' } : null)
    const result = await invoke(h)
    assert.equal(result.success, false)
    assert.doesNotMatch(result.error, /private database information/)
    assert.equal(h.db.writes.length, 0)
    assert.equal(h.calls.revalidations.length, 0)
  }
})
