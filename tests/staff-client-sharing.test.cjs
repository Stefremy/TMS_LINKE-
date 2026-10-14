const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const TENANT = '11111111-1111-1111-1111-111111111111'
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const FOREIGN = '99999999-9999-4999-8999-999999999999'
const staff = (id, role) => ({ id, email: `${id}@example.invalid`, app_metadata: { role } })

function harness(failure) {
  let user = staff('admin-user', 'admin')
  const tables = {
    colaboradores: [], client_users: [],
    clients: [
      { id: A, name: 'Admin-created store', tenant_id: TENANT, created_by: 'admin-user' },
      { id: B, name: 'Support-created store', tenant_id: TENANT, created_by: 'support-user' },
      { id: FOREIGN, name: 'Foreign company private store', tenant_id: FOREIGN },
    ],
    audit_log: [
      { id: 'profile-a', action: 'client_data', tenant_id: TENANT, details: { id: A, short_name: 'Admin-created store' } },
      { id: 'profile-b', action: 'client_data', tenant_id: TENANT, details: { id: B, short_name: 'Support-created store' } },
      { id: 'profile-foreign', action: 'client_data', tenant_id: FOREIGN,
        details: { id: FOREIGN, short_name: 'Foreign company private store' } },
    ],
  }
  const db = fakeSupabase(tables, failure)
  const load = createLoader({
    '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
    'next/headers': { cookies: async () => ({ getAll: () => [], get: () => undefined }) },
    react: { cache: fn => fn },
    'next/navigation': { redirect: () => { throw new Error('LOGIN_REQUIRED') } },
    'next/cache': { revalidatePath() {} },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    '@/app/ops/entidades/colaboradores/types': { DEFAULT_COLABORADORES: [] },
  })
  return { db, tables, auth: load('lib/auth/context.ts'), actions: load('app/actions/clientes.ts'),
    setUser: value => { user = value } }
}

test('independent Ops and administrator accounts see the same company clients regardless of creator', async () => {
  const h = harness()
  const results = []
  for (const user of [staff('admin-user', 'admin'), staff('support-user', 'employee')]) {
    h.setUser(user)
    assert.equal((await h.auth.requireEmployee()).tenant_id, TENANT)
    const clients = await h.actions.getClientesAction()
    assert.ok(clients.some(c => c.id === A))
    assert.ok(clients.some(c => c.id === B))
    assert.doesNotMatch(JSON.stringify(clients), /Foreign company/)
    results.push(clients.map(c => c.id).sort())
  }
  assert.deepEqual(results[0], results[1])
  assert.equal(h.db.writes.length, 0)
})

test('a saved client created by either colleague is available to the other on a fresh read', async () => {
  const h = harness()
  for (const [creator, viewer, id] of [
    [staff('admin-user', 'admin'), staff('support-user', 'employee'), 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'],
    [staff('support-user', 'employee'), staff('admin-user', 'admin'), 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'],
  ]) {
    h.setUser(creator)
    const before = h.db.writes.length
    const saved = await h.actions.saveClienteAction({ id, short_name: `Store by ${creator.id}` })
    assert.equal(saved.success, true)
    // The test database records inserts; materialize the accepted payloads to
    // exercise the subsequent independent account read with persisted data.
    for (const write of h.db.writes.slice(before).filter(w => w.kind === 'insert')) {
      assert.equal(write.value.tenant_id, TENANT)
      h.tables[write.table].push({ id: `fixture-${id}`, created_at: '2026-10-14', ...write.value })
    }
    h.setUser(viewer)
    const result = await h.actions.getClientesAction()
    assert.equal(result.find(c => c.id === id)?.short_name, `Store by ${creator.id}`)
  }
})

test('shared Ops access does not let a store login read or create another store', async () => {
  const h = harness()
  h.setUser({ id: 'client-user', email: 'store@example.invalid', app_metadata: { role: 'client', client_id: A } })
  const result = await h.actions.getClientesAction(B)
  assert.deepEqual(result.map(c => c.id), [A])
  await assert.rejects(h.actions.saveClienteAction({ id: B, short_name: 'Forbidden' }), /LOGIN_REQUIRED/)
  assert.equal(h.db.writes.length, 0)
})

test('failed registry or profile writes cannot report a successfully shared client', async () => {
  for (const table of ['clients', 'audit_log']) {
    const h = harness(query => query.table === table && query.write ? { code: 'fixture-error', message: 'private error' } : null)
    await assert.rejects(h.actions.saveClienteAction({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', short_name: 'Unsaved store' }),
      error => /gravar/.test(error.message) && !error.message.includes('private error'))
  }
})

test('anonymous visitors cannot list company clients or save a client', async () => {
  const h = harness()
  h.setUser(null)
  await assert.rejects(h.actions.getClientesAction(), /LOGIN_REQUIRED/)
  await assert.rejects(h.actions.saveClienteAction({ short_name: 'Forbidden' }), /LOGIN_REQUIRED/)
  assert.equal(h.db.queries.length, 0)
  assert.equal(h.db.writes.length, 0)
})

test('a new store persists no table assignments until the team explicitly chooses them', async () => {
  const h = harness()
  const saved = await h.actions.saveClienteAction({
    id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', short_name: 'Unconfigured store',
  })
  assert.equal(saved.success, true)
  assert.deepEqual(saved.data.assigned_linke_service_ids, [])
  assert.equal(saved.data.default_linke_table_id, '')
  const profile = h.db.writes.find(w => w.table === 'audit_log' && w.kind === 'insert').value.details
  assert.deepEqual(profile.assigned_linke_service_ids, [])
  assert.equal(profile.default_linke_table_id, '')
})

test('every colleague sees older clients beyond the former row limits and all database pages', async () => {
  const h = harness()
  for (let i = 0; i < 1050; i++) {
    h.tables.clients.push({ id: `fixture-store-${i}`, tenant_id: TENANT, name: `Store ${i}`, created_at: '2026-10-01' })
    h.tables.audit_log.push({ id: `fixture-profile-${i}`, action: 'client_data', tenant_id: TENANT,
      created_at: '2026-10-01', details: { id: `fixture-store-${i}`, short_name: `Profile ${i}` } })
  }
  for (const user of [staff('admin-user', 'admin'), staff('support-user', 'employee')]) {
    h.setUser(user)
    const result = await h.actions.getClientesAction()
    assert.equal(result.filter(c => c.id.startsWith('fixture-store-')).length, 1050)
    assert.equal(result.find(c => c.id === 'fixture-store-1049').short_name, 'Profile 1049')
    assert.doesNotMatch(JSON.stringify(result), /Foreign company/)
  }
})

test('a failed company registry or profile read reports an error instead of hiding shared clients', async () => {
  for (const table of ['clients', 'audit_log']) {
    const h = harness(query => query.table === table ? { message: 'private connection details' } : null)
    await assert.rejects(h.actions.getClientesAction(), error => /carregar os clientes da empresa/.test(error.message)
      && !error.message.includes('private connection details'))
    assert.equal(h.db.writes.length, 0)
  }
})
