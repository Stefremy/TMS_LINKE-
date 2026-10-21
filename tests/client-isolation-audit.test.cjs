const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { auditDatabase } = require('./helpers/client-isolation-audit-db.cjs')

// These tests assert the intended security boundary. Unfixed findings deliberately fail.
// Only fictional records and mocked integration responses are used.
const TENANT = '11111111-1111-1111-1111-111111111111'
const A = '22222222-2222-2222-2222-222222222222'
const B = '33333333-3333-3333-3333-333333333333'
const SA = '44444444-4444-4444-4444-444444444444'
const SB = '55555555-5555-5555-5555-555555555555'
const FOREIGN = '99999999-9999-9999-9999-999999999999'
const ctxA = { user: { id: 'fictional-user-a' }, role: 'client', tenant_id: TENANT, client_id: A, permissions: [] }
const utils = {
  isValidUuid: value => /^[0-9a-f-]{36}$/i.test(value || ''),
  isCorreosShipment: value => /correos/i.test(value?.carrier_code || value?.service_type || ''),
  formatOrGenerateCttObjectId: value => value.ctt_object_id || value.carrier_tracking_number || null,
}
function fixtureService(id, owner) {
  return { id, tenant_id: TENANT, client_id: owner, is_active: true, name: 'Fictional service ' + id,
    webservice_connection_id: 'fictional-connection-' + id, global_markup_pct: 25,
    preferred_carrier_id: 'fictional-carrier', preferred_carrier_name: 'Fictional carrier',
    webservice_service_code: 'FICTIONAL-SERVICE',
    zones: [{ zone_code: 'PT-CONT', tiers: [{ weight_max: 5, cost_price: 7, sell_price: 9, margin_pct: 25 }] }] }
}
function harness({ ctx = ctxA, fallback = false, eventsOnA = false, failure } = {}) {
  const clients = [{ id: A, tenant_id: TENANT, short_name: 'Fictional A', billing_type: 'conta_corrente', credit_limit: 100 },
    { id: B, tenant_id: TENANT, short_name: 'Fictional B', billing_type: 'conta_corrente', credit_limit: 900 }]
  const services = [fixtureService('service-a', A), fixtureService('service-b', B)]
  const statement = owner => ({ tenant_id: TENANT, action: 'billing_statement', created_at: '2026-10-01', details: {
    id: 'statement-' + owner, client_id: owner, total_value: owner === A ? 10 : 90,
    moloni_document_id: 42, moloni_receipt_pdf: 'https://fixture.invalid/receipt.pdf',
  } })
  const db = auditDatabase({
    clients,
    shipments: [
      { id: SA, tenant_id: TENANT, client_id: A, tracking_number: 'LTK1000001', carrier_tracking_number: 'EQ000000001PT',
        status: 'pendente', sell_price: 10, fuel_tax_amount: 0, recipient_name: 'Fictional recipient A', created_at: '2026-10-01', ctt_label_base64: 'LABEL-A' },
      { id: SB, tenant_id: TENANT, client_id: B, tracking_number: 'LTK1000002', carrier_tracking_number: 'EQ000000002PT',
        status: 'pendente', sell_price: 90, recipient_name: 'Fictional recipient B', created_at: '2026-10-02', ctt_label_base64: 'LABEL-B' },
    ],
    tracking_events: [{ id: 'private-event-b', tenant_id: TENANT, shipment_id: SB, event_code: 'EMI', description: 'PRIVATE-B-EVENT', created_at: '2026-10-02' },
      ...(eventsOnA ? [{ id: 'own-event-a', tenant_id: TENANT, shipment_id: SA, event_code: 'EMI', description: 'OWN-A-EVENT', created_at: '2026-10-01' }] : [])],
    audit_log: [statement(A), statement(B), { ...statement(A), tenant_id: FOREIGN, details: { ...statement(A).details, id: 'foreign-statement' } },
      ...(fallback ? services.map(service => ({ tenant_id: TENANT, action: 'servicos_linke_data', details: service, created_at: '2026-10-01' })) : [])],
    servicos_linke: fallback ? [] : services,
    client_transactions: [],
  }, failure)
  const calls = { providers: [], stripe: 0, emails: 0 }
  const requireUser = async () => { if (!ctx) throw new Error('LOGIN_REQUIRED'); return ctx }
  const event = { eventCode: 'EMI', eventName: 'Fixture delivery', description: 'MOCKED-PROVIDER-EVENT', location: 'Fictional location',
    timestamp: '2026-10-21T09:00:00Z', status: 'entregue', displayStatus: 'entregue', isTerminal: true, isIncidencia: false }
  const fetchTracking = carrier => async tracking => {
    calls.providers.push({ carrier, tracking })
    return { success: true, events: [{ ...event, carrierCode: carrier }] }
  }
  const mapCorreosStatus = () => ({ eventName: 'Fixture delivery', displayStatus: 'entregue', isTerminal: true, isIncidencia: false })
  const mocks = {
    'server-only': {},
    '@/lib/auth/context': {
      requireUser, getAuthContext: async () => ctx, getTenantId: async () => (await requireUser()).tenant_id,
      requireEmployee: async () => { const context = await requireUser(); if (context.role === 'client') throw new Error('STAFF_REQUIRED'); return context },
    },
    '@/lib/supabase/server': { createAdminClient: () => db.client },
    'next/cache': { revalidatePath() {} },
    'next/headers': { headers: async () => new Headers() },
    '@/lib/config/public-origins': { checkoutReturnOrigin: () => 'https://fixture.invalid', publicUrl: path => 'https://fixture.invalid' + path },
    '@/lib/pricing/calculate-shipment-price': {},
    '@/lib/pricing/calculate-shipment-quote': {},
    '@/lib/pricing/shipment-pricing-context': {},
    '@/lib/services/ctt/ctt-types': { CTT_TRACKING_EVENTS: { EMI: { description: 'Delivered', tms_status: 'entregue', is_terminal: true } }, CTT_INCIDENT_CODES: new Set() },
    '@/lib/services/carriers/ctt-provider': { CttProvider: class {} },
    '@/lib/services/correos/correos-shipment.service': { CorreosShipmentService: class {} },
    '@/lib/services/carriers/credentials': {},
    '@/lib/label-utils': {},
    '@/lib/services/correos/correos-label-customizer': { isCorreosPdfLabel: async () => false },
    '@/lib/services/shipments/shipment-utils': utils,
    './shipment-utils': utils,
    '../shipments/shipment-utils': utils,
    './transport-label-generator': { generateTransportLabelPdfBase64: async () => 'FICTIONAL-LABEL' },
    '@/lib/services/shipments/shipment-creator': {},
    '@/lib/services/shipments/shipment-deleter': {},
    '@/lib/services/tracking': { mapCorreosStatus },
    './ctt-tracking-sync': { fetchCttTrackingEvents: fetchTracking('ctt') },
    './correos-tracking-sync': { fetchCorreosTrackingEvents: fetchTracking('correos'), mapCorreosStatus },
    '@/lib/email/tracking-notifications': { sendTrackingEmailNotification: async () => { calls.emails++ } },
    '@/lib/moloni/moloni-client': { MoloniClient: class {} },
    '@/app/actions/clientes': {
      getClientesAction: async () => ctx?.role === 'client' ? clients.filter(client => client.id === ctx.client_id) : clients,
      getClienteByIdAction: async id => clients.find(client => client.id === id) || null,
    },
    '@/app/actions/fornecedores': {},
    '@/app/actions/ctt': {},
    '@/lib/services/ctt': {},
    '@/lib/config/ctt-pickup-requester': {},
    '@/lib/services/ctt/close-manifest': {},
    '@/app/ops/configuracao/servicos/types': { isPrimordialServico: () => false },
    '@/lib/services/geo/international-zones': { buildOfficialLinkeInternationalZones: () => [] },
    '@/lib/services/service-availability': { isTemporarilyWithdrawnService: () => false },
    stripe: class { checkout = { sessions: { create: async () => { calls.stripe++; return { id: 'fictional-checkout', url: 'https://fixture.invalid/checkout' } } } } },
  }
  const load = createLoader(mocks)
  mocks['@/lib/services/tracking'].syncShipmentTracking = load('lib/services/tracking/tracking-dispatcher.ts').syncShipmentTracking
  return { load, db, calls, mocks }
}

test('CONTROL: shipment listing uses the signed-in store even when a different store is submitted', async () => {
  for (const owner of [A, B]) {
    const h = harness({ ctx: { ...ctxA, client_id: owner } })
    const rows = await h.load('app/actions/shipments.ts').getShipmentsAction({ clientId: owner === A ? B : A })
    assert.deepEqual(rows.map(row => row.client_id), [owner])
    assert.ok(rows.every(row => !row.ctt_label_base64))
  }
})
test('CONTROL: own labels work and another store label is denied by UUID and carrier reference', async () => {
  const h = harness()
  const actions = h.load('app/actions/shipments.ts')
  assert.equal(await actions.getShipmentLabelAction(SA), 'LABEL-A')
  assert.equal(await actions.getShipmentLabelAction('EQ000000001PT'), 'LABEL-A')
  assert.equal(await actions.getShipmentLabelAction(SB), null)
  assert.equal(await actions.getShipmentLabelAction('EQ000000002PT'), null)
})
test('CONTROL: paginated shipment listing excludes store B', async () => {
  const h = harness()
  const result = await h.load('lib/services/shipments/shipment-fetcher.ts').fetchPaginatedShipments({ pageSize: 10 })
  assert.deepEqual(result.data.map(row => row.client_id), [A])
})
test('CONTROL: invoice enumeration ignores an attempted store B override and excludes other tenants', async () => {
  const h = harness()
  const rows = await h.load('app/actions/moloni.ts').getBillingStatementsAction(B)
  assert.deepEqual(rows.map(row => row.id), ['statement-' + A])
})
test('CONTROL: portal statistics and used balance stay scoped to A despite submitted B identifiers', async () => {
  const h = harness()
  const result = await h.load('app/actions/shipments.ts').getClientPortalStatsAction(B, 'Fictional B')
  assert.equal(result.totalCount, 1)
  assert.equal(result.totalRevenue, 10)
  assert.ok(result.allShipments.every(row => row.client_id === A))
})
test('CONTROL: topping up B is rejected before transaction inserts and Stripe calls', async () => {
  const h = harness()
  const result = await h.load('app/actions/stripe.ts').createTopUpCheckoutSession(B, 10)
  assert.equal(result.success, false)
  assert.equal(h.db.writes.length, 0)
  assert.equal(h.calls.stripe, 0)
})
test('CONTROL: topping up A succeeds using only a simulated checkout', async () => {
  const h = harness()
  const result = await h.load('app/actions/stripe.ts').createTopUpCheckoutSession(A, 10)
  assert.equal(result.success, true)
  assert.equal(h.calls.stripe, 1)
  assert.equal(h.db.writes[0].value.client_id, A)
})
test('CONTROL: direct access to store B tracking timeline is denied', async () => {
  const h = harness()
  await assert.rejects(h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SB, 'EQ000000002PT'), /negado/)
})
test('CONTROL: an own timeline returns only own events', async () => {
  const h = harness({ eventsOnA: true })
  const events = await h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SA, 'EQ000000001PT')
  assert.deepEqual(events.map(event => event.description), ['OWN-A-EVENT'])
})
for (const fallback of [false, true]) {
  test('CONTROL: normal catalog hides B-specific services and cost fields (' + (fallback ? 'audit fallback' : 'table') + ')', async () => {
    const h = harness({ fallback })
    const result = await h.load('app/actions/servicos-linke.ts').getServicosLinkeAction()
    assert.equal(result.some(service => service.id === 'service-b'), false)
    assert.equal(result.find(service => service.id === 'service-a').zones[0].tiers[0].cost_price, undefined)
  })
}
test('CONTROL: direct tracking sync for B stops before provider calls and writes', async () => {
  const h = harness()
  const result = await h.load('app/actions/shipments.ts').syncShipmentTrackingAction('EQ000000002PT', SB)
  assert.equal(result.success, false)
  assert.equal(h.calls.providers.length, 0)
  assert.equal(h.db.writes.length, 0)
})
test('CONTROL: own tracking sync still works against a mocked carrier and an in-memory database', async () => {
  const h = harness()
  const result = await h.load('app/actions/shipments.ts').syncShipmentTrackingAction('EQ000000001PT', SA)
  assert.equal(result.success, true)
  assert.equal(h.calls.providers.length, 1)
  assert.equal(h.db.tables.shipments.find(row => row.id === SA).status, 'entregue')
  assert.equal(h.db.tables.shipments.find(row => row.id === SB).status, 'pendente')
  assert.equal(h.calls.emails, 0)
})
test('CONTROL: anonymous shipment and label access stops before database queries', async () => {
  const h = harness({ ctx: null })
  const actions = h.load('app/actions/shipments.ts')
  await assert.rejects(actions.getShipmentsAction(), /LOGIN_REQUIRED/)
  await assert.rejects(actions.getShipmentLabelAction(SA), /LOGIN_REQUIRED/)
  assert.equal(h.db.queries.length, 0)
})

for (const fallback of [false, true]) {
  test('F01: client-controlled skipRedaction must not expose store B services (' + (fallback ? 'audit fallback' : 'table') + ')', async t => {
    const h = harness({ fallback })
    const services = await h.load('app/actions/servicos-linke.ts').getServicosLinkeAction(true)
    const leaked = services.find(service => service.id === 'service-b')
    t.diagnostic('Other-store service returned: ' + Boolean(leaked) + '; internal cost present: ' + Boolean(leaked?.zones?.[0]?.tiers?.[0]?.cost_price))
    assert.equal(Boolean(leaked), false, 'A client parameter must not disable store ownership filtering')
  })
}
// Exercise both storage paths, both stores, forged arguments, and legitimate staff access.
for (const fallback of [false, true]) {
  const storage = fallback ? 'audit fallback' : 'table'
  for (const owner of [A, B]) {
    test('F01: catalog scope and internal fields depend only on the signed-in store (' + owner + ', ' + storage + ')', async () => {
      for (const argument of [undefined, false, true, 'true', { skipRedaction: true }]) {
        const h = harness({ ctx: { ...ctxA, client_id: owner }, fallback })
        const general = fixtureService('service-general', null)
        if (fallback) {
          h.db.tables.audit_log.push({ tenant_id: TENANT, action: 'servicos_linke_data', details: general, created_at: '2026-10-01' })
        } else {
          h.db.tables.servicos_linke.push(general)
        }
        const result = await h.load('app/actions/servicos-linke.ts').getServicosLinkeAction(argument)
        assert.ok(result.some(service => service.id === (owner === A ? 'service-a' : 'service-b')))
        assert.ok(result.some(service => service.id === 'service-general'))
        assert.ok(result.every(service => !service.client_id || service.client_id === owner))
        for (const service of result) {
          for (const field of ['global_markup_pct', 'preferred_carrier_id', 'preferred_carrier_name',
            'webservice_connection_id', 'webservice_service_code']) {
            assert.equal(service[field], undefined, 'Client must not receive ' + field)
          }
          for (const zone of service.zones || []) {
            for (const tier of zone.tiers || []) {
              assert.equal(tier.cost_price, undefined)
              assert.equal(tier.margin_pct, undefined)
            }
          }
        }
        assert.equal(result.find(service => service.id === 'service-general').zones[0].tiers[0].sell_price, 9)
        assert.equal(h.db.writes.length, 0)
      }
    })
  }
  for (const role of ['employee', 'admin']) {
    test('F01: ' + role + ' retains the authorized catalog and internal cost fields (' + storage + ')', async () => {
      const h = harness({ ctx: { ...ctxA, role, client_id: null }, fallback })
      const result = await h.load('app/actions/servicos-linke.ts').getServicosLinkeAction()
      for (const id of ['service-a', 'service-b']) {
        const service = result.find(row => row.id === id)
        assert.ok(service)
        assert.equal(service.global_markup_pct, 25)
        assert.equal(service.webservice_connection_id, 'fictional-connection-' + id)
        assert.equal(service.zones[0].tiers[0].cost_price, 7)
        assert.equal(service.zones[0].tiers[0].sell_price, 9)
        assert.equal(service.zones[0].tiers[0].margin_pct, 25)
      }
      assert.equal(h.db.writes.length, 0)
    })
  }
}
test('F01: anonymous catalog access stops before querying the database', async () => {
  const h = harness({ ctx: null })
  await assert.rejects(h.load('app/actions/servicos-linke.ts').getServicosLinkeAction(true), /LOGIN_REQUIRED/)
  assert.equal(h.db.queries.length, 0)
})

for (const [owner, ownId, foreignRef] of [[A, SA, 'EQ000000002PT'], [B, SB, 'EQ000000001PT'],
  [A, SA, 'LTK1000002'], [A, SA, 'unknown,tracking_number.eq.LTK1000002']]) {
  test('F02: contradictory references are denied before reading events: ' + owner + '/' + foreignRef, async () => {
    const h = harness({ ctx: { ...ctxA, client_id: owner }, eventsOnA: true })
    await assert.rejects(h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(ownId, foreignRef), /negado/)
    assert.equal(h.db.queries.some(q => q.table === 'tracking_events'), false)
    assert.equal(h.db.writes.length, 0)
  })
}
test('F02: original exploit with an empty own timeline and B reference is rejected before fallback', async () => {
  const h = harness()
  await assert.rejects(h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SA, 'EQ000000002PT'), /negado/)
  assert.equal(h.db.queries.some(q => q.table === 'tracking_events'), false)
  assert.equal(h.db.writes.length, 0)
  assert.equal(h.calls.providers.length, 0)
})
for (const ctx of [null, { ...ctxA, client_id: null }, { ...ctxA, tenant_id: '' }, { ...ctxA, role: null }]) {
  test('F02: missing session or incomplete scope stops before database reads: ' + JSON.stringify(ctx), async () => {
    const h = harness({ ctx })
    await assert.rejects(h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SA), /LOGIN_REQUIRED|negado/)
    assert.equal(h.db.queries.length, 0)
  })
}
test('F02: ownership lookup error never falls back to stale audit ownership', async () => {
  const h = harness({ failure: q => q.table === 'shipments' ? { message: 'Simulated authorization failure' } : null })
  h.db.tables.audit_log.push({ tenant_id: TENANT, action: 'shipment_data', details: { id: SB, client_id: A } })
  await assert.rejects(h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SB), /negado/)
  assert.equal(h.db.queries.length, 1)
})
test('F02: stale audit ownership cannot override an existing shipment or its latest snapshot', async () => {
  const h = harness()
  h.db.tables.audit_log.push({ tenant_id: TENANT, action: 'shipment_data', created_at: '2026-10-01', details: { id: SB, client_id: A } })
  const action = h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction
  await assert.rejects(action(SB), /negado/)
  h.db.tables.shipments = h.db.tables.shipments.filter(s => s.id !== SB)
  h.db.tables.audit_log.push({ tenant_id: TENANT, action: 'shipment_data', created_at: '2026-10-02', details: { id: SB, client_id: B } })
  await assert.rejects(action(SB), /negado/)
  assert.equal(h.db.queries.some(q => q.table === 'tracking_events'), false)
})
test('F02: a failed legacy ownership query denies access before events', async () => {
  const h = harness({ failure: q => q.table === 'audit_log' ? { message: 'Simulated audit failure' } : null })
  h.db.tables.shipments = []
  await assert.rejects(h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SA), /negado/)
  assert.equal(h.db.queries.some(q => q.table === 'tracking_events'), false)
})
test('F02: a valid legacy shipment can resolve matching stored events in its own store', async () => {
  const h = harness({ eventsOnA: true })
  h.db.tables.audit_log.push({ tenant_id: TENANT, action: 'shipment_data', details: {
    id: FOREIGN, client_id: A, carrier_tracking_number: 'EQ000000001PT',
  } })
  const result = await h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(FOREIGN, 'EQ000000001PT')
  assert.deepEqual(result.map(e => e.description), ['OWN-A-EVENT'])
})
test('F02: Correos timelines and the legacy CTT object reference remain supported', async () => {
  const h = harness({ eventsOnA: true, failure: q => q.table === 'shipments' && q.projection.includes('ctt_object_id')
    ? { message: 'Optional ctt_object_id column is absent from the live shipments schema' } : null })
  Object.assign(h.db.tables.shipments[0], { carrier_code: 'correos', carrier_tracking_number: '0000000000000001' })
  const action = h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction
  assert.deepEqual((await action(SA, '0000000000000001')).map(e => e.description), ['OWN-A-EVENT'])
  h.db.tables.shipments = h.db.tables.shipments.filter(s => s.id !== SA)
  h.db.tables.audit_log.push({ tenant_id: TENANT, action: 'shipment_data', details: {
    id: SA, client_id: A, carrier_code: 'ctt', ctt_object_id: 'EQ000000001PT',
  } })
  assert.deepEqual((await action(SA, 'EQ000000001PT')).map(e => e.description), ['OWN-A-EVENT'])
})
test('F02: public exact-reference tracking keeps its separate intended behavior', async () => {
  const h = harness({ ctx: null, eventsOnA: true })
  h.db.tables.shipment_metadata = h.db.tables.shipments.map(s => ({ ...s, details: s }))
  const result = await h.load('app/actions/shipments.ts').getPublicShipmentTrackingAction('LTK1000001')
  assert.equal(result.success, true)
  assert.deepEqual(result.timeline.map(e => e.description), ['OWN-A-EVENT'])
  assert.equal(h.db.writes.length, 0)
})
for (const role of ['client', 'employee', 'admin']) {
  test('F02: another tenant is denied even with matching client ownership: ' + role, async () => {
    const h = harness({ ctx: { ...ctxA, role } })
    h.db.tables.shipments[0].tenant_id = FOREIGN
    await assert.rejects(h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SA), /negado/)
    assert.equal(h.db.queries.some(q => q.table === 'tracking_events'), false)
  })
}
test('F02: own events and historical events are tenant scoped', async () => {
  const h = harness({ eventsOnA: true })
  h.db.tables.tracking_events.push({ tenant_id: FOREIGN, shipment_id: SA, description: 'FOREIGN-EVENT' })
  let result = await h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SA)
  assert.deepEqual(result.map(e => e.description), ['OWN-A-EVENT'])
  h.db.tables.tracking_events = []
  h.db.tables.audit_log.push({ tenant_id: FOREIGN, entity_id: SA, details: { status: 'entregue', description: 'FOREIGN-AUDIT' } },
    { tenant_id: TENANT, entity_id: SA, details: { status: 'entregue', description: 'OWN-AUDIT' } })
  result = await h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SA)
  assert.deepEqual(result.map(e => e.description), ['OWN-AUDIT'])
})
test('F02: a shared carrier reference never links a timeline from another store or tenant', async () => {
  const h = harness()
  h.db.tables.shipments[1].carrier_tracking_number = 'EQ000000001PT'
  h.db.tables.shipments.reverse()
  assert.deepEqual(await h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SA, 'EQ000000001PT'), [])
  h.db.tables.shipments[0].client_id = A
  h.db.tables.shipments[0].tenant_id = FOREIGN
  assert.deepEqual(await h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SA, 'EQ000000001PT'), [])
})
for (const reference of [undefined, 'EQ000000001PT', 'LTK1000001']) {
  test('F02: own timeline works with an optional canonical reference: ' + reference, async () => {
    const h = harness({ eventsOnA: true })
    const result = await h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SA, reference)
    assert.deepEqual(result.map(e => e.description), ['OWN-A-EVENT'])
  })
}
test('F02: legacy audit shipments require matching tenant and store', async () => {
  const h = harness()
  h.db.tables.shipments = h.db.tables.shipments.filter(s => s.id !== SA)
  const legacy = { id: SA, client_id: A, carrier_tracking_number: 'EQ000000001PT', tracking_number: 'LTK1000001' }
  h.db.tables.audit_log.push({ tenant_id: TENANT, action: 'shipment_data', details: legacy },
    { tenant_id: TENANT, entity_id: SA, details: { status: 'entregue', description: 'OWN-LEGACY' } })
  const result = await h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SA, 'EQ000000001PT')
  assert.deepEqual(result.map(e => e.description), ['OWN-LEGACY'])
  legacy.client_id = B
  await assert.rejects(h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SA), /negado/)
  legacy.client_id = A
  h.db.tables.audit_log.find(row => row.action === 'shipment_data').tenant_id = FOREIGN
  await assert.rejects(h.load('app/actions/shipments.ts').getShipmentTrackingTimelineAction(SA), /negado/)
})
for (const role of ['employee', 'admin']) {
  test('F02: authorized staff retain access to both stores in their tenant: ' + role, async () => {
    const h = harness({ ctx: { ...ctxA, role }, eventsOnA: true })
    const actions = h.load('app/actions/shipments.ts')
    assert.deepEqual((await actions.getShipmentTrackingTimelineAction(SA)).map(e => e.description), ['OWN-A-EVENT'])
    assert.deepEqual((await actions.getShipmentTrackingTimelineAction(SB)).map(e => e.description), ['PRIVATE-B-EVENT'])
  })
}
for (const [carrier, tracking] of [['ctt', 'EQ000000002PT'], ['correos', '0000000000000002']]) {
  test('F03: lookup failure must deny tracking sync before fetching or modifying B (' + carrier + ')', async t => {
    const h = harness({ failure: query => query.table === 'shipments' && query.projection === '*' && !query.write
      && query.filters.some(filter => filter.name === 'id' && filter.value === SB) ? { message: 'Simulated lookup failure' } : null })
    const result = await h.load('app/actions/shipments.ts').syncShipmentTrackingAction(tracking, SB)
    const statusB = h.db.tables.shipments.find(row => row.id === SB).status
    t.diagnostic('Mock provider calls: ' + h.calls.providers.length + '; writes: ' + h.db.writes.length + '; store B status: ' + statusB)
    assert.equal(result.success, false, 'A failed ownership lookup must fail closed')
    assert.equal(h.calls.providers.length, 0)
    assert.equal(h.db.writes.length, 0)
    assert.equal(statusB, 'pendente')
  })
}


// F03: every client sync must resolve a shipment in the session scope before side effects.
for (const [file, action] of [
  ['app/actions/shipments.ts', 'syncShipmentTrackingAction'],
  ['app/actions/ctt.ts', 'syncCttTrackingAction'],
]) {
  for (const field of ['id', 'tracking_number', 'carrier_tracking_number']) {
    test('F03: ' + action + ' stops on lookup errors in ' + field, async () => {
      const h = harness({ failure: query => query.table === 'shipments' && !query.write
        && query.filters.some(filter => filter.name === field) ? { message: 'Private DB error' } : null })
      const tracking = field === 'tracking_number' ? 'LTK1000001' : 'EQ000000001PT'
      const result = await h.load(file)[action](tracking, field === 'id' ? SA : undefined)
      assert.equal(result.success, false)
      assert.equal(result.error.includes('Private DB error'), false)
      assert.equal(h.calls.providers.length, 0)
      assert.equal(h.db.writes.length, 0)
    })
  }
  test('F03: ' + action + ' stops on a thrown database exception', async () => {
    const h = harness({ failure: () => { throw new Error('Private DB exception') } })
    const result = await h.load(file)[action]('EQ000000001PT', SA)
    assert.equal(result.success, false)
    assert.equal(result.error.includes('Private DB exception'), false)
    assert.equal(h.calls.providers.length, 0)
    assert.equal(h.db.writes.length, 0)
  })
  test('F03: ' + action + ' denies missing, other-store and other-company shipments', async () => {
    for (const scenario of ['missing-id', 'missing-reference', 'other-store', 'other-company']) {
      const h = harness()
      if (scenario === 'other-company') h.db.tables.shipments.find(row => row.id === SA).tenant_id = FOREIGN
      const id = scenario === 'missing-id' ? FOREIGN : scenario === 'missing-reference' ? undefined : scenario === 'other-store' ? SB : SA
      const result = await h.load(file)[action]('UNKNOWN-TRACKING', id)
      assert.equal(result.success, false, scenario)
      assert.equal(h.calls.providers.length, 0, scenario)
      assert.equal(h.db.writes.length, 0, scenario)
    }
  })
  for (const carrier of ['ctt', 'correos']) {
    test('F03: ' + action + ' syncs only the verified own shipment (' + carrier + ')', async () => {
      for (const lookup of ['id', 'tracking_number', 'carrier_tracking_number']) {
        const h = harness()
        const own = h.db.tables.shipments.find(row => row.id === SA)
        own.carrier_code = carrier
        own.carrier_tracking_number = carrier === 'correos' ? '0000000000000001' : 'EQ000000001PT'
        const tracking = lookup === 'tracking_number' ? own.tracking_number : own.carrier_tracking_number
        const result = await h.load(file)[action](tracking, lookup === 'id' ? SA : undefined)
        assert.equal(result.success, true)
        assert.deepEqual(h.calls.providers, [{ carrier, tracking: own.carrier_tracking_number }])
        assert.equal(own.status, 'entregue')
        assert.equal(h.db.tables.shipments.find(row => row.id === SB).status, 'pendente')
        assert.ok(h.db.writes.every(write => write.table === 'shipments'
          ? write.filters.some(filter => filter.name === 'id' && filter.value === SA)
          : write.value.shipment_id === SA))
        const lookups = h.db.queries.filter(query => query.table === 'shipments' && query.projection === '*' && !query.write)
        assert.ok(lookups.length > 0)
        for (const query of lookups) {
          assert.ok(query.filters.some(filter => filter.name === 'tenant_id' && filter.value === TENANT))
          assert.ok(query.filters.some(filter => filter.name === 'client_id' && filter.value === A))
        }
      }
    })
  }
  test('F03: ' + action + ' rejects anonymous users before database access', async () => {
    const h = harness({ ctx: null })
    await assert.rejects(h.load(file)[action]('EQ000000001PT', SA), /LOGIN_REQUIRED/)
    assert.equal(h.db.queries.length, 0)
    assert.equal(h.calls.providers.length, 0)
  })
  for (const role of ['employee', 'admin']) {
    test('F03: ' + action + ' preserves ' + role + ' access across stores', async () => {
      const h = harness({ ctx: { ...ctxA, role, client_id: null } })
      const result = await h.load(file)[action]('EQ000000002PT', SB)
      assert.equal(result.success, true)
      assert.deepEqual(h.calls.providers, [{ carrier: 'ctt', tracking: 'EQ000000002PT' }])
      assert.equal(h.db.tables.shipments.find(row => row.id === SB).status, 'entregue')
    })
  }
}
test('F03: clients cannot substitute a preloaded shipment or opt out of verification', async () => {
  const h = harness()
  const result = await h.load('lib/services/tracking/tracking-dispatcher.ts').syncShipmentTracking(
    { shipmentId: SB, shipment: { id: SB, tenant_id: TENANT, client_id: A, carrier_tracking_number: 'EQ000000002PT' } },
    { userRole: 'client', clientId: A, tenantId: TENANT, skipAuth: true })
  assert.equal(result.success, false)
  assert.equal(h.calls.providers.length, 0)
  assert.equal(h.db.writes.length, 0)
})
test('F03: missing client or company scope fails before querying shipments', async () => {
  for (const scope of [{ clientId: null, tenantId: TENANT }, { clientId: A, tenantId: null }]) {
    const h = harness()
    const result = await h.load('lib/services/tracking/tracking-dispatcher.ts').syncShipmentTracking(
      { shipmentId: SA, trackingNumber: 'EQ000000001PT' }, { userRole: 'client', ...scope })
    assert.equal(result.success, false)
    assert.equal(h.db.queries.length, 0)
    assert.equal(h.calls.providers.length, 0)
    assert.equal(h.db.writes.length, 0)
  }
})
test('F03: trusted scheduled sync retains preloaded shipment support', async () => {
  const h = harness()
  const shipment = h.db.tables.shipments.find(row => row.id === SB)
  const result = await h.load('lib/services/tracking/tracking-dispatcher.ts').syncShipmentTracking(
    { shipmentId: SB, shipment }, { skipAuth: true })
  assert.equal(result.success, true)
  assert.deepEqual(h.calls.providers, [{ carrier: 'ctt', tracking: 'EQ000000002PT' }])
  assert.equal(shipment.status, 'entregue')
})

test('F03: a submitted reference cannot redirect an authorized shipment to another carrier', async () => {
  const h = harness()
  const result = await h.load('app/actions/shipments.ts').syncShipmentTrackingAction('0000000000000002', SA)
  assert.equal(result.success, true)
  assert.deepEqual(h.calls.providers, [{ carrier: 'ctt', tracking: 'EQ000000001PT' }])
  assert.equal(h.db.tables.shipments.find(row => row.id === SA).status, 'entregue')
  assert.equal(h.db.tables.shipments.find(row => row.id === SB).status, 'pendente')
})
test('F03: an own shipment without stored references cannot use a submitted foreign reference', async () => {
  const h = harness()
  const own = h.db.tables.shipments.find(row => row.id === SA)
  own.tracking_number = null
  own.carrier_tracking_number = null
  const result = await h.load('app/actions/shipments.ts').syncShipmentTrackingAction('EQ000000002PT', SA)
  assert.equal(result.success, false)
  assert.equal(h.calls.providers.length, 0)
  assert.equal(h.db.writes.length, 0)
})


// Separate finding discovered while following tracking callers; not part of the F03 fix.
test('F04: anonymous batch sync must stop before reading shipments or calling carriers', async t => {
  const h = harness({ ctx: null })
  let denied = false
  try {
    await h.load('app/actions/shipments.ts').syncActiveShipmentsBatchAction([SB])
  } catch (error) {
    if (!/LOGIN_REQUIRED/.test(error.message)) throw error
    denied = true
  }
  t.diagnostic('Anonymous batch queries: ' + h.db.queries.length + '; provider calls: ' + h.calls.providers.length + '; writes: ' + h.db.writes.length)
  assert.equal(denied, true, 'The batch action must authenticate the caller')
  assert.equal(h.db.queries.length, 0)
  assert.equal(h.calls.providers.length, 0)
  assert.equal(h.db.writes.length, 0)
})
test('F04: client batch sync must not update another store shipment', async t => {
  const h = harness()
  await h.load('app/actions/shipments.ts').syncActiveShipmentsBatchAction([SB])
  const statusB = h.db.tables.shipments.find(row => row.id === SB).status
  t.diagnostic('Client A batch for B: provider calls: ' + h.calls.providers.length + '; writes: ' + h.db.writes.length + '; B status: ' + statusB)
  assert.equal(h.calls.providers.length, 0)
  assert.equal(h.db.writes.length, 0)
  assert.equal(statusB, 'pendente')
})


test('F04: anonymous callers cannot bypass authentication with empty or malformed batches', async () => {
  for (const input of [[], null, undefined, 'not-an-array']) {
    const h = harness({ ctx: null })
    await assert.rejects(h.load('app/actions/shipments.ts').syncActiveShipmentsBatchAction(input), /LOGIN_REQUIRED/)
    assert.equal(h.db.queries.length, 0)
    assert.equal(h.calls.providers.length, 0)
    assert.equal(h.db.writes.length, 0)
  }
})
for (const owner of [A, B]) {
  test('F04: mixed client batches update only the signed-in store (' + owner + ')', async () => {
    const h = harness({ ctx: { ...ctxA, client_id: owner } })
    const own = h.db.tables.shipments.find(row => row.client_id === owner)
    own.carrier_code = 'correos'
    own.carrier_tracking_number = owner === A ? '0000000000000001' : '0000000000000002'
    h.db.tables.shipments.push({ id: FOREIGN, tenant_id: FOREIGN, client_id: owner,
      status: 'pendente', carrier_tracking_number: 'EQ000000009PT' })
    const result = await h.load('app/actions/shipments.ts').syncActiveShipmentsBatchAction([SA, SB, FOREIGN, own.id])
    assert.equal(result.updatedCount, 1)
    assert.deepEqual(h.calls.providers, [{ carrier: 'correos', tracking: own.carrier_tracking_number }])
    assert.equal(own.status, 'entregue')
    assert.ok(h.db.tables.shipments.filter(row => row.id !== own.id).every(row => row.status === 'pendente'))
    assert.ok(h.db.writes.every(write => write.table === 'shipments'
      ? write.filters.some(filter => filter.name === 'id' && filter.value === own.id)
      : write.value.shipment_id === own.id))
    const lookups = h.db.queries.filter(query => query.table === 'shipments' && query.projection === '*' && !query.write)
    assert.ok(lookups.length >= 2, 'Client ownership must also be checked by the dispatcher')
    for (const query of lookups) {
      assert.ok(query.filters.some(filter => filter.name === 'client_id' && filter.value === owner))
      assert.ok(query.filters.some(filter => filter.name === 'tenant_id' && filter.value === TENANT))
    }
  })
}
for (const role of ['employee', 'admin']) {
  test('F04: ' + role + ' batch can update both stores within the signed-in company', async () => {
    const h = harness({ ctx: { ...ctxA, role, client_id: A } })
    h.db.tables.shipments.push({ id: FOREIGN, tenant_id: FOREIGN, client_id: A,
      status: 'pendente', carrier_tracking_number: 'EQ000000009PT' })
    const result = await h.load('app/actions/shipments.ts').syncActiveShipmentsBatchAction([SA, SB, FOREIGN])
    assert.equal(result.updatedCount, 2)
    assert.deepEqual(h.calls.providers.map(call => call.tracking).sort(), ['EQ000000001PT', 'EQ000000002PT'])
    assert.equal(h.db.tables.shipments.find(row => row.id === FOREIGN).status, 'pendente')
    assert.ok(h.db.queries.filter(query => query.table === 'shipments' && query.projection === '*')
      .every(query => query.filters.some(filter => filter.name === 'tenant_id' && filter.value === TENANT)))
  })
}
test('F04: batches ignore completed shipments and unknown IDs', async () => {
  for (const status of ['entregue', 'cancelado', 'devolvido']) {
    const h = harness()
    h.db.tables.shipments.find(row => row.id === SA).status = status
    const result = await h.load('app/actions/shipments.ts').syncActiveShipmentsBatchAction([SA, FOREIGN])
    assert.equal(result.updatedCount, 0)
    assert.equal(h.calls.providers.length, 0)
    assert.equal(h.db.writes.length, 0)
  }
})
test('F04: returned errors and thrown exceptions stop the batch before side effects', async () => {
  for (const thrown of [false, true]) {
    const h = harness({ failure: query => {
      if (query.table !== 'shipments') return null
      if (thrown) throw new Error('Private DB exception')
      return { message: 'Private DB error' }
    } })
    const result = await h.load('app/actions/shipments.ts').syncActiveShipmentsBatchAction([SA])
    assert.equal(result.updatedCount, 0)
    assert.equal(typeof result.error, 'string')
    assert.equal(result.error.includes('Private DB'), false)
    assert.equal(h.calls.providers.length, 0)
    assert.equal(h.db.writes.length, 0)
  }
})
test('F04: a failed ownership recheck cannot use the earlier batch snapshot', async () => {
  const h = harness({ failure: query => query.table === 'shipments' && query.projection === '*'
    && query.filters.some(filter => filter.name === 'id' && filter.kind === 'eq') ? { message: 'Recheck failed' } : null })
  const result = await h.load('app/actions/shipments.ts').syncActiveShipmentsBatchAction([SA])
  assert.equal(result.updatedCount, 0)
  assert.equal(h.calls.providers.length, 0)
  assert.equal(h.db.writes.length, 0)
})
test('F04: ownership changes before the client recheck stop that shipment', async () => {
  const h = harness({ failure: query => {
    if (query.table === 'shipments' && query.projection === '*'
      && query.filters.some(filter => filter.name === 'id' && filter.value === SA)) {
      h.db.tables.shipments.find(row => row.id === SA).client_id = B
    }
    return null
  } })
  const result = await h.load('app/actions/shipments.ts').syncActiveShipmentsBatchAction([SA])
  assert.equal(result.updatedCount, 0)
  assert.equal(h.calls.providers.length, 0)
  assert.equal(h.db.writes.length, 0)
})
test('F04: missing company or client scope stops before querying shipments', async () => {
  for (const scope of [{ tenant_id: null }, { client_id: null }]) {
    const h = harness({ ctx: { ...ctxA, ...scope } })
    await assert.rejects(h.load('app/actions/shipments.ts').syncActiveShipmentsBatchAction([SA]))
    assert.equal(h.db.queries.length, 0)
    assert.equal(h.calls.providers.length, 0)
    assert.equal(h.db.writes.length, 0)
  }
})
test('F04: authenticated empty or malformed batches do not query shipments', async () => {
  for (const input of [[], null, undefined, 'not-an-array', [null, false, 123, '', ' ']]) {
    const h = harness()
    const result = await h.load('app/actions/shipments.ts').syncActiveShipmentsBatchAction(input)
    assert.equal(result.updatedCount, 0)
    assert.equal(h.db.queries.length, 0)
    assert.equal(h.calls.providers.length, 0)
  }
})

for (const billingType of ['conta_corrente', 'pay_as_you_go']) {
  test('PERF: portal reads run concurrently with the signed-in store and preserve ' + billingType + ' totals', async () => {
    const h = harness()
    const started = []
    const release = {}
    const read = (name, scope) => {
      started.push([name, scope])
      return new Promise(resolve => { release[name] = resolve })
    }
    h.mocks['@/lib/services/shipments/shipment-fetcher'] = {
      fetchShipments: options => read('shipments', options.clientId),
    }
    h.mocks['@/app/actions/moloni'] = { getBillingStatementsAction: id => read('statements', id) }
    h.mocks['@/app/actions/clientes'].getClientesAction = id => read('profile', id)
    const pending = h.load('app/actions/shipments.ts').getClientPortalStatsAction(B, 'Fictional B')
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(started.map(([name]) => name).sort(), ['profile', 'shipments', 'statements'])
    assert.ok(started.every(([, scope]) => scope === A))
    release.profile([{ id: A, billing_type: billingType }])
    release.statements([{ client_id: A, moloni_document_id: 42, total_value: 5 }])
    release.shipments([
      { id: SA, client_id: A, status: 'pendente', sell_price: 10, fuel_tax_amount: 1 },
      { id: 'billed-own', client_id: A, status: 'entregue', sell_price: 20, fuel_tax_amount: 1, billing_statement_id: 'billed' },
      { id: 'cancelled-own', client_id: A, status: 'anulado', sell_price: 100 },
    ])
    const result = await pending
    assert.equal(result.totalRevenue, billingType === 'pay_as_you_go' ? 32 : 16)
    assert.equal(result.totalCount, 3)
    assert.equal(result.deliveredCount, 1)
  })
}
