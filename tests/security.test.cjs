const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const TENANT = '11111111-1111-1111-1111-111111111111'
const CLIENT = '22222222-2222-2222-2222-222222222222'
const OTHER = '33333333-3333-3333-3333-333333333333'
const UUID = '44444444-4444-4444-4444-444444444444'
const clientContext = { user: { id: 'user-a' }, role: 'client', tenant_id: TENANT, client_id: CLIENT, permissions: [] }
const financeContext = { ...clientContext, role: 'employee', client_id: null, permissions: ['Faturação & Contas Correntes'] }
const routes = [
  ['app/api/statements/[id]/pdf/route.ts', 'billing_statement'],
  ['app/api/statements/[id]/proforma-pdf/route.ts', 'billing_statement'],
  ['app/api/statements/[id]/moloni-pdf/route.ts', 'billing_statement'],
  ['app/api/custom-invoices/[id]/pdf/route.ts', 'custom_invoice'],
]
function documentRow(action, owner = CLIENT, tenant = TENANT) {
  return { id: UUID, tenant_id: tenant, action, created_at: '2026-10-13', details: {
    id: 'internal-id', statement_number: 'EXT-2026/10-1234', invoice_number: 'FT 2026/1234',
    client_id: owner, client_name: 'Fixture', total_value: 10, shipments: [],
    moloni_document_pdf: 'https://fixture.invalid/invoice.pdf',
  } }
}
function pdfHarness(ctx, rows, failure) {
  const db = fakeSupabase({ audit_log: rows, shipments: [] }, failure)
  let pdfCalls = 0, fetchCalls = 0
  const pdf = async () => { pdfCalls++; return new Uint8Array([37, 80, 68, 70]) }
  const load = createLoader({
    '@/lib/auth/context': { getAuthContext: async () => ctx },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    '@/app/actions/clientes': { getClientesAction: async () => [] },
    '@/app/actions/moloni': { getMoloniConfigAction: async () => ({ isConnected: false }) },
    '@/lib/moloni/moloni-client': { MoloniClient: class {} },
    '@/lib/services/billing/statement-pdf': { generateStatementPdfBuffer: pdf },
    '@/lib/services/billing/proforma-pdf': { generateProFormaPdfBuffer: pdf },
    '@/lib/services/billing/custom-invoice-pdf': { generateCustomInvoicePdfBuffer: pdf },
    fetch: async () => { fetchCalls++; return new Response(await pdf()) },
  })
  return { db, load, get pdfCalls() { return pdfCalls }, get fetchCalls() { return fetchCalls } }
}
function request() { return { nextUrl: new URL('http://localhost/document?inline=1') } }

for (const [file, action] of routes) {
  test(`${file}: anonymous and unprivileged staff cannot read or render documents`, async () => {
    for (const ctx of [null, { ...clientContext, role: 'employee' }, { ...clientContext, client_id: null }]) {
      const h = pdfHarness(ctx, [documentRow(action)])
      const response = await h.load(file).GET(request(), { params: Promise.resolve({ id: UUID }) })
      assert.equal(response.status, 404)
      assert.equal(await response.text(), 'Documento não encontrado')
      assert.match(response.headers.get('Cache-Control'), /private, no-store/)
      assert.equal(h.db.adminClients, 0)
      assert.equal(h.pdfCalls + h.fetchCalls, 0)
    }
  })
  test(`${file}: another client's or tenant's document is inaccessible`, async () => {
    for (const row of [documentRow(action, OTHER), documentRow(action, CLIENT, OTHER)]) {
      const h = pdfHarness(clientContext, [row])
      const response = await h.load(file).GET(request(), { params: Promise.resolve({ id: UUID }) })
      assert.equal(response.status, 404)
      assert.equal(h.pdfCalls + h.fetchCalls, 0)
      for (const q of h.db.queries) {
        assert.ok(q.filters.some(f => f.field === 'tenant_id' && f.value === TENANT))
        assert.ok(q.filters.some(f => f.field === 'details->>client_id' && f.value === CLIENT))
        assert.equal(q.limit, 1)
      }
    }
  })
  test(`${file}: owner, financial staff and admin can retrieve private PDFs`, async () => {
    for (const ctx of [clientContext, financeContext, { ...financeContext, role: 'admin', permissions: [] }]) {
      for (const id of [UUID, 'internal-id', action === 'billing_statement' ? 'ext-2026/10-1234' : 'ft 2026/1234']) {
        const h = pdfHarness(ctx, [documentRow(action)])
        const response = await h.load(file).GET(request(), { params: Promise.resolve({ id }) })
        assert.equal(response.status, 200)
        assert.equal(response.headers.get('Content-Type'), 'application/pdf')
        assert.match(response.headers.get('Cache-Control'), /private, no-store/)
        assert.equal(response.headers.get('Vary'), 'Cookie, Authorization')
        assert.equal((await response.arrayBuffer()).byteLength, 4)
      }
    }
  })
  test(`${file}: missing IDs, wildcards and database failures fail safely`, async () => {
    for (const id of ['', '\n', 'x'.repeat(161), 'unknown', '%', '_', 'internal-id,tenant_id.eq.other']) {
      const h = pdfHarness(clientContext, [documentRow(action)])
      const response = await h.load(file).GET(request(), { params: Promise.resolve({ id }) })
      assert.equal(response.status, 404)
      assert.equal(h.pdfCalls + h.fetchCalls, 0)
    }
    const h = pdfHarness(clientContext, [documentRow(action)], () => ({ message: 'private database detail' }))
    const response = await h.load(file).GET(request(), { params: Promise.resolve({ id: UUID }) })
    assert.equal(response.status, 500)
    assert.doesNotMatch(await response.text(), /private database detail/)
    assert.match(response.headers.get('Cache-Control'), /no-store/)
  })
}

function service(carrier = 'CTT') {
  return { id: 'service-a', tenant_id: TENANT, name: `${carrier} Expresso 24H`, is_active: true,
    pricing_profile: 'Standard / Geral', allowed_zones: ['PT-CONT'], fuel_surcharge_pct: 12.5,
    webservice_service_code: carrier === 'CTT' ? 'EMSF056.01' : '63', webservice_connection_id: 'verified-connection',
    zones: [{ zone_code: 'PT-CONT', zone_name: 'Portugal', tiers: [
      { weight_max: 5, cost_price: 3, sell_price: 8, margin_pct: 20, enabled: true, label: '5kg' },
    ] }],
  }
}
function shipmentHarness({ carrier = 'CTT', adjust = () => {}, failure, ctx = clientContext } = {}) {
  const tables = {
    clients: [{ id: CLIENT, tenant_id: TENANT, name: 'Fixture' }],
    audit_log: [{ tenant_id: TENANT, action: 'client_data', details: { id: CLIENT, short_name: 'Fixture', billing_type: 'conta_corrente' } }],
    servicos_linke: [service(carrier)], clientes: [], shipments: [],
  }
  adjust(tables)
  const db = fakeSupabase(tables, failure)
  const providerCalls = [], credentials = []
  const load = createLoader({
    '@/lib/auth/context': { requireUser: async () => ctx, getTenantId: async () => ctx.tenant_id },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    'next/cache': { revalidatePath() {} },
    '@/lib/services/ctt/ctt-types': {},
    '@/lib/services/carriers/ctt-provider': { CttProvider: class {
      async initialize() {}
      async createShipment(payload) { providerCalls.push({ carrier: 'CTT', payload }); return { success: true, trackingNumber: 'DB123456789PT' } }
    } },
    '@/lib/services/correos/correos-shipment.service': { CorreosShipmentService: class {
      async createShipment(creds, payload) { providerCalls.push({ carrier: 'Correos', payload }); return { codigoRetorno: 0, datosResultado: '1234567890123456' } }
    } },
    '@/lib/services/carriers/credentials': {
      resolveCttCredentials: async id => { credentials.push(id); return {} },
      resolveCorreosCredentials: async id => { credentials.push(id); return {} },
    },
    '@/lib/label-utils': {}, '@/lib/services/correos/correos-label-customizer': {},
    '@/lib/services/shipments/shipment-utils': {}, '@/lib/services/shipments/shipment-fetcher': {},
    '@/lib/services/tracking': {}, '@/lib/services/shipments/shipment-creator': {},
    '@/lib/services/shipments/shipment-deleter': {},
  })
  return { db, load, providerCalls, credentials }
}
function shipmentInput(extra = {}) {
  return { clientId: OTHER, serviceId: 'service-a', serviceName: 'forged service name',
    recipientName: 'Fixture', recipientAddress: 'Fixture street', recipientCountry: 'PT', recipientPostal: '4000-001',
    weightKg: 1, volumesCount: 1, calculatedPrice: 0.01, subProductId: 'forged-code', webserviceConnectionId: 'forged-connection', ...extra }
}
async function emit(h, extra) { return h.load('app/actions/shipments.ts').emitClientGuiaAction(shipmentInput(extra)) }

for (const carrier of ['CTT', 'Correos']) {
  test(`${carrier}: submitted prices cannot determine the stored price or carrier configuration`, async () => {
    for (const calculatedPrice of [0, -10, 0.01, 1e12, NaN, Infinity]) {
      const h = shipmentHarness({ carrier })
      const result = await emit(h, { calculatedPrice })
      assert.equal(result.success, true)
      assert.equal(h.providerCalls.length, 1)
      assert.equal(h.providerCalls[0].carrier, carrier)
      assert.deepEqual(h.credentials, ['verified-connection'])
      const stored = h.db.writes.find(w => w.table === 'shipments').value
      assert.equal(stored.sell_price, 9)
      assert.equal(stored.client_id, CLIENT)
      assert.equal(stored.service_type, `${carrier} Expresso 24H`)
      assert.equal(h.providerCalls[0].payload[carrier === 'CTT' ? 'subProduct' : 'producto'], carrier === 'CTT' ? 'EMSF056.01' : '63')
    }
  })
  test(`${carrier}: pricing failures prevent provider calls and every database mutation`, async () => {
    const cases = [
      { input: { recipientCountry: 'ES' } },
      { input: { serviceId: 'missing' } },
      { input: { weightKg: 0 } }, { input: { weightKg: -1 } }, { input: { weightKg: NaN } },
      { input: { weightKg: 6 } }, { input: { heightCm: -1 } }, { input: { lengthCm: Infinity } },
      { input: { volumesCount: 1.5 } }, { input: { codValue: -1 } },
      { input: { codValue: Number.MAX_VALUE } },
      { input: { selectedSpecialServices: [carrier === 'CTT' ? 'correos_cod' : 'cod'], codValue: 100 } },
      { input: { selectedSpecialServices: ['unknown'] } },
      { input: { selectedSpecialServices: ['fragil', 'fragil'] } },
      { input: { selectedSpecialServices: [carrier === 'CTT' ? 'cod' : 'correos_cod'], codValue: 0 } },
      { adjust: t => { t.servicos_linke[0].zones = [] } },
      { adjust: t => { t.servicos_linke[0].zones[0].tiers[0].enabled = false } },
      { adjust: t => { t.servicos_linke[0].zones[0].tiers[0].sell_price = NaN } },
      { adjust: t => { t.servicos_linke[0].is_active = false } },
      { adjust: t => { delete t.servicos_linke[0].webservice_service_code } },
      { adjust: t => { t.servicos_linke[0].client_id = OTHER } },
      { adjust: t => { t.servicos_linke[0].tenant_id = OTHER } },
      { adjust: t => { t.clients[0].tenant_id = OTHER } },
      { adjust: t => { t.audit_log[0].details.assigned_linke_service_ids = ['other-service'] } },
      { failure: q => q.table === 'clients' ? { message: 'private connection details' } : null },
      { failure: q => q.table === 'servicos_linke' ? { code: '08006', message: 'private connection details' } : null },
      { failure: q => q.table === 'audit_log' ? { message: 'private connection details' } : null },
    ]
    for (const c of cases) {
      const h = shipmentHarness({ carrier, ...c })
      const result = await emit(h, c.input)
      assert.equal(result.success, false, JSON.stringify(c.input))
      assert.doesNotMatch(result.error, /private connection details/)
      assert.equal(h.providerCalls.length, 0)
      assert.equal(h.credentials.length, 0)
      assert.equal(h.db.writes.length, 0)
    }
  })
  test(`${carrier}: configured special services and COD retain their existing charges`, async () => {
    const h = shipmentHarness({ carrier })
    const result = await emit(h, { selectedSpecialServices: carrier === 'CTT' ? ['cod', 'fragil'] : ['correos_cod', 'correos_saturday'], codValue: 100 })
    assert.equal(result.success, true)
    const stored = h.db.writes.find(w => w.table === 'shipments').value
    assert.equal(stored.sell_price, carrier === 'CTT' ? 12.5 : 19.5)
    const audit = h.db.writes.find(w => w.table === 'audit_log').value.details
    assert.equal(audit.fuel_tax_amount, 1)
    assert.equal(audit.base_price, 8)
    assert.equal(audit.special_fees_amount, carrier === 'CTT' ? 3.5 : 10.5)
  })
}

test('legacy service storage: only missing schema may use scoped audit pricing', async () => {
  const h = shipmentHarness({
    adjust: t => { t.audit_log.push({ tenant_id: TENANT, action: 'servicos_linke_data', details: service() }) },
    failure: q => q.table === 'servicos_linke' ? { code: '42P01' } : null,
  })
  assert.equal((await emit(h)).success, true)
  for (const q of h.db.queries.filter(q => ['clients', 'audit_log', 'servicos_linke'].includes(q.table) && !q.write)) {
    assert.ok(q.filters.some(f => f.field === 'tenant_id' && f.value === TENANT))
  }
})

test('carrier routing uses persisted configuration when the service has a generic name', async () => {
  const h = shipmentHarness({ adjust: t => {
    t.servicos_linke[0].name = 'Linke Standard'
    t.servicos_linke[0].preferred_carrier_name = 'Correos Express'
    t.servicos_linke[0].webservice_service_code = '63'
  } })
  assert.equal((await emit(h)).success, true)
  assert.equal(h.providerCalls[0].carrier, 'Correos')
  assert.equal(h.db.writes.find(w => w.table === 'shipments').value.carrier_code, 'correos')
})

test('legacy FormData creation: tariff failures produce no shipment, package or audit writes', async () => {
  for (const options of [{}, { failure: () => ({ message: 'database unavailable' }) }]) {
    const h = shipmentHarness(options)
    const form = new FormData()
    form.set('weight_kg', options.failure ? '1' : '0')
    form.set('service_id', 'service-a')
    const result = await h.load('lib/services/shipments/shipment-creator.ts').createShipment(form)
    assert.equal(result.success, false)
    assert.equal(h.db.writes.length, 0)
    assert.equal(h.providerCalls.length, 0)
  }
})

test('legacy FormData creation: valid configured tariff still creates a draft', async () => {
  const h = shipmentHarness()
  const form = new FormData()
  form.set('weight_kg', '1')
  form.set('service_id', 'service-a')
  const result = await h.load('lib/services/shipments/shipment-creator.ts').createShipment(form)
  assert.equal(result.success, true)
  assert.equal(h.db.writes.find(w => w.table === 'shipments').value.sell_price, 9)
  assert.equal(h.providerCalls.length, 0)
})
