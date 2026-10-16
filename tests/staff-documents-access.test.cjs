const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createLoader } = require('./helpers/load-typescript.cjs')

const access = createLoader({})('lib/auth/staff-documents.ts')

test('staff document vault allows administrators and the exact director account only', () => {
  const admin = { role: 'admin', user: { email: 'admin@linke.pt' } }
  const director = { role: 'employee', user: { email: 'geral@linke.pt' } }
  assert.equal(access.canAccessStaffDocuments(admin), true)
  assert.equal(access.canAccessStaffDocuments(director), true)
  assert.equal(access.canAccessStaffDocuments({ role: 'employee', user: { email: 'GERAL@LINKE.PT ' } }), true)
})

test('staff document vault denies other employees, clients, anonymous and unrecognized contexts', () => {
  for (const context of [
    null,
    undefined,
    { role: 'employee', user: { email: 'colleague@linke.pt' } },
    { role: 'client', user: { email: 'geral@linke.pt' } },
    { role: null, user: { email: 'admin@linke.pt' } },
  ]) assert.equal(access.canAccessStaffDocuments(context), false)
})

test('document API rejects unauthorized users before creating a service-role client', async () => {
  for (const context of [null, { role: 'employee', user: { email: 'colleague@linke.pt' } }, { role: 'client', user: { email: 'client@example.com' } }]) {
    let serviceRoleClients = 0
    const route = createLoader({
      'node:crypto': { randomUUID: () => 'fixture-id' },
      'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
      '@/lib/auth/context': { getAuthContext: async () => context },
      '@/lib/auth/staff-documents': access,
      '@/lib/supabase/server': { createAdminClient: () => { serviceRoleClients++; throw new Error('must not be called') } },
      '@/app/ops/entidades/colaboradores/types': { DEFAULT_COLABORADORES: [] },
    })('app/api/ops/documents/route.ts')
    for (const response of [
      await route.GET(new Request('http://localhost/api/ops/documents')),
      await route.POST(new Request('http://localhost/api/ops/documents', { method: 'POST' })),
      await route.DELETE(new Request('http://localhost/api/ops/documents', { method: 'DELETE' })),
    ]) assert.equal(response.status, 403)
    assert.equal(serviceRoleClients, 0)
  }
})

test('document storage is private and its metadata table has RLS without user-facing policies', () => {
  const migration = fs.readFileSync('supabase/migrations/20261016150000_staff_documents.sql', 'utf8')
  assert.match(migration, /'staff-documents',[\s\S]*?false/)
  assert.match(migration, /ALTER TABLE public\.staff_documents ENABLE ROW LEVEL SECURITY/)
  assert.doesNotMatch(migration, /CREATE POLICY/i)
})
