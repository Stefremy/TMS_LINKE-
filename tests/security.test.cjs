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
  ['app/api/period-statements/[id]/pdf/route.ts', 'period_statement'],
]
function documentRow(action, owner = CLIENT, tenant = TENANT) {
  return { id: UUID, tenant_id: tenant, action, created_at: '2026-10-13', details: {
    id: 'internal-id', statement_number: 'EXT-2026/10-1234', invoice_number: 'FT 2026/1234',
    client_id: owner, client_name: 'Fixture', total_value: 10, shipments: [],
    client_snapshot: { name: 'Fixture' }, period_start: '2026-10-01', period_end: '2026-10-08', created_at: '2026-10-08',
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
      for (const id of [UUID, 'internal-id', action !== 'custom_invoice' ? 'ext-2026/10-1234' : 'ft 2026/1234']) {
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
function shipmentHarness({ carrier = 'CTT', adjust = () => {}, failure, ctx = clientContext, carrierResult, carrierError, savedLabel=null } = {}) {
  const tables = {
    clients: [{ id: CLIENT, tenant_id: TENANT, name: 'Fixture' }],
    audit_log: [{ tenant_id: TENANT, action: 'client_data', details: { id: CLIENT, short_name: 'Fixture', billing_type: 'conta_corrente' } }],
    servicos_linke: [service(carrier)], clientes: [], shipments: [],
  }
  adjust(tables)
  const db = fakeSupabase(tables, failure)
  const providerCalls = [], credentials = []
  const load = createLoader({
    '@/lib/auth/context': { requireUser: async () => ctx, getTenantId: async () => ctx.tenant_id,
      requireEmployee:async()=>{if(ctx.role==='client')throw Error('STAFF_REQUIRED');return ctx} },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    'next/cache': { revalidatePath() {} },
    '@/app/actions/fornecedores': {}, '@/app/actions/ctt': {},
    '@/lib/services/ctt/ctt-types': {},
    '@/lib/services/carriers/ctt-provider': { CttProvider: class {
      async initialize() {}
      async createShipment(payload) {
        providerCalls.push({ carrier: 'CTT', payload })
        if(carrierError)throw Error(carrierError)
        if(carrierResult)return carrierResult
        return { success: true, trackingNumber: 'DD123456789PT', rawResponse: {
          Status: 1, ShipmentData: [{ FirstObject: 'DD123456789PT', LastObject: 'DD123456790PT' }],
        } }
      }
    } },
    '@/lib/services/correos/correos-shipment.service': { CorreosShipmentService: class {
      async createShipment(creds, payload) { providerCalls.push({ carrier: 'Correos', payload }); return { codigoRetorno: 0, datosResultado: '1234567890123456' } }
    } },
    '@/lib/services/carriers/credentials': {
      resolveCttCredentials: async id => { credentials.push(id); return {} },
      resolveCorreosCredentials: async id => { credentials.push(id); return {} },
    },
    '@/lib/label-utils': {convertZplToPdfBase64:async value=>value}, '@/lib/services/correos/correos-label-customizer': {},
    '@/lib/services/shipments/shipment-utils': {}, '@/lib/services/shipments/shipment-fetcher': {fetchShipmentLabel:async()=>savedLabel},
    '@/lib/services/tracking': {}, '@/lib/services/shipments/shipment-creator': {},
    '@/lib/services/shipments/shipment-deleter': {},
  })
  return { db, load, providerCalls, credentials, tables }
}
function shipmentInput(extra = {}) {
  return { clientId: OTHER, serviceId: 'service-a', serviceName: 'forged service name',
    recipientName: 'Fixture', recipientAddress: 'Fixture street', recipientCountry: 'PT', recipientPostal: '4000-001',
    weightKg: 1, volumesCount: 1, lengthCm: 30.5, widthCm: 20, heightCm: 10, calculatedPrice: 0.01, subProductId: 'forged-code', webserviceConnectionId: 'forged-connection', ...extra }
}
test('requesting an existing CTT label never creates another carrier shipment or changes tracking',async()=>{
 for(const savedLabel of [null,'JVBERi0xLjQK']){
  const h=shipmentHarness({ctx:{...clientContext,role:'employee'},savedLabel})
  const result=await h.load('app/actions/shipments.ts').regenerateCttLabelAction(UUID)
  assert.equal(result.success,Boolean(savedLabel));assert.equal(result.labelBase64,savedLabel||undefined)
  assert.equal(h.providerCalls.length,0);assert.equal(h.credentials.length,0);assert.equal(h.db.writes.length,0)
 }
})
test('carrier-provided CE PDF documents are returned and saved at shipment creation',async()=>{
 const pdf=Buffer.from('%PDF-1.4\nFixture').toString('base64')
 const documents=[{FileName:'CE000000001PT.pdf',File:pdf}]
 const h=shipmentHarness({carrierResult:{success:true,trackingNumber:'CE000000001PT',rawResponse:{Status:1,ShipmentData:[{
  FirstObject:'CE000000001PT',LastObject:'CE000000001PT',LabelList:[],DocumentsList:documents,
 }]} }})
 // A PDF requires no ZPL conversion or external service.
 const api=h.load('app/actions/shipments.ts')
 const result=await api.emitClientGuiaAction(shipmentInput())
 assert.equal(result.success,true,result.error)
 assert.equal(result.labelBase64,pdf)
 const saved=h.db.writes.find(w=>w.table==='audit_log'&&w.value.action==='shipment_data').value.details
 assert.deepEqual(saved.ctt_documents,documents);assert.equal(saved.ctt_label_base64,pdf)
 assert.equal(saved.carrier_tracking_number,'CE000000001PT')
})
function withDimensions(form) {
  form.set('length_cm', '30.5'); form.set('width_cm', '20'); form.set('height_cm', '10')
  return form
}
async function emit(h, extra) { return h.load('app/actions/shipments.ts').emitClientGuiaAction(shipmentInput(extra)) }

test('CTT client and OPS emissions keep the selected Spanish destination through the provider and stored details', async () => {
  for (const ctx of [clientContext, { ...clientContext, role: 'employee' }]) {
    const h = shipmentHarness({ ctx, adjust: t => {
      t.servicos_linke[0].allowed_zones = ['ES-PENIN']
      t.servicos_linke[0].zones[0].zone_code = 'ES-PENIN'
    } })
    const result = await emit(h, { clientId: CLIENT, recipientCountry: 'ES', recipientPostal: '28013',
      recipientCity: 'Madrid', recipientPhone: '+34 612 345 678',
      cttExportDetails: { exportType: 'Permanent', contentType: 'Goods', declaredValue: 25.5 } })
    assert.equal(result.success, true)
    assert.equal(h.providerCalls[0].payload.recipient.country, 'ES')
    assert.equal(h.providerCalls[0].payload.recipient.zip, '28013')
    assert.equal(h.providerCalls[0].payload.recipient.phone, '+34 612 345 678')
    const saved = h.db.writes.find(w => w.table === 'audit_log' && w.value.action === 'shipment_data').value.details
    assert.equal(saved.recipient_country, 'ES')
    assert.equal(saved.recipient_city, 'Madrid')
    assert.deepEqual(saved.ctt_export_details, { exportType: 'Permanent', contentType: 'Goods', declaredValue: 25.5 })
    assert.deepEqual(h.providerCalls[0].payload.cttExportDetails, saved.ctt_export_details)
  }
})

test('CE Finland shipments reach the carrier and preserve the validated road tariff in native and audit storage',async()=>{
  const {buildOfficialCeTruckZones}=createLoader({})('lib/services/geo/international-zones.ts')
  for(const role of ['client','employee','admin']){
    for(const auditOnly of [false,true]){
      const h=shipmentHarness({ctx:{...clientContext,role},failure:auditOnly?q=>q.table==='servicos_linke'?{code:'PGRST205'}:null:undefined,
        adjust:t=>{
          const s=t.servicos_linke[0]
          s.webservice_service_code='ENCF008.02';s.allowed_zones=['Zona 2','Zona 3'];s.zones=buildOfficialCeTruckZones()
          if(auditOnly)t.audit_log.push({tenant_id:TENANT,action:'servicos_linke_data',details:s})
        }})
      const result=await emit(h,{clientId:CLIENT,recipientCountry:'FI',recipientPostal:'00100',recipientCity:'Helsínquia',
        cttExportDetails:{exportType:'Permanent',contentType:'Goods',declaredValue:25}})
      assert.equal(result.success,true,result.error)
      assert.equal(h.providerCalls.length,1)
      assert.equal(h.providerCalls[0].payload.recipient.country,'FI')
      assert.equal(h.providerCalls[0].payload.recipient.zip,'00100')
      const saved=h.db.writes.find(w=>w.table==='audit_log'&&w.value.action==='shipment_data').value.details
      assert.equal(saved.recipient_country,'FI')
      assert.equal(saved.weight_pricing_basis.service.zones[0].zone_code,'Zona 3')
      assert.equal(saved.weight_pricing_basis.service.webservice_service_code,'ENCF008.02')
      assert.equal(saved.weight_pricing_basis.service.webservice_connection_id,undefined)
      assert.equal(result.sellPrice,17.92)
    }
  }
})

test('Correos client and OPS emissions preserve the chosen country and postal code',async()=>{
  for(const role of ['client','employee']){
    for(const [country,postal,zone] of [['ES','28013','ES-PENIN'],['FR','75001','EU 1'],['US','10001','NA']]){
      const h=shipmentHarness({carrier:'Correos',ctx:{...clientContext,role},adjust:t=>{
        t.servicos_linke[0].allowed_zones=[zone]
        t.servicos_linke[0].zones[0].zone_code=zone
      }})
      const result=await emit(h,{clientId:CLIENT,recipientCountry:country,recipientPostal:postal})
      assert.equal(result.success,true)
      const destination=h.providerCalls[0].payload.destinatario
      assert.equal(destination.paisISO,country)
      assert.equal(destination.cpInternacional,postal)
      assert.equal(destination.cpNacional,country==='ES'?postal:'')
      const saved=h.db.writes.find(w=>w.table==='audit_log'&&w.value.action==='shipment_data').value.details
      assert.equal(saved.recipient_country,country)
    }
  }
})

test('Spanish postcodes with Portuguese masks are rejected before wallet reservation or carrier submission', async () => {
  const h = shipmentHarness({ adjust: t => {
    t.servicos_linke[0].allowed_zones = ['ES-PENIN']
    t.servicos_linke[0].zones[0].zone_code = 'ES-PENIN'
  } })
  const result = await emit(h, { recipientCountry: 'ES', recipientPostal: '2801-003' })
  assert.equal(result.success, false); assert.match(result.error, /5 dígitos/)
  assert.equal(h.providerCalls.length, 0); assert.equal(h.db.writes.length, 0)
})

test('missing or invalid CTT international declarations stop before reserving money or requesting a label', async () => {
  for (const details of [undefined, {}, { exportType: '1', contentType: 'Goods', declaredValue: 10 },
    { exportType: 'Permanent', contentType: 'Goods', declaredValue: NaN },
    { exportType: 'Permanent', contentType: 'Goods', declaredValue: -1 }]) {
    const h = shipmentHarness({ adjust: t => {
      t.servicos_linke[0].allowed_zones = ['ES-PENIN']; t.servicos_linke[0].zones[0].zone_code = 'ES-PENIN'
      t.audit_log[0].details.billing_type = 'pay_as_you_go'
    } })
    const result = await emit(h, { recipientCountry: 'ES', recipientPostal: '28013', cttExportDetails: details })
    assert.equal(result.success, false); assert.match(result.error, /exportação|conteúdo|declarado/)
    assert.equal(h.providerCalls.length, 0); assert.equal(h.db.writes.length, 0)
  }
})

test('a confirmed CTT validation rejection is reported as validation rather than a connection error', async () => {
  const message = 'O tipo de exportação é obrigatório., O tipo de produto é obrigatório.'
  const h = shipmentHarness({ carrierResult: { success: false, confirmedRejection: true, error: message } })
  const result = await emit(h)
  assert.equal(result.success, false); assert.equal(result.error, message)
  assert.equal(h.providerCalls.length, 1); assert.equal(h.db.writes.length, 0)
})

for (const role of ['client', 'employee', 'admin']) {
  test(`${role}: missing or invalid C/L/A is rejected before reserving funds or contacting a carrier`, async () => {
    for (const field of ['lengthCm', 'widthCm', 'heightCm']) {
      for (const value of [undefined, null, 0, -1, 0.05, NaN, Infinity, '20']) {
        const h = shipmentHarness({ ctx: { ...clientContext, role } })
        const result = await emit(h, { clientId: CLIENT, [field]: value })
        assert.equal(result.success, false, `${field}=${value}`)
        assert.match(result.error, /Dimensões obrigatórias/)
        assert.equal(h.providerCalls.length, 0)
        assert.equal(h.credentials.length, 0)
        assert.equal(h.db.writes.length, 0)
      }
    }
  })
}

for (const carrier of ['CTT', 'Correos']) {
  test(`${carrier}: validated decimal dimensions are saved in the native packages JSONB schema and the full snapshot`, async () => {
    const h = shipmentHarness({ carrier })
    const result = await emit(h)
    assert.equal(result.success, true)
    const row = h.db.writes.find(w => w.table === 'packages').value
    assert.deepEqual(row.dimensions, { length_cm: 30.5, width_cm: 20, height_cm: 10, unit: 'cm' })
    assert.equal(row.weight_g, 1000)
    assert.equal(row.tenant_id, TENANT)
    const snapshot = h.db.writes.find(w => w.table === 'audit_log' && w.value.action === 'shipment_data').value.details
    assert.equal(snapshot.length_cm, 30.5)
    assert.equal(snapshot.width_cm, 20)
    assert.equal(snapshot.height_cm, 10)
    assert.equal(row.shipment_id, snapshot.id)
  })
}

test('draft FormData cannot omit any dimension and retains valid decimal dimensions', async () => {
  for (const field of ['length_cm', 'width_cm', 'height_cm']) {
    const h = shipmentHarness(), form = withDimensions(new FormData())
    form.set('weight_kg', '1'); form.set('service_id', 'service-a'); form.delete(field)
    const result = await h.load('lib/services/shipments/shipment-creator.ts').createShipment(form)
    assert.equal(result.success, false)
    assert.match(result.error, /Dimensões obrigatórias/)
    assert.equal(h.db.writes.length, 0)
  }
  const h = shipmentHarness(), form = withDimensions(new FormData())
  form.set('weight_kg', '2.5'); form.set('service_id', 'service-a')
  assert.equal((await h.load('lib/services/shipments/shipment-creator.ts').createShipment(form)).success, true)
  assert.deepEqual(h.db.writes.find(w => w.table === 'packages').value.dimensions,
    { length_cm: 30.5, width_cm: 20, height_cm: 10, unit: 'cm' })
  assert.equal(h.db.writes.find(w => w.table === 'packages').value.weight_g, 2500)
  const native = h.db.writes.find(w => w.table === 'shipments').value
  for (const unsupported of ['length_cm', 'width_cm', 'height_cm', 'weight_kg', 'base_price', 'tier_label']) {
    assert.equal(Object.hasOwn(native, unsupported), false)
  }
})

test('a failed parcel write after carrier acceptance reports a warning instead of asking for a duplicate emission', async () => {
  const h = shipmentHarness({ failure: q => q.table === 'packages' && q.write ? { message: 'Fixture package write failure' } : null })
  const result = await emit(h)
  assert.equal(result.success, true)
  assert.match(result.dbWarning, /aceite pela transportadora/)
  assert.equal(h.providerCalls.length, 1)
  assert.equal(h.db.writes.find(w => w.table === 'audit_log' && w.value.action === 'shipment_data').value.details.length_cm, 30.5)
})

test('the withdrawn point/Locky table stays out of persisted and legacy catalogs for every role', async () => {
  for (const role of ['client', 'employee', 'admin']) {
    for (const fallback of [false, true]) {
      const h = shipmentHarness({ ctx: { ...clientContext, role },
        failure: fallback ? q => q.table === 'servicos_linke' ? { code: '42P01' } : null : undefined,
        adjust: t => {
          const point = { ...service(), id: 'point-uuid', code: 'LK-PONTO', name: 'Renamed pickup table' }
          t.servicos_linke.push(point)
          t.audit_log.push({ tenant_id: TENANT, action: 'servicos_linke_data', details: point })
          t.audit_log.push({ tenant_id: TENANT, action: 'servicos_linke_data',
            details: { ...point, id: 'srv_linke_ponto_ctt', code: 'RENAMED' } })
        },
      })
      const result = await h.load('app/actions/servicos-linke.ts').getServicosLinkeAction()
      assert.ok(result.length > 0)
      assert.ok(result.every(s => s.id !== 'srv_linke_ponto_ctt' && s.code !== 'LK-PONTO'))
      assert.ok(result.some(s => s.id === (fallback ? 'srv_linke_dd_std' : 'service-a')))
      assert.equal(h.db.writes.length, 0)
    }
  }
})

test('withdrawn tables cannot emit labels or create drafts even from stale client or staff requests', async () => {
  for (const role of ['client', 'employee', 'admin']) {
    for (const target of [{ id: 'srv_linke_ponto_ctt', code: 'RENAMED' }, { id: 'point-uuid', code: 'LK-PONTO' }]) {
      const h = shipmentHarness({ ctx: { ...clientContext, role }, adjust: t => {
        const point = { ...service(), ...target }
        t.servicos_linke.push(point)
        t.audit_log[0].details.default_linke_table_id = target.id
        t.audit_log[0].details.assigned_linke_service_ids = [target.id]
      } })
      const result = await emit(h, { clientId: CLIENT, serviceId: target.id })
      assert.equal(result.success, false)
      const form = withDimensions(new FormData())
      form.set('client_id', CLIENT)
      form.set('weight_kg', '1')
      form.set('service_id', target.id)
      assert.equal((await h.load('lib/services/shipments/shipment-creator.ts').createShipment(form)).success, false)
      assert.equal(h.providerCalls.length, 0)
      assert.equal(h.credentials.length, 0)
      assert.equal(h.db.writes.length, 0)
    }
  }
})

for (const carrier of ['CTT', 'Correos']) {
  test(`${carrier}: no assigned tables denies emission and drafts even with a saved default or forged browser assignments`, async () => {
    const h = shipmentHarness({ carrier, adjust: t => {
      t.audit_log[0].details.assigned_linke_service_ids = []
      t.audit_log[0].details.default_linke_table_id = 'service-a'
    } })
    const result = await emit(h, { assigned_linke_service_ids: ['service-a'] })
    assert.equal(result.success, false)
    assert.match(result.error, /não autorizado/)
    const form = withDimensions(new FormData())
    form.set('weight_kg', '1')
    form.set('service_id', 'service-a')
    form.set('assigned_linke_service_ids', '["service-a"]')
    assert.equal((await h.load('lib/services/shipments/shipment-creator.ts').createShipment(form)).success, false)
    assert.equal(h.providerCalls.length, 0)
    assert.equal(h.credentials.length, 0)
    assert.equal(h.db.writes.length, 0)
  })
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
    const form = withDimensions(new FormData())
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
  const form = withDimensions(new FormData())
  form.set('weight_kg', '1')
  form.set('service_id', 'service-a')
  const result = await h.load('lib/services/shipments/shipment-creator.ts').createShipment(form)
  assert.equal(result.success, true)
  assert.equal(h.db.writes.find(w => w.table === 'shipments').value.sell_price, 9)
  assert.equal(h.providerCalls.length, 0)
})


test('CTT emission preserves authoritative product, connection and object range for later manifest closing', async () => {
  const h = shipmentHarness()
  assert.equal((await emit(h)).success, true)
  const saved = h.db.writes.find(w => w.table === 'audit_log').value.details
  assert.deepEqual(saved.ctt_close_data, {
    shipmentId: saved.id,
    connectionId: 'verified-connection',
    FirstObjectCode: 'DD123456789PT',
    LastObjectCode: 'DD123456790PT',
    SubProductCode: 'EMSF056.01',
  })
})

function setCustomPrices(tables, prices) {
  tables.audit_log[0].details.custom_tier_overrides = { 'service-a': prices }
}
function fixtureQuote(h, input = {}) {
  const data = shipmentInput(input)
  return h.load('lib/pricing/calculate-shipment-quote.ts').calculateShipmentQuote(
    data.weightKg, h.tables.audit_log[0].details, h.tables.servicos_linke[0],
    data.recipientCountry, data.recipientPostal, data.selectedSpecialServices, data.codValue)
}

for (const carrier of ['CTT', 'Correos']) {
  test(`${carrier}: client estimates work with costs redacted and match authoritative totals`, () => {
    const h = shipmentHarness({ carrier, adjust: t => setCustomPrices(t, [6]) })
    const client = h.tables.audit_log[0].details
    const original = h.tables.servicos_linke[0]
    const publicService = { ...original, zones: original.zones.map(z => ({ ...z,
      tiers: z.tiers.map(t => ({ ...t, cost_price: undefined, margin_pct: undefined })),
    })) }
    const codes = carrier === 'CTT' ? ['cod', 'fragil'] : ['correos_cod', 'correos_saturday']
    const authoritative = fixtureQuote(h, { selectedSpecialServices: codes, codValue: 100 })
    assert.throws(() => h.load('lib/pricing/calculate-shipment-quote.ts').calculateShipmentQuote(
      1, client, publicService, 'PT', '4800-019', codes, 100), /Tarifa inválida/)
    const before = JSON.stringify(publicService)
    const preview = h.load('lib/pricing/calculate-client-shipment-preview.ts').calculateClientShipmentPreview(
      1, client, publicService, 'PT', '4800-019', codes, 100)
    for (const key of ['basePrice', 'fuelSurchargeAmount', 'specialFeesAmount', 'specialItems', 'totalPrice']) {
      assert.deepEqual(preview[key], authoritative[key])
    }
    assert.ok(!('buyPrice' in preview))
    assert.equal(JSON.stringify(publicService), before)
  })
}

test('client estimates do not invent Spain tariffs from a Portuguese price zone', () => {
  const h = shipmentHarness()
  const service = { ...h.tables.servicos_linke[0], allowed_zones: ['ES-PENIN'] }
  const preview = h.load('lib/pricing/calculate-client-shipment-preview.ts').calculateClientShipmentPreview
  assert.throws(() => preview(1, {}, service, 'ES', '28013'), /Tarifa não configurada/)
  const spanish = { ...service, zones: service.zones.map(z => ({ ...z, zone_code: 'ES-PENIN' })) }
  assert.ok(preview(1, {}, spanish, 'ES', '28013').totalPrice > 0)
  assert.throws(() => preview(1, {}, spanish, 'PT', '4800-019'), /Serviço indisponível/)
  const highest = Math.max(...spanish.zones[0].tiers.map(t => t.weight_max))
  assert.throws(() => preview(highest + 1, {}, spanish, 'ES', '28013'), /Tarifa não configurada/)
  const invalid = { ...spanish, zones: spanish.zones.map(z => ({ ...z, tiers: z.tiers.map(t => ({ ...t, sell_price: 0 })) })) }
  assert.throws(() => preview(1, {}, invalid, 'ES', '28013'), /Tarifa inválida/)
})

for (const carrier of ['CTT', 'Correos']) {
  test(`${carrier}: persisted custom prices match the preview, returned total and recorded breakdown without discount`, async () => {
    const h = shipmentHarness({ carrier, adjust: t => {
      setCustomPrices(t, [6])
      t.audit_log[0].details.pricing = { discount_pct: 50 }
      t.audit_log.push({ tenant_id: OTHER, action: 'client_data', details: {
        id: CLIENT, custom_tier_overrides: { 'service-a': [1] },
      } })
      t.audit_log.push({ tenant_id: TENANT, action: 'client_data', details: {
        id: OTHER, custom_tier_overrides: { 'service-a': [2] },
      } })
    } })
    const input = { selectedSpecialServices: carrier === 'CTT' ? ['cod', 'fragil'] : ['correos_cod', 'correos_saturday'], codValue: 100,
      custom_tier_overrides: { 'service-a': [0.01] }, calculatedPrice: 0.01 }
    const preview = fixtureQuote(h, input)
    assert.equal(preview.basePrice, 6)
    assert.equal(preview.fuelSurchargeAmount, 0.75)
    assert.equal(preview.buyPrice, 3)
    assert.equal(preview.totalPrice, carrier === 'CTT' ? 10.25 : 17.25)
    const result = await emit(h, input)
    assert.equal(result.success, true)
    assert.equal(result.sellPrice, preview.totalPrice)
    const stored = h.db.writes.find(w => w.table === 'shipments').value
    const audit = h.db.writes.find(w => w.table === 'audit_log').value.details
    assert.equal(stored.sell_price, preview.totalPrice)
    assert.equal(stored.buy_price, preview.buyPrice)
    assert.equal(audit.base_price, preview.basePrice)
    assert.equal(audit.fuel_tax_amount, preview.fuelSurchargeAmount)
    assert.equal(audit.special_fees_amount, preview.specialFeesAmount)
    assert.deepEqual(JSON.parse(audit.special_fees_description), preview.specialItems)
    assert.equal(h.tables.servicos_linke[0].zones[0].tiers[0].sell_price, 8)
  })
  test(`${carrier}: invalid negotiated prices stop every provider call and database write`, async () => {
    for (const prices of [[0], [-1], [NaN], [Infinity], ['6'], [null], [Number.MAX_VALUE], null, 6, { 0: 6 }]) {
      const h = shipmentHarness({ carrier, adjust: t => setCustomPrices(t, prices) })
      assert.throws(() => fixtureQuote(h), /personalizado|Tarifa/)
      const result = await emit(h)
      assert.equal(result.success, false)
      assert.equal(h.providerCalls.length, 0)
      assert.equal(h.credentials.length, 0)
      assert.equal(h.db.writes.length, 0)
    }
  })
  test(`${carrier}: sorting and disabled tiers preserve saved override indexes`, async () => {
    const h = shipmentHarness({ carrier, adjust: t => {
      const tier = t.servicos_linke[0].zones[0].tiers[0]
      t.servicos_linke[0].zones[0].tiers = [tier,
        { ...tier, weight_max: 0.5, enabled: false, sell_price: 2 },
        { ...tier, weight_max: 1, sell_price: 4, cost_price: 1 }]
      setCustomPrices(t, [6, 0, 3])
    } })
    const preview = fixtureQuote(h)
    assert.equal(preview.basePrice, 3)
    assert.equal(preview.buyPrice, 1)
    const result = await emit(h)
    assert.equal(result.success, true)
    assert.equal(result.sellPrice, 3.38)
    assert.equal(h.db.writes.find(w => w.table === 'shipments').value.sell_price, preview.totalPrice)
  })
  test(`${carrier}: mainland customized prices cannot overwrite Spain or island tariffs`, async () => {
    for (const [country, postal, zone] of [['ES', '28001', 'ES-PENIN'], ['PT', '9500-001', 'PT-ILHAS']]) {
      const h = shipmentHarness({ carrier, adjust: t => {
        const srv = t.servicos_linke[0]
        srv.allowed_zones.push(zone)
        srv.zones.push({ zone_code: zone, zone_name: zone, tiers: [{ ...srv.zones[0].tiers[0], sell_price: 20 }] })
        setCustomPrices(t, [6])
      } })
      const input = { recipientCountry: country, recipientPostal: postal,
        cttExportDetails: country === 'ES' ? { exportType: 'Permanent', contentType: 'Goods', declaredValue: 25.5 } : undefined }
      const preview = fixtureQuote(h, input)
      assert.equal(preview.basePrice, 20)
      assert.equal(preview.totalPrice, 22.5)
      assert.equal((await emit(h, input)).sellPrice, preview.totalPrice)
    }
  })
}

test('additional kilograms use the configured anchor, rounded increments and negotiated per-kg price', async () => {
  for (const [weight, basePrice, buyPrice, totalPrice] of [[30, 9, 8, 10.13], [30.01, 9.4, 8.2, 10.58], [31.2, 9.8, 8.4, 11.03]]) {
    const h = shipmentHarness({ adjust: t => {
      const tier = t.servicos_linke[0].zones[0].tiers[0]
      t.servicos_linke[0].zones[0].tiers = [
        { ...tier, weight_max: 30, sell_price: 10, cost_price: 8 },
        { ...tier, weight_max: 999, sell_price: 0.5, cost_price: 0.2, label: 'Kg adicional' },
      ]
      setCustomPrices(t, [9, 0.4])
    } })
    const preview = fixtureQuote(h, { weightKg: weight })
    assert.equal(preview.basePrice, basePrice)
    assert.equal(preview.buyPrice, buyPrice)
    assert.equal(preview.totalPrice, totalPrice)
    const publicService = { ...h.tables.servicos_linke[0], zones: h.tables.servicos_linke[0].zones.map(z => ({ ...z,
      tiers: z.tiers.map(t => ({ ...t, cost_price: undefined, margin_pct: undefined })),
    })) }
    const publicPreview = h.load('lib/pricing/calculate-client-shipment-preview.ts').calculateClientShipmentPreview(
      weight, h.tables.audit_log[0].details, publicService, 'PT', '4800-019')
    assert.equal(publicPreview.basePrice, basePrice)
    assert.equal(publicPreview.totalPrice, totalPrice)
    const result = await emit(h, { weightKg: weight })
    assert.equal(result.success, true)
    assert.equal(result.sellPrice, preview.totalPrice)
    assert.equal(h.db.writes.find(w => w.table === 'shipments').value.buy_price, buyPrice)
  }
})

test('international extra kilograms preserve half-kg increments in generated and existing official tables', () => {
  const load = createLoader({})
  const { buildOfficialLinkeInternationalZones } = load('lib/services/geo/international-zones.ts')
  const { calculateShipmentQuote } = load('lib/pricing/calculate-shipment-quote.ts')
  const srv = { ...service(), zones: buildOfficialLinkeInternationalZones(0), allowed_zones: ['EU 1'], fuel_surcharge_pct: 0 }
  const zone = srv.zones[0]
  const anchor = zone.tiers.find(t => t.weight_max === 10.5)
  const extra = zone.tiers.find(t => t.weight_max === 999)
  for (const legacy of [false, true]) {
    if (legacy) delete extra.additional_weight_step
    for (const [weight, extraKg] of [[10.5, 0], [10.51, 0.5], [11, 0.5], [11.01, 1]]) {
      const result = calculateShipmentQuote(weight, {}, srv, 'FR', '')
      assert.equal(result.basePrice, Number((anchor.sell_price + extraKg * extra.sell_price).toFixed(2)))
      assert.equal(result.buyPrice, result.basePrice)
    }
  }
})

test('missing additional-kg anchor and uncovered weights fail before dispatch', async () => {
  for (const weight of [6, 1000]) {
    const h = shipmentHarness({ adjust: t => { t.servicos_linke[0].zones[0].tiers[0].weight_max = 999 } })
    assert.equal((await emit(h, { weightKg: weight })).success, false)
    assert.equal(h.providerCalls.length, 0)
    assert.equal(h.db.writes.length, 0)
  }
})

test('draft creation honors persisted negotiated tariffs rather than submitted amounts', async () => {
  const h = shipmentHarness({ adjust: t => setCustomPrices(t, [6]) })
  const form = withDimensions(new FormData())
  form.set('weight_kg', '1')
  form.set('service_id', 'service-a')
  form.set('sell_price', '0.01')
  form.set('client_id', OTHER)
  const result = await h.load('lib/services/shipments/shipment-creator.ts').createShipment(form)
  assert.equal(result.success, true)
  const stored = h.db.writes.find(w => w.table === 'shipments').value
  assert.equal(stored.sell_price, 6.75)
  assert.equal(stored.client_id, CLIENT)
  assert.equal(stored.buy_price, 3)
  assert.equal(h.providerCalls.length, 0)
})

test('preview percentage supplements use the same COD base, transport base and cent rounding as emission', async () => {
  const h = shipmentHarness({ carrier: 'Correos', adjust: t => {
    setCustomPrices(t, [6])
    t.audit_log[0].details.pricing = { discount_pct: 80, special_services_fees: [
      { special_service_code: 'correos_cod', special_service_name: 'COD', fee_type: 'percentage', percentage_value: 2, min_value: 1.8, is_enabled: true },
      { special_service_code: 'correos_insurance', special_service_name: 'Seguro', fee_type: 'percentage', percentage_value: 10, min_value: 0.1, is_enabled: true },
    ] }
  } })
  const input = { selectedSpecialServices: ['correos_cod', 'correos_insurance'], codValue: 150.3 }
  const preview = fixtureQuote(h, input)
  assert.deepEqual(preview.specialItems, [{ name: 'COD', amount: 3.01 }, { name: 'Seguro', amount: 0.68 }])
  assert.equal(preview.totalPrice, 10.44)
  assert.equal((await emit(h, input)).sellPrice, preview.totalPrice)
})


function walletShipmentHarness(options={}) {
 return shipmentHarness({...options,adjust:t=>{
  t.audit_log[0].details.billing_type='pay_as_you_go';t.audit_log[0].details.credit_limit=20
  t.audit_log[0].details.default_linke_table_id='service-a'
 }})
}
test('wallet carrier emission: confirmed rejection releases the reservation',async()=>{
 const h=walletShipmentHarness({carrierResult:{success:false,confirmedRejection:true,error:'Fixture rejected'}})
 assert.equal((await emit(h)).success,false);assert.equal(h.providerCalls.length,1)
 assert.equal(h.tables.wallet_reservations[0].state,'released')
})
test('wallet carrier emission: a transport timeout retains submitted credit for reconciliation',async()=>{
 const h=walletShipmentHarness({carrierError:'Fixture timeout'})
 const result=await emit(h)
 assert.equal(result.success,false);assert.match(result.error,/saldo permanece reservado/)
 assert.equal(h.tables.wallet_reservations[0].state,'submitted')
})
test('wallet carrier emission: no carrier request is made without a successful reservation',async()=>{
 const h=walletShipmentHarness();h.db.client.rpc=async()=>({error:{message:'Fixture unavailable'},data:null})
 assert.equal((await emit(h)).success,false);assert.equal(h.providerCalls.length,0)
})
test('wallet carrier emission: confirmed acceptance keeps a recoverable result even if shipment inserts fail',async()=>{
 const h=walletShipmentHarness({failure:q=>q.write?.kind==='insert'&&['shipments','audit_log'].includes(q.table)?{message:'Fixture write failure'}:null})
 const result=await emit(h)
 assert.equal(h.providerCalls.length,1);assert.equal(h.tables.wallet_reservations[0].state,'consumed')
 assert.equal(h.tables.wallet_reservations[0].result.carrier_tracking_number,'DD123456789PT')
 assert.equal(h.tables.wallet_reservations[0].result.shipment.sell_price,9)
 assert.ok(result.dbWarning)
})

for (const carrier of ['CTT','Correos']) {
 test(`${carrier}: an active account-credit reservation keeps the shipment invoiced, never prepaid`,async()=>{
  const h=shipmentHarness({carrier,adjust:t=>Object.assign(t.audit_log[0].details,{billing_type:'conta_corrente',credit_limit_enabled:true,credit_limit:10})})
  const moves=[]
  h.db.client.rpc=async(name,p)=>{
   if(name==='reserve_current_account_credit')return {data:{reserved:true,balance:10},error:null}
   assert.equal(name,'transition_credit_limit_reservation');moves.push([p.p_from,p.p_to]);return {data:true,error:null}
  }
  const result=await emit(h)
  assert.equal(result.success,true);assert.equal(h.providerCalls.length,1)
  assert.ok(moves.some(([,to])=>to==='consumed'))
  assert.equal(h.db.writes.find(w=>w.table==='audit_log' && w.value?.action==='shipment_data').value.details.billing_type,'conta_corrente')
 })
 test(`${carrier}: insufficient account credit stops before contacting the carrier`,async()=>{
  const h=shipmentHarness({carrier,adjust:t=>Object.assign(t.audit_log[0].details,{billing_type:'conta_corrente',credit_limit_enabled:true,credit_limit:0})})
  h.db.client.rpc=async name=>{assert.equal(name,'reserve_current_account_credit');return {data:{refused:true,balance:0},error:null}}
  const result=await emit(h)
  assert.equal(result.success,false);assert.match(result.error,/Limite de crédito atingido/)
  assert.equal(h.providerCalls.length,0)
 })
}
