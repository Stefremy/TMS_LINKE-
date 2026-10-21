const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const TENANT = '11111111-1111-1111-1111-111111111111'
const FOREIGN = '99999999-9999-9999-9999-999999999999'
const A = '22222222-2222-2222-2222-222222222222'
const B = '33333333-3333-3333-3333-333333333333'
const CREDS = { auth_id: 'fixture-auth', client_number: 'fixture-client', contract_number: 'fixture-contract' }
const PDF = Buffer.from('%PDF-1.4\nfixture document').toString('base64')
const row = (id = A, extra = {}) => ({ id, tenant_id: TENANT, status: 'pendente', carrier_code: 'ctt_expresso',
  tracking_number: 'LTK123', carrier_tracking_number: 'DD123456789PT', ...extra })

function harness({ rows = [row()], audit = [], credentials = CREDS, response, carrierError, failure } = {}) {
  const db = fakeSupabase({ shipments: rows, audit_log: audit }, failure)
  const calls = []
  const close = createLoader({
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    '@/lib/services/carriers/credentials': { resolveCttCredentials: async () => credentials },
    './ctt-shipment.service': { CTTShipmentService: class {
      async closeShipment(creds, input) {
        calls.push({ creds, input })
        if (carrierError) throw carrierError
        return response || { Status: 1, DocumentsList: [{ FileName: 'certificado.pdf', File: PDF }] }
      }
    } },
  })('lib/services/ctt/close-manifest.ts').closeCttManifest
  return { close, db, calls, rows }
}

test('closing pending CTT shipments uses carrier codes and archives confirmation without changing transport status or creating collection events', async () => {
  const h = harness()
  const r = await h.close(TENANT, [A])
  assert.equal(r.success, true)
  assert.equal(r.manifestPdfBase64, PDF)
  assert.deepEqual(h.calls[0].input.shipments, [{ FirstObjectCode: 'DD123456789PT', LastObjectCode: 'DD123456789PT', SubProductCode: 'EMSF056.01' }])
  assert.equal(h.rows[0].status, 'pendente')
  assert.equal(h.rows[0].ops_substatus, 'manifesto_fechado')
  assert.equal(h.rows[0].ctt_delivery_note_id, undefined)
  assert.match(r.manifestReference, /^LINKE-[0-9A-F]{16}$/)
  assert.equal(h.db.writes.some(w => w.table === 'tracking_events'), false)
  assert.ok(h.db.queries.every(q => q.write || q.filters.some(f => f.field === 'tenant_id' && f.value === TENANT)))
  const repeat = await h.close(TENANT, [A])
  assert.equal(repeat.success, false)
  assert.equal(h.calls.length, 1)
})

test('empty, missing, invalid and foreign selections never fall back to closing other pending shipments', async () => {
  for (const ids of [undefined, [], ['invalid-id'], [B], [A, B]]) {
    const h = harness({ rows: [row(), row(B, { tenant_id: FOREIGN })] })
    assert.equal((await h.close(TENANT, ids)).success, false)
    assert.equal(h.calls.length, 0)
    assert.equal(h.db.writes.length, 0)
  }
})

test('non-CTT, draft, cancelled, closed and unissued shipments are rejected without side effects', async () => {
  for (const extra of [{ carrier_code: 'correos_express' }, { status: 'rascunho' }, { status: 'cancelado' },
    { ops_substatus: 'manifesto_fechado' }, { carrier_tracking_number: null }, { ctt_manifest_pdf: PDF }]) {
    const h = harness({ rows: [row(A, extra)] })
    assert.equal((await h.close(TENANT, [A])).success, false)
    assert.equal(h.calls.length, 0)
    assert.equal(h.db.writes.length, 0)
  }
})

test('missing credentials produce an actionable message before calling CTT', async () => {
  const h = harness({ credentials: {} })
  const r = await h.close(TENANT, [A])
  assert.equal(r.success, false)
  assert.match(r.error, /Configuração → Webservices/)
  assert.equal(h.calls.length, 0)
  assert.equal(h.db.writes.length, 0)
})

test('CTT refusal and transport errors never fabricate a manifesto or change shipments', async () => {
  for (const config of [{ response: { Status: 0, ErrorsList: [{ Code: 42, Message: 'Fixture refusal' }] } },
    { response: { Status: 1, ErrorsList: [{ Code: 42 }] } },
    { carrierError: new Error('fixture auth secret and network error') }]) {
    const h = harness(config)
    const r = await h.close(TENANT, [A])
    assert.equal(r.success, false)
    assert.equal(r.manifestPdfBase64, undefined)
    assert.equal(h.db.writes.length, 0)
    assert.equal(h.rows[0].status, 'pendente')
    assert.doesNotMatch(r.error, /fixture auth secret/)
  }
})

test('database lookup failure sends no carrier request', async () => {
  const h = harness({ failure: q => q.table === 'shipments' ? { message: 'fixture database outage' } : null })
  assert.equal((await h.close(TENANT, [A])).success, false)
  assert.equal(h.calls.length, 0)
  assert.equal(h.db.writes.length, 0)
})

test('a client scope cannot close another store, including mixed selections', async () => {
  for (const ids of [[B], [A, B]]) {
    const h = harness({ rows: [row(A, { client_id: 'store-a' }), row(B, { client_id: 'store-b' })] })
    assert.equal((await h.close(TENANT, ids, 'store-a')).success, false)
    assert.equal(h.calls.length, 0)
    assert.equal(h.db.writes.length, 0)
  }
  const h = harness({ rows: [row(A, { client_id: 'store-a' })] })
  assert.equal((await h.close(TENANT, [A], 'store-a')).success, true)
})

test('duplicate carrier tracking codes cannot close an ambiguous batch', async () => {
  const h = harness({ rows: [row(), row(B)] })
  assert.equal((await h.close(TENANT, [A, B])).success, false)
  assert.equal(h.calls.length, 0)
})

test('EQ and DB products use their own CTT product code, without a Para Amanhã default', async () => {
  for (const [tracking, product] of [['EQ123456789PT', 'ENCF008.01'], ['DB123456789PT', 'EMSF057.01']]) {
    const h = harness({ rows: [row(A, { carrier_tracking_number: tracking })] })
    assert.equal((await h.close(TENANT, [A])).success, true)
    assert.equal(h.calls[0].input.shipments[0].SubProductCode, product)
  }
  const h = harness({ rows: [row(A, { carrier_tracking_number: 'ZZ123456789PT' })] })
  assert.equal((await h.close(TENANT, [A])).success, false)
  assert.equal(h.calls.length, 0)
})

test('stored emission metadata retains the real last object for multiple volumes', async () => {
  const metadata = { shipmentId: A, FirstObjectCode: 'DD123456789PT', LastObjectCode: 'DD123456790PT', SubProductCode: 'EMSF056.01' }
  const h = harness({ rows: [row(A, { volumes_count: 2 })], audit: [{ tenant_id: TENANT, action: 'shipment_data',
    details: { id: A, ctt_close_data: metadata } }] })
  assert.equal((await h.close(TENANT, [A])).success, true)
  assert.equal(h.calls[0].input.shipments[0].LastObjectCode, 'DD123456790PT')
  const missing = harness({ rows: [row(A, { volumes_count: 2 })] })
  assert.equal((await missing.close(TENANT, [A])).success, false)
  assert.equal(missing.calls.length, 0)
})

test('all official certificates are returned and archived without inventing a CTT delivery-note number', async () => {
  const docs = [{ FileName: 'economico.pdf', File: PDF }, { FileName: 'amanha.pdf', File: PDF }]
  const h = harness({ response: { Status: 1, DocumentsList: docs } })
  const r = await h.close(TENANT, [A])
  assert.equal(r.success, true)
  assert.deepEqual(r.documents, docs)
  assert.equal(h.rows[0].ctt_delivery_note_id, undefined)
  const archive = h.db.writes.find(w => w.table === 'audit_log')
  assert.deepEqual(archive.value.details.carrier_documents, docs)
})

test('missing carrier PDF is reported without fabricating an official certificate', async () => {
  const h = harness({ response: { Status: 1, DocumentsList: [{ File: 'bm90LXBkZg==' }] } })
  const r = await h.close(TENANT, [A])
  assert.equal(r.success, true)
  assert.equal(r.manifestPdfBase64, '')
  assert.match(r.warning, /não devolveram um PDF válido/)
  assert.equal(h.rows[0].ops_substatus, 'manifesto_fechado')
})

test('archiving failures keep the confirmed carrier result and certificate with a do-not-repeat warning', async () => {
  const h = harness({ failure: q => q.write ? { message: 'fixture archive failure' } : null })
  const r = await h.close(TENANT, [A])
  assert.equal(r.success, true)
  assert.equal(r.manifestPdfBase64, PDF)
  assert.match(r.warning, /não repita/)
  assert.equal(h.calls.length, 1)
  assert.equal(h.rows[0].status, 'pendente')
})

test('CTT credentials use the tenant legacy configuration and cache independently for each company', async () => {
  let tenant = TENANT
  const db = fakeSupabase({ carrier_connections: [], audit_log: [
    { id: 'config-a', tenant_id: TENANT, action: 'carrier_connection_config', created_at: '2026-10-15', details: {
      carrier_code: 'ctt_expresso', client_id: 'client-a', contract_number: 'contract-a', auth_id: 'auth-a', environment: 'qa',
    } },
    { id: 'config-b', tenant_id: FOREIGN, action: 'carrier_connection_config', created_at: '2026-10-16', details: {
      carrier_code: 'ctt_expresso', client_id: 'client-b', contract_number: 'contract-b', auth_id: 'auth-b',
    } },
  ] })
  const resolve = createLoader({ '@/lib/auth/context': { getTenantId: async () => tenant },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
  })('lib/services/carriers/credentials.ts').resolveCttCredentials
  assert.equal((await resolve()).client_number, 'client-a')
  tenant = FOREIGN
  assert.equal((await resolve()).client_number, 'client-b')
  tenant = TENANT
  assert.equal((await resolve()).client_number, 'client-a')
  assert.ok(db.queries.every(q => q.filters.some(f => f.field === 'tenant_id')))
})

test('manifest notification excludes other carriers, companies and already closed pending shipments', async () => {
  const db = fakeSupabase({ shipments: [row(), row(B, { carrier_code: 'correos_express' }),
    row('44444444-4444-4444-4444-444444444444', { tenant_id: FOREIGN }),
    row('55555555-5555-5555-5555-555555555555', { ops_substatus: 'manifesto_fechado' })] })
  const action = createLoader({ '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    '@/lib/auth/context': { requireEmployee: async () => ({ role: 'employee', tenant_id: TENANT }) },
    '@/app/actions/clientes': { getClientesAction: async () => [] },
    '@/app/actions/ctt': { getCarrierConnectionsAction: async () => [] },
  })('app/actions/notifications.ts').getOperationalNotificationsAction
  const batch = (await action()).find(n => n.type === 'batch')
  assert.match(batch.message, /Existem 1 envio/)
})
