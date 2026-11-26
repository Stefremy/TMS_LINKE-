const test = require('node:test')
const assert = require('node:assert/strict')
const { lisbon, mapRows } = require('../scripts/import-legacy-shipments.cjs')

test('old platform dates are Lisbon time, summer and winter', () => {
  assert.equal(lisbon('2026-07-01 10:00:00'), '2026-07-01T09:00:00.000Z')
  assert.equal(lisbon('2026-11-26 10:43:23'), '2026-11-26T10:43:23.000Z')
  assert.equal(lisbon(''), null)
})

test('rows of another customer are refused and multi-parcel trackings are kept', () => {
  const client = { id: 'c', name: 'BORDADO INOVADOR', tenant_id: 't' }
  const row = { TRK: '001 ', Customer: 'BORDADO INOVADOR', 'Secondary TRK': 'EG1PT;EG2PT', 'Creation Date': '2026-03-26 20:14:08', Volumes: 2, 'Weight (Kg)': '' }
  const [mapped] = mapRows([row], client, 'f.xlsx')
  assert.equal(mapped.legacy_trk, '001')
  assert.equal(mapped.carrier_tracking_number, 'EG1PT · EG2PT')
  assert.equal(mapped.weight_kg, null)
  assert.throws(() => mapRows([{ ...row, Customer: 'OUTRA LOJA' }], client, 'f.xlsx'), /não é/)
})

test('old price is transport + fees + fuel without VAT, and a broken total is refused', () => {
  const client = { id: 'c', name: 'BORDADO INOVADOR', tenant_id: 't' }
  const row = { TRK: '1', Customer: 'BORDADO INOVADOR', 'Creation Date': '', 'Transportation Price': 2.98, 'Fees Price': '', 'Fuel Price': 0.425, 'Fuel Tax': 14.25, Total: 3.4, 'VAT Tax': 23, Invoice: 'FT/2026 262' }
  const [mapped] = mapRows([row], client, 'f.xlsx')
  assert.equal(mapped.total_net, 3.4)
  assert.equal(mapped.vat_pct, 23)
  assert.equal(mapped.invoice, 'FT/2026 262')
  assert.throws(() => mapRows([{ ...row, Total: 5 }], client, 'f.xlsx'), /não bate/)
})
