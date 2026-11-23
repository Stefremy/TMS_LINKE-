const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const T = '11111111-1111-1111-1111-111111111111'
const A = '22222222-2222-2222-2222-222222222222', B = '33333333-3333-3333-3333-333333333333', M = '44444444-4444-4444-4444-444444444444'
const codes = createLoader({})('lib/clients/client-code.ts')

test('client codes: CL + at least 3 digits, next free number never reuses a code', () => {
  assert.equal(codes.formatClientCode(7), 'CL007'); assert.equal(codes.formatClientCode(1200), 'CL1200')
  assert.equal(codes.nextClientCode([]), 'CL002', 'CL001 is the mother account')
  assert.equal(codes.nextClientCode(['CL001', 'cl933', 'LK0006', '20260080', null, 'CL5']), 'CL934', 'old and malformed codes are ignored')
  for (const ok of ['CL001', 'CL934', 'CL1200']) assert.ok(codes.CLIENT_CODE_PATTERN.test(ok), ok)
  for (const bad of ['LK0006', '20260080', 'CL12', 'CLABC', 'cl001 ']) assert.ok(!codes.CLIENT_CODE_PATTERN.test(bad), bad)
})

function harness(profiles) {
  const tables = {
    clients: [A, B, M].map(id => ({ id, tenant_id: T, name: id })),
    audit_log: profiles.map((details, i) => ({ id: `p${i}`, tenant_id: T, action: 'client_data', created_at: `2026-11-0${i + 1}`, details: { credit_limit: 0, ...details } })),
  }
  const db = fakeSupabase(tables, null, { persistInserts: true })
  const staff = { role: 'employee', tenant_id: T, client_id: null, user: { id: 'u' } }
  const load = createLoader({
    'server-only': {}, 'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect: url => { throw new Error(`REDIRECT:${url}`) }, notFound: () => { throw new Error('NOT_FOUND') } },
    '@/lib/supabase/server': { createAdminClient: () => db.createAdminClient() },
    '@/lib/auth/context': { requireUser: async () => staff, requireEmployee: async () => staff, getTenantId: async () => T, getAuthContext: async () => staff },
  })
  const saved = id => tables.audit_log.filter(r => r.action === 'client_data' && r.details.id === id).at(-1)?.details
  return { save: c => load('app/actions/clientes.ts').saveClienteAction(c), saved, tables }
}

test('new clients get the next free CL code; editing keeps the code and the old-platform code', async () => {
  const h = harness([
    { id: A, code: 'CL933', short_name: 'Loja A', legacy_code: 'LK0006', legacy_import: { source_code: 'LK0006', source_row: 7 } },
    { id: M, code: 'CL001', short_name: 'GO Linke' },
  ])
  const created = await h.save({ id: B, short_name: 'Loja B' })
  assert.equal(created.success, true, created.error); assert.equal(created.data.code, 'CL934')
  const edited = await h.save({ id: A, code: 'CL933', short_name: 'Loja A renomeada' })
  assert.equal(edited.success, true, edited.error)
  const a = h.saved(A)
  assert.equal(a.code, 'CL933'); assert.equal(a.legacy_code, 'LK0006', 'the old code survives a profile edit')
  assert.deepEqual(a.legacy_import, { source_code: 'LK0006', source_row: 7 })
})

test('typed codes must be free and in the CL format; the mother account code cannot change', async () => {
  const h = harness([{ id: A, code: 'CL933', short_name: 'Loja A' }, { id: B, code: 'CL100', short_name: 'Loja B' }, { id: M, code: 'CL001', short_name: 'GO Linke' }])
  const taken = await h.save({ id: B, code: 'CL933', short_name: 'Loja B' })
  assert.equal(taken.success, false); assert.match(taken.error, /CL933 já pertence a outro cliente/)
  const badFormat = await h.save({ id: B, code: 'LK0099', short_name: 'Loja B' })
  assert.equal(badFormat.success, false); assert.match(badFormat.error, /CL seguido de números/)
  const mother = await h.save({ id: M, code: 'CL777', short_name: 'GO Linke' })
  assert.equal(mother.success, false); assert.match(mother.error, /conta-mãe/)
  const changed = await h.save({ id: B, code: 'cl101', short_name: 'Loja B' })
  assert.equal(changed.success, true, changed.error); assert.equal(h.saved(B).code, 'CL101')
  assert.equal(h.saved(A).code, 'CL933')
})

test('a store not yet standardised keeps its old code on edit until it is migrated', async () => {
  const h = harness([{ id: A, code: '20260080', short_name: 'Loja Antiga' }])
  const edited = await h.save({ id: A, code: '20260080', short_name: 'Loja Antiga 2' })
  assert.equal(edited.success, true, edited.error); assert.equal(h.saved(A).code, '20260080')
})
