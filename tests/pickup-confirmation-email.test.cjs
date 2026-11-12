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
