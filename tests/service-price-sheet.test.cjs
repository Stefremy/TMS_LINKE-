const test = require('node:test')
const assert = require('node:assert/strict')
const pdf = require('pdf-lib')
const { createLoader } = require('./helpers/load-typescript.cjs')

const model = createLoader({})('lib/services/pricing/service-price-sheet.ts')
const tier = (weight_max, sell_price, extra = {}) => ({ id: `tier-${weight_max}`, weight_max, sell_price, cost_price: 987.65, margin_pct: 777, enabled: true, ...extra })
const zone = (zone_code, tiers = [tier(1, 3.33), tier(5, 4.24), tier(30, 8.81), tier(999, .28)]) => ({ zone_code, zone_name: zone_code, tiers })
const service = (extra = {}) => ({ id: 'table-a', name: 'Linke Expresso (VIP / Alto Volume)', webservice_service_code: 'EMSF056.01',
  preferred_carrier_name: 'CTT Expresso', allowed_zones: ['PT-CONT'], fuel_surcharge_pct: 99, cod_min_fee: 999,
  zones: [zone('PT-CONT')], ...extra })

test('customer projection contains only authorized compatible sale prices and respects disabled tiers and visual order', () => {
  const s = service({ zones: [zone('PT-CONT', [tier(1, 3.33, { display_order: 1 }), tier(5, 4.24, { display_order: 0 }), tier(10, NaN, { enabled: false })]), zone('PT-ILHAS'), zone('NA')] })
  const sheet = model.buildServicePriceSheet(s)
  assert.equal(sheet.serviceName, 'Linke Expresso')
  assert.deepEqual(sheet.zones.map(z => z.name), ['Portugal Continental'])
  assert.deepEqual(sheet.zones[0].rows.map(r => [r.weight, r.price]), [['1 - 5 kg', 4.24], ['Até 1 kg', 3.33]])
  for (const forbidden of ['987.65', '777', 'cost_price', 'fuel_surcharge', 'webservice', 'VIP', 'cod_min_fee']) assert.ok(!JSON.stringify(sheet).includes(forbidden), forbidden)
  assert.equal(model.buildServicePriceSheet(service({ webservice_service_code: 'EMSF010.01', allowed_zones: ['PT-CONT', 'PT-ILHAS'], zones: [zone('PT-CONT'), zone('PT-ILHAS')] })).zones.length, 1)
})

test('additional kilograms retain their per-kg sell price and the configured fractional billing step', () => {
  const rows = model.buildServicePriceSheet(service({ zones: [zone('PT-CONT', [tier(10.5, 25), tier(999, 1.2, { additional_weight_step: .5 })])] })).zones[0].rows
  assert.deepEqual(rows[1], { weight: 'Kg adicional', detail: 'Acima de 10,5 kg; frações de 0,5 kg', price: 1.2, perKg: true })
  assert.equal(model.buildServicePriceSheet(service({ zones: [zone('PT-CONT', [tier(1, 0)])] })).zones[0].rows[0].price, 0)
})

test('empty coverage, invalid configured prices, missing anchors and duplicate destinations never produce a misleading table', () => {
  for (const extra of [{ allowed_zones: [] }, { zones: [] }, { zones: [zone('PT-CONT', [])] },
    ...[undefined, NaN, Infinity, -1, '3.33'].map(price => ({ zones: [zone('PT-CONT', [tier(1, price)])] })),
    { zones: [zone('PT-CONT', [tier(999, .2)])] }, { zones: [zone('PT-CONT'), zone('PT-CONT')] }]) {
    assert.throws(() => model.buildServicePriceSheet(service(extra)), model.ServicePriceSheetError)
  }
  assert.equal(model.servicePriceSheetFilename('Açores / Cliente "\r\n"'), 'linke-tabela-precos-acores-cliente.pdf')
})

function pdfHarness() {
  const draws = []
  const load = createLoader({
    'pdf-lib': { ...pdf, PDFDocument: { create: async () => {
      const doc = await pdf.PDFDocument.create(), add = doc.addPage.bind(doc)
      doc.addPage = (...args) => {
        const page = add(...args), index = doc.getPageCount(), draw = page.drawText.bind(page)
        page.drawText = (text, options) => { draws.push({ text, ...options, page: index }); return draw(text, options) }
        return page
      }
      return doc
    } } },
    'node:fs/promises': require('node:fs/promises'), 'node:path': require('node:path'),
  })
  return { draws, generate: load('lib/services/pricing/service-price-sheet-pdf.ts').generateServicePriceSheetPdf }
}

test('actual PDF groups matching destinations, preserves accents, and prints base prices without any internal amounts', async () => {
  const h = pdfHarness()
  const sheet = model.buildServicePriceSheet(service({ allowed_zones: ['PT-CONT', 'ES-PENIN'], zones: [zone('PT-CONT'), zone('ES-PENIN')] }))
  const bytes = await h.generate(sheet, new Date('2026-11-02T12:00:00Z'))
  const doc = await pdf.PDFDocument.load(bytes)
  assert.equal(doc.getPageCount(), 1)
  const text = h.draws.map(d => d.text).join('\n')
  for (const value of ['Portugal Continental', 'Espanha Peninsular', '3,33 €', '0,28 €/kg', 'Acima de 30 kg', '02/11/2026', 'Não incluem IVA']) assert.ok(text.includes(value), value)
  for (const value of ['987,65', '777', '99%', 'VIP', 'EMSF', '999 kg']) assert.ok(!text.includes(value), value)
})

test('long international price sheets repeat headers and paginate without clipping rows into the footer', async () => {
  const h = pdfHarness()
  const tiers = Array.from({ length: 45 }, (_, i) => tier(i + 1, i + 3.33))
  const bytes = await h.generate(model.buildServicePriceSheet(service({ name: 'Tabela Açores 🚚 ' + 'nomecomprido'.repeat(20), zones: [zone('PT-CONT', tiers)] })))
  const doc = await pdf.PDFDocument.load(bytes)
  assert.ok(doc.getPageCount() > 2)
  assert.equal(h.draws.filter(d => d.text === 'PESO').length, doc.getPageCount())
  assert.equal(h.draws.filter(d => / €$/.test(d.text)).length, 45)
  for (const draw of h.draws) {
    assert.ok(draw.y >= 44 && draw.y < 842, `${draw.text}: ${draw.y}`)
    assert.ok(draw.x >= 43 && draw.x + draw.font.widthOfTextAtSize(draw.text, draw.size) <= 552, draw.text)
    if (/ €$/.test(draw.text)) assert.ok(draw.y >= 146)
  }
})

function routeHarness(ctx, records = [service()], fail = false) {
  let reads = 0, generates = 0
  const load = createLoader({
    '@/lib/auth/context': { getAuthContext: async () => ctx },
    '@/app/actions/servicos-linke': { getServicosLinkeAction: async () => { reads++; if (fail) throw Error('private DB detail'); return records } },
    '@/lib/services/pricing/service-price-sheet-pdf': { generateServicePriceSheetPdf: async sheet => { generates++; return Buffer.from('%PDF-1.7\n' + JSON.stringify(sheet)) } },
  })
  return { get: id => load('app/api/servicos-linke/[id]/pdf/route.ts').GET(new Request('http://localhost/export?price=0.01'), { params: Promise.resolve({ id }) }), reads: () => reads, generates: () => generates }
}
const employee = { user: { id: 'staff' }, role: 'employee', tenant_id: 'tenant-a' }

test('PDF endpoint authenticates before catalogue reads and uses persisted prices with private download headers', async () => {
  for (const ctx of [null, { ...employee, role: 'client' }, { ...employee, role: null }]) {
    const h = routeHarness(ctx)
    assert.equal((await h.get('table-a')).status, 403)
    assert.equal(h.reads(), 0)
    assert.equal(h.generates(), 0)
  }
  for (const role of ['employee', 'admin']) {
    const h = routeHarness({ ...employee, role }), response = await h.get('table-a')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'application/pdf')
    assert.match(response.headers.get('Content-Disposition'), /^attachment; filename="linke-tabela-precos-/)
    assert.match(response.headers.get('Cache-Control'), /private, no-store/)
    assert.match(response.headers.get('Vary'), /Cookie, Authorization/)
    const body = await response.text()
    assert.ok(body.includes('3.33'))
    assert.ok(!body.includes('987.65'))
    assert.ok(!body.includes('0.01'))
  }
})

test('PDF endpoint rejects missing, cross-tenant or unconfigured tables and hides internal failures', async () => {
  for (const id of ['missing', '', 'x'.repeat(161), '\n']) assert.equal((await routeHarness(employee).get(id)).status, 404)
  assert.equal((await routeHarness(employee, [service({ tenant_id: 'tenant-b' })]).get('table-a')).status, 404)
  const h = routeHarness(employee, [service({ allowed_zones: [] })])
  assert.equal((await h.get('table-a')).status, 422)
  assert.equal(h.generates(), 0)
  const response = await routeHarness(employee, [], true).get('table-a')
  assert.equal(response.status, 500)
  assert.ok(!(await response.text()).includes('private DB detail'))
})
