const test = require('node:test'), assert = require('node:assert/strict')
const { XMLParser } = require('fast-xml-parser')
const { createLoader } = require('./helpers/load-typescript.cjs'), { fakeSupabase } = require('./helpers/fake-supabase.cjs')

// End-to-end chain with no network: server action -> certificate lookup -> close -> real SOAP client -> archive -> reopen.
const T = '11111111-1111-1111-1111-111111111111', C = '22222222-2222-2222-2222-222222222222'
const S1 = '33333333-3333-3333-3333-333333333333', S2 = '44444444-4444-4444-4444-444444444444'
const NS = 'http://schemas.datacontract.org/2004/07/CTTExpressoWS'
const PDF = Buffer.from('%PDF-1.4\nREAL CTT CERTIFICATE').toString('base64')
const PDF2 = Buffer.from('%PDF-1.5\nSECOND PRODUCT CERTIFICATE').toString('base64')
const docs = files => `<a:DocumentsList>${files.map(([name, file]) => `<a:DocumentData><a:File>${file}</a:File><a:FileName>${name}</a:FileName></a:DocumentData>`).join('')}</a:DocumentsList>`
const success = (files = [['CertAceitResumo.pdf', PDF]]) => ({ body: `<a:Status>Success</a:Status>${docs(files)}` })
const failure = (code, message) => ({ body: `<a:Status>Failure</a:Status><a:ErrorsList><a:ErrorData><a:Code>${code}</a:Code><a:Message>${message}</a:Message></a:ErrorData></a:ErrorsList>` })
const ship = (id, tracking, extra = {}) => ({ id, tenant_id: T, client_id: C, status: 'pendente', carrier_code: 'ctt', carrier_tracking_number: tracking, tracking_number: 'LTK' + tracking.slice(2, 8), service_type: 'Linke Expresso#', ops_substatus: null, ...extra })
const emission = (id, first, product, last = first) => ({ tenant_id: T, action: 'shipment_data', created_at: '2026-11-12T16:00:00Z',
  details: { id, ctt_documents: [], ctt_close_data: { shipmentId: id, connectionId: 'ctt_expresso', FirstObjectCode: first, LastObjectCode: last, SubProductCode: product } } })

function chain({ shipments, audit, reply = () => success() }) {
  const tables = { shipments, audit_log: audit }, db = fakeSupabase(tables, undefined, { persistInserts: true }), sent = []
  const transport = { request(options, callback) {
    const parts = []
    return { on() { return this }, destroy() {}, write(part) { parts.push(part) }, end() {
      sent.push(parts.join(''))
      const result = reply(sent.length, sent.at(-1)), handlers = {}
      callback({ statusCode: result.status || 200, setEncoding() {}, on(event, handler) { handlers[event] = handler } })
      queueMicrotask(() => {
        handlers.data(result.raw || `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><CloseShipmentResponse xmlns="http://tempuri.org/"><CloseShipmentResult xmlns:a="${NS}">${result.body}</CloseShipmentResult></CloseShipmentResponse></s:Body></s:Envelope>`)
        handlers.end()
      })
    } }
  } }
  const actions = createLoader({ http: transport, https: transport, 'fast-xml-parser': { XMLParser }, 'next/cache': { revalidatePath() {} },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    '@/lib/services/carriers/credentials': { resolveCttCredentials: async () => ({ auth_id: '55555555-5555-5555-5555-555555555555', client_number: '100032458', contract_number: '300330941', environment: 'production' }) },
    '@/lib/auth/context': { requireUser: async () => ({ tenant_id: T, role: 'employee', client_id: null }) },
  })('app/actions/shipment-manifests.ts')
  return { sent, tables, generate: actions.generateCttAcceptanceCertificateAction, download: actions.downloadCttAcceptanceCertificateAction,
    row: id => tables.shipments.find(s => s.id === id), archives: () => tables.audit_log.filter(a => a.action === 'manifest_closed') }
}
const one = (extra = {}) => chain({ shipments: [ship(S1, 'EQ423706000PT')], audit: [emission(S1, 'EQ423706000PT', 'ENCF008.01')], ...extra })

test('generate once: CTT is called once with the stored object and product, the original PDF is archived and the row is marked closed', async () => {
  const h = one(), r = await h.generate([S1])
  assert.equal(r.success, true); assert.equal(r.manifestPdfBase64, PDF); assert.equal(h.sent.length, 1)
  assert.match(h.sent[0], /<ws:FirstObjectCode>EQ423706000PT<\/ws:FirstObjectCode>/); assert.match(h.sent[0], /<ws:SubProductCode>ENCF008\.01<\/ws:SubProductCode>/)
  assert.match(h.sent[0], /<ws:ClientId>100032458<\/ws:ClientId>/); assert.match(h.sent[0], /<ws:ContractId>300330941<\/ws:ContractId>/)
  assert.equal(h.row(S1).ops_substatus, 'manifesto_fechado'); assert.equal(h.row(S1).status, 'pendente')
  assert.equal(h.archives().length, 1); assert.equal(h.archives()[0].details.carrier_documents[0].File, PDF)
})

test('after closing, every later click and the saved-copy download return the same PDF without contacting CTT again', async () => {
  const h = one(); await h.generate([S1])
  for (const call of [() => h.generate([S1]), () => h.download(S1), () => h.generate([S1]), () => h.download(S1)]) {
    const r = await call(); assert.equal(r.success, true); assert.equal(r.manifestPdfBase64, PDF)
  }
  assert.equal(h.sent.length, 1); assert.equal(h.archives().length, 1)
})

test('"not found or already closed" shows the real CTT reply, saves nothing and does not mark the shipment closed', async () => {
  const h = one({ reply: () => failure(7, 'Shipment of object number EQ423706000PT not found or already closed.') }), r = await h.generate([S1])
  assert.equal(r.success, false); assert.equal(r.manifestPdfBase64, undefined)
  assert.match(r.error, /Não foi obtido um certificado oficial/); assert.match(r.error, /Resposta CTT/); assert.match(r.error, /already closed/)
  assert.equal(h.archives().length, 0); assert.equal(h.row(S1).ops_substatus, null)
  assert.equal((await h.generate([S1])).success, false); assert.equal(h.sent.length, 2, 'a refused close can be retried because nothing was recorded')
})

test('SOAP faults, HTTP errors and garbage replies never mark a shipment closed or fabricate a PDF', async () => {
  for (const reply of [
    () => ({ status: 500, raw: '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><s:Fault><faultcode>s:Server</faultcode><faultstring>boom</faultstring></s:Fault></s:Body></s:Envelope>' }),
    () => ({ status: 503, raw: 'Service Unavailable' }), () => ({ raw: 'not xml at all' }), () => ({ raw: '' }),
  ]) {
    const h = one({ reply }), r = await h.generate([S1])
    assert.equal(r.success, false); assert.equal(r.manifestPdfBase64, undefined)
    assert.equal(h.archives().length, 0); assert.equal(h.row(S1).ops_substatus, null)
  }
})

test('success without a valid PDF is closed once, reports it, and a retry never closes again', async () => {
  for (const files of [[], [['CertAceitResumo.pdf', 'AAAA']], [['CertAceitResumo.pdf', '']]]) {
    const h = one({ reply: () => success(files) }), r = await h.generate([S1])
    assert.equal(r.success, true); assert.ok(!r.manifestPdfBase64); assert.match(r.warning, /não repita o fecho/)
    assert.equal(h.row(S1).ops_substatus, 'manifesto_fechado')
    const retry = await h.generate([S1]); assert.equal(retry.success, false); assert.match(retry.error, /não repita o fecho|Não repita o fecho/)
    assert.equal(h.sent.length, 1)
  }
})

test('every CTT product sends its own code and object range', async () => {
  const cases = [['DD123456789PT', 'EMSF056.01'], ['DB123456789PT', 'EMSF057.01'], ['EQ123456789PT', 'ENCF008.01'], ['EE123456789PT', 'EMSF001.02'], ['CE123456789PT', 'ENCF008.02']]
  for (const [tracking, product] of cases) {
    const h = chain({ shipments: [ship(S1, tracking)], audit: [emission(S1, tracking, product)] }); await h.generate([S1])
    assert.match(h.sent[0], new RegExp(`<ws:FirstObjectCode>${tracking}</ws:FirstObjectCode>\\s*<ws:LastObjectCode>${tracking}</ws:LastObjectCode>\\s*<ws:SubProductCode>${product.replace('.', '\\.')}</ws:SubProductCode>`))
  }
  const multi = chain({ shipments: [ship(S1, 'EQ423706001PT')], audit: [emission(S1, 'EQ423706001PT', 'EMSF010.01', 'EQ423706003PT')] }); await multi.generate([S1])
  assert.match(multi.sent[0], /<ws:FirstObjectCode>EQ423706001PT<\/ws:FirstObjectCode>\s*<ws:LastObjectCode>EQ423706003PT<\/ws:LastObjectCode>/)
})

test('a batch of two products returns both certificates, archives both and reopens either shipment with both', async () => {
  const h = chain({ shipments: [ship(S1, 'EQ423706000PT'), ship(S2, 'DD423706000PT')], audit: [emission(S1, 'EQ423706000PT', 'ENCF008.01'), emission(S2, 'DD423706000PT', 'EMSF056.01')],
    reply: () => success([['Economico.pdf', PDF], ['Amanha.pdf', PDF2]]) })
  const r = await h.generate([S1, S2])
  assert.equal(r.success, true); assert.deepEqual(r.documents.map(d => d.File), [PDF, PDF2]); assert.equal(h.sent.length, 1)
  assert.match(h.sent[0], /EQ423706000PT[\s\S]*DD423706000PT/)
  for (const id of [S1, S2]) { assert.equal(h.row(id).ops_substatus, 'manifesto_fechado'); const d = await h.download(id); assert.deepEqual(d.documents.map(x => x.File), [PDF, PDF2]) }
  assert.equal(h.sent.length, 1)
})

test('shipments closed one by one keep separate certificates and never leak into each other', async () => {
  const h = chain({ shipments: [ship(S1, 'EQ423706000PT'), ship(S2, 'EQ423706001PT')], audit: [emission(S1, 'EQ423706000PT', 'ENCF008.01'), emission(S2, 'EQ423706001PT', 'ENCF008.01')],
    reply: n => success([[`cert${n}.pdf`, n === 1 ? PDF : PDF2]]) })
  assert.equal((await h.generate([S1])).manifestPdfBase64, PDF); assert.equal((await h.generate([S2])).manifestPdfBase64, PDF2)
  assert.equal((await h.download(S1)).manifestPdfBase64, PDF); assert.equal((await h.download(S2)).manifestPdfBase64, PDF2)
  assert.equal(h.sent.length, 2)
})

test('download never closes: an open shipment has no saved copy and CTT is not contacted', async () => {
  const h = one(), r = await h.download(S1)
  assert.equal(r.success, false); assert.equal(h.sent.length, 0); assert.equal(h.row(S1).ops_substatus, null)
})

test('shipments already closed on the CTT portal cannot be closed again from the TMS', async () => {
  const h = one(); h.row(S1).ops_substatus = 'manifesto_fechado'
  const r = await h.generate([S1]); assert.equal(r.success, false); assert.equal(h.sent.length, 0)
})

test('Correos, drafts, cancelled and unknown shipments are rejected before CTT is contacted', async () => {
  for (const extra of [{ carrier_code: 'correos' }, { status: 'rascunho' }, { status: 'cancelado' }]) {
    const h = chain({ shipments: [ship(S1, 'EQ423706000PT', extra)], audit: [emission(S1, 'EQ423706000PT', 'ENCF008.01')] })
    assert.equal((await h.generate([S1])).success, false); assert.equal(h.sent.length, 0)
  }
  const h = one(); assert.equal((await h.generate([S2])).success, false); assert.equal((await h.generate([])).success, false); assert.equal(h.sent.length, 0)
})

// ── Draft emission feeds the certificate: dispatch -> saved close data -> close ──────────────────────────────────
const officialPdf = Buffer.from('%PDF-1.4\nCarrier label').toString('base64')
function dispatchHarness(result) {
  const id = S1, calls = []
  const tables = { shipments: [{ id, tenant_id: T, client_id: C, status: 'rascunho', tracking_number: 'LTK-FIXTURE', service_type: 'Linke Económico' }],
    audit_log: [{ tenant_id: T, action: 'shipment_data', created_at: '2020-01-01', details: { id, tenant_id: T, client_id: C, weight_kg: 1.5, package_count: 2, length_cm: 30, width_cm: 20, height_cm: 10,
      webservice_service_code: 'EMSF010.01', webservice_connection_id: 'ctt_expresso', sender_name: 'S', sender_address: 'Rua 1', sender_zip4: '4000', sender_zip3: '001', sender_city: 'Porto', sender_phone: '+351910000001',
      recipient_name: 'R', recipient_address: 'Rua 2', recipient_postal: '4800-019', recipient_country: 'PT', recipient_city: 'Guimarães', recipient_phone: '+351910000002' } }], packages: [] }
  const db = fakeSupabase(tables, undefined, { persistInserts: true })
  const api = createLoader({ 'next/cache': {}, '@/lib/auth/context': { requireEmployee: async () => ({ role: 'employee', tenant_id: T, client_id: null }) },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() }, '@/lib/services/carriers/credentials': { resolveCttCredentials: async () => ({}) },
    '@/lib/services/carriers/ctt-provider': { CttProvider: class { async initialize() {} async createShipment(input) { calls.push(input); return result } } },
    '@/lib/label-utils': { convertZplToPdfBase64: async value => value }, '@/lib/billing/wallet': {} })('lib/services/shipments/shipment-creator.ts')
  return { calls, tables, dispatch: () => api.dispatchShipment(id) }
}
const emitted = (extra = {}) => ({ success: true, trackingNumber: 'EQ423706001PT', labelBase64: officialPdf,
  rawResponse: { ShipmentData: [{ FirstObject: 'EQ423706001PT', LastObject: 'EQ423706002PT', DocumentsList: [] }] }, ...extra })

test('draft emission never auto-closes at CTT and saves what is needed to close later', async () => {
  const h = dispatchHarness(emitted()); const r = await h.dispatch()
  assert.equal(r.success, true); assert.equal(h.calls[0].autoClose, false)
  const saved = h.tables.audit_log.at(-1).details
  assert.deepEqual(saved.ctt_close_data, { shipmentId: S1, connectionId: 'ctt_expresso', FirstObjectCode: 'EQ423706001PT', LastObjectCode: 'EQ423706002PT', SubProductCode: 'EMSF010.01' })
  assert.deepEqual(saved.ctt_documents, [])
})

test('draft emission without a raw CTT response still succeeds and stores no invented close data', async () => {
  const h = dispatchHarness({ success: true, trackingNumber: 'EQ423706001PT', labelBase64: officialPdf }); const r = await h.dispatch()
  assert.equal(r.success, true); assert.equal(h.tables.audit_log.at(-1).details.ctt_close_data, null)
})

test('dispatch then certificate: a draft emitted from the TMS can be closed and reprinted without the "already closed" error', async () => {
  const d = dispatchHarness(emitted()); await d.dispatch()
  const h = chain({ shipments: d.tables.shipments, audit: d.tables.audit_log })
  const r = await h.generate([S1]); assert.equal(r.success, true); assert.equal(r.manifestPdfBase64, PDF)
  assert.match(h.sent[0], /<ws:FirstObjectCode>EQ423706001PT<\/ws:FirstObjectCode>\s*<ws:LastObjectCode>EQ423706002PT<\/ws:LastObjectCode>\s*<ws:SubProductCode>EMSF010\.01/)
  assert.equal((await h.download(S1)).manifestPdfBase64, PDF); assert.equal(h.sent.length, 1)
})
