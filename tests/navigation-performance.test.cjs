const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { auditDatabase } = require('./helpers/client-isolation-audit-db.cjs')

const ctx = { user: { id: 'fixture-user' }, role: 'client', client_id: 'store-a', tenant_id: 'company-a' }
function request(body = { shipmentIds: ['shipment-a'] }, origin = 'https://fixture.invalid') {
  return new Request('https://fixture.invalid/api/tracking/sync', { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body) })
}
function routeHarness(context = ctx, response = { updatedCount: 1 }) {
  const calls = []
  const route = createLoader({
    '@/lib/auth/context': { getAuthContext: async () => context },
    '@/lib/services/tracking/tracking-batch': { syncAuthorizedShipmentBatch: async (...args) => {
      calls.push(args); return response
    } },
  })('app/api/tracking/sync/route.ts')
  return { route, calls }
}
test('background tracking API rejects anonymous, invalid scope and cross-origin requests before running a batch', async () => {
  for (const [context, origin, status] of [[null, 'https://fixture.invalid', 401],
    [{ ...ctx, tenant_id: null }, 'https://fixture.invalid', 403],
    [{ ...ctx, client_id: null }, 'https://fixture.invalid', 403],
    [ctx, 'https://other.invalid', 403], [ctx, null, 403]]) {
    const h = routeHarness(context)
    const res = await h.route.POST(request(undefined, origin))
    assert.equal(res.status, status)
    assert.equal(h.calls.length, 0)
  }
})
test('background tracking API passes only verified identity and returns private JSON, without a page refresh', async () => {
  for (const role of ['client', 'employee', 'admin']) {
    const verified = { ...ctx, role }
    const h = routeHarness(verified)
    const res = await h.route.POST(request({ shipmentIds: ['shipment-a'], role: 'admin',
      clientId: 'forged-store', tenantId: 'forged-company' }))
    assert.equal(res.status, 200)
    assert.deepEqual(h.calls, [[verified, ['shipment-a']]])
    assert.deepEqual(await res.json(), { updatedCount: 1 })
    assert.match(res.headers.get('Cache-Control'), /private.*no-store/)
  }
})
test('background tracking API rejects invalid selections and reports a failed database read', async () => {
  for (const body of ['invalid json', { shipmentIds: 'shipment-a' }, { shipmentIds: [null] },
    { shipmentIds: Array(51).fill('shipment-a') }]) {
    const h = routeHarness()
    assert.equal((await h.route.POST(request(body))).status, 400)
    assert.equal(h.calls.length, 0)
  }
  const h = routeHarness(ctx, { updatedCount: 0, error: 'Lookup failed' })
  assert.equal((await h.route.POST(request())).status, 503)
})
test('unchanged tracking no longer causes refresh; new events or changed state still refresh', async () => {
  for (const [count, latestStatus, code, expected, measurementsUpdated] of [[0, 'em_transito', 'EMA', 0, false],
    [1, 'em_transito', 'EMA', 1], [0, 'entregue', 'EMI', 1], [0, 'em_transito', 'EMF', 1],
    [0, 'em_transito', 'EMA', 1, true]]) {
    const db = auditDatabase({ shipments: [{ id: 'shipment-a', tenant_id: ctx.tenant_id,
      client_id: ctx.client_id, status: 'entrada_rede', ops_substatus: 'ema' }] })
    const calls = []
    const { syncAuthorizedShipmentBatch } = createLoader({
      '@/lib/supabase/server': { createAdminClient: () => db.client },
      '@/lib/services/tracking': { syncShipmentTracking: async (...args) => {
        calls.push(args); return { success: true, count, latestStatus, measurementsUpdated, event: { eventCode: code } }
      } },
    })('lib/services/tracking/tracking-batch.ts')
    assert.equal((await syncAuthorizedShipmentBatch(ctx, ['shipment-a'])).updatedCount, expected)
    assert.equal(calls[0][1].userRole, 'client')
    assert.equal(calls[0][1].tenantId, ctx.tenant_id)
    assert.equal(calls[0][1].clientId, ctx.client_id)
    assert.equal(calls[0][1].skipAuth, false)
  }
})
function pollingHarness(t) {
  const previous = { document: global.document, setTimeout: global.setTimeout,
    setInterval: global.setInterval, clearTimeout: global.clearTimeout, clearInterval: global.clearInterval }
  const timers = [], intervals = [], requests = []
  let effect, updates = 0
  global.document = { visibilityState: 'visible' }
  global.setTimeout = callback => { timers.push(callback); return 10 }
  global.setInterval = callback => { intervals.push(callback); return 20 }
  const cleared = []
  global.clearTimeout = id => cleared.push(id)
  global.clearInterval = id => cleared.push(id)
  t.after(() => Object.assign(global, previous))
  const { useTrackingPolling } = createLoader({
    react: { useEffect: callback => { effect = callback }, useEffectEvent: fn => fn },
    fetch: (url, options) => new Promise(resolve => { requests.push({ url, options, resolve }) }),
  })('lib/hooks/useTrackingPolling.ts')
  useTrackingPolling(['shipment-a'], () => { updates++ })
  const cleanup = effect()
  return { timers, intervals, requests, cleared, cleanup, get updates() { return updates } }
}
test('polling stays outside Server Actions, does not overlap and refreshes only changed data', async t => {
  const h = pollingHarness(t)
  assert.equal(h.requests.length, 0, 'Mounting a page must not immediately launch a carrier action')
  h.timers[0]()
  h.intervals[0]()
  assert.equal(h.requests.length, 1)
  assert.equal(h.requests[0].url, '/api/tracking/sync')
  assert.equal(h.requests[0].options.credentials, 'same-origin')
  h.requests[0].resolve(Response.json({ updatedCount: 0 }))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.updates, 0)
  h.intervals[0]()
  h.requests[1].resolve(Response.json({ updatedCount: 1 }))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.updates, 1)
  h.cleanup()
  assert.deepEqual(h.cleared, [10, 20])
  h.intervals[0]()
  assert.equal(h.requests.length, 2)
})
test('polling skips hidden pages and ignores a late response after navigation', async t => {
  const h = pollingHarness(t)
  document.visibilityState = 'hidden'
  h.timers[0]()
  assert.equal(h.requests.length, 0)
  document.visibilityState = 'visible'
  h.intervals[0]()
  h.cleanup()
  assert.equal(h.requests[0].options.signal.aborted, true)
  h.requests[0].resolve(Response.json({ updatedCount: 1 }))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.updates, 0)
})
