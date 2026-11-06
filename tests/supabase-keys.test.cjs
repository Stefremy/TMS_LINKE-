const test = require('node:test'), assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
test('browser, server sessions and admin use modern keys, with legacy fallback only during migration', async t => {
  const names = ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
  const previous = Object.fromEntries(names.map(k => [k, process.env[k]]))
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value } })
  const calls = []
  const load = createLoader({
    '@supabase/ssr': { createServerClient: (url, key) => { calls.push(['session', key]); return {} }, createBrowserClient: (url, key) => { calls.push(['browser', key]); return {} } },
    '@supabase/supabase-js': { createClient: (url, key) => { calls.push(['admin', key]); return {} } },
    'next/headers': { cookies: async () => ({ getAll: () => [], set() {} }) },
  })
  for (const modern of [false, true]) {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-public-fixture'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-server-fixture'
    if (modern) { process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-fixture'; process.env.SUPABASE_SECRET_KEY = 'secret-fixture' }
    else { delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; delete process.env.SUPABASE_SECRET_KEY }
    load('lib/supabase/client.ts').createClient()
    await load('lib/supabase/server.ts').createClient()
    load('lib/supabase/server.ts').createAdminClient()
    assert.deepEqual(calls.splice(0), [['browser', modern ? 'publishable-fixture' : 'legacy-public-fixture'], ['session', modern ? 'publishable-fixture' : 'legacy-public-fixture'], ['admin', modern ? 'secret-fixture' : 'legacy-server-fixture']])
  }
})
