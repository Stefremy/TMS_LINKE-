const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const load = createLoader({})
const { buildShipmentInvoiceLines: lines, shipmentChargeBreakdown: split } = load('lib/billing/shipment-invoice-lines.ts')
const { hydrateShipmentCharges: hydrate } = load('lib/services/billing/shipment-charge-snapshots.ts')
const options = { productId: 1, taxId: 2, vatRate: 23, grouped: true }
const own = { id: 's1', client_id: 'store-a', tenant_id: 'tenant-a', tracking_number: 'LTK1', service_type: 'Nacional',
  sell_price: 6.5, base_price: 4, fuel_tax_amount: 0.5, fuel_rate_pct: 12.5,
  special_fees_amount: 2, special_fees_description: JSON.stringify([{ name: 'Frágil', amount: 1.5 }, { name: 'SMS', amount: 0.5 }]) }
const sum = result => result.reduce((n, line) => n + Math.round(line.price * 100), 0)
for (const grouped of [true, false]) {
 test('base, fuel and each named supplement are separate, without double charging; grouped=' + grouped, () => {
  const result = lines([own], { ...options, grouped })
  assert.deepEqual(result.map(l => l.price), [4, 0.5, 1.5, 0.5]); assert.equal(sum(result), 650)
  assert.match(result[1].name, /12,5%/); assert.match(result[2].name, /Frágil/); assert.match(result[3].name, /SMS/)
  assert.ok(result.every(l => l.taxes[0].value === 23 && l.qty === 1))
  if (!grouped) assert.ok(result.every(l => l.name.includes('LTK1')))
 })
}
test('same-name extras aggregate exactly while different services and fuel rates remain separate', () => {
 const result = lines([own, { ...own, id: 's2', service_type: 'Outro', fuel_rate_pct: 10 }], options)
 assert.equal(sum(result), 1300)
 assert.deepEqual(result.filter(l => l.name.includes('Frágil')).map(l => l.price), [3])
 assert.equal(result.filter(l => l.name.includes('Combustível')).length, 2)
 assert.equal(result.filter(l => l.name.includes('Serviço Nacional') || l.name.includes('Serviço Outro')).length, 2)
})
test('actual historical example keeps 12.21 net, with 10.86 base and 1.35 fuel, without inventing percentages', () => {
 const rows = [[3.91, 3.48, 0.43], [4.15, 3.69, 0.46], [4.15, 3.69, 0.46]].map(([sell_price, base_price, fuel_tax_amount], i) => ({ id: String(i), service_type: 'Nacional', sell_price, base_price, fuel_tax_amount }))
 const result = lines(rows, options)
 assert.deepEqual(result.map(l => l.price), [10.86, 1.35]); assert.equal(sum(result), 1221)
 assert.equal(result.some(l => l.name.includes('%')), false)
})
test('unknown legacy breakdown keeps its original total and never applies a default fuel percentage', () => {
 const result = lines([{ id: 'legacy', sell_price: 10 }], options)
 assert.equal(result.length, 1); assert.equal(result[0].price, 10); assert.doesNotMatch(result[0].name, /Combustível/)
})
test('zero charges are omitted and special-only shipments still reconcile', () => {
 assert.deepEqual(lines([{ id: 'free', sell_price: 0, base_price: 0, fuel_tax_amount: 0 }], options), [])
 const r = lines([{ id: 'extra', sell_price: 2, base_price: 0, special_fees_amount: 2, special_fees_description: 'Seguro' }], options)
 assert.equal(r.length, 1); assert.match(r[0].name, /Seguro/); assert.equal(sum(r), 200)
})
for (const description of ['[broken', '[{"name":"Fake","amount":999}]', '[{"name":"Fake","amount":-1}]', '[]']) {
 test('invalid historical extra details preserve the single recorded charge: ' + description, () => {
  const r = lines([{ ...own, special_fees_description: description }], options)
  assert.equal(sum(r), 650); assert.equal(r.length, 3); assert.equal(r[2].price, 2)
  assert.match(r[2].name, /Serviços especiais/)
 })
}
test('inconsistent, negative and non-finite prices cannot be invoiced', () => {
 for (const changed of [{ sell_price: 5 }, { base_price: -1 }, { fuel_tax_amount: NaN }, { special_fees_amount: Infinity }, { sell_price: 'bad' }]) assert.throws(() => split({ ...own, ...changed }), /discriminação|Discriminação/)
})
function row(details, tenant = 'tenant-a', date = '2026-10-01') { return { id: date, tenant_id: tenant, action: 'shipment_data', created_at: date, details } }
test('historical enrichment accepts only the authorized tenant/store/id and does not mutate source objects', async () => {
 const native = { id: 's1', tenant_id: 'tenant-a', client_id: 'store-a', sell_price: 6.5 }
 const db = fakeSupabase({ audit_log: [row(own), row({ ...own, fuel_tax_amount: 88 }, 'foreign', '2026-10-03'), row({ ...own, client_id: 'store-b', fuel_tax_amount: 99 }, 'tenant-a', '2026-10-04')] })
 const r = await hydrate(db.client, 'tenant-a', 'store-a', [native])
 assert.equal(r[0].fuel_tax_amount, 0.5); assert.equal(r[0].special_fees_amount, 2); assert.equal(native.fuel_tax_amount, undefined)
 assert.equal(db.writes.length, 0)
 assert.ok(db.queries.every(q => q.filters.some(f => f.field === 'tenant_id' && f.value === 'tenant-a') && q.filters.some(f => f.field === 'details->>client_id' && f.value === 'store-a')))
})
test('obsolete prices and older snapshots cannot overwrite the current amount', async () => {
 const db = fakeSupabase({ audit_log: [row(own), row({ ...own, sell_price: 99 }, 'tenant-a', '2026-10-02')] })
 const r = await hydrate(db.client, 'tenant-a', 'store-a', [{ id: 's1', sell_price: 6.5 }])
 assert.equal(r[0].fuel_tax_amount, undefined); assert.equal(sum(lines(r, options)), 650)
})
test('query errors and foreign scope stop before any write or external invoice', async () => {
 const db = fakeSupabase({ audit_log: [] }, () => ({ message: 'private failure' }))
 await assert.rejects(hydrate(db.client, 'tenant-a', 'store-a', [{ id: 's1', sell_price: 2 }]), /confirmar/)
 await assert.rejects(hydrate(db.client, 'tenant-a', 'store-a', [{ ...own, client_id: 'store-b' }]), /âmbito/)
 assert.equal(db.writes.length, 0)
})
test('complete authoritative fields take precedence over missing-field historical enrichment', async () => {
 const db = fakeSupabase({ audit_log: [row({ ...own, fuel_tax_amount: 99 })] })
 const r = await hydrate(db.client, 'tenant-a', 'store-a', [own])
 assert.equal(r[0].fuel_tax_amount, 0.5); assert.equal(db.queries.length, 0)
})
