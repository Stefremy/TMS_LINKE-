const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const TENANT = '11111111-1111-1111-1111-111111111111'
const OTHER = '99999999-9999-9999-9999-999999999999'
const STORE = '22222222-2222-2222-2222-222222222222'
const TOKEN = 'ab'.repeat(28)
const EMAIL = 'client@example.invalid'
const boundUser = () => ({ id: 'client-user', email: EMAIL, app_metadata: { role: 'client', client_id: STORE, tenant_id: TENANT } })

function harness(options = {}) {
  // This test process never loads .env.local or a real provider; all secrets are fixtures.
  process.env.CLIENT_PORTAL_ORIGIN = 'https://portal.example.invalid'
  process.env.RESEND_API_KEY = 'fixture-key'
  process.env.STORE_FROM_EMAIL = 'Linke <portal@example.invalid>'
  const tables = {
    clients: [{ id: STORE, tenant_id: TENANT, name: 'Store A' }, { id: OTHER, tenant_id: OTHER, name: 'Private foreign store' }],
    audit_log: [{ id: 'profile', tenant_id: TENANT, action: 'client_data', created_at: '2026-10-14', details: { id: STORE, short_name: 'Store A', email: EMAIL, is_active: true } }],
    colaboradores: [],
  }
  options.adjust?.(tables)
  const db = fakeSupabase(tables, options.failure)
  const calls = { auth: [], mail: [], password: [], verify: [], transient: [], signOut: 0 }
  const generated = options.generated || options.existing || { id: 'new-client', email: EMAIL, app_metadata: {} }
  db.client.auth = { admin: {
    async listUsers(params) {
      calls.auth.push({ method: 'list', params })
      if (options.listError) return { data: null, error: { message: 'private-provider-detail' } }
      return { data: { users: options.pages?.[params.page - 1] || (options.existing ? [options.existing] : []) }, error: null }
    },
    async generateLink(params) {
      calls.auth.push({ method: 'generate', params })
      return { data: { user: generated, properties: { hashed_token: TOKEN, verification_type: params.type } }, error: options.generateError ? { message: 'private-provider-detail' } : null }
    },
    async updateUserById(id, params) {
      calls.auth.push({ method: 'assign', id, params })
      return { error: options.assignError ? { message: 'private-provider-detail' } : null }
    },
    async createUser(params) { calls.auth.push({ method: 'create', params }); return { error: null } },
  } }
  const fresh = options.fresh === undefined ? (options.otpUser || boundUser()) : options.fresh
  const auth = {
    async verifyOtp(params) {
      calls.verify.push(params)
      return { data: { user: options.otpUser || boundUser(), session: options.noSession ? null : {} }, error: options.otpError ? { message: 'private-token-detail' } : null }
    },
    async getUser() { return { data: { user: fresh }, error: null } },
    async updateUser(params) { calls.password.push(params); return { error: options.passwordError ? { message: 'private-password-detail' } : null } },
    async signOut() { calls.signOut++; return { error: null } },
  }
  const load = createLoader({
    'server-only': {},
    '@/lib/auth/context': {
      LINKE_TENANT_ID: TENANT,
      requireUser: async () => {
        if(options.role==='anonymous')throw Error('ACCESS_DENIED')
        return {user:{id:options.actorId||'operator-user',email:options.actorEmail||'operator@example.invalid'},role:options.role||'admin',tenant_id:TENANT,client_id:options.role==='client'?STORE:null,permissions:options.permissions||[]}
      },
      requireAdmin: async () => {
        if (options.role && options.role !== 'admin') throw new Error('ADMIN_REQUIRED')
        return { user: { id: 'operator-user' }, role: 'admin', tenant_id: TENANT }
      },
      requireEmployee: async () => ({ role: 'admin', tenant_id: TENANT }),
    },
    '@/app/ops/entidades/colaboradores/types': { DEFAULT_COLABORADORES: [{ email: 'staff@example.invalid' }] },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    '@supabase/supabase-js': { createClient: (...args) => { calls.transient.push(args); return { auth } } },
    resend: { Resend: class {
      emails = { send: async params => {
        calls.mail.push(params)
        assert.equal(calls.auth.at(-1).method, 'assign', 'store binding must be persisted before delivery')
        return { error: options.mailError ? { message: 'private-delivery-detail' } : null }
      } }
    } },
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect() { throw new Error('REDIRECT') } },
  })
  return { load, db, tables, calls, invite: load('app/actions/client-invitations.ts').inviteClientAccessAction,
    password: load('app/api/auth/client-password/route.ts').POST }
}

function request(overrides = {}, headers = {}) {
  return new Request('https://portal.example.invalid/api/auth/client-password', {
    method: 'POST', headers: { Origin: 'https://portal.example.invalid', 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ token_hash: TOKEN, type: 'invite', password: 'a-fixture-password', confirmation: 'a-fixture-password', ...overrides }),
  })
}

test('unprivileged roles cannot invite clients and only admins can configure passwords manually', async () => {
  for (const role of ['client', 'employee', 'anonymous']) {
    const h = harness({ role })
    await assert.rejects(h.invite(STORE, EMAIL), /Acesso restrito|ACCESS_DENIED/)
    await assert.rejects(h.load('app/actions/auth.ts').setClientPasswordAction(STORE, EMAIL, 'a-fixture-password'), /ADMIN_REQUIRED/)
    assert.equal(h.db.adminClients, 0)
    assert.equal(h.calls.auth.length, 0)
    assert.equal(h.calls.mail.length, 0)
  }
})

test('Aldara and explicitly permitted staff can send a password email to the registered client address',async()=>{
  for(const actor of [{actorEmail:'aldara.linke@gmail.com'},{actorEmail:'clientes@linke.pt'},{permissions:['Enviar email de acesso ao cliente']}]){
    const h=harness({role:'employee',...actor})
    assert.equal((await h.invite(STORE,EMAIL)).success,true)
    assert.equal(h.calls.mail.length,1)
    assert.deepEqual(h.calls.mail[0].to,[EMAIL])
    await assert.rejects(h.load('app/actions/auth.ts').setClientPasswordAction(STORE,EMAIL,'a-fixture-password'),/ADMIN_REQUIRED/)
  }
})

test('delegated email permission cannot select another address, another tenant or a deleted client',async()=>{
  const options={role:'employee',actorEmail:'aldara.linke@gmail.com'}
  const changed=harness(options)
  await assert.rejects(changed.invite(STORE,'other@example.invalid'),/email registado/)
  assert.equal(changed.calls.auth.length,0);assert.equal(changed.calls.mail.length,0)
  const foreign=harness(options)
  await assert.rejects(foreign.invite(OTHER,EMAIL),/loja/)
  assert.equal(foreign.calls.auth.length,0)
  const deleted=harness({...options,adjust:t=>t.audit_log.push({tenant_id:TENANT,action:'deleted_client',details:{id:STORE}})})
  await assert.rejects(deleted.invite(STORE,EMAIL),/gravada e ativa/)
  assert.equal(deleted.calls.mail.length,0)
})

test('missing email configuration stops invitation provisioning and delivery', async () => {
  for (const key of ['CLIENT_PORTAL_ORIGIN', 'RESEND_API_KEY', 'STORE_FROM_EMAIL']) {
    const h = harness()
    delete process.env[key]
    await assert.rejects(h.invite(STORE, EMAIL), /Configure/)
    assert.equal(h.calls.auth.length, 0)
    assert.equal(h.calls.mail.length, 0)
  }
})

test('configured origin rejects insecure public hosts, embedded credentials and arbitrary callback paths', () => {
  const h = harness()
  const config = h.load('lib/client-portal/invitations.ts').invitationConfig
  for (const origin of ['http://public.example.invalid', 'https://user:secret@portal.example.invalid', 'https://portal.example.invalid/ops', 'https://portal.example.invalid/?next=evil', 'https://portal.example.invalid/#token']) {
    process.env.CLIENT_PORTAL_ORIGIN = origin
    assert.throws(config, /origem HTTPS/)
  }
})

test('foreign, missing, deleted and inactive stores cannot be invited', async () => {
  const scenarios = [
    { id: OTHER }, { id: 'missing' },
    { adjust: t => { t.audit_log = [] } },
    { adjust: t => { t.audit_log.push({ id: 'deleted', tenant_id: TENANT, action: 'deleted_client', details: { id: STORE } }) } },
    { adjust: t => { t.audit_log[0].details.is_active = false } },
    { failure: () => ({ message: 'private-database-detail' }) },
  ]
  for (const options of scenarios) {
    const h = harness(options)
    await assert.rejects(h.invite(options.id || STORE, EMAIL), error => !error.message.includes('private'))
    assert.equal(h.calls.auth.length, 0)
    assert.equal(h.calls.mail.length, 0)
    assert.equal(h.db.writes.length, 0)
  }
})

test('staff emails and existing identities from another store, role or company are never overwritten', async () => {
  for (const metadata of [{ role: 'admin' }, { role: 'employee' }, { role: 'client', client_id: OTHER },
    { role: 'client', client_id: STORE, tenant_id: OTHER }, {}, { role: 'client', client_id: STORE, colaborador_id: 'staff-id' }]) {
    const h = harness({ existing: { ...boundUser(), app_metadata: metadata, user_metadata: { role: 'client', client_id: STORE } } })
    await assert.rejects(h.invite(STORE, EMAIL), /outro acesso/)
    await assert.rejects(h.load('app/actions/auth.ts').setClientPasswordAction(STORE, EMAIL, 'a-fixture-password'), /outro acesso/)
    assert.equal(h.calls.auth.filter(c => ['assign', 'generate', 'create'].includes(c.method)).length, 0)
    assert.equal(h.calls.mail.length, 0)
  }
  for (const email of ['staff@example.invalid', 'database_staff@example.invalid', 'databaseXstaff@example.invalid']) {
    const h = harness({ adjust: t => { t.colaboradores = [{ id: 'staff', email: 'DATABASE_STAFF@example.invalid' }] } })
    if (email === 'databaseXstaff@example.invalid') {
      // '_' in an email must be literal, not a SQL wildcard matching this other address.
      await h.load('lib/client-portal/invitations.ts').assertClientEmail(h.db.client, email)
    } else await assert.rejects(h.invite(STORE, email), /pertence à equipa/)
    assert.equal(h.calls.mail.length, 0)
  }
})

test('new invitations assign server-controlled one-store metadata before sending, with no password or token in audit/results', async () => {
  const h = harness({ adjust: t => { t.audit_log[0].details.short_name = '<script>private-store</script>' } })
  const result = await h.invite(STORE, ` ${EMAIL.toUpperCase()} `)
  assert.equal(result.success, true)
  const assignment = h.calls.auth.find(c => c.method === 'assign')
  assert.deepEqual(assignment.params, { app_metadata: { role: 'client', client_id: STORE, tenant_id: TENANT } })
  assert.deepEqual(h.calls.auth.find(c => c.method === 'generate').params, { type: 'invite', email: EMAIL })
  assert.equal(h.calls.mail.length, 1)
  const mail = h.calls.mail[0]
  assert.doesNotMatch(mail.html, /<script>/)
  const link = mail.html.match(/href="([^"]+)"/)[1].replaceAll('&amp;', '&')
  const url = new URL(link)
  assert.equal(url.origin, 'https://portal.example.invalid')
  assert.equal(url.pathname, '/app/ativar')
  assert.equal(url.search, '')
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('token_hash'), TOKEN)
  assert.equal(h.db.writes[0].value.details.initiated_by, 'operator-user')
  assert.doesNotMatch(JSON.stringify({ result, writes: h.db.writes }), new RegExp(TOKEN))
  assert.equal(h.calls.auth.some(c => c.params?.password), false)
})

test('missing staff registry supports manual access and invitations using persisted legacy records and verified Auth identities', async () => {
  for (const code of ['PGRST205', '42P01']) {
    const h = harness({ failure: q => q.table === 'colaboradores' ? { code, message: 'Missing public.colaboradores table' } : null })
    const manual = await h.load('app/actions/auth.ts').setClientPasswordAction(STORE, EMAIL, 'a-fixture-password')
    assert.equal(manual.success, true)
    assert.equal(h.calls.auth.find(c => c.method === 'create').params.app_metadata.client_id, STORE)
    const invitation = await h.invite(STORE, EMAIL)
    assert.equal(invitation.success, true)
    assert.equal(h.calls.mail.length, 1)
    assert.ok(h.db.queries.some(q => q.table === 'audit_log' && q.filters.some(f => f.field === 'details->>email')))
  }
})

test('persisted staff emails remain blocked when the registry is missing, across case, action and company', async () => {
  for (const action of ['colaborador_created', 'colaborador_updated', 'colaborador_credentials_updated']) {
    for (const tenant of [TENANT, OTHER]) {
      const h = harness({
        failure: q => q.table === 'colaboradores' ? { code: 'PGRST205', message: 'Missing public.colaboradores table' } : null,
        adjust: t => t.audit_log.push({ id: 'legacy-staff', tenant_id: tenant, action, details: { email: EMAIL.toUpperCase() } }),
      })
      await assert.rejects(h.invite(STORE, EMAIL), /pertence à equipa/)
      await assert.rejects(h.load('app/actions/auth.ts').setClientPasswordAction(STORE, EMAIL, 'a-fixture-password'), /pertence à equipa/)
      assert.equal(h.calls.auth.length, 0)
      assert.equal(h.calls.mail.length, 0)
      assert.equal(h.db.writes.length, 0)
    }
  }
  const h = harness({ adjust: t => t.audit_log.push({ id: 'legacy-staff', action: 'colaborador_created', details: { email: EMAIL } }) })
  await assert.rejects(h.invite(STORE, EMAIL), /pertence à equipa/)
})

test('staff verification never bypasses connection, permission, unrelated schema or legacy-record failures', async () => {
  for (const error of [{ message: 'Network unavailable' }, { code: '42501', message: 'Denied public.colaboradores' },
    { code: 'PGRST205', message: 'Missing another table' }, { code: '42703', message: 'Missing column colaboradores.email' }]) {
    const h = harness({ failure: q => q.table === 'colaboradores' ? error : null })
    await assert.rejects(h.invite(STORE, EMAIL), /verificar o email/)
    assert.equal(h.calls.auth.length, 0)
    assert.equal(h.calls.mail.length, 0)
  }
  const h = harness({ failure: q => q.table === 'colaboradores'
    ? { code: 'PGRST205', message: 'Missing public.colaboradores table' }
    : q.filters.some(f => f.field === 'details->>email') ? { message: 'Legacy lookup unavailable' } : null })
  await assert.rejects(h.invite(STORE, EMAIL), /verificar o email/)
  assert.equal(h.calls.auth.length, 0)
  assert.equal(h.calls.mail.length, 0)
})

test('legacy staff lookup escapes wildcards and ignores unrelated customer history', async () => {
  const h = harness({
    failure: q => q.table === 'colaboradores' ? { code: 'PGRST205', message: 'Missing public.colaboradores table' } : null,
    adjust: t => t.audit_log.push({ id: 'staff', action: 'colaborador_created', details: { email: 'aXb@example.invalid' } },
      { id: 'customer-email', action: 'client_data', details: { id: 'another-store', email: 'a_b@example.invalid' } }),
  })
  await h.load('lib/client-portal/invitations.ts').assertClientEmail(h.db.client, 'a_b@example.invalid')
  assert.equal(h.calls.auth.length, 0)
})

test('resending the same-store account uses recovery and paginates beyond the first 1000 users', async () => {
  const h = harness({ existing: boundUser(), pages: [Array.from({ length: 1000 }, (_, i) => ({ email: `fixture-${i}@example.invalid` })), [boundUser()]] })
  await h.invite(STORE, EMAIL)
  assert.deepEqual(h.calls.auth.filter(c => c.method === 'list').map(c => c.params.page), [1, 2])
  assert.equal(h.calls.auth.find(c => c.method === 'generate').params.type, 'recovery')
  assert.equal(h.calls.mail.length, 1)
})

test('generation, assignment, audit and delivery failures never claim the invitation was sent', async () => {
  for (const options of [{ listError: true }, { generateError: true }, { assignError: true },
    { failure: state => state.write ? { message: 'private-audit-detail' } : null }, { mailError: true }]) {
    const h = harness(options)
    await assert.rejects(h.invite(STORE, EMAIL), error => !error.message.includes('private'))
    if (!options.mailError) assert.equal(h.calls.mail.length, 0)
  }
  const raced = harness({ generated: { ...boundUser(), app_metadata: { role: 'admin' } } })
  await assert.rejects(raced.invite(STORE, EMAIL), /outro acesso/)
  assert.equal(raced.calls.auth.some(c => c.method === 'assign'), false)
  assert.equal(raced.calls.mail.length, 0)
})

test('password setup rejects cross-origin requests, missing/invalid tokens, wrong token types and mismatching passwords before auth', async () => {
  for (const [input, headers] of [[{}, { Origin: 'https://attacker.invalid' }], [{ token_hash: '' }, {}],
    [{ type: 'signup' }, {}], [{ password: 'short', confirmation: 'short' }, {}],
    [{ confirmation: 'different-password' }, {}], [{ password: 'x'.repeat(129), confirmation: 'x'.repeat(129) }, {}],
    [{}, { 'Content-Type': 'text/plain' }]]) {
    const h = harness()
    const response = await h.password(request(input, headers))
    assert.equal(response.status, 400)
    assert.equal(h.calls.verify.length, 0)
    assert.equal(h.db.adminClients, 0)
    assert.equal(h.calls.password.length, 0)
  }
})

test('only a verified invitation or recovery belonging to an active client can set a password', async () => {
  for (const options of [{ otpError: true }, { noSession: true }, { fresh: null },
    { fresh: { ...boundUser(), id: 'different-user' } },
    { otpUser: { ...boundUser(), app_metadata: { role: 'admin', client_id: STORE, tenant_id: TENANT } } },
    { otpUser: { ...boundUser(), app_metadata: { role: 'client', client_id: STORE, tenant_id: OTHER } } },
    { otpUser: { ...boundUser(), app_metadata: { role: 'client', client_id: OTHER, tenant_id: TENANT } } },
    { otpUser: { ...boundUser(), email: 'staff@example.invalid' } },
    { adjust: t => { t.audit_log[0].details.is_active = false } },
    { failure: () => ({ message: 'private-db-error' }) }]) {
    const h = harness(options)
    const response = await h.password(request())
    assert.equal(response.status, 400)
    assert.equal(h.calls.password.length, 0)
    assert.doesNotMatch(await response.text(), /private/)
    if (!options.otpError && !options.noSession) assert.equal(h.calls.signOut, 1)
  }
})

test('password setup ignores caller-supplied store/role and never replaces the browser session or exposes tokens', async () => {
  for (const type of ['invite', 'recovery']) {
    const h = harness()
    const response = await h.password(request({ type, client_id: OTHER, role: 'admin', next: '/ops' }))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { success: true })
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(response.headers.get('Set-Cookie'), null)
    assert.equal(h.calls.transient[0][2].auth.persistSession, false)
    assert.deepEqual(h.calls.password, [{ password: 'a-fixture-password' }])
    assert.equal(h.calls.signOut, 1)
    assert.equal(h.db.writes.length, 0)
  }
})

test('password provider failure returns a safe error and closes the temporary session', async () => {
  const h = harness({ passwordError: true })
  const response = await h.password(request())
  assert.equal(response.status, 400)
  assert.doesNotMatch(await response.text(), /private|token_hash|access_token/)
  assert.equal(h.calls.signOut, 1)
})
