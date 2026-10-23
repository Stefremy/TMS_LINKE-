const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const TENANT = 'tenant-a', OTHER = 'tenant-b'
const load = createLoader({})
const pure = load('lib/services/shipments/parcel-summary.ts')
const { loadShipmentParcelSummaries } = load('lib/services/shipments/shipment-parcel-summaries.ts')
const shipment = (id, carrier_code = 'ctt') => ({ id, carrier_code })
const snapshot = (id, { carrier = 'ctt', value = 6000, unit = null, date = '2026-10-23T12:00:00Z', tenant = TENANT, source } = {}) => ({
  id: `measurement-${id}-${date}`, tenant_id: tenant, action: 'shipment_carrier_measurements', created_at: date,
  details: { shipment_id: id, carrier, retrieved_at: date,
    measurements: { source: source || (carrier === 'ctt' ? 'ctt_events_v3' : 'correos_tracking'), weight: { value, unit } } },
})

test('batched summaries keep the original declared weight separate from the latest carrier weight', async () => {
  const db = fakeSupabase({
    packages: [{ tenant_id: TENANT, shipment_id: 'a', weight_g: 1000 }],
    audit_log: [
      { tenant_id: TENANT, action: 'shipment_data', created_at: '2026-10-22', details: { id: 'a', weight_kg: 1, package_count: 2, ctt_label_base64: 'PRIVATE_LABEL' } },
      snapshot('a', { value: 6000 }), snapshot('a', { value: 2000, date: '2026-10-22' }),
      snapshot('a', { value: 999999, date: '2026-12-01', tenant: OTHER }), snapshot('other-store'),
    ],
  })
  const result = await loadShipmentParcelSummaries(db.client, TENANT, [shipment('a')])
  assert.equal(result.size, 1)
  assert.deepEqual(result.get('a'), { declaredWeightKg: 1, volumeCount: 2,
    carrierWeight: { carrier: 'ctt', value: 6000, unit: null, retrievedAt: '2026-10-23T12:00:00Z' } })
  assert.doesNotMatch(JSON.stringify([...result.values()]), /PRIVATE_LABEL|999999|other-store/)
  assert.equal(db.queries.length, 3, 'one batch per compact data source, no per-row requests')
  for (const query of db.queries) {
    assert.ok(query.filters.some(f => f.field === 'tenant_id' && f.value === TENANT))
    assert.deepEqual(query.filters.find(f => f.kind === 'in').value, ['a'])
    assert.notEqual(query.projection, '*')
    assert.notEqual(query.projection, 'details')
  }
})

test('no measurement does not fabricate a real weight or a one-kilogram declaration', async () => {
  const db = fakeSupabase({})
  const result = await loadShipmentParcelSummaries(db.client, TENANT, [shipment('empty')])
  assert.deepEqual(result.get('empty'), { declaredWeightKg: null, volumeCount: null, carrierWeight: null })
  assert.equal(pure.formatListCarrierWeight(result.get('empty').carrierWeight), null)
  assert.equal(pure.formatDeclaredWeight(result.get('empty').declaredWeightKg), 'Peso não registado')
})

test('package weights are summed only from the selected tenant and authorized shipments', async () => {
  const db = fakeSupabase({ packages: [
    { tenant_id: TENANT, shipment_id: 'a', weight_g: 1000 }, { tenant_id: TENANT, shipment_id: 'a', weight_g: 2500 },
    { tenant_id: OTHER, shipment_id: 'a', weight_g: 900000 }, { tenant_id: TENANT, shipment_id: 'other-store', weight_g: 999999 },
  ] })
  const result = await loadShipmentParcelSummaries(db.client, TENANT, [shipment('a')])
  assert.equal(result.get('a').declaredWeightKg, 3.5)
  assert.equal(result.get('a').volumeCount, 2)
})

test('Correos uses a distinct reported-weight label and incompatible source/units are rejected', async () => {
  const db = fakeSupabase({ audit_log: [snapshot('correos', { carrier: 'correos', value: 6, unit: 'kg' }),
    snapshot('invalid-source', { source: 'correos_tracking' }), snapshot('invalid-unit', { unit: 'cm' })] })
  const result = await loadShipmentParcelSummaries(db.client, TENANT, [shipment('correos', 'correos'), shipment('invalid-source'), shipment('invalid-unit')])
  assert.equal(pure.formatListCarrierWeight(result.get('correos').carrierWeight).text, 'Peso Correos: 6,00 kg')
  assert.match(pure.formatListCarrierWeight(result.get('correos').carrierWeight).title, /não confirma.*pesagem física/)
  assert.equal(result.get('invalid-source').carrierWeight, null)
  assert.equal(result.get('invalid-unit').carrierWeight, null)
})

test('only confirmed units are converted; unknown CTT numbers never become invented kilograms', () => {
  assert.equal(pure.formatListCarrierWeight({ value: 6000, unit: 'g', carrier: 'ctt', retrievedAt: null }).text, 'Real CTT: 6,00 kg')
  assert.equal(pure.formatListCarrierWeight({ value: 6000, unit: null, carrier: 'ctt', retrievedAt: null }).text, 'Real CTT: 6000')
  assert.equal(pure.formatListCarrierWeight({ value: 0, unit: 'kg', carrier: 'ctt', retrievedAt: null }), null)
})

test('metadata failure leaves authorized shipments visible without an invented green value', async () => {
  const db = fakeSupabase({ packages: [{ tenant_id: TENANT, shipment_id: 'a', weight_g: 1000 }], audit_log: [snapshot('a')] },
    q => q.table === 'audit_log' ? { message: 'Fixture read failure' } : null)
  const result = await loadShipmentParcelSummaries(db.client, TENANT, [shipment('a')])
  assert.equal(result.get('a').declaredWeightKg, 1)
  assert.equal(result.get('a').carrierWeight, null)
})

test('an empty selection makes no database calls and a page of fifty uses three batch reads', async () => {
  const db = fakeSupabase({})
  await loadShipmentParcelSummaries(db.client, TENANT, [])
  assert.equal(db.queries.length, 0)
  await loadShipmentParcelSummaries(db.client, TENANT, Array.from({ length: 50 }, (_, i) => shipment(String(i))))
  assert.equal(db.queries.length, 3)
})

test('manual detail refresh produces the same summary shape, preserving the declared weight and volume count', () => {
  const previous = { volumeCount: 2, declaredWeightKg: 1, carrierWeight: null }
  const result = pure.parcelSummaryFromDetail({ carrier: 'correos', declared: { weightKg: 1 },
    observations: [{ retrieved_at: '2026-10-23T12:00:00Z', measurements: { source: 'correos_tracking', weight: { value: 6, unit: 'kg' } } }] }, previous)
  assert.equal(result.declaredWeightKg, 1)
  assert.equal(result.volumeCount, 2)
  assert.equal(result.carrierWeight.value, 6)
})

test('shared OPS/client weight cell puts the green carrier weight below the unchanged declaration', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
  const Component = createLoader({ 'react/jsx-runtime': require('react/jsx-runtime') })('components/shipments/ShipmentParcelWeight.tsx').ShipmentParcelWeight
  const html = renderToStaticMarkup(React.createElement(Component, { summary: { volumeCount: 1, declaredWeightKg: 1,
    carrierWeight: { carrier: 'ctt', value: 6, unit: 'kg', retrievedAt: null } } }))
  assert.ok(html.indexOf('1,00 kg') < html.indexOf('Real CTT: 6,00 kg'))
  assert.match(html, /text-\[var\(--status-success\)\]/)
  const empty = renderToStaticMarkup(React.createElement(Component, { summary: { declaredWeightKg: 1, carrierWeight: null } }))
  assert.doesNotMatch(empty, /Real CTT|status-success/)
})

test('detail read notifies the list when only weight changes, without refreshing unchanged values', async () => {
  const previous = { volumeCount: 1, declaredWeightKg: 1,
    carrierWeight: { value: 1, unit: 'kg', carrier: 'correos', retrievedAt: '2026-10-22T12:00:00Z' } }
  const response = { carrier: 'correos', declared: { weightKg: 1 }, observations: [{ retrieved_at: '2026-10-23T12:00:00Z',
    measurements: { source: 'correos_tracking', weight: { value: 6, unit: 'kg' } } }] }
  for (const changed of [true, false]) {
    const effects = [], updates = []
    const jsx = (type, props) => ({ type, props })
    const Component = createLoader({
      react: { useState: initial => [initial, () => {}], useEffect: fn => effects.push(fn), useEffectEvent: fn => fn },
      'react/jsx-runtime': { jsx, jsxs: jsx },
      'lucide-react': { Scale: 'Scale', Ruler: 'Ruler', RefreshCw: 'Refresh' },
      fetch: async () => Response.json(response),
    })('components/shipments/CarrierMeasurementsPanel.tsx').CarrierMeasurementsPanel
    Component({ shipmentId: 'a', previous: changed ? previous : pure.parcelSummaryFromDetail(response, previous), onUpdated: next => updates.push(next) })
    const cleanup = effects[0]()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(updates.length, changed ? 1 : 0)
    if (changed) {
      assert.equal(updates[0].declaredWeightKg, 1)
      assert.equal(updates[0].carrierWeight.value, 6)
    }
    cleanup()
  }
})
