const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')

const T = '11111111-1111-1111-1111-111111111111', OTHER = '99999999-9999-4999-8999-999999999999'
const migration = fs.readFileSync('supabase/migrations/20261127120000_shipment_list_metadata.sql', 'utf8')
let db
before(async () => {
  db = await PGlite.create()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
      action text NOT NULL, details jsonb, created_at timestamptz NOT NULL);`)
  await db.exec(migration); await db.exec(migration)
  const add = (tenant, action, at, details) => db.query('INSERT INTO public.audit_log(tenant_id,action,created_at,details) VALUES ($1,$2,$3,$4)', [tenant, action, at, JSON.stringify(details)])
  await add(T, 'shipment_data', '2026-01-01', { id: 'a', recipient_country: 'BE', driver_name: 'old' })
  await add(T, 'shipment_data', '2026-01-02', { id: 'a', recipient_country: 'PT', recipient_postal: '9000-001', is_return: true, isReturn: null, ctt_label_base64: 'x'.repeat(5000) })
  await add(T, 'other_action', '2026-01-03', { id: 'a', recipient_country: 'ES' })
  await add(OTHER, 'shipment_data', '2026-01-03', { id: 'a', recipient_country: 'ES' })
  await add(T, 'shipment_data', '2026-01-01', { id: 'b', is_return: false, driver_id: 'd1', driver_name: 'João' })
  await add(T, 'shipment_data', '2026-01-01', { id: 'not-asked', recipient_country: 'FR' })
})
after(async () => db?.close())

test('returns only the newest snapshot of each requested shipment of that company, without other fields', async () => {
  const { rows } = await db.query('SELECT * FROM public.shipment_list_metadata($1,$2) ORDER BY shipment_id', [T, ['a', 'a', 'b', 'missing']])
  assert.deepEqual(rows, [
    { shipment_id: 'a', recipient_country: 'PT', recipient_postal: '9000-001', is_return: true, isReturn: null, driver_id: null, driver_name: null },
    { shipment_id: 'b', recipient_country: null, recipient_postal: null, is_return: false, isReturn: null, driver_id: 'd1', driver_name: 'João' },
  ])
})

test('browser roles cannot call it', async () => {
  const { rows } = await db.query(`SELECT r, has_function_privilege(r, 'public.shipment_list_metadata(uuid,text[])', 'EXECUTE') ok FROM unnest(ARRAY['anon','authenticated','service_role']) r`)
  assert.deepEqual(rows.map(x => [x.r, x.ok]), [['anon', false], ['authenticated', false], ['service_role', true]])
})
