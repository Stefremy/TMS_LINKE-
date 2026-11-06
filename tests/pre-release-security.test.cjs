const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')
const { Resend } = require('resend')
class NextResponse extends Response { static json(body, init) { return Response.json(body, init) } static redirect(url) { return new NextResponse(null, { status: 307, headers: { location: url } }) } }
const next = { NextResponse }
const T = '11111111-1111-1111-1111-111111111111', A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const ctx = { role: 'employee', tenant_id: T, user: { id: A } }
const secret = `whsec_${Buffer.from('fixture-only-webhook-signing-secret').toString('base64')}`
const event = { type: 'email.received', data: { email_id: 'fixture-email-id', from: 'Fixture <fixture@example.invalid>', to: ['geral@linke.pt'], subject: 'Fixture' } }
function env(t, values) {
  const prior = Object.fromEntries(Object.keys(values).map(k => [k, process.env[k]]))
  for (const [key, value] of Object.entries(values)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
  t.after(() => { for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value } })
}
function signed(body = event, timestamp = Math.floor(Date.now() / 1000), mutate) {
  const raw = JSON.stringify(body), id = 'msg_fixture'
  const signature = crypto.createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`${id}.${timestamp}.${raw}`).digest('base64')
  return new Request('https://fixture.invalid/api/webhooks/resend', { method: 'POST', headers: { 'content-type': 'application/json', 'svix-id': id, 'svix-timestamp': String(timestamp), 'svix-signature': `v1,${signature}` }, body: mutate ? mutate(raw) : raw })
}
function webhook(failure, fetchBody = async () => ({ text: 'Full received body', html: null }), rows = []) {
  const tables = { audit_log: rows }, db = fakeSupabase(tables, failure, { persistInserts: true })
  let fetched = 0
  const load = createLoader({ 'node:crypto': crypto, 'next/server': next, resend: { Resend },
    '@/lib/auth/context': { getAuthContext: async () => null },
    '@/lib/supabase/server': { createAdminClient: () => db.client },
    '@/lib/email/resend': { getReceivedEmailContent: async id => { fetched++; assert.equal(id, event.data.email_id); return fetchBody() } },
  })
  return { db, tables, api: load('app/api/webhooks/resend/route.ts'), get fetched() { return fetched } }
}
test('Resend rejects missing configuration, unsigned/tampered requests and expired/future signatures before any write', async t => {
  env(t, { RESEND_WEBHOOK_SECRET: undefined })
  const h = webhook()
  assert.equal((await h.api.POST(signed())).status, 503)
  process.env.RESEND_WEBHOOK_SECRET = secret
  const unsigned = new Request('https://fixture.invalid', { method: 'POST', body: JSON.stringify(event) })
  for (const request of [unsigned, signed(event, undefined, raw => raw + ' '), signed(event, 1), signed(event, Math.floor(Date.now() / 1000) + 3600)]) assert.equal((await h.api.POST(request)).status, 401)
  assert.equal(h.db.queries.length, 0)
  assert.equal(h.fetched, 0)
})
test('verified inbound email fetches the body; serial and simultaneous retries persist exactly once', async t => {
  env(t, { RESEND_WEBHOOK_SECRET: secret })
  for (const concurrent of [false, true]) {
    const h = webhook()
    const responses = concurrent ? await Promise.all([h.api.POST(signed()), h.api.POST(signed())]) : [await h.api.POST(signed()), await h.api.POST(signed())]
    assert.ok(responses.every(r => r.status === 200))
    assert.equal(h.tables.audit_log.length, 1)
    assert.equal(h.tables.audit_log[0].details.bodyText, 'Full received body')
    assert.equal(h.tables.audit_log[0].tenant_id, T)
  }
})
test('Resend ignores unrelated event types and unknown recipients; legacy stored emails are not duplicated', async t => {
  env(t, { RESEND_WEBHOOK_SECRET: secret })
  const h = webhook()
  assert.equal((await h.api.POST(signed({ ...event, type: 'email.bounced' }))).status, 200)
  assert.equal((await h.api.POST(signed({ ...event, data: { ...event.data, to: ['unknown@example.invalid'] } }))).status, 200)
  assert.equal(h.db.writes.length, 0)
  const existing = webhook(null, undefined, [{ id: ID, tenant_id: T, action: 'ops_mailbox_message', details: { id: `inbound-${event.data.email_id}`, bodyText: 'Already received' } }])
  assert.equal((await existing.api.POST(signed())).status, 200)
  assert.equal(existing.fetched, 0)
  assert.equal(existing.db.writes.length, 0)
})
test('Resend content/provider/read/insert failures return a retryable failure without acknowledging delivery', async t => {
  env(t, { RESEND_WEBHOOK_SECRET: secret })
  for (const h of [webhook(() => ({ message: 'DB failure' })), webhook(q => q.write ? { message: 'Write failure' } : null), webhook(null, async () => { throw Error('Provider unavailable') })]) {
    assert.equal((await h.api.POST(signed())).status, 500)
    assert.equal(h.tables.audit_log.length, 0)
  }
})
function chat({ context = ctx, messages = [], metadata = true, fail } = {}) {
  const path = `${T}/${B}/${ID}.pdf`, reference = `/api/ops/chat/attachments?id=${ID}`
  const tables = { audit_log: metadata ? [{ tenant_id: T, action: 'team_chat_attachment', details: { id: ID, storage_path: path, uploaded_by: B, name: 'Fixture.pdf', type: 'application/pdf' } }] : [], team_chat_messages: messages }
  const db = fakeSupabase(tables, fail, { persistInserts: true }), storageCalls = []
  db.client.storage = {
    getBucket: async () => ({ data: { public: true } }),
    updateBucket: async (bucket, options) => { storageCalls.push(['private', bucket, options]); return { error: null } },
    from: bucket => ({
      createSignedUrl: async (p, seconds) => { storageCalls.push(['sign', bucket, p, seconds]); return { data: { signedUrl: 'https://storage.example.invalid/signed' } } },
      upload: async (p, bytes, options) => { storageCalls.push(['upload', p, options]); return { error: null } },
      remove: async p => { storageCalls.push(['remove', p]); return { error: null } },
    }),
  }
  const load = createLoader({ 'node:crypto': crypto, 'next/server': next,
    '@/lib/team-chat-server': { chatContext: async () => { if (!context || context.role === 'client') { const { ChatError } = load('lib/team-chat.ts'); throw new ChatError('Denied', 403) } return context } },
    '@/lib/supabase/server': { createAdminClient: () => db.client },
  })
  return { api: load('app/api/ops/chat/attachments/route.ts'), helper: load('lib/team-chat-attachments.ts'), media: load('lib/team-chat-media.ts'), db, tables, reference, path, storageCalls }
}
const download = id => new Request(`https://fixture.invalid/api/ops/chat/attachments?id=${id}`)
test('chat download denies anonymous/client, another tenant and unrelated DM viewers before signing', async () => {
  for (const context of [null, { ...ctx, role: 'client' }, { ...ctx, tenant_id: C }, ctx]) {
    const h = chat({ context, messages: [{ id: 'msg', tenant_id: T, sender_id: B, recipient_id: C, body: `[file:/api/ops/chat/attachments?id=${ID}|Fixture.pdf|application/pdf|10]` }] })
    assert.ok([403, 404].includes((await h.api.GET(download(ID))).status))
    assert.equal(h.storageCalls.length, 0)
  }
})
test('chat authorizes uploader, DM participants and general-channel viewers with 60-second links', async () => {
  for (const recipient of [A, null]) {
    const h = chat({ messages: [{ id: 'msg', tenant_id: T, sender_id: B, recipient_id: recipient, body: `[file:/api/ops/chat/attachments?id=${ID}|Fixture.pdf|application/pdf|10]` }] })
    const result = await h.api.GET(download(ID))
    assert.equal(result.status, 307)
    assert.match(result.headers.get('cache-control'), /no-store/)
    assert.equal(h.storageCalls[0][3], 60)
  }
  assert.equal((await chat({ context: { ...ctx, user: { id: B } } }).api.GET(download(ID))).status, 307)
})
test('legacy public chat links use authorization and forged message references cannot grant access', async t => {
  env(t, { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co' })
  const h = chat({ metadata: false })
  const legacy = `https://fixture.supabase.co/storage/v1/object/public/team-chat-attachments/${h.path}`
  h.tables.team_chat_messages.push({ id: 'msg', tenant_id: T, sender_id: B, recipient_id: A, body: `[file:${legacy}|Fixture.pdf|application/pdf|10]` })
  const parsed = h.media.parseAttachmentMessage(h.tables.team_chat_messages[0].body)
  assert.match(parsed.attachments[0].url, /^\/api\/ops\/chat\/attachments\?path=/)
  assert.equal((await h.api.GET(new Request(`https://fixture.invalid${parsed.attachments[0].url}`))).status, 307)
  const denied = chat()
  await assert.rejects(denied.helper.validateChatAttachmentReferences(ctx, `[file:${denied.reference}|Fixture.pdf|application/pdf|10]`), /Anexo não encontrado/)
  assert.equal(denied.db.writes.length, 0)
  assert.equal((await h.api.GET(new Request('https://fixture.invalid/api/ops/chat/attachments?path=../other'))).status, 404)
})
async function upload(h, name, mime, bytes) {
  const form = new FormData(); form.set('file', new File([bytes], name, { type: mime }))
  return h.api.POST(new Request('https://fixture.invalid/api/ops/chat/attachments', { method: 'POST', body: form, headers: { origin: 'https://fixture.invalid' } }))
}
test('chat upload rejects spoofed MIME/signatures; legitimate files use a private bucket and stable protected URL', async () => {
  for (const [mime, bytes] of [['text/html', '%PDF-fixture'], ['application/pdf', '<html>fixture</html>']]) {
    const h = chat(); assert.equal((await upload(h, 'fixture.pdf', mime, bytes)).status, 415); assert.equal(h.storageCalls.length, 0)
  }
  const h = chat(), response = await upload(h, 'fixture.pdf', 'application/pdf', '%PDF-fixture')
  assert.equal(response.status, 201)
  assert.equal(h.storageCalls[0][2].public, false)
  const result = await response.json()
  assert.match(result.attachment.url, /^\/api\/ops\/chat\/attachments\?id=/)
  assert.equal(h.media.parseAttachmentMessage(h.media.formatAttachmentMessage([result.attachment])).attachments[0].url, result.attachment.url)
  const failed = chat({ fail: q => q.write ? { message: 'DB unavailable' } : null })
  assert.equal((await upload(failed, 'fixture.pdf', 'application/pdf', '%PDF-fixture')).status, 503)
  assert.ok(failed.storageCalls.some(call => call[0] === 'remove'))
})
test('active email attachments download with CSP and nosniff, and IMAP verifies certificates', async () => {
  const options = []
  class ImapFlow { constructor(o) { options.push(o) } async connect() {} async getMailboxLock() { return { release() {} } } async *fetch() { yield { source: Buffer.from('fixture') } } async logout() {} }
  const load = createLoader({ 'next/server': next, imapflow: { ImapFlow }, mailparser: { simpleParser: async () => ({ attachments: [{ filename: 'fixture.html', contentType: 'text/html', content: Buffer.from('<script>fixture</script>') }] }) },
    '@/lib/auth/permissions': { getAllowedMailAccounts: () => ['geral@linke.pt'] },
    '@/lib/ops-mailbox-imap': { resolveImapCredentials: () => ({ host: 'fixture.invalid', port: 993, user: 'fixture', pass: 'fixture' }) },
    '@/lib/ops-mailbox-server': { mailboxContext: async () => ctx },
  })
  const response = await load('app/api/ops/mail/attachment/route.ts').GET(new Request('https://fixture.invalid?uid=1&account=geral%40linke.pt'))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-disposition'), /^attachment/)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.match(response.headers.get('content-security-policy'), /sandbox/)
  assert.equal(options[0].tls.rejectUnauthorized, true)
})
