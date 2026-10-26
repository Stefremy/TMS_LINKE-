const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const TENANT = '11111111-1111-1111-1111-111111111111'
const FOREIGN = '99999999-9999-9999-9999-999999999999'
const A = '22222222-2222-2222-2222-222222222222'
const B = '33333333-3333-3333-3333-333333333333'
const client = { role: 'client', tenant_id: TENANT, client_id: A }
const staff = { role: 'employee', tenant_id: TENANT, client_id: null }
const paths = createLoader({})('lib/client-portal/paths.ts')

function cookieJar(initial = []) {
  const values = new Map(initial.map(c => [c.name, c]))
  return {
    getAll: () => [...values.values()],
    has: name => values.has(name),
    get: name => values.get(name),
    set(name, value, options) { const c = typeof name === 'object' ? name : { name, value, ...options }; values.set(c.name, c) },
    delete: name => values.delete(name),
  }
}
const nextResponse = {
  next: () => ({ cookies: cookieJar(), status: 200 }),
  redirect: url => ({ cookies: cookieJar(), status: 307, location: String(url) }),
}

function harness(ctx = client, { adjust, failure } = {}) {
  const tables = {
    clients: [{ id: A, tenant_id: TENANT, name: 'Stef Store' }, { id: B, tenant_id: TENANT, name: 'Store B' },
      { id: FOREIGN, tenant_id: FOREIGN, name: 'Foreign private store' }],
    audit_log: [
      { id: 'audit-a', tenant_id: TENANT, action: 'client_data', created_at: '2026-10-14', details: { id: A, short_name: 'Stef Store' } },
      { id: 'audit-b', tenant_id: TENANT, action: 'client_data', created_at: '2026-10-14', details: { id: B, short_name: 'Store B' } },
      { id: 'audit-old-a', tenant_id: TENANT, action: 'client_data', created_at: '2026-10-01', details: { id: A, short_name: 'Old name' } },
      { id: 'audit-foreign', tenant_id: FOREIGN, action: 'client_data', created_at: '2026-12-01', details: { id: A, short_name: 'Foreign private alias' } },
    ],
  }
  adjust?.(tables)
  const db = fakeSupabase(tables, failure)
  const calls = { profiles: [], recipients: [], statements: [] }
  const requireUser = async () => {
    if (!ctx) throw new Error('LOGIN_REQUIRED')
    return ctx
  }
  const load = createLoader({
    'server-only': {},
    react: { cache: fn => fn, Suspense: 'Suspense' },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'next/navigation': { notFound: () => { throw new Error('NOT_FOUND') }, redirect: url => { throw new Error(`REDIRECT:${url}`) } },
    'next/server': { NextResponse: nextResponse },
    '@/lib/auth/context': { requireUser, requireEmployee: async () => {
      const authorized = await requireUser()
      if (!['employee', 'admin'].includes(authorized.role)) throw new Error('STAFF_REQUIRED')
      return authorized
    }, getTenantId: async () => ctx?.tenant_id, getAuthContext: async () => ctx },
    'next/cache': { revalidatePath() {} },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    '@/app/actions/clientes': { getClientesAction: async id => {
      calls.profiles.push(id)
      return [{ id, short_name: id === A ? 'Stef Store' : 'Store B' }]
    } },
    '@/app/actions/destinatarios': { getDestinatariosAction: async id => { calls.recipients.push(id); return [] } },
    '@/app/actions/credit-notes': {listCreditNotesAction:async()=>[]},
    '@/app/actions/moloni': { getBillingStatementsAction: async id => { calls.statements.push(id); return [] } },
    '../components/ClientDashboard': { ClientDashboard: 'Dashboard' },
    '../../components/ClientCreateGuia': { ClientCreateGuia: 'Create' },
    '../../components/ClientShipmentsHistory': { ClientShipmentsHistory: 'History' },
    '@/app/ops/entidades/destinatarios/components/DestinatariosClient': { DestinatariosClient: 'Recipients' },
    '../../faturas/FaturasClient': { default: 'Invoices' },
    '../components/ClientPortalShell': { ClientPortalShell: 'Shell' },
    'lucide-react': { Loader2: 'Loader' },
  })
  return { load, access: load('lib/client-portal/access.ts'), tables, db, calls }
}

test('slugs normalize readable names and disambiguate duplicates, reserved paths and alias collisions', () => {
  assert.equal(paths.normalizeStoreSlug(' Stéf Store! '), 'stef-store')
  assert.equal(paths.normalizeStoreSlug('///'), 'loja')
  assert.equal(paths.portalPath('stef-store', 'criar-guia'), '/app/stef-store/criar-guia')
  const stores = [
    { id: A, name: 'Same' }, { id: B, name: 'Same' },
    { id: 'c', name: 'envios' }, { id: 'd', name: `same-${A}` },
    { id: 'e', name: `loja-${A}` },
  ]
  const slugs = paths.buildStoreSlugs(stores)
  assert.equal(new Set(slugs.values()).size, stores.length)
  assert.notEqual(slugs.get('c'), 'envios')
  assert.notEqual(slugs.get(A), slugs.get(B))
})

test('client opens its own slug but cannot open a different, unknown, reserved or foreign-store slug', async () => {
  const h = harness()
  const own = await h.access.requirePortalStore('stef-store')
  assert.equal(own.client.id, A)
  assert.equal(own.basePath, '/app/stef-store')
  assert.equal(own.isEmployee, false)
  for (const slug of ['store-b', 'foreign-private-store', 'foreign-private-alias', 'old-name', 'missing', '../ops', 'envios']) {
    await assert.rejects(h.access.requirePortalStore(slug), /NOT_FOUND/)
  }
  assert.deepEqual(h.calls.profiles, [A])
  for (const q of h.db.queries) assert.ok(q.filters.some(f => f.field === 'tenant_id' && f.value === TENANT))
})

test('each store login is independently bound to exactly its assigned store', async () => {
  const h = harness({ ...client, client_id: B })
  assert.equal((await h.access.requirePortalStore('store-b')).client.id, B)
  await assert.rejects(h.access.requirePortalStore('stef-store'), /NOT_FOUND/)
  await assert.rejects(h.access.getPortalDestination(A), /NOT_FOUND/)
})

test('store routing reads only identity JSON fields instead of full billing, avatars and pricing documents', async () => {
  const h = harness(client, { adjust: t => {
    t.audit_log[0].details.logo_url = 'data:image/png;base64,' + 'X'.repeat(100000)
    t.audit_log[0].details.credit_limit = 123
    t.audit_log[0].details.portal_slug = 'stef-store'
  } })
  assert.equal((await h.access.requirePortalStore('stef-store')).client.id, A)
  const identityQueries = h.db.queries.filter(q => q.table === 'audit_log')
  assert.ok(identityQueries.length > 0)
  for (const q of identityQueries) {
    assert.match(q.projection, /store_id:details->>id/)
    assert.match(q.projection, /is_active:details->is_active/)
    assert.doesNotMatch(q.projection, /logo_url|credit_limit|pricing|(?:^|,)\s*details\s*(?:,|$)/)
  }
})

test('Ops and admins open both stores directly, independent of the last selection cookie', async () => {
  for (const role of ['employee', 'admin']) {
    const ctx = { ...staff, role, client_id: A }
    const h = harness(ctx)
    const a = await h.access.requirePortalStore('stef-store')
    const b = await h.access.requirePortalStore('store-b')
    assert.equal(a.client.id, A)
    assert.equal(b.client.id, B)
    assert.equal(a.isEmployee, true)
    assert.equal(b.isEmployee, true)
    assert.equal(ctx.client_id, A)
    assert.deepEqual(h.calls.profiles, [A, B])
    await assert.rejects(h.access.requirePortalStore('foreign-private-store'), /NOT_FOUND/)
  }
})

test('deleted stores, inactive client stores and missing company context fail closed', async () => {
  for (const options of [
    { adjust: t => t.audit_log.push({ id: 'deleted', tenant_id: TENANT, action: 'deleted_client', details: { id: A } }) },
    { adjust: t => { t.audit_log[0].details.is_active = false } },
  ]) {
    const h = harness(client, options)
    await assert.rejects(h.access.requirePortalStore('stef-store'), /NOT_FOUND/)
    await assert.rejects(h.access.getPortalDestination(A), /NOT_FOUND/)
    assert.equal(h.calls.profiles.length, 0)
  }
  const missing = harness({ ...client, tenant_id: '' })
  await assert.rejects(missing.access.requirePortalStore('stef-store'), /empresa/)
  assert.equal(missing.db.adminClients, 0)
  const ops = harness(staff, { adjust: t => { t.audit_log[0].details.is_active = false } })
  assert.equal((await ops.access.requirePortalStore('stef-store')).client.id, A)
})

test('database errors never fall back to demo stores or load client profiles', async () => {
  for (const table of ['clients', 'audit_log']) {
    const h = harness(client, { failure: q => q.table === table ? { message: 'private details' } : null })
    await assert.rejects(h.access.requirePortalStore('stef-store'), err => !/private details/.test(err.message) && /verificar/.test(err.message))
    assert.equal(h.calls.profiles.length, 0)
  }
  const anonymous = harness(null)
  await assert.rejects(anonymous.access.requirePortalStore('stef-store'), /LOGIN_REQUIRED/)
  assert.equal(anonymous.db.adminClients, 0)
})

test('stored aliases survive display-name changes and duplicate names resolve to different immutable IDs', async () => {
  const h = harness(client, { adjust: t => {
    t.audit_log[0].details.short_name = 'Renamed display name'
    t.audit_log[0].details.portal_slug = 'stef-store'
  } })
  assert.equal((await h.access.requirePortalStore('stef-store')).client.id, A)
  const duplicate = harness(client, { adjust: t => { t.audit_log[1].details.short_name = 'Stef Store' } })
  await assert.rejects(duplicate.access.requirePortalStore('stef-store'), /NOT_FOUND/)
  assert.equal((await duplicate.access.requirePortalStore(`stef-store-${A}`)).client.id, A)
  await assert.rejects(duplicate.access.requirePortalStore(`stef-store-${B}`), /NOT_FOUND/)
})

test('catalog pagination includes stores beyond 1000 records without exposing other companies', async () => {
  const h = harness(staff, { adjust: t => {
    for (let i = 0; i < 1001; i++) t.clients.push({ id: `x-${String(i).padStart(5, '0')}`, tenant_id: TENANT, name: `Store ${i}` })
  } })
  assert.equal((await h.access.requirePortalStore('store-1000')).client.id, 'x-01000')
  assert.ok(h.db.queries.some(q => q.table === 'clients' && q.range?.[0] === 1000))
})

test('old links redirect to the selected store and retain only supported payment feedback', async () => {
  const h = harness()
  await assert.rejects(h.access.redirectLegacyPortal('envios', { topup: 'success', clientId: B, next: 'https://evil.invalid' }),
    /REDIRECT:\/app\/stef-store\/envios\?topup=success/)
  await assert.rejects(h.access.redirectLegacyPortal(undefined, { topup: '<script>' }), /^Error: REDIRECT:\/app\/stef-store$/)
  const unselected = harness(staff)
  await assert.rejects(unselected.access.redirectLegacyPortal(), /REDIRECT:\/ops\/entidades\/clientes/)
})

test('every new page independently rejects the wrong store before loading its data', async () => {
  for (const section of ['', 'criar-guia', 'envios', 'destinatarios', 'faturas', 'recolhas']) {
    const h = harness()
    const page = h.load(`app/app/[storeSlug]/${section ? `${section}/` : ''}page.tsx`).default
    await assert.rejects(page({ params: Promise.resolve({ storeSlug: 'store-b' }) }), /NOT_FOUND/)
    assert.deepEqual(h.calls, { profiles: [], recipients: [], statements: [] })
  }
})

test('staff recipient and invoice pages use the URL store rather than a browser-wide selection', async () => {
  const h = harness({ ...staff, client_id: A })
  await h.load('app/app/[storeSlug]/destinatarios/page.tsx').default({ params: Promise.resolve({ storeSlug: 'store-b' }) })
  await h.load('app/app/[storeSlug]/faturas/page.tsx').default({ params: Promise.resolve({ storeSlug: 'store-b' }) })
  assert.deepEqual(h.calls.recipients, [B])
  assert.deepEqual(h.calls.statements, [B])
})

test('staff selector validates the store before setting a cookie and cannot redirect off-site', async () => {
  const h = harness(staff)
  const selector = h.load('app/app/selecionar/route.ts').GET
  const url = new URL(`http://fixture.invalid/app/selecionar?clientId=${B}&section=envios&topup=success&next=https://evil.invalid`)
  const result = await selector({ nextUrl: url, url: String(url) })
  assert.equal(result.location, 'http://fixture.invalid/app/store-b/envios?topup=success')
  assert.equal(result.cookies.get('impersonated_client_id').value, B)
  assert.equal(result.cookies.get('impersonated_client_id').httpOnly, true)
  const invalid = new URL(`http://fixture.invalid/app/selecionar?clientId=${FOREIGN}`)
  await assert.rejects(selector({ nextUrl: invalid, url: String(invalid) }), /NOT_FOUND/)
  const c = harness(client)
  await assert.rejects(c.load('app/app/selecionar/route.ts').GET({ nextUrl: url, url: String(url) }), /STAFF_REQUIRED/)
  assert.equal(c.db.adminClients, 0)
})

test('legacy clientId middleware delegates validation instead of setting an unchecked store cookie', async () => {
  const refreshed = { name: 'fixture-auth', value: 'refreshed', httpOnly: true }
  const middleware = createLoader({
    'next/server': { NextResponse: nextResponse },
    '@supabase/ssr': { createServerClient: (_url, _key, options) => ({ auth: {
      getUser: async () => {
        options.cookies.setAll([refreshed])
        return { data: { user: { app_metadata: { role: 'employee' } } } }
      },
    } }) },
  })('lib/supabase/middleware.ts').updateSession
  const nextUrl = new URL(`http://fixture.invalid/app/envios?clientId=${FOREIGN}&clientName=forged`)
  nextUrl.clone = () => new URL(nextUrl)
  const result = await middleware({ nextUrl, cookies: cookieJar() })
  assert.equal(result.location, `http://fixture.invalid/app/selecionar?clientId=${FOREIGN}&section=envios`)
  assert.equal(result.cookies.has('impersonated_client_id'), false)
  assert.equal(result.cookies.get('fixture-auth').value, 'refreshed')
})

test('staff saves a normalized portal alias and name edits retain the existing address', async () => {
  for (const existingAlias of [undefined, 'fixed-address']) {
    const h = harness(staff, { adjust: t => { t.audit_log[0].details.portal_slug = existingAlias } })
    const result = await h.load('app/actions/clientes.ts').saveClienteAction({ id: A, short_name: 'Renamed Store' })
    assert.equal(result.data.portal_slug, existingAlias || 'stef-store')
    assert.equal(h.db.writes.find(w => w.kind === 'insert').value.details.portal_slug, existingAlias || 'stef-store')
  }
  const h = harness(staff)
  const result = await h.load('app/actions/clientes.ts').saveClienteAction({ id: A, short_name: 'Stef Store', portal_slug: ' Stéf Store! ' })
  assert.equal(result.data.portal_slug, 'stef-store')
})

test('clients cannot change store aliases and lookup errors prevent alias writes', async () => {
  const h = harness(client)
  await assert.rejects(h.load('app/actions/clientes.ts').saveClienteAction({ id: A, portal_slug: 'store-b' }), /STAFF_REQUIRED/)
  assert.equal(h.db.adminClients, 0)
  const failed = harness(staff, { failure: state => state.table === 'audit_log' ? { message: 'private detail' } : null })
  await assert.rejects(failed.load('app/actions/clientes.ts').saveClienteAction({ id: A, short_name: 'Renamed' }), /verificar o endereço/)
  assert.equal(failed.db.writes.length, 0)
})

test('saving stores rejects foreign IDs and failed writes, retaining previous profiles until a new one persists', async () => {
  const foreign = harness(staff)
  await assert.rejects(foreign.load('app/actions/clientes.ts').saveClienteAction({ id: FOREIGN, short_name: 'Forged' }), /verificar a loja/)
  assert.equal(foreign.db.writes.length, 0)
  for (const table of ['clients', 'audit_log']) {
    const h = harness(staff, { failure: state => state.write && state.table === table ? { message: 'private database error' } : null })
    await assert.rejects(h.load('app/actions/clientes.ts').saveClienteAction({ id: A, short_name: 'Renamed' }), error => !error.message.includes('private'))
    assert.equal(h.tables.audit_log.some(p => p.id === 'audit-a'), true)
    assert.equal(h.db.writes.some(w => w.kind === 'delete'), false)
  }
  const success = harness(staff)
  await success.load('app/actions/clientes.ts').saveClienteAction({ id: A, short_name: 'Renamed' })
  assert.equal(success.tables.audit_log.some(p => p.id === 'audit-foreign'), true)
  assert.equal(success.tables.audit_log.some(p => p.id === 'audit-b'), true)
  const insertIndex = success.db.queries.findIndex(q => q.table === 'audit_log' && q.write?.kind === 'insert')
  const cleanupIndex = success.db.queries.findIndex(q => q.table === 'audit_log' && q.write?.kind === 'delete')
  assert.ok(insertIndex >= 0 && cleanupIndex > insertIndex)
})

test('shipment lists force client ownership and constrain staff store queries to the signed-in company', async () => {
  for (const ctx of [client, { ...staff, client_id: A }]) {
    const db = fakeSupabase({ shipments: [
      { id: 'own', tenant_id: TENANT, client_id: A }, { id: 'other-store', tenant_id: TENANT, client_id: B },
      { id: 'foreign', tenant_id: FOREIGN, client_id: A },
    ] })
    const fetcher = createLoader({
      '@/lib/auth/context': { requireUser: async () => ctx },
      '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
      './shipment-utils': { formatOrGenerateCttObjectId: () => '' },
      '@/lib/services/correos/correos-label-customizer': {},
      '@/lib/label-utils': {},
    })('lib/services/shipments/shipment-fetcher.ts')
    const result = await fetcher.fetchShipments({ clientId: ctx.role === 'client' ? B : A })
    assert.deepEqual(result.map(row => row.id), ['own'])
  }
})
