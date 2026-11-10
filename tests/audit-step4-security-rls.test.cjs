const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { PGlite } = require("@electric-sql/pglite")
const { createLoader } = require("./helpers/load-typescript.cjs")
const { fakeSupabase } = require("./helpers/fake-supabase.cjs")

const TENANT = "11111111-1111-4111-8111-111111111111"
const CLIENT_A = "22222222-2222-4222-8222-222222222222"
const CLIENT_B = "33333333-3333-4333-8333-333333333333"

async function setupRlsDb() {
  const db = new PGlite()
  await db.exec(`
    DO $$ BEGIN
      CREATE ROLE anon NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE ROLE authenticated NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE ROLE service_role NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
      SELECT coalesce(current_setting('request.jwt.claim.role', true), 'anon');
    $$;
    CREATE OR REPLACE FUNCTION auth.client_id() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.client_id', true), '')::uuid;
    $$;
    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
    $$;

    CREATE TABLE public.shipments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      client_id uuid NOT NULL,
      tracking_number text,
      status text NOT NULL DEFAULT 'pendente',
      sell_price numeric(10,2) NOT NULL DEFAULT 10.00,
      weight_kg numeric(8,2) NOT NULL DEFAULT 1.00
    );

    CREATE TABLE public.packages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
      weight_kg numeric(8,2) NOT NULL DEFAULT 1.00
    );

    ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
  `)

  // Apply the new SEC-003 migration
  const migrationSql = fs.readFileSync(
    "supabase/migrations/20261110140000_restrict_client_shipments_rls.sql",
    "utf8"
  )
  await db.exec(migrationSql)

  // Seed sample shipments
  await db.query(
    `INSERT INTO public.shipments (id, tenant_id, client_id, tracking_number, status, sell_price)
     VALUES
       ('10000000-0000-0000-0000-000000000001', $1, $2, 'DA_CLIENT_A_1', 'pendente', 10.00),
       ('20000000-0000-0000-0000-000000000002', $1, $3, 'DA_CLIENT_B_1', 'pendente', 25.00)`,
    [TENANT, CLIENT_A, CLIENT_B]
  )
  return db
}

test("SEC-003 RLS: clients can only SELECT own shipments and packages, direct INSERT/UPDATE/DELETE are blocked", async () => {
  const db = await setupRlsDb()

  // Switch session to Client A
  await db.exec("SET ROLE authenticated")
  await db.exec(`SET request.jwt.claim.role = 'client'`)
  await db.exec(`SET request.jwt.claim.client_id = '${CLIENT_A}'`)
  await db.exec(`SET request.jwt.claims = '{"app_metadata": {"role": "client", "client_id": "${CLIENT_A}"}}'`)

  // 1. Can SELECT own shipments
  const selOwn = await db.query("SELECT id, tracking_number, sell_price FROM public.shipments")
  assert.equal(selOwn.rows.length, 1)
  assert.equal(selOwn.rows[0].tracking_number, "DA_CLIENT_A_1")

  // 2. Direct INSERT into shipments is blocked by RLS
  await assert.rejects(
    db.query(
      "INSERT INTO public.shipments (tenant_id, client_id, tracking_number, sell_price) VALUES ($1, $2, 'FORGED_TRACKING', 0.01)",
      [TENANT, CLIENT_A]
    ),
    /violates row-level security policy|permission denied/i
  )

  // 3. Direct UPDATE on shipments (e.g. tampering sell_price or status) modifies 0 rows / fails RLS
  const updateRes = await db.query(
    "UPDATE public.shipments SET sell_price = 0.01, status = 'entregue' WHERE id = '10000000-0000-0000-0000-000000000001'"
  )
  assert.equal(updateRes.affectedRows || 0, 0, "Client must not be able to UPDATE shipments directly")

  // Verify price remained intact
  const verifyPrice = await db.query(
    "SELECT sell_price FROM public.shipments WHERE id = '10000000-0000-0000-0000-000000000001'"
  )
  assert.equal(Number(verifyPrice.rows[0].sell_price), 10.00)

  // 4. Direct DELETE on shipments is blocked / deletes 0 rows
  const delRes = await db.query(
    "DELETE FROM public.shipments WHERE id = '10000000-0000-0000-0000-000000000001'"
  )
  assert.equal(delRes.affectedRows || 0, 0, "Client must not be able to DELETE shipments directly")

  // 5. Direct INSERT into packages is blocked
  await assert.rejects(
    db.query(
      "INSERT INTO public.packages (shipment_id, weight_kg) VALUES ('10000000-0000-0000-0000-000000000001', 5.0)",
      []
    ),
    /violates row-level security policy|permission denied/i
  )

  await db.exec("RESET ROLE")
})

test("PERF-004 fetchShipments enforces safe query limits", async () => {
  const tables = {
    shipments: [],
  }
  const db = fakeSupabase(tables)
  const load = createLoader({
    '@/lib/services/correos/correos-label-customizer': {},
    '@/lib/label-utils': {},
    "@/lib/auth/context": {
      async requireUser() {
        return { tenant_id: TENANT, role: "employee" }
      },
    },
    "@/lib/supabase/server": { createAdminClient: () => db.client },
  })

  const { fetchShipments } = load("lib/services/shipments/shipment-fetcher.ts")

  // 1. Unconstrained query defaults to 1000 instead of 10000
  await fetchShipments()
  const q1 = db.queries[db.queries.length - 1]
  assert.equal(q1.limit, 1000)

  // 2. Contas Correntes query with createdAfter allows 10000
  await fetchShipments({ createdAfter: "2026-08-01T00:00:00Z" })
  const q2 = db.queries[db.queries.length - 1]
  assert.equal(q2.limit, 10000)

  // 3. Explicit limit (e.g. tracking page 100) is respected
  await fetchShipments({ limit: 100 })
  const q3 = db.queries[db.queries.length - 1]
  assert.equal(q3.limit, 100)
})

