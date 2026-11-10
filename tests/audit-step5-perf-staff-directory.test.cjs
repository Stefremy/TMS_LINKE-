const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const TENANT = '11111111-1111-1111-1111-111111111111'
const OTHER_TENANT = '22222222-2222-2222-2222-222222222222'

test('PERF-001: loadStaffDirectory scopes audit_log query to candidate collaborator IDs and avoids full table replay', async () => {
  const user = {
    id: 'user-staff-1234',
    email: 'staff@example.invalid',
    app_metadata: { role: 'employee', colaborador_id: 'col-staff-1', tenant_id: TENANT, permissions: ['access:shipments'] },
  }

  const auditEvents = [
    {
      id: 'event-1',
      tenant_id: TENANT,
      action: 'colaborador_created',
      details: { id: 'col-staff-1', name: 'Staff One', email: 'staff@example.invalid', permissions: ['access:shipments', 'access:support'] },
      created_at: '2026-11-01T10:00:00Z',
    },
    {
      id: 'event-2',
      tenant_id: TENANT,
      action: 'colaborador_created',
      details: { id: 'col-other-99', name: 'Unrelated Staff', email: 'other@example.invalid', permissions: [] },
      created_at: '2026-11-01T10:05:00Z',
    },
  ]

  const db = fakeSupabase({ audit_log: auditEvents, colaboradores: [] }, null, { persistInserts: false })

  const load = createLoader({
    'server-only': {},
    '@/lib/supabase/schema-capabilities': {
      supportsDatabaseFeature: async () => false, // test audit_log fallback path
    },
  })

  const { loadStaffDirectory } = load('lib/auth/staff-directory.ts')
  const profiles = await loadStaffDirectory(db.client, TENANT, [user])

  assert.equal(profiles.length, 1)
  assert.equal(profiles[0].id, 'col-staff-1')
  assert.ok(profiles[0].permissions.includes('access:support'))

  // Verify that the audit_log query contained an IN filter on details->>id targeting candidate IDs
  const auditQuery = db.queries.find(q => q.table === 'audit_log')
  assert.ok(auditQuery, 'audit_log must be queried')
  const idFilter = auditQuery.filters.find(f => f.field === 'details->>id')
  assert.ok(idFilter, 'audit_log query must filter by details->>id')
  assert.equal(idFilter.kind, 'in')
  assert.ok(idFilter.value.includes('col-staff-1'), 'filter must include candidate collaborator ID')
  assert.ok(!idFilter.value.includes('col-other-99'), 'filter must NOT include unrelated IDs')
})

test('PERF-001: SQL migration creates canonical colaboradores table, indexes, and applies backfill from audit_log', async () => {
  const pg = new PGlite()

  // 1. Setup mock auth roles, functions, and audit_log
  await pg.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.jwt()
    RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT COALESCE(
        current_setting('request.jwt.claims', true)::jsonb,
        '{}'::jsonb
      );
    $$;

    CREATE TABLE IF NOT EXISTS public.audit_log (
      id BIGSERIAL PRIMARY KEY,
      tenant_id UUID NOT NULL,
      action TEXT NOT NULL,
      details JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
    );

    -- Insert mock audit events
    INSERT INTO public.audit_log (tenant_id, action, details, created_at)
    VALUES
      ('${TENANT}', 'colaborador_created', '{"id": "col-1", "name": "Stefano", "email": "stefano@linkelogistics.pt", "status": "Ativo", "access_level": "Administrador", "permissions": ["*"]}', '2026-11-01T10:00:00Z'),
      ('${TENANT}', 'colaborador_created', '{"id": "col-2", "name": "Aldara", "email": "aldara@linkelogistics.pt", "status": "Ativo", "access_level": "Operacional", "permissions": ["access:shipments"]}', '2026-11-01T10:05:00Z'),
      ('${TENANT}', 'colaborador_updated', '{"id": "col-2", "name": "Aldara", "email": "aldara@linkelogistics.pt", "status": "Ativo", "access_level": "Operacional", "permissions": ["access:shipments", "access:pickups"]}', '2026-11-02T10:00:00Z'),
      ('${TENANT}', 'colaborador_created', '{"id": "col-3", "name": "Deleted Colab", "email": "deleted@linkelogistics.pt", "status": "Ativo"}', '2026-11-01T11:00:00Z'),
      ('${TENANT}', 'colaborador_deleted', '{"id": "col-3"}', '2026-11-03T10:00:00Z');
  `)

  // 2. Run the migration
  const migrationSql = fs.readFileSync(
    path.join(__dirname, '../supabase/migrations/20261110150000_canonical_colaboradores_table.sql'),
    'utf8'
  )
  await pg.exec(migrationSql)

  // 3. Verify table exists and backfilled records
  const result = await pg.query('SELECT id, name, email, access_level, permissions FROM public.colaboradores ORDER BY id ASC;')
  assert.equal(result.rows.length, 2, 'Deleted collaborator must not be present; 2 active must be backfilled')
  assert.equal(result.rows[0].id, 'col-1')
  assert.equal(result.rows[0].name, 'Stefano')
  assert.equal(result.rows[0].access_level, 'Administrador')

  assert.equal(result.rows[1].id, 'col-2')
  assert.equal(result.rows[1].name, 'Aldara')
  assert.deepEqual(result.rows[1].permissions, ['access:shipments', 'access:pickups'])

  // 4. Verify RLS policies: employee can SELECT own tenant, cannot see OTHER_TENANT
  await pg.exec(`
    INSERT INTO public.colaboradores (id, tenant_id, name, email)
    VALUES ('col-foreign', '${OTHER_TENANT}', 'Foreign Colab', 'foreign@other.com');
  `)

  await pg.exec(`
    SET ROLE authenticated;
    SET request.jwt.claims = '{"app_metadata": {"role": "employee", "tenant_id": "${TENANT}"}}';
  `)

  const staffQuery = await pg.query('SELECT id FROM public.colaboradores;')
  assert.equal(staffQuery.rows.length, 2, 'Staff must only see the 2 colaboradores from own tenant')
  assert.ok(!staffQuery.rows.some(r => r.id === 'col-foreign'), 'Foreign tenant records must be hidden by RLS')
})
