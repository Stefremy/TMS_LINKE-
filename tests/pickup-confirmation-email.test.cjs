const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const T = '11111111-1111-1111-1111-111111111111', C = '22222222-2222-2222-2222-222222222222', ID = '44444444-4444-4444-4444-444444444444'
const request = { id: ID, reference: 'PR-444444444444', client_id: C, client_name: 'Loja <A & B>', status: 'completed', carrier_reference: '1519176/26', carrier_name: 'CTT Expresso', pickup: { email: 'untrusted-form@example.invalid' } }
function harness(options = {}) {
  const tables = { audit_log: options.noProfile ? [] : [{ id: 'profile', tenant_id: T, action: 'client_data', details: { id: C, email: options.email ?? 'registered@example.invalid' } }] }
  const db = fakeSupabase(tables, options.failure, { persistInserts: true }), calls = [], deliveries = [], provider = new Map()
  let lost = false
  const load = createLoader({
    './resend': { sendEmail: async email => {
      calls.push(structuredClone(email))
      if (options.failSend) return { success: false, error: 'Fixture failure' }
      let result = provider.get(email.idempotencyKey)
      if (!result) { deliveries.push(email); result = { payload: JSON.stringify(email), id: 'fixture-email-id' }; provider.set(email.idempotencyKey, result) }
      assert.equal(JSON.stringify(email), result.payload, 'retries must retain the identical recipient and payload')
      if (options.lostResponse && !lost) { lost = true; return { success: false, error: 'Fixture lost response' } }
      return { success: true, data: { id: result.id } }
    } },
    '@/lib/config/public-origins': { publicUrl: (path, audience) => { assert.equal(audience, 'portal'); return `https://portal.example.invalid${path}` } },
  })
  const { notifyPickupConfirmation } = load('lib/email/pickup-confirmation.ts')
  return { tables, calls, deliveries, db, send: (value = request, tenant = T) => notifyPickupConfirmation(db.client, tenant, value), emailRow: () => tables.audit_log.find(row => row.action === 'client_pickup_confirmation_email') }
}

test('confirmed pickup email uses notificacoes and the registered client contact, with escaped references and the portal link', async () => {
  const h = harness(); await h.send()
  assert.equal(h.calls[0].from, 'Linke <notificacoes@linke.pt>')
  assert.equal(h.calls[0].to, 'registered@example.invalid'); assert.doesNotMatch(JSON.stringify(h.calls), /untrusted-form/)
  assert.match(h.calls[0].subject, /Recolha confirmada/); assert.match(h.calls[0].html, /1519176\/26/)
  assert.match(h.calls[0].html, /https:\/\/portal.example.invalid\/app\/recolhas/)
  assert.match(h.calls[0].html, /Loja &lt;A &amp; B&gt;/); assert.doesNotMatch(h.calls[0].html, /Loja <A/)
  assert.equal(h.emailRow().details.status, 'sent'); assert.equal(h.emailRow().details.provider_id, 'fixture-email-id')
  assert.ok(h.db.queries.filter(query => !query.write).every(query => query.filters.some(filter => filter.field === 'tenant_id' && filter.value === T)))
})

test('pending/unconfirmed requests, foreign company profiles and invalid registered emails cannot trigger a send', async () => {
  for (const patch of [{ status: 'pending' }, { carrier_reference: '' }, { carrier_name: '' }]) {
    const h = harness(); await assert.rejects(h.send({ ...request, ...patch }), /confirmação/); assert.equal(h.calls.length, 0)
  }
  for (const options of [{ noProfile: true }, { email: 'invalid' }]) {
    const h = harness(options); await assert.rejects(h.send(), /email de contacto/); assert.equal(h.calls.length, 0)
  }
  const h = harness(); await assert.rejects(h.send(request, 'foreign'), /email de contacto/); assert.equal(h.calls.length, 0)
})

test('concurrent and later completion retries produce one delivered email and a durable sent marker', async () => {
  const h = harness(); await Promise.all([h.send(), h.send()])
  assert.equal(h.deliveries.length, 1)
  const count = h.calls.length
  h.emailRow().details.created_at = '2000-01-01T00:00:00Z'
  assert.equal((await h.send()).skipped, true); assert.equal(h.calls.length, count)
  assert.equal(h.tables.audit_log.filter(row => row.action === 'client_pickup_confirmation_email').length, 1)
})

test('lost email responses retry the same envelope and key without sending a second message', async () => {
  const h = harness({ lostResponse: true })
  await assert.rejects(h.send(), /confirmar o envio/)
  assert.equal(h.emailRow().details.status, 'pending')
  h.tables.audit_log[0].details.email = 'changed@example.invalid'
  await h.send()
  assert.equal(h.calls.length, 2); assert.deepEqual(h.calls[0], h.calls[1]); assert.equal(h.deliveries.length, 1)
  assert.equal(h.emailRow().details.status, 'sent')
})

test('failed envelope storage prevents sending, and accepted mail with a failed local receipt remains recoverable', async () => {
  const blocked = harness({ failure: query => query.write?.kind === 'insert' ? { message: 'Fixture insert failure' } : null })
  await assert.rejects(blocked.send(), /preparar/); assert.equal(blocked.calls.length, 0)
  let fail = true
  const h = harness({ failure: query => fail && query.write?.kind === 'update' ? { message: 'Fixture receipt failure' } : null })
  await assert.rejects(h.send(), /registo local falhou/)
  assert.equal(h.deliveries.length, 1); assert.equal(h.emailRow().details.status, 'pending')
  fail = false; await h.send(); assert.equal(h.deliveries.length, 1); assert.equal(h.emailRow().details.status, 'sent')
})

test('uncertain attempts outside the provider deduplication window require reconciliation, not an automatic duplicate', async () => {
  const h = harness({ lostResponse: true }); await assert.rejects(h.send())
  h.emailRow().details.created_at = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await assert.rejects(h.send(), /verificação no provedor/)
  assert.equal(h.calls.length, 1); assert.equal(h.deliveries.length, 1)
})


// ── Cancelamento e data do pedido ──
function cancelHarness(options = {}) {
  const tables = { audit_log: options.noEmail ? [] : [{ id: 'profile', tenant_id: T, action: 'client_data', details: { id: C, email: 'registered@example.invalid' } }] }
  const db = fakeSupabase(tables), sent = []
  const load = createLoader({
    './resend': { sendEmail: async email => { sent.push(email); return options.fail ? { success: false, error: 'down' } : { success: true, data: { id: 'x' } } } },
    '@/lib/config/public-origins': { publicUrl: path => `https://portal.example.invalid${path}` },
  })
  return { sent, cancel: value => load('lib/email/pickup-confirmation.ts').notifyPickupCancellation(db.client, T, value) }
}
const cancelled = { ...request, status: 'cancelled', carrier_reference: undefined, carrier_name: undefined, cancel_reason: 'Duplicado <script>',
  pickup: { date: '2026-11-25', period: '09:00-19:00', carrier: 'ctt_expresso', address: 'Rua A 1', postal: '4000-001', city: 'Porto', email: 'untrusted-form@example.invalid' } }

test('cancellation email goes to the registered contact once per request, says it was not sent to the carrier, and escapes client text', async () => {
  const h = cancelHarness()
  await h.cancel(cancelled)
  assert.equal(h.sent.length, 1)
  const [email] = h.sent
  assert.equal(email.to, 'registered@example.invalid'); assert.equal(email.from, 'Linke <notificacoes@linke.pt>')
  assert.equal(email.subject, 'Linke | Pedido de recolha cancelado · PR-444444444444')
  assert.equal(email.idempotencyKey, `pickup-cancelled-${ID}`)
  for (const text of ['Pedido de recolha cancelado', 'não foi pedido à transportadora', '25/11/2026 · 09:00 - 19:00', 'CTT Expresso', 'Rua A 1, 4000-001 Porto', 'Cancelado', 'https://portal.example.invalid/app/recolhas']) assert.ok(email.html.includes(text), text)
  assert.ok(email.html.includes('Loja &lt;A &amp; B&gt;')); assert.ok(email.html.includes('Duplicado &lt;script&gt;')); assert.ok(!email.html.includes('<script>'))
})

test('cancellation email is refused for requests that are not cancelled, missing contacts and provider failures', async () => {
  await assert.rejects(cancelHarness().cancel({ ...cancelled, status: 'pending' }), /não está cancelado/)
  await assert.rejects(cancelHarness({ noEmail: true }).cancel(cancelled), /email de contacto válido/)
  await assert.rejects(cancelHarness({ fail: true }).cancel(cancelled), /Não foi possível enviar/)
})

test('the confirmation email shows when the pickup was requested from the carrier', async () => {
  const h = harness()
  await h.send({ ...request, completed_at: '2026-11-23T14:05:00Z' })
  assert.match(h.deliveries[0].html, /Pedido à transportadora em:<\/strong> 23\/11\/2026, 14:05/)
})

test('the confirmation email shows the pickup day and place, preferring the date booked at the carrier', async () => {
  const pickup = { date: '2026-11-25', period: '09:00-19:00', address: 'Rua A 1', postal: '4000-001', city: 'Porto' }
  const requested = harness(); await requested.send({ ...request, pickup })
  assert.match(requested.deliveries[0].html, /Data da recolha:<\/strong> 25\/11\/2026 · 09:00 - 19:00/)
  assert.match(requested.deliveries[0].html, /Local de recolha:<\/strong> Rua A 1, 4000-001 Porto/)
  const rebooked = harness(); await rebooked.send({ ...request, pickup, scheduled_date: '2026-12-01', scheduled_period: '10:00-13:00' })
  assert.match(rebooked.deliveries[0].html, /Data da recolha:<\/strong> 01\/12\/2026 · 10:00 - 13:00/)
})
