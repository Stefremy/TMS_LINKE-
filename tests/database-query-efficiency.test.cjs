const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

test('schema metadata queries coalesce and cache only capability booleans', async () => {
  const { supportsDatabaseFeature: supports } = createLoader({})('lib/supabase/schema-capabilities.ts')
  let calls = 0
  const db = { rpc: async name => {
    calls++
    assert.equal(name, 'linke_schema_capabilities')
    return { data: { carrier_connections: false, colaboradores: true, private: 'not cached' }, error: null }
  } }
  assert.deepEqual(await Promise.all([supports(db, 'carrier_connections'), supports(db, 'colaboradores')]), [false, true])
  assert.equal(await supports(db, 'carrier_connections'), false)
  assert.equal(await supports(db, 'servicos_linke'), true)
  assert.equal(calls, 1)
})

test('older deployments and malformed metadata preserve the existing native query/fallback behavior', async () => {
  for (const response of [{ data: null, error: { code: 'PGRST202' } }, { data: [], error: null }, { data: { carrier_connections: 'false' }, error: null }]) {
    const { supportsDatabaseFeature: supports } = createLoader({})('lib/supabase/schema-capabilities.ts')
    assert.equal(await supports({ rpc: async () => response }, 'carrier_connections'), true)
  }
  const { supportsDatabaseFeature: supports } = createLoader({})('lib/supabase/schema-capabilities.ts')
  assert.equal(await supports({}, 'carrier_connections'), true)
})

test('shipment snapshot reads filter both identifiers and tenant before loading heavy JSON', async () => {
  const { findShipmentAuditRecords: find } = createLoader({})('lib/services/shipments/audit-records.ts')
  const db = fakeSupabase({ audit_log: [
    { id: 'one', tenant_id: 'tenant', action: 'shipment_data', details: { id: 'target', tracking_number: 'target', ctt_label_base64: 'keep' } },
    { id: 'two', tenant_id: 'tenant', action: 'shipment_data', details: { id: 'other', tracking_number: 'target' } },
    { id: 'unrelated', tenant_id: 'tenant', action: 'shipment_data', details: { id: 'unrelated', ctt_label_base64: 'large unrelated document' } },
    { id: 'foreign', tenant_id: 'foreign', action: 'shipment_data', details: { id: 'target' } },
  ] })
  const result = await find(db.client, 'tenant', 'target')
  assert.deepEqual(result.map(row => row.id), ['one', 'two'])
  assert.equal(result[0].details.ctt_label_base64, 'keep')
  assert.equal(db.queries.length, 2)
  for (const query of db.queries) {
    assert.ok(query.filters.some(filter => filter.field === 'tenant_id' && filter.value === 'tenant'))
    assert.ok(query.filters.some(filter => filter.field.startsWith('details->>') && filter.value === 'target'))
  }
  assert.deepEqual(await find(db.client, '', 'target'), [])
})

test('Correos fallback and credential cache remain isolated by tenant', async () => {
  let tenantId = 'tenant-a'
  const db = fakeSupabase({ audit_log: [
    { id: 'a', tenant_id: 'tenant-a', action: 'carrier_connection_config', created_at: '2026-01-01', details: { carrier_code: 'correos_express', client_id: 'A', auth_id: 'user-a', user_id: 'pass-a' } },
    { id: 'b', tenant_id: 'tenant-b', action: 'carrier_connection_config', created_at: '2026-02-01', details: { carrier_code: 'correos_express', client_id: 'B', auth_id: 'user-b', user_id: 'pass-b' } },
  ] })
  db.client.rpc = async () => ({ data: { carrier_connections: false }, error: null })
  const credentials = createLoader({
    '@/lib/supabase/server': { createAdminClient: () => db.client },
    '@/lib/auth/context': { getTenantId: async () => tenantId },
    '@/lib/config/ctt-pickup-requester': { getCttPickupRequester: () => ({}) },
  })('lib/services/carriers/credentials.ts')
  assert.equal((await credentials.resolveCorreosCredentials()).solicitante, 'A')
  tenantId = 'tenant-b'
  assert.equal((await credentials.resolveCorreosCredentials()).solicitante, 'B')
  tenantId = 'tenant-a'
  assert.equal((await credentials.resolveCorreosCredentials()).solicitante, 'A')
  assert.equal(db.queries.filter(query => query.table === 'carrier_connections').length, 0)
  assert.equal(db.queries.filter(query => query.table === 'audit_log').length, 2)
})

test('efficiency migration preserves records and exposes only schema metadata to service_role', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.shipments(id uuid);
      CREATE TABLE public.audit_log(id uuid PRIMARY KEY, tenant_id uuid, action text, details jsonb, created_at timestamptz DEFAULT now());
      INSERT INTO public.audit_log VALUES ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','shipment_data','{"id":"shipment","ctt_label_base64":"preserved"}');`)
    const before = (await db.query('SELECT * FROM audit_log')).rows
    const migration = fs.readFileSync('supabase/migrations/20261104110000_database_query_efficiency.sql', 'utf8')
    await db.exec(migration)
    await db.exec(migration)
    assert.deepEqual((await db.query('SELECT * FROM audit_log')).rows, before)
    const flags = (await db.query('SELECT public.linke_schema_capabilities() AS capabilities')).rows[0].capabilities
    assert.equal(flags.carrier_connections, false)
    assert.equal(flags['shipments.ctt_manifest_pdf'], false)
    assert.equal(Object.keys(flags).length, 5)
    await db.exec('CREATE TABLE public.carrier_connections(id uuid); ALTER TABLE public.shipments ADD COLUMN ctt_manifest_pdf text;')
    const changed = (await db.query('SELECT public.linke_schema_capabilities() AS capabilities')).rows[0].capabilities
    assert.equal(changed.carrier_connections, true)
    assert.equal(changed['shipments.ctt_manifest_pdf'], true)
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const permission = (await db.query("SELECT has_function_privilege($1,'public.linke_schema_capabilities()','execute') AS allowed", [role])).rows[0].allowed
      assert.equal(permission, role === 'service_role')
    }
    const indexes = (await db.query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='audit_log'")).rows
    assert.equal(indexes.length, 7)
  } finally { await db.close() }
})
