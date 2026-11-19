// Alterações recentes: lista de objetos no certificado CTT, discriminação do preço (painel lateral,
// "Ver Completo", hover no valor s/ IVA), taxa de combustível no snapshot e limpeza da UI.
const test = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
const { PDFDocument, PDFName } = require('pdf-lib')
const { createLoader } = require('./helpers/load-typescript.cjs'), { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const T = '11111111-1111-4111-8111-111111111111', T2 = '99999999-9999-4999-8999-999999999999'
const C = '22222222-2222-4222-8222-222222222222', C2 = '33333333-3333-4333-8333-333333333333'
const S = '44444444-4444-4444-8444-444444444444'

// ───────────── 1. Preço: a taxa de combustível aplicada fica no resultado ─────────────
test('pricing returns the fuel rate used, and base + fuel = price s/ IVA', () => {
  const { calculateShipmentPrice } = createLoader({})('lib/pricing/calculate-shipment-price.ts')
  const tier = (max, price) => ({ id: String(max), label: `Até ${max} kg`, weight_max: max, sell_price: price, cost_price: 1, margin_pct: 20, enabled: true })
  const service = { id: 'svc', name: 'CTT Teste', is_active: true, fuel_surcharge_pct: 13.9, zones: [{ zone_code: 'PT-CONT', zone_name: 'Continente', tiers: [tier(2, 3.62), tier(5, 5)] }] }
  const quote = calculateShipmentPrice(1, { default_linke_table_id: 'svc' }, [service], 'PT', '4800-001', { requireConfiguredTariff: true })
  assert.equal(quote.basePrice, 3.62)
  assert.equal(quote.fuelRatePct, 13.9)
  assert.equal(quote.fuelSurchargeAmount, 0.5)
  assert.equal(quote.sellPrice, 4.12)
})

test('shipment creation stores fuel_rate_pct in the audit snapshot', () => {
  for (const file of ['lib/services/shipments/shipment-creator.ts', 'app/actions/shipments.ts']) {
    assert.match(read(file), /fuel_rate_pct/, `${file} must record the fuel rate`)
  }
})

// ───────────── 2. Ação de discriminação (mesmas linhas e arredondamento do checkout) ─────────────
function chargesAction({ user, shipments, snapshots }) {
  const db = fakeSupabase({
    shipments,
    audit_log: snapshots.map((details, i) => ({ id: `a${i}`, tenant_id: T, action: 'shipment_data', created_at: `2026-11-0${i + 1}`, details })),
  })
  const load = createLoader({
    '@/lib/auth/context': { requireUser: async () => user },
    '@/lib/supabase/server': { createAdminClient: () => db.client || db },
  })
  return { action: load('app/actions/shipment-charges.ts').getShipmentChargeBreakdownAction, db }
}
const client = { tenant_id: T, role: 'client', client_id: C }
const shipment = (extra = {}) => ({ id: S, tenant_id: T, client_id: C, sell_price: 4.12, service_type: 'CTT Expresso', recipient_zip4: '4800', recipient_zip3: '001', ...extra })
const snapshot = (extra = {}) => ({ id: S, client_id: C, sell_price: 4.12, base_price: 3.62, fuel_tax_amount: 0.5, fuel_rate_pct: 13.9, special_fees_amount: 0, ...extra })

test('client sees the checkout split: tabela + combustível, IVA per line, total c/ IVA', async () => {
  const { action } = chargesAction({ user: client, shipments: [shipment()], snapshots: [snapshot()] })
  assert.deepEqual(await action(S), {
    vatPct: 23, basePrice: 3.62, baseVatAmount: 0.83, fuelRatePct: 13.9, fuelSurchargeAmount: 0.5, fuelVatAmount: 0.12,
    specialItems: [], totalPrice: 4.12, vatAmount: 0.95, totalWithVat: 5.07,
  })
})

test('supplements are listed one by one with their own VAT', async () => {
  const fees = JSON.stringify([{ name: 'saturday_delivery', amount: 2 }, { name: 'Seguro', amount: 1.5 }])
  const { action } = chargesAction({
    user: client, shipments: [shipment({ sell_price: 7.62 })],
    snapshots: [snapshot({ sell_price: 7.62, special_fees_amount: 3.5, special_fees_description: fees })],
  })
  const view = await action(S)
  assert.deepEqual(view.specialItems, [{ name: 'saturday_delivery', amount: 2, vatAmount: 0.46 }, { name: 'Seguro', amount: 1.5, vatAmount: 0.35 }])
  assert.equal(view.totalPrice, 7.62)
  assert.equal(view.vatAmount, 1.76) // 0,83 + 0,12 + 0,46 + 0,35
  assert.equal(view.totalWithVat, 9.38)
})

test('Madeira/Açores destinations are 0% VAT', async () => {
  const { action } = chargesAction({ user: client, shipments: [shipment({ recipient_zip4: '9000', recipient_zip3: '050' })], snapshots: [snapshot()] })
  const view = await action(S)
  assert.equal(view.vatPct, 0)
  assert.equal(view.vatAmount, 0)
  assert.equal(view.totalWithVat, 4.12)
})

test('no snapshot, or a price edited after creation, returns null instead of an invented split', async () => {
  assert.equal(await chargesAction({ user: client, shipments: [shipment()], snapshots: [] }).action(S), null)
  assert.equal(await chargesAction({ user: client, shipments: [shipment({ sell_price: 6 })], snapshots: [snapshot()] }).action(S), null)
})

test('clients only see their own shipments; staff see any client in their tenant', async () => {
  const other = { tenant_id: T, role: 'client', client_id: C2 }
  assert.equal(await chargesAction({ user: other, shipments: [shipment()], snapshots: [snapshot()] }).action(S), null)
  const foreignTenant = { tenant_id: T2, role: 'admin' }
  assert.equal(await chargesAction({ user: foreignTenant, shipments: [shipment()], snapshots: [snapshot()] }).action(S), null)
  const staff = { tenant_id: T, role: 'admin' }
  assert.equal((await chargesAction({ user: staff, shipments: [shipment()], snapshots: [snapshot()] }).action(S)).totalWithVat, 5.07)
})

test('invalid shipment ids never reach the database', async () => {
  const { action, db } = chargesAction({ user: client, shipments: [shipment()], snapshots: [snapshot()] })
  for (const id of ['', 'abc', `${S}' or 1=1`, null]) assert.equal(await action(id), null)
  assert.equal((db.queries || []).length, 0)
})

// ───────────── 3. Componentes de UI (render real com React) ─────────────
const view = { vatPct: 23, basePrice: 3.62, baseVatAmount: 0.83, fuelRatePct: 13.9, fuelSurchargeAmount: 0.5, fuelVatAmount: 0.12, specialItems: [], totalPrice: 4.12, vatAmount: 0.95, totalWithVat: 5.07 }
const pass = ({ children }) => React.createElement(React.Fragment, null, children)
const radix = { Provider: pass, Root: pass, Trigger: pass, Portal: pass, Content: pass, Arrow: () => null }
// Renders a component with its state already loaded (the server render does not run effects).
function renderWithState(file, exportName, states, props) {
  const queue = [...states]
  const fakeReact = { ...React, useState: initial => queue.length ? [queue.shift(), () => {}] : React.useState(initial) }
  const mod = createLoader({
    react: fakeReact, 'react/jsx-runtime': require('react/jsx-runtime'),
    'lucide-react': { Loader2: () => null }, '@radix-ui/react-tooltip': radix,
    '@/app/actions/shipment-charges': { getShipmentChargeBreakdownAction: async () => view },
  })(file)
  return renderToStaticMarkup(React.createElement(mod[exportName], props)).replace(/ /g, ' ')
}

test('price hover shows Preço de tabela + Taxa de combustível = Total s/ IVA', () => {
  const html = renderWithState('components/shipments/ShipmentPriceHover.tsx', 'ShipmentPriceHover', [true, view], { shipmentId: S, sellPrice: 4.12, children: '4.12€' })
  assert.match(html, /4\.12€/)
  assert.match(html, /Preço de tabela.*3,62 €/)
  assert.match(html, /Taxa de combustível \(13,9%\).*0,50 €/)
  assert.match(html, /Total s\/ IVA.*4,12 €/)
  assert.match(html, /Com IVA 23%: 5,07 €/)
  assert.match(html, /aria-label="Ver composição do preço"/)
})

test('price hover says when no breakdown exists', () => {
  const html = renderWithState('components/shipments/ShipmentPriceHover.tsx', 'ShipmentPriceHover', [true, null], { shipmentId: S, children: '4.12€' })
  assert.match(html, /Discriminação não disponível/)
  assert.doesNotMatch(html, /Preço de tabela/)
})

test('breakdown panel matches the checkout lines', () => {
  const html = renderWithState('components/shipments/ShipmentChargeBreakdown.tsx', 'ShipmentChargeBreakdown', [{ key: `${S}:4.12`, view }], { shipmentId: S, sellPrice: 4.12 })
  for (const text of ['Transporte base', 'Combustível (13,9%)', 'Suplementos', 'Subtotal (s/ IVA)', 'IVA (23% · PT-CONT)', 'Total (c/ IVA)', '5,07 €', '4,12 €']) {
    assert.ok(html.includes(text), `missing "${text}"`)
  }
})

test('breakdown panel falls back to the stored total s/ IVA', () => {
  const html = renderWithState('components/shipments/ShipmentChargeBreakdown.tsx', 'ShipmentChargeBreakdown', [{ key: `${S}:4,12`, view: null }], { shipmentId: S, sellPrice: '4,12' })
  assert.match(html, /Discriminação não disponível/)
  assert.match(html, /Total \(s\/ IVA\).*4,12 €/)
})

// ───────────── 4. Onde aparece / o que foi removido ─────────────
test('side panel and Ver Completo both use the shared breakdown; fake split and 24h badge are gone', () => {
  const drawer = read('app/ops/envios/components/ShipmentLateralDrawer.tsx')
  const detail = read('app/app/components/ClientShipmentDetailModal.tsx')
  assert.match(drawer, /<ShipmentChargeBreakdown/)
  assert.match(detail, /<ShipmentChargeBreakdown/)
  assert.match(detail, /Preço do Envio/)
  assert.match(detail, /Total Faturado.*\(s\/ IVA\)/s)
  assert.doesNotMatch(drawer, /24h Garantido/)
  assert.doesNotMatch(drawer, /0\.74|0\.19/)
})

test('client lists wrap every price in the hover, except "Aguarda guia"', () => {
  for (const file of ['app/app/components/ClientDashboard.tsx', 'app/app/components/ClientShipmentsHistory.tsx']) {
    const source = read(file)
    const prices = source.match(/(?:shipment|envio)\.sell_price \? [^:]+:/g) || []
    assert.ok(prices.length >= 2, `${file}: expected table and card prices`)
    for (const price of prices) assert.match(price, /<ShipmentPriceHover/, `${file}: ${price}`)
  }
  assert.match(read('app/app/components/ClientShipmentsHistory.tsx'), /"Aguarda guia" : envio\.sell_price \? <ShipmentPriceHover/)
})

test('client app opens the side panel and allows bulk certificate selection', () => {
  const dashboard = read('app/app/components/ClientDashboard.tsx')
  assert.match(dashboard, /<ShipmentLateralDrawer/)
  assert.match(dashboard, /useCttCertificateSelection/)
  assert.match(dashboard, /handleGenerateManifest\(certificateSelection\.selectedIds\)/)
  assert.match(read('app/app/components/ClientShipmentsHistory.tsx'), /<ShipmentLateralDrawer/)
})

test('shipment modal no longer offers "Imprimir certificado de aceitação"', () => {
  assert.doesNotMatch(read('components/shipments/form/steps/ReviewStep.tsx'), /Imprimir certificado/i)
  assert.doesNotMatch(read('components/shipments/form/ShipmentForm.tsx'), /wantsCertificate/)
})

// ───────────── 5. Lista de objetos no certificado de aceitação CTT ─────────────
const { stampCertificateObjectList } = createLoader({ 'pdf-lib': require('pdf-lib') })('lib/services/ctt/certificate-object-list.ts')
async function blankCertificate() {
  const pdf = await PDFDocument.create()
  pdf.addPage([595.28, 841.89])
  return Buffer.from(await pdf.save()).toString('base64')
}
const rows = n => Array.from({ length: n }, (_, i) => ({ objectCode: `EQ${String(427056653 + i)}PT`, guia: `LNK-${i}`, recipient: 'João Conceição', destination: '4800-001 Guimarães', volumes: 2, weightKg: 1.5 }))
const pages = async base64 => (await PDFDocument.load(Buffer.from(base64, 'base64'))).getPageCount()

test('object list is stamped on the certificate page', async () => {
  const original = await blankCertificate()
  const stamped = await stampCertificateObjectList(original, rows(4))
  assert.notEqual(stamped, original)
  assert.equal(await pages(stamped), 1)
  const page = (await PDFDocument.load(Buffer.from(stamped, 'base64'))).getPage(0)
  // Helvetica + Helvetica-Bold were added to the page to draw the table.
  const fonts = page.node.Resources().lookup(PDFName.of('Font'))
  const baseFonts = fonts.entries().map(([, ref]) => page.doc.context.lookup(ref).get(PDFName.of('BaseFont')).asString())
  assert.deepEqual([...new Set(baseFonts)].sort(), ['/Helvetica', '/Helvetica-Bold'])
})

test('27 objects fit on page 1; more continue on extra pages', async () => {
  const original = await blankCertificate()
  assert.equal(await pages(await stampCertificateObjectList(original, rows(27))), 1)
  assert.equal(await pages(await stampCertificateObjectList(original, rows(28))), 2)
  assert.equal(await pages(await stampCertificateObjectList(original, rows(120))), 3)
})

test('names outside Latin-1 do not break the certificate', async () => {
  const original = await blankCertificate()
  const stamped = await stampCertificateObjectList(original, [{ objectCode: 'EQ1PT', recipient: '王小明 ✓ Zoë', destination: 'Kraków — ŁÓDŹ' }])
  assert.notEqual(stamped, original)
  assert.equal(await pages(stamped), 1)
})

test('no objects or an unreadable PDF returns the CTT original untouched', async () => {
  const original = await blankCertificate()
  assert.equal(await stampCertificateObjectList(original, []), original)
  assert.equal(await stampCertificateObjectList('bm90IGEgcGRm', rows(2)), 'bm90IGEgcGRm')
  assert.equal(await stampCertificateObjectList('', rows(2)), '')
})
