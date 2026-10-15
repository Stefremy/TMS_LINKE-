const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const config = createLoader({})('lib/config/public-origins.ts')
const origins = { portal: 'https://app.toke.pt', ops: 'https://ops.toke.pt', site: 'https://www.toke.pt' }

function environment(t, values = {}) {
  const names = ['CLIENT_PORTAL_ORIGIN', 'OPS_ORIGIN', 'PUBLIC_SITE_ORIGIN', 'NODE_ENV']
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]))
  for (const name of names) {
    const value = values[name]
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  t.after(() => {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
    }
  })
}

test('client, staff and public domains select the correct entrance while preserving store slugs', () => {
  for (const [input, expected] of [
    ['https://app.toke.pt/', 'https://app.toke.pt/app'],
    ['https://app.toke.pt/login?error=true', 'https://app.toke.pt/app/login?error=true'],
    ['https://app.toke.pt/ops/envios', 'https://ops.toke.pt/ops/envios'],
    ['https://ops.toke.pt/', 'https://ops.toke.pt/ops'],
    ['https://ops.toke.pt/app/login?next=%2Fapp%2Fstef-store', 'https://app.toke.pt/app/login?next=%2Fapp%2Fstef-store'],
    ['https://ops.toke.pt/app/ativar', 'https://app.toke.pt/app/ativar'],
    ['https://www.toke.pt/app/stef-store/envios', 'https://app.toke.pt/app/stef-store/envios'],
    ['https://www.toke.pt/login', 'https://ops.toke.pt/login'],
    ['https://www.toke.pt/ops/relatorios', 'https://ops.toke.pt/ops/relatorios'],
    ['https://www.toke.pt/', 'https://app.toke.pt/app'],
  ]) assert.equal(config.domainDestination(input, origins), expected)
})

test('staff previews, APIs, tracking and canonical client paths do not loop or lose their host-local session', () => {
  for (const input of ['https://ops.toke.pt/app/stef-store', 'https://ops.toke.pt/app/stef-store/criar-guia',
    'https://ops.toke.pt/login', 'https://ops.toke.pt/api/webhooks/stripe',
    'https://app.toke.pt/app/stef-store', 'https://www.toke.pt/tracking?trk=fixture',
    'http://localhost:3000/ops', 'https://tms-linke.vercel.app/ops']) {
    assert.equal(config.domainDestination(input, origins), undefined)
  }
  assert.equal(config.domainDestination('http://localhost:3000/', {}), undefined)
})

test('untrusted paths, next parameters and lookalike hostnames cannot choose redirect origins', () => {
  assert.equal(config.domainDestination('https://app.toke.pt//evil.invalid/path', origins), undefined)
  assert.equal(config.domainDestination('https://app.toke.pt.evil.invalid/ops', origins), undefined)
  const destination = config.domainDestination('https://www.toke.pt/app/store?next=https://evil.invalid', origins)
  assert.equal(new URL(destination).origin, origins.portal)
})

test('production public links and Moloni callback use configured canonical addresses', t => {
  environment(t, { NODE_ENV: 'production', CLIENT_PORTAL_ORIGIN: origins.portal, OPS_ORIGIN: origins.ops, PUBLIC_SITE_ORIGIN: origins.site })
  assert.equal(config.publicUrl('/app', 'portal'), 'https://app.toke.pt/app')
  assert.equal(config.publicUrl('/tracking?trk=fixture', 'site'), 'https://www.toke.pt/tracking?trk=fixture')
  assert.equal(config.moloniRedirectUri('https://untrusted.invalid'), 'https://ops.toke.pt/api/moloni/callback')
  assert.equal(config.checkoutReturnOrigin(origins.portal), origins.portal)
  assert.equal(config.checkoutReturnOrigin(origins.ops), origins.ops)
  assert.equal(config.checkoutReturnOrigin('https://evil.invalid'), origins.portal)
  for (const path of ['//evil.invalid', 'https://evil.invalid', '/\\evil.invalid', '/\n/evil.invalid']) assert.throws(() => config.publicUrl(path))
})

test('invalid origins cannot inject paths, credentials or insecure production links', t => {
  environment(t, { NODE_ENV: 'production' })
  assert.throws(() => config.publicUrl('/app'), /Configure/)
  assert.throws(() => config.checkoutReturnOrigin(null), /Configure/)
  for (const value of ['http://app.toke.pt', 'https://app.toke.pt/app', 'https://u:p@app.toke.pt', 'https://app.toke.pt/?x=1', 'https://app.toke.pt/#fragment']) {
    process.env.CLIENT_PORTAL_ORIGIN = value
    assert.throws(() => config.getPublicOrigins())
  }
})

test('localhost and legacy single-host configuration remain usable for development', t => {
  environment(t, { NODE_ENV: 'development' })
  assert.equal(config.publicUrl('/app'), 'http://localhost:3000/app')
  assert.equal(config.checkoutReturnOrigin('http://localhost:3000'), 'http://localhost:3000')
  assert.equal(config.checkoutReturnOrigin('https://legacy.vercel.app'), 'https://legacy.vercel.app')
  assert.equal(config.moloniRedirectUri('http://localhost:3000'), 'http://localhost:3000/api/moloni/callback')
  process.env.CLIENT_PORTAL_ORIGIN = 'http://localhost:3000'
  assert.equal(config.publicUrl('/tracking', 'site'), 'http://localhost:3000/tracking')
})

test('Proxy redirects navigation but never forwards login/Server Action bodies across domains', async t => {
  environment(t)
  let sessionCalls = 0
  const load = createLoader({
    '@/lib/config/public-origins': { domainDestination: input => config.domainDestination(input, origins) },
    '@/lib/supabase/middleware': { updateSession: async () => { sessionCalls++; return { status: 200 } } },
    'next/server': { NextResponse: class {
      constructor(body, options) { this.body = body; Object.assign(this, options) }
      static redirect(url) { return { status: 307, url } }
      static next() { return { status: 200 } }
    } },
  })
  const { proxy } = load('proxy.ts')
  const request = (url, method = 'GET') => ({ url, method, nextUrl: new URL(url) })
  const post = await proxy(request('https://app.toke.pt/login', 'POST'))
  assert.equal(post.status, 421)
  assert.equal(sessionCalls, 0)
  assert.equal((await proxy(request('https://app.toke.pt/login'))).url, 'https://app.toke.pt/app/login')
  assert.equal((await proxy(request('https://ops.toke.pt/app/stef-store', 'POST'))).status, 200)
  assert.equal(sessionCalls, 1)
})
