const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')

const TENANT = '11111111-1111-1111-1111-111111111111'
const USER = {
  id: 'staff-user-1',
  email: 'staff@example.invalid',
  app_metadata: { role: 'employee', colaborador_id: 'staff-1', tenant_id: TENANT, permissions: [] },
}
const PROFILE = {
  id: 'staff-1',
  code: 'COL-1',
  name: 'Staff One',
  email: USER.email,
  role: 'Operações',
  department: 'Operações',
  status: 'Ativo',
  access_level: 'Operacional',
  permissions: [],
  created_at: '2026-10-01',
}

function encodeCookieSession(payload) {
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `base64-${b64}`
}

function setupHarness({ cookiesList = [], getUserHandler } = {}) {
  let getUserCalls = 0
  let currentCookies = [...cookiesList]
  const writtenCookies = []

  const cookieStore = {
    getAll: () => currentCookies,
    get: name => currentCookies.find(c => c.name === name) || null,
    set: (name, value, options) => {
      writtenCookies.push({ name, value, options })
      const idx = currentCookies.findIndex(c => c.name === name)
      if (idx >= 0) currentCookies[idx] = { name, value }
      else currentCookies.push({ name, value })
    },
  }

  const db = {
    from: table => {
      const q = {
        select: () => q,
        eq: () => q,
        in: () => q,
        order: () => q,
        range: () => q,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: resolve => Promise.resolve({ data: table === 'colaboradores' ? [PROFILE] : [], error: null }).then(resolve),
      }
      return q
    },
  }

  const load = createLoader({
    'server-only': {},
    react: { cache: fn => fn },
    'next/headers': { cookies: async () => cookieStore },
    'next/navigation': { redirect: url => { throw new Error(`REDIRECT:${url}`) } },
    '@/lib/supabase/public-key': { supabasePublicKey: () => 'anon-key' },
    '@/lib/supabase/server': { createAdminClient: () => db },
    '@/lib/client-portal/suspension': { enforcePortalSuspension: async () => {} },
    '@/lib/auth/staff-directory': {
      staffEmail: v => (v || '').trim().toLowerCase(),
      loadStaffDirectory: async () => [PROFILE],
    },
    '@/lib/auth/permissions': { hasPermission: () => true },
    '@supabase/ssr': {
      createServerClient: (_url, _key, options) => ({
        auth: {
          getUser: async () => {
            getUserCalls++
            return await getUserHandler(options.cookies, getUserCalls)
          },
        },
      }),
    },
  })

  const contextModule = load('lib/auth/context.ts')
  return {
    contextModule,
    setRequestCookies: next => { currentCookies = [...next] },
    getWrittenCookies: () => writtenCookies,
    get getUserCalls() { return getUserCalls },
  }
}

test('caches verified session JWTs across repeated polls and clears immediately on logout invalidation', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'
  const expiresAtSec = Math.floor(Date.now() / 1000) + 3600
  const cookieValue = encodeCookieSession({
    access_token: 'header.payload.signature-valid-1',
    refresh_token: 'refresh-1',
    expires_at: expiresAtSec,
  })
  const h = setupHarness({
    cookiesList: [{ name: 'sb-fixture-auth-token', value: cookieValue }],
    getUserHandler: async () => ({ data: { user: USER }, error: null }),
  })

  const first = await h.contextModule.getAuthContextState()
  const second = await h.contextModule.getAuthContextState()
  const third = await h.contextModule.getAuthContextState()

  assert.equal(first.context?.user.id, USER.id)
  assert.equal(second.context?.user.id, USER.id)
  assert.equal(third.context?.user.id, USER.id)
  assert.equal(h.getUserCalls, 1)

  await h.contextModule.invalidateAuthCacheForCookies([{ name: 'sb-fixture-auth-token', value: cookieValue }])
  const fourth = await h.contextModule.getAuthContextState()
  assert.equal(fourth.context?.user.id, USER.id)
  assert.equal(h.getUserCalls, 2)
})

test('deduplicates concurrent token refreshes and writes rotated cookies back to callers', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'
  const nearExpirySec = Math.floor(Date.now() / 1000) + 30 // within 95s refresh margin
  const oldCookie = encodeCookieSession({
    access_token: 'header.payload.expiring-1',
    refresh_token: 'refresh-old-1',
    expires_at: nearExpirySec,
  })
  const newCookie = encodeCookieSession({
    access_token: 'header.payload.fresh-2',
    refresh_token: 'refresh-new-2',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  })

  const h = setupHarness({
    cookiesList: [{ name: 'sb-fixture-auth-token', value: oldCookie }],
    getUserHandler: async cookiesApi => {
      await new Promise(resolve => setTimeout(resolve, 25))
      cookiesApi.setAll([{ name: 'sb-fixture-auth-token', value: newCookie, options: {} }])
      return { data: { user: USER }, error: null }
    },
  })

  const results = await Promise.all([
    h.contextModule.getAuthContextState(),
    h.contextModule.getAuthContextState(),
    h.contextModule.getAuthContextState(),
  ])

  assert.equal(h.getUserCalls, 1)
  for (const res of results) {
    assert.equal(res.context?.user.id, USER.id)
    assert.equal(res.rateLimited, false)
  }
  assert.ok(h.getWrittenCookies().some(c => c.name === 'sb-fixture-auth-token' && c.value === newCookie))

  // Staggered caller still carrying the old cookie hits recentRefreshCache instead of re-refreshing
  h.setRequestCookies([{ name: 'sb-fixture-auth-token', value: oldCookie }])
  const delayed = await h.contextModule.getAuthContextState()
  assert.equal(delayed.context?.user.id, USER.id)
  assert.equal(h.getUserCalls, 1)
})

test('backs off on 429 rate-limit responses and surfaces rateLimited instead of hammering Supabase', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co'
  const expiredCookie = encodeCookieSession({
    access_token: 'header.payload.expired-1',
    refresh_token: 'refresh-rate-limited',
    expires_at: Math.floor(Date.now() / 1000) - 60,
  })

  const h = setupHarness({
    cookiesList: [{ name: 'sb-fixture-auth-token', value: expiredCookie }],
    getUserHandler: async () => ({
      data: { user: null },
      error: { status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' },
    }),
  })

  const first = await h.contextModule.getAuthContextState()
  const second = await h.contextModule.getAuthContextState()
  const third = await h.contextModule.getAuthContextState()

  assert.equal(first.context, null)
  assert.equal(first.rateLimited, true)
  assert.equal(second.context, null)
  assert.equal(second.rateLimited, true)
  assert.equal(third.context, null)
  assert.equal(third.rateLimited, true)
  assert.equal(h.getUserCalls, 1)
})

