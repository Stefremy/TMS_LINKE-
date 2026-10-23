const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const TENANT = '11111111-1111-1111-1111-111111111111'
const FOREIGN = '99999999-9999-9999-9999-999999999999'
const A = '22222222-2222-2222-2222-222222222222'
const B = '33333333-3333-3333-3333-333333333333'
const ID = '44444444-4444-4444-4444-444444444444'
const OTHER = '55555555-5555-5555-5555-555555555555'
const ctx = { role: 'client', tenant_id: TENANT, client_id: A }
const pure = createLoader({})('lib/services/tracking/carrier-measurements.ts')
const measured = { source: 'ctt_events_v3', weight: { value: 6000, unit: null }, length: { value: 40, unit: null } }
const event = (measurements = measured) => ({
  status: 'entregue', displayStatus: 'entregue', eventCode: 'EMI', eventName: 'Entrega', description: 'Entrega',
  timestamp: '2026-10-23T10:00:00Z', location: 'Centro CTT', isTerminal: true, isIncidencia: false,
  carrierCode: 'ctt', measurements,
})
const saved = { shipment_id: ID, carrier: 'ctt', measurements: measured, event_code: 'EMI', event_timestamp: '2026-10-23T10:00:00Z', retrieved_at: '2026-10-23T11:00:00Z' }

function harness(context = ctx, options = {}) {
  const tables = {
    shipments: [{ id: ID, tenant_id: TENANT, client_id: A, carrier_code: 'ctt', carrier_tracking_number: 'EQ123456789PT' },
      { id: OTHER, tenant_id: TENANT, client_id: B, carrier_code: 'ctt', carrier_tracking_number: 'OTHER-PRIVATE' }],
    packages: [{ tenant_id: TENANT, shipment_id: ID, weight_g: 1000 }, { tenant_id: FOREIGN, shipment_id: ID, weight_g: 999999 }],
    audit_log: [
      { id: 'snapshot', tenant_id: TENANT, action: 'shipment_data', created_at: '2026-10-22',
        details: { id: ID, client_id: A, tenant_id: TENANT, length_cm: 20, width_cm: 15, height_cm: 10, ctt_label_base64: 'PRIVATE_LABEL' } },
      { id: 'measure', tenant_id: TENANT, action: 'shipment_carrier_measurements', created_at: '2026-10-23', details: saved },
      { id: 'foreign', tenant_id: FOREIGN, action: 'shipment_carrier_measurements', created_at: '2026-12-01', details: { ...saved, measurements: { source: 'ctt_events_v3', weight: { value: 999999, unit: null } } } },
    ],
  }
  options.adjust?.(tables)
  const db = fakeSupabase(tables, options.failure)
  const calls = []
  const load = createLoader({
    'node:crypto': crypto,
    '@/lib/auth/context': { getAuthContext: async () => context, getTenantId: async () => TENANT },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    '@/lib/services/tracking/ctt-tracking-sync': { fetchCttTrackingEvents: async ref => { calls.push(['ctt', ref]); return { success: true, events: [event()] } } },
    '@/lib/services/tracking/correos-tracking-sync': { fetchCorreosTrackingEvents: async ref => { calls.push(['correos', ref]); return { success: true, events: [{ ...event(pure.parseCorreosMeasurements({ kilos: '6.000' })), carrierCode: 'correos' }] } } },
  })
  const route = load('app/api/shipments/[id]/measurements/route.ts')
  return {
    db, tables, calls, load,
    run(method = 'GET', id = ID, origin = 'http://localhost:3000') {
      return route[method](new Request(`http://localhost:3000/api/shipments/${id}/measurements`, {
        method, headers: { origin },
      }), { params: Promise.resolve({ id }) })
    },
  }
}

test('CTT V3 preserves positive raw values and does not guess units or use declared values', () => {
  const result = pure.parseCttMeasurements({ _PesoReal: '6000', _PesoVolumetrico: '7,500', _Comprimento: '40', _Largura: '30', _Altura: '25', _Valido: '1' })
  assert.deepEqual(result.weight, { value: 6000, unit: null })
  assert.deepEqual(result.volumetricWeight, { value: 7.5, unit: null })
  assert.equal(result.length.value, 40)
  assert.match(pure.formatCarrierReading(result.weight), /unidade não indicada/)
})

test('nil, zero, invalid events and malformed values never become physical measurements', () => {
  for (const value of [null, {}, '', '0', '-5', Infinity, '1.2.3', 'NaN', '6 kg', true]) {
    assert.equal(pure.positiveMeasurement(value), null)
    assert.equal(pure.parseCttMeasurements({ _PesoReal: value, _Altura: '0' }), undefined)
  }
  assert.equal(pure.parseCttMeasurements({ _PesoReal: '6000', _Valido: '0' }), undefined)
  assert.equal(pure.positiveMeasurement(' .125 '), 0.125)
})

test('Correos kilos is reported weight; volumen is never mistaken for volumetric weight', () => {
  const result = pure.parseCorreosMeasurements({ kilos: '     6.000', volumen: '100.000', alto: '25', largo: '40', ancho: '30' })
  assert.deepEqual(result.weight, { value: 6, unit: 'kg' })
  assert.equal(result.source, 'correos_tracking')
  assert.equal(result.volumetricWeight, undefined)
  assert.deepEqual(result.volume, { value: 100, unit: null })
  assert.equal(result.height.value, 25)
  assert.equal(result.height.unit, null)
})

test('a partial newer response retains earlier fields without mixing carriers', () => {
  const result = pure.latestCarrierReadings([
    { ...saved, retrieved_at: '2026-10-23T12:00:00Z', measurements: { source: 'ctt_events_v3', width: { value: 30, unit: null } } },
    saved,
    { ...saved, measurements: { source: 'correos_tracking', height: { value: 999, unit: null } } },
  ])
  assert.equal(result.weight.value, 6000)
  assert.equal(result.width.value, 30)
  assert.equal(result.height, undefined)
})

for (const method of ['GET', 'POST']) {
  for (const context of [null, { ...ctx, role: 'unknown' }, { ...ctx, tenant_id: null }]) {
    test(`${method}: invalid session is denied before any database or carrier access (${context?.role || 'anonymous'})`, async () => {
      const h = harness(context), response = await h.run(method)
      assert.equal(response.status, context ? 403 : 401)
      assert.equal(h.db.queries.length, 0)
      assert.equal(h.db.writes.length, 0)
      assert.deepEqual(h.calls, [])
    })
  }
  test(`${method}: client A cannot read or refresh client B or another tenant`, async () => {
    for (const context of [ctx, { ...ctx, tenant_id: FOREIGN }]) {
      const h = harness(context), response = await h.run(method, OTHER)
      assert.equal(response.status, 403)
      assert.equal(h.db.writes.length, 0)
      assert.deepEqual(h.calls, [])
      assert.doesNotMatch(await response.text(), /OTHER-PRIVATE/)
    }
  })
}

test('GET returns own declared and carrier values separately without labels or a live carrier call', async () => {
  const h = harness(), response = await h.run(), result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.declared.weightKg, 1)
  assert.equal(result.declared.lengthCm, 20)
  assert.equal(result.observations[0].measurements.weight.value, 6000)
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_LABEL|999999/)
  assert.deepEqual(h.calls, [])
  assert.equal(h.db.writes.length, 0)
  assert.match(response.headers.get('cache-control'), /private.*no-store/)
  assert.ok(h.db.queries.filter(q => q.table === 'audit_log').every(q => q.filters.some(f => f.field === 'tenant_id' && f.value === TENANT)))
  assert.ok(h.db.queries.some(q => q.projection?.includes('weight:details->weight_kg')))
})

test('staff can read both stores inside their own tenant', async () => {
  const h = harness({ role: 'employee', tenant_id: TENANT })
  assert.equal((await h.run('GET', OTHER)).status, 200)
})

test('declared C/L/A can be read from the packages JSONB column without an audit snapshot', async () => {
  const h = harness(ctx, { adjust: t => {
    t.audit_log = t.audit_log.filter(row => row.action !== 'shipment_data')
    t.packages[0].dimensions = { length_cm: 30.5, width_cm: 20, height_cm: 10, unit: 'cm' }
  } })
  const data = await (await h.run()).json()
  assert.deepEqual(data.declared, { weightKg: 1, lengthCm: 30.5, widthCm: 20, heightCm: 10 })
})

test('latest authoritative owner wins over a stale accessible audit snapshot', async () => {
  const h = harness(ctx, { adjust: t => { t.shipments[0].client_id = B } })
  assert.equal((await h.run()).status, 403)
  assert.equal(h.db.writes.length, 0)
})

test('audit-only shipment checks the latest owner, never an older matching owner', async () => {
  const h = harness(ctx, { adjust: t => {
    t.shipments = []
    t.audit_log.push({ tenant_id: TENANT, action: 'shipment_data', created_at: '2026-10-24', details: { id: ID, client_id: B, tenant_id: TENANT } })
  } })
  assert.equal((await h.run()).status, 403)
})

test('an authorization lookup failure cannot fall back to old audit ownership', async () => {
  const h = harness(ctx, { failure: q => q.table === 'shipments' ? { message: 'private error' } : null })
  const response = await h.run('POST')
  assert.equal(response.status, 503)
  assert.deepEqual(h.calls, [])
  assert.doesNotMatch(await response.text(), /private error/)
})

test('POST rejects cross-origin calls before accessing data', async () => {
  const h = harness(), response = await h.run('POST', ID, 'https://evil.invalid')
  assert.equal(response.status, 403)
  assert.equal(h.db.queries.length, 0)
})

test('POST refreshes the authorized stored CTT reference and never changes prices/status', async () => {
  const h = harness(), response = await h.run('POST')
  assert.equal(response.status, 200)
  assert.deepEqual(h.calls, [['ctt', 'EQ123456789PT']])
  assert.ok(h.db.writes.every(w => w.table === 'audit_log' && w.kind === 'upsert' && w.value.action === 'shipment_carrier_measurements'))
})

test('POST routes Correos shipments to Correos and retains the source distinction', async () => {
  const h = harness(ctx, { adjust: t => { Object.assign(t.shipments[0], { carrier_code: 'correos', carrier_tracking_number: '1234567890123456' }) } })
  const response = await h.run('POST')
  assert.equal(response.status, 200)
  assert.deepEqual(h.calls, [['correos', '1234567890123456']])
  assert.equal(h.db.writes[0].value.details.measurements.source, 'correos_tracking')
})

test('empty measurement responses leave prior readings intact; same values do not create another snapshot', async () => {
  const h = harness(), store = h.load('lib/services/tracking/carrier-measurements-store.ts')
  const unmeasured = event()
  delete unmeasured.measurements
  await store.saveCarrierMeasurements(h.db.client, h.tables.shipments[0], [unmeasured])
  assert.equal(h.db.queries.length, 0)
  await store.saveCarrierMeasurements(h.db.client, h.tables.shipments[0], [event({ ...measured })])
  assert.equal(h.db.writes.length, 0)
})

test('tracking sync stores new measurements even when the scan already exists', async () => {
  const h = harness(ctx, { adjust: t => {
    t.shipments[0].status = 'entregue'
    t.shipments[0].ops_substatus = 'emi'
    t.tracking_events = [{ shipment_id: ID, event_code: 'EMI', timestamp: '2026-10-23T10:00:00Z' }]
  } })
  const recorder = h.load('lib/services/tracking/tracking-recorder.ts')
  const res = await recorder.recordTrackingEvents(h.db.client, ID, h.tables.shipments[0], [event({ ...measured, width: { value: 30, unit: null } })])
  assert.equal(res.success, true)
  assert.equal(res.count, 0)
  assert.equal(res.measurementsUpdated, true)
  assert.equal(h.db.writes.length, 1)
  assert.equal(h.db.writes[0].value.action, 'shipment_carrier_measurements')
  assert.equal(h.db.writes[0].value.details.measurements.width.value, 30)
  assert.equal(h.tables.packages[0].weight_g, 1000)
})

test('duplicate refreshes have the same deterministic key, and prior declared values are never modified', async () => {
  const h = harness(), store = h.load('lib/services/tracking/carrier-measurements-store.ts')
  const changed = event({ source: 'ctt_events_v3', width: { value: 30, unit: null } })
  await store.saveCarrierMeasurements(h.db.client, h.tables.shipments[0], [changed])
  await store.saveCarrierMeasurements(h.db.client, h.tables.shipments[0], [changed])
  assert.equal(h.db.writes[0].value.id, h.db.writes[1].value.id)
  assert.equal(h.db.writes[0].value.details.measurements.weight.value, 6000)
  assert.equal(h.tables.packages[0].weight_g, 1000)
  assert.equal(h.tables.audit_log[0].details.length_cm, 20)
})

test('jsonb key ordering does not create another measurement snapshot', async () => {
  const h = harness(ctx, { adjust: t => { t.audit_log[1].details = { ...saved,
    measurements: { length: { unit: null, value: 40 }, weight: { unit: null, value: 6000 }, source: 'ctt_events_v3' },
  } } })
  await h.load('lib/services/tracking/carrier-measurements-store.ts').saveCarrierMeasurements(h.db.client, h.tables.shipments[0], [event()])
  assert.equal(h.db.writes.length, 0)
})

test('carrier parser passes V3 measurements through the real CTT service', async () => {
  const load = createLoader({
    './ctt-soap-client': { CTTSoapClient: class {
      static escapeXml(v) { return v }
      async callSoap() { return { GetEventosObjectos_V3Response: { GetEventosObjectos_V3Result: { _Objectos: {
        DadosObjectos_V3BE: { _NObjecto: 'EQ123456789PT', _Eventos: { DadosEventos_V3BE: {
          _CodigoEvento: 'EMI', _DataEvento: '23-10-2026 10:00:00', _PesoReal: '6000', _Altura: '25', _Valido: '1',
        } } },
      } } } } }
    } },
  })
  return load('lib/services/ctt/ctt-tracking.service.ts').CTTTrackingService.fetchRealTrackingEvents('EQ123456789PT', { environment: 'production' }).then(events => {
    assert.equal(events[0].measurements.weight.value, 6000)
    assert.equal(events[0].measurements.height.value, 25)
  })
})
