const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const routes = createLoader({})('lib/client-portal/login-paths.ts')

function redirect(url) { throw Object.assign(new Error(`REDIRECT:${url}`), { digest: `NEXT_REDIRECT;${url}` }) }
function harness(ctx = { user: { id: 'fixture-user' }, role: 'client', client_id: 'store-a' }, options = {}) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'
  const calls = { signIn: [], signOut: 0, signOutOptions: [], revalidate: 0, cookies: new Map() }
  const load = createLoader({
    '@/lib/supabase/server': { createClient: async () => {
      if (options.createError) throw new Error('private configuration detail')
      return { auth: {
        signInWithPassword: async input => {
          calls.signIn.push(input)
          if (options.providerThrow) throw new Error('private provider detail')
          return { data: { user: options.failed ? null : { id: 'fixture-user', app_metadata: { role: options.metadataRole || 'client' } } },
            error: options.failed ? { message: 'private provider detail' } : null }
        },
        signOut: async input => {
          calls.signOut++
          calls.signOutOptions.push(input)
          if (options.signOutThrow) throw new Error('private signout detail')
          return { error: options.signOutError ? { message: 'private signout detail' } : null }
        },
      } }
    } },
    '@/lib/auth/context': { getAuthContext: async () => {
      if (options.suspended) redirect('/conta-suspensa')
      if (options.contextError) throw new Error('private account detail')
      return ctx
    } },
    'next/cache': { revalidatePath: () => calls.revalidate++ },
    'next/navigation': { redirect, unstable_rethrow: error => { if (error?.digest?.startsWith('NEXT_REDIRECT')) throw error } },
    'next/headers': { cookies: async () => ({
      set: (name, value, attributes) => calls.cookies.set(name, { value, ...attributes }),
      get: name => calls.cookies.get(name), delete: name => calls.cookies.delete(name),
      getAll: () => [...calls.cookies].map(([name, value]) => ({ name, ...value })),
    }) },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    './ClientLoginForm': { ClientLoginForm: 'ClientForm' },
    './OpsLoginForm': { __esModule: true, default: 'OpsForm' },
  })
  const form = new FormData()
  form.set('email', ' fixture@example.invalid ')
  form.set('password', 'fixture-only-password')
  form.set('returnTo', '/app/stef-store/envios')
  return { load, actions: load('app/login/actions.ts'), calls, form }
}

test('return paths reject external URLs, staff routes, traversal, encodings, arrays and login loops', () => {
  for (const value of ['https://evil.invalid', '//evil.invalid', '/ops', '/app/login', '/app/selecionar',
    '/app/../ops', '/app/%2e%2e/ops', '/app/store\\evil', '/app/store?next=https://evil.invalid',
    '/app/store/unknown', ['/app/store'], null]) assert.equal(routes.safePortalReturn(value), undefined)
  for (const value of ['/app', '/app/store', '/app/store/criar-guia', '/app/store/envios', '/app/store/faturas']) {
    assert.equal(routes.safePortalReturn(value), value)
  }
  assert.equal(routes.clientLoginPath('/ops'), '/app/login')
})

test('client login keeps a safe store destination and creates only a host-local presentation cookie', async () => {
  const h = harness()
  h.form.set('role', 'admin')
  await assert.rejects(h.actions.clientLogin(h.form), /REDIRECT:\/app\/stef-store\/envios/)
  assert.deepEqual(h.calls.signIn, [{ email: 'fixture@example.invalid', password: 'fixture-only-password' }])
  const cookie = h.calls.cookies.get('portal_login_source')
  assert.equal(cookie.value, 'client')
  assert.equal(cookie.httpOnly, true)
  assert.equal(cookie.sameSite, 'lax')
  assert.equal(cookie.domain, undefined)
  assert.equal(h.calls.revalidate, 1)
})

test('changing a client return path to Ops or an external URL never grants staff navigation', async () => {
  for (const path of ['/ops', '//evil.invalid', 'https://evil.invalid', '/app/login']) {
    const h = harness()
    h.form.set('returnTo', path)
    await assert.rejects(h.actions.clientLogin(h.form), /^Error: REDIRECT:\/app$/)
  }
})

test('Ops/admin retain their real role when using the client form; the verified account decides access', async () => {
  for (const role of ['employee', 'admin']) {
    const h = harness({ user: { id: 'fixture-user' }, role, client_id: null })
    await assert.rejects(h.actions.clientLogin(h.form), /REDIRECT:\/app\/stef-store\/envios/)
    assert.equal(h.calls.signOut, 0)
    assert.equal(h.calls.cookies.get('portal_login_source').value, 'client')
    h.form.delete('returnTo')
    await assert.rejects(h.actions.clientLogin(h.form), /REDIRECT:\/ops/)
  }
  const client = harness(undefined, { metadataRole: 'admin' })
  client.form.set('returnTo', '/ops')
  await assert.rejects(client.actions.clientLogin(client.form), /^Error: REDIRECT:\/app$/)
})

test('team login admits only verified staff and administrators', async () => {
  for (const role of ['employee', 'admin']) {
    const h = harness({ user: { id: 'fixture-user' }, role, client_id: null })
    await assert.rejects(h.actions.login(h.form), /^Error: REDIRECT:\/ops$/)
    assert.equal(h.calls.signOut, 0)
    assert.equal(h.calls.cookies.get('portal_login_source').value, 'ops')
  }
})

test('team login rejects clients after verification, ignores forged form roles and directs them to the client entrance', async () => {
  for (const options of [{}, { metadataRole: 'admin' }, { signOutThrow: true }, { signOutError: true }]) {
    const h = harness(undefined, options)
    h.form.set('role', 'admin')
    h.form.set('portal', 'true')
    h.form.set('returnTo', '/ops')
    for (const name of ['sb-fixture-auth-token', 'sb-fixture-auth-token.0', 'sb-fixture-auth-token.1', 'impersonated_client_id', 'portal_login_source']) {
      h.calls.cookies.set(name, { value: 'fixture-only' })
    }
    h.calls.cookies.set('sb-other-project-auth-token', { value: 'unrelated' })
    await assert.rejects(h.actions.login(h.form), /^Error: REDIRECT:\/login\?error=client_portal$/)
    assert.equal(h.calls.signOut, 1)
    assert.deepEqual(h.calls.signOutOptions, [{ scope: 'local' }])
    assert.equal(h.calls.revalidate, 0)
    assert.deepEqual([...h.calls.cookies.keys()], ['sb-other-project-auth-token'])
  }
})

test('failed sign-in preserves the client form and requested store, without exposing errors', async () => {
  for (const options of [{ failed: true }, { providerThrow: true }, { createError: true }]) {
    const h = harness(undefined, options)
    await assert.rejects(h.actions.clientLogin(h.form), error => {
      assert.doesNotMatch(error.message, /private/)
      const url = new URL(error.message.slice('REDIRECT:'.length), 'http://fixture.invalid')
      assert.equal(url.pathname, '/app/login')
      assert.equal(url.searchParams.get('next'), '/app/stef-store/envios')
      assert.equal(url.searchParams.get('error'), 'true')
      return true
    })
    assert.equal(h.calls.cookies.size, 0)
    assert.equal(h.calls.revalidate, 0)
  }
})

test('unassigned, mismatched or unresolved accounts are signed out after password authentication', async () => {
  for (const ctx of [null, { user: { id: 'wrong-user' }, role: 'client', client_id: 'store-a' },
    { user: { id: 'fixture-user' }, role: null }, { user: { id: 'fixture-user' }, role: 'client', client_id: null }]) {
    const h = harness(ctx)
    await assert.rejects(h.actions.clientLogin(h.form), /REDIRECT:\/app\/login\?/)
    assert.equal(h.calls.signOut, 1)
    assert.equal(h.calls.revalidate, 0)
  }
  const failed = harness(undefined, { contextError: true })
  await assert.rejects(failed.actions.clientLogin(failed.form), /REDIRECT:\/app\/login\?/)
  assert.equal(failed.calls.signOut, 1)
})

test('invalid inputs do not attempt authentication', async () => {
  const h = harness()
  h.form.delete('password')
  await assert.rejects(h.actions.clientLogin(h.form), /REDIRECT:\/app\/login\?/)
  assert.equal(h.calls.signIn.length, 0)
})

test('logout clears support context and returns to the appropriate login', async () => {
  for (const source of ['client', 'ops']) {
    const h = harness()
    h.calls.cookies.set('portal_login_source', { value: source })
    h.calls.cookies.set('impersonated_client_id', { value: 'store-a' })
    await assert.rejects(h.actions.signout(), new RegExp(`REDIRECT:${source === 'client' ? '/app/login' : '/login'}$`))
    assert.equal(h.calls.signOut, 1)
    assert.equal(h.calls.cookies.size, 0)
  }
})

test('anonymous client login renders a public form without loading store/customer data', async () => {
  const h = harness(null)
  const page = h.load('app/app/login/page.tsx').default
  const result = await page({ searchParams: Promise.resolve({ next: '/app/stef-store', error: 'true' }) })
  assert.equal(result.props.returnTo, '/app/stef-store')
  assert.equal(result.props.isError, true)
  const sanitized = await page({ searchParams: Promise.resolve({ next: '//evil.invalid' }) })
  assert.equal(sanitized.props.returnTo, undefined)
})

test('existing sessions resolve on the server without trusting a login form role', async () => {
  const c = harness()
  await assert.rejects(c.load('app/login/page.tsx').default({ searchParams: Promise.resolve({}) }), /^Error: REDIRECT:\/app$/)
  await assert.rejects(c.load('app/app/login/page.tsx').default({ searchParams: Promise.resolve({ next: '/ops' }) }), /^Error: REDIRECT:\/app$/)
  const staff = harness({ user: { id: 'fixture-user' }, role: 'admin', client_id: null })
  const preview = await staff.load('app/app/login/page.tsx').default({ searchParams: Promise.resolve({ preview: 'true' }) })
  assert.equal(preview.props.returnTo, undefined)
  await assert.rejects(staff.load('app/login/page.tsx').default({ searchParams: Promise.resolve({}) }), /^Error: REDIRECT:\/ops$/)
  const opsPreview = await staff.load('app/login/page.tsx').default({ searchParams: Promise.resolve({ preview: 'true', error: 'client_portal' }) })
  assert.equal(opsPreview.type, 'OpsForm')
  await assert.rejects(c.load('app/login/page.tsx').default({ searchParams: Promise.resolve({ preview: 'true' }) }), /^Error: REDIRECT:\/app$/)
  // A preview flag changes presentation only; clients still redirect to their own portal.
  await assert.rejects(c.load('app/app/login/page.tsx').default({ searchParams: Promise.resolve({ preview: 'true' }) }), /^Error: REDIRECT:\/app$/)
})

test('proxy sends anonymous store links to client login, keeps Ops login separate and preserves refreshed cookies', async () => {
  const makeCookies = () => {
    const map = new Map()
    return { getAll: () => [...map.values()], has: name => map.has(name),
      set: (name, value) => { const c = typeof name === 'object' ? name : { name, value }; map.set(c.name, c) } }
  }
  for (const [path, expected] of [['/app/stef-store/envios', '/app/login?next=%2Fapp%2Fstef-store%2Fenvios'],
    ['/ops', '/login'], ['/app/login', null], ['/app/ativar', null], ['/login', null]]) {
    const middleware = createLoader({
      'next/server': { NextResponse: { next: () => ({ cookies: makeCookies() }), redirect: url => ({ location: String(url), cookies: makeCookies() }) } },
      '@supabase/ssr': { createServerClient: (_url, _key, options) => ({ auth: { getUser: async () => {
        options.cookies.setAll([{ name: 'fixture-refresh', value: 'fixture-only', options: {} }])
        return { data: { user: null } }
      } } }) },
    })('lib/supabase/middleware.ts').updateSession
    const nextUrl = new URL(`http://fixture.invalid${path}`)
    nextUrl.clone = () => new URL(nextUrl)
    const response = await middleware({ nextUrl, cookies: makeCookies() })
    assert.equal(response.location, expected ? `http://fixture.invalid${expected}` : undefined)
    assert.ok(response.cookies.getAll().some(c => c.name === 'fixture-refresh'))
  }
})


test('a valid suspended login reaches the suspension notice instead of being swallowed as a bad password',async()=>{
  const h=harness(undefined,{suspended:true})
  await assert.rejects(h.actions.clientLogin(h.form),/REDIRECT:\/conta-suspensa/)
  assert.equal(h.calls.signOut,0)
  assert.equal(h.calls.revalidate,0)
})
