const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const T = '11111111-1111-1111-1111-111111111111', A = '22222222-2222-2222-2222-222222222222', B = '33333333-3333-3333-3333-333333333333'
const ID = '44444444-4444-4444-4444-444444444444', OTHER = '55555555-5555-5555-5555-555555555555'
const input = () => ({ date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0,10), period: '09:00-19:00', carrier: 'ctt_expresso',
  volumes: 1, weightKg: 3, heaviestWeightKg: 3, name: 'Armazém A', address: 'Rua A 1', city: 'Porto', postal: '4000-001', contact: 'Ana', phone: '912345678', email: '', notes: 'Campainha do armazém' })
function harness(options = {}) {
  let role = options.role || 'client', allow = true
  const tables = { audit_log: [] }, db = fakeSupabase(tables, options.failure, { persistInserts: true }), calls = [], emails = []
  const ctx = () => ({ role, tenant_id: T, client_id: role === 'client' ? A : null, user: { id: 'trusted-actor' } })
  const auth = { requireUser: async permission => { if (!allow) throw Error('Forbidden'); assert.equal(permission, 'Pedidos de Recolha & Distribuição'); return ctx() },
    requireEmployee: async permission => { if (!allow || role === 'client') throw Error('Forbidden'); assert.equal(permission, 'Pedidos de Recolha & Distribuição'); return ctx() } }
  const load = createLoader({ zod: require('zod'), '@/lib/auth/context': auth, '@/lib/supabase/server': { createAdminClient: () => db.client },
    './clientes': { getClientesAction: async id => id === A ? [{ id: A, short_name: 'Loja A', is_active: options.active !== false }] : [] },
    '@/lib/client-portal/suspension': { readPortalAccess: async () => ({ suspended: !!options.suspended, blocked: !!options.blocked }) },
    '@/lib/email/pickup-confirmation': { notifyPickupConfirmation: async (db, tenant, request) => { if (request.status !== 'completed') throw Error('Ainda não confirmado'); assert.equal(tables.audit_log.find(row => row.id === request.id).details.status, 'completed'); emails.push(request.id); if (options.emailFailure) throw Error('Fixture email unavailable'); return { skipped: false } } },
    './ctt': { scheduleCttPickupAction: async booking => { calls.push(booking); if (options.throwCarrier) throw Error('Timeout'); return options.carrierResult || { success: true, pickupNumber: '1519176/26', carrier_name: 'CTT Expresso', carrier_code: 'ctt_expresso' } } },
  })
  return { api: load('app/actions/client-pickup-requests.ts'), tables, db, calls, emails, staff: () => { role = 'employee' }, deny: () => { allow = false },
    request: (values = input(), id = ID, client = B) => load('app/actions/client-pickup-requests.ts').requestClientPickupAction(values, id, client) }
}

test('client creates a real pending Ops request scoped to the session, without carrier, shipment or wallet calls', async () => {
  const h = harness(), result = await h.request()
  assert.equal(result.success, true); assert.equal(result.request.status, 'pending'); assert.equal(result.request.client_id, A)
  assert.equal(h.calls.length, 0); assert.equal(h.db.writes.length, 1)
  assert.equal(h.emails.length, 0)
  const row = h.tables.audit_log[0]
  assert.equal(row.tenant_id, T); assert.equal(row.action, 'client_pickup_request'); assert.equal(row.details.created_by, 'trusted-actor')
  assert.equal(result.request.created_by, undefined); assert.equal(row.details.pickup.address, 'Rua A 1')
})

test('double clicks and retries create one request even after JSONB changes key order', async () => {
  const h = harness(), values = input()
  const results = await Promise.all([h.request(values), h.request(values)])
  assert.ok(results.every(result => result.success)); assert.equal(h.tables.audit_log.length, 1)
  h.tables.audit_log[0].details.pickup = Object.fromEntries(Object.entries(values).reverse())
  assert.equal((await h.request(values)).success, true)
  assert.equal((await h.request({ ...values, weightKg: 4, heaviestWeightKg: 4 })).success, false)
  assert.equal(h.tables.audit_log.length, 1)
})

test('invalid, forged and suspended requests cannot be saved', async () => {
  for (const patch of [{ status: 'completed' }, { client_id: B }, { date: '2000-01-01' }, { date: '2099-02-30' }, { weightKg: 0 }, { volumes: 1.5 }, { heaviestWeightKg: 4 }, { phone: '' }]) {
    const h = harness(); assert.equal((await h.request({ ...input(), ...patch })).success, false); assert.equal(h.db.writes.length, 0)
  }
  for (const options of [{ suspended: true }, { blocked: true }, { active: false }]) {
    const h = harness(options); assert.equal((await h.request()).success, false); assert.equal(h.db.writes.length, 0)
  }
})

test('client listing is paginated, ignores a foreign client override and redacts Ops processing and actors', async () => {
  const h = harness(); await h.request()
  const original = h.tables.audit_log[0]
  original.details.status = 'processing'; original.details.processing_by = 'private-operator'
  h.tables.audit_log.push({ ...original, id: OTHER, details: { ...original.details, id: OTHER, client_id: B } },
    { ...original, id: 'foreign-tenant', tenant_id: 'foreign' })
  const result = await h.api.listClientPickupRequestsAction({ clientId: B })
  assert.equal(result.total, 1); assert.equal(result.requests[0].id, ID); assert.equal(result.requests[0].status, 'pending')
  assert.doesNotMatch(JSON.stringify(result), /private-operator|processing_by|created_by/)
  h.staff()
  const ops = await h.api.listClientPickupRequestsAction({ pendingOnly: true })
  assert.equal(ops.total, 2); assert.equal(ops.requests[0].status, 'processing')
  assert.equal((await h.api.listClientPickupRequestsAction({ page: 1 })).requests.length, 0)
  assert.equal((await h.api.listClientPickupRequestsAction({ page: -1 })).success, false)
  assert.ok(h.db.queries.filter(query => !query.write).every(query => query.filters.some(filter => filter.field === 'tenant_id' && filter.value === T)))
})

test('client accounts and staff without permissions cannot book, complete or reopen a pickup', async () => {
  const h = harness(); await h.request(); const count = h.db.queries.length
  for (const call of [() => h.api.scheduleClientPickupRequestAction(ID, {}), () => h.api.completeClientPickupRequestAction(ID, 'REF', 'CTT Expresso'), () => h.api.reopenClientPickupRequestAction(ID, true), () => h.api.getPendingClientPickupRequestsCountAction(), () => h.api.sendClientPickupConfirmationEmailAction(ID)]) await assert.rejects(call, /Forbidden/)
  assert.equal(h.db.queries.length, count); assert.equal(h.calls.length, 0)
  h.staff(); h.deny()
  await assert.rejects(h.api.listClientPickupRequestsAction(), /Forbidden/)
  await assert.rejects(h.api.scheduleClientPickupRequestAction(ID, {}), /Forbidden/)
})

test('history paginates beyond the first page without mixing companies or losing requests', async () => {
  const h = harness(); await h.request()
  const original = h.tables.audit_log[0]
  for (let i = 0; i < 30; i++) {
    const id = `aaaaaaaa-aaaa-aaaa-aaaa-${String(i).padStart(12, '0')}`
    h.tables.audit_log.push({ ...original, id, details: { ...original.details, id } })
  }
  const first = await h.api.listClientPickupRequestsAction(), second = await h.api.listClientPickupRequestsAction({ page: 1 })
  assert.equal(first.total, 31); assert.equal(first.requests.length, 25); assert.equal(second.requests.length, 6)
  assert.equal(new Set([...first.requests, ...second.requests].map(row => row.id)).size, 31)
})

test('sidebar counts all outstanding requests beyond page limits, excluding completed requests and other companies', async () => {
  const h = harness(); await h.request(); h.staff()
  const original = h.tables.audit_log[0]
  for (let i = 0; i < 1005; i++) h.tables.audit_log.push({ ...original, id: `request-${i}`, details: { ...original.details, status: i % 2 ? 'pending' : 'processing' } })
  h.tables.audit_log.push({ ...original, id: 'done', details: { ...original.details, status: 'completed' } }, { ...original, id: 'foreign', tenant_id: 'foreign' })
  assert.equal(await h.api.getPendingClientPickupRequestsCountAction(), 1006)
  const query = h.db.queries.at(-1)
  assert.equal(query.projection, 'id'); assert.equal(query.count, 'exact'); assert.equal(query.range, undefined)
  assert.equal(h.calls.length, 0)
})

test('foreign company request IDs cannot be booked or marked completed by staff', async () => {
  const h = harness(); await h.request(); h.staff()
  const original = h.tables.audit_log[0]
  h.tables.audit_log.push({ ...original, id: OTHER, tenant_id: 'foreign-tenant', details: { ...original.details, id: OTHER } })
  const count = h.db.writes.length
  assert.equal((await h.api.scheduleClientPickupRequestAction(OTHER, {})).success, false)
  assert.equal((await h.api.completeClientPickupRequestAction(OTHER, 'REF', 'CTT Expresso')).success, false)
  assert.equal(h.db.writes.length, count); assert.equal(h.calls.length, 0)
})

test('Ops booking claims the request once, reuses the current scheduler, and marks it completed after carrier acceptance', async () => {
  const h = harness(); await h.request(); h.staff()
  const results = await Promise.all([h.api.scheduleClientPickupRequestAction(ID, { client_id: B }), h.api.scheduleClientPickupRequestAction(ID, { client_id: B })])
  assert.equal(results.filter(result => result.success).length, 1); assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].client_id, A); assert.equal(h.calls[0].client_request_id, ID)
  const saved = h.tables.audit_log[0].details
  assert.equal(saved.status, 'completed'); assert.equal(saved.carrier_reference, '1519176/26'); assert.equal(saved.completed_by, 'trusted-actor')
  assert.deepEqual(h.emails, [ID])
  assert.equal((await h.api.listClientPickupRequestsAction({ pendingOnly: true })).total, 0)
})

test('uncertain or failed carrier responses stay pending to the client and cannot be booked again automatically', async () => {
  for (const options of [{ throwCarrier: true }, { carrierResult: { success: false, error: 'Carrier error' } }, { carrierResult: { success: true, carrier_name: 'CTT Expresso' } }]) {
    const h = harness(options); await h.request(); h.staff()
    assert.equal((await h.api.scheduleClientPickupRequestAction(ID, {})).success, false)
    assert.equal(h.tables.audit_log[0].details.status, 'processing')
    assert.equal((await h.api.scheduleClientPickupRequestAction(ID, {})).success, false); assert.equal(h.calls.length, 1)
    assert.equal((await h.api.reopenClientPickupRequestAction(ID, false)).success, false)
    assert.equal((await h.api.reopenClientPickupRequestAction(ID, true)).success, true)
    assert.equal(h.tables.audit_log[0].details.status, 'pending')
  }
})

test('manual completion requires a confirmed carrier reference and never calls a carrier', async () => {
  const h = harness(); await h.request(); h.staff()
  assert.equal((await h.api.completeClientPickupRequestAction(ID, '', 'CTT Expresso')).success, false)
  assert.equal((await h.api.completeClientPickupRequestAction(OTHER, 'REF', 'CTT Expresso')).success, false)
  assert.equal((await h.api.completeClientPickupRequestAction(ID, 'CEX123', 'Correos Express')).success, true)
  const before = h.db.writes.length
  assert.equal((await h.api.completeClientPickupRequestAction(ID, 'CEX123', 'Correos Express')).success, true)
  assert.equal(h.db.writes.length, before); assert.equal(h.calls.length, 0)
})

test('failed confirmation emails preserve the booked pickup and can be retried without another carrier request', async () => {
  const h = harness({ emailFailure: true }); await h.request(); h.staff()
  assert.equal((await h.api.sendClientPickupConfirmationEmailAction(ID)).success, false)
  const result = await h.api.scheduleClientPickupRequestAction(ID, {})
  assert.equal(result.success, true); assert.match(result.notification_warning, /Email de confirmação/)
  assert.equal(h.tables.audit_log[0].details.status, 'completed')
  assert.equal((await h.api.sendClientPickupConfirmationEmailAction(ID)).success, false)
  assert.equal(h.calls.length, 1)
  assert.equal((await h.api.sendClientPickupConfirmationEmailAction(OTHER)).success, false)
})

test('database failures cannot report success or book after a failed claim', async () => {
  let fail = true
  const h = harness({ failure: q => fail && q.write ? { message: 'Fixture storage unavailable' } : null })
  assert.equal((await h.request()).success, false); assert.equal(h.tables.audit_log.length, 0)
  fail = false; await h.request(); h.staff(); fail = true
  assert.equal((await h.api.scheduleClientPickupRequestAction(ID, {})).success, false); assert.equal(h.calls.length, 0)
})

test('accepted bookings retain success and the carrier reference if the final request update fails', async () => {
  const h = harness({ failure: q => q.write?.value?.details?.status === 'completed' ? { message: 'Fixture final write failure' } : null })
  await h.request(); h.staff()
  const result = await h.api.scheduleClientPickupRequestAction(ID, {})
  assert.equal(result.success, true); assert.equal(result.pickupNumber, '1519176/26'); assert.match(result.request_update_warning, /Marcar efetuado/)
  assert.equal(h.tables.audit_log[0].details.status, 'processing')
  assert.equal((await h.api.scheduleClientPickupRequestAction(ID, {})).success, false); assert.equal(h.calls.length, 1)
})
