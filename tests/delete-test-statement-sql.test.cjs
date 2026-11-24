const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')

const T = '11111111-1111-1111-1111-111111111111', A = '22222222-2222-2222-2222-222222222222', B = '33333333-3333-3333-3333-333333333333'
const S1 = '55555555-5555-4555-8555-555555555555', S2 = '66666666-6666-4666-8666-666666666666', OTHER = '77777777-7777-4777-8777-777777777777'
const BS = '88888888-8888-4888-8888-888888888888'
let db
before(async () => {
  db = await PGlite.create()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.clients(id uuid PRIMARY KEY,tenant_id uuid NOT NULL);
    CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,action text NOT NULL,details jsonb,created_at timestamptz DEFAULT now());
    CREATE TABLE public.billing_statements(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,statement_number text);
    CREATE TABLE public.shipments(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,client_id uuid,status text,tracking_number text,sell_price numeric,
      billing_statement_id uuid REFERENCES public.billing_statements(id) ON DELETE SET NULL);
    CREATE TABLE public.billing_emission_claims(shipment_id uuid,tenant_id uuid);
    CREATE TABLE public.wallet_reservations(shipment_id uuid,tenant_id uuid,client_id uuid);
    CREATE TABLE public.credit_limit_reservations(shipment_id uuid,tenant_id uuid,client_id uuid);`)
  const sql = fs.readFileSync('supabase/migrations/20261124150000_delete_test_billing_statement.sql', 'utf8')
  await db.exec(sql); await db.exec(sql)
})
after(async () => db?.close())

async function seed(statement) {
  await db.exec('TRUNCATE public.audit_log,public.shipments,public.billing_statements,public.billing_emission_claims,public.wallet_reservations,public.credit_limit_reservations')
  await db.query("INSERT INTO public.billing_statements VALUES ($1,$2,$3,'EXT-1')", [BS, T, A])
  for (const [id, client] of [[S1, A], [S2, A], [OTHER, B]]) {
    await db.query("INSERT INTO public.shipments VALUES ($1,$2,$3,'pendente',$5,10,$4)", [id, T, client, client === A ? BS : null, 'LTK' + id.slice(0, 4)])
    await db.query("INSERT INTO public.audit_log(tenant_id,action,details) VALUES ($1,'shipment_data',$2)", [T, JSON.stringify({ id, client_id: client })])
  }
  await db.query('INSERT INTO public.billing_emission_claims VALUES ($1,$2),($3,$2)', [S1, T, S2])
  await db.query("INSERT INTO public.audit_log(tenant_id,action,details) VALUES ($1,'billing_statement',$2),($1,'billing_invoice_email_sent','{\"statement_number\":\"EXT-1\"}')",
    [T, JSON.stringify({ statement_number: 'EXT-1', client_id: A, shipment_ids: [S1, S2, OTHER], total_value: 20, ...statement })])
}
const run = () => db.query("SELECT public.delete_test_billing_statement($1,'EXT-1','tester') r", [T])
const count = async (sql, args = []) => (await db.query(sql, args)).rows[0].n

test('SQL: a Moloni TEST invoice and its shipments disappear from revenue, margins and statistics, with a deletion record', async () => {
  await seed({ moloni_document_id: 10, moloni_environment: 'test' })
  assert.equal((await run()).rows[0].r.shipments_deleted, 2)
  assert.equal(await count('SELECT count(*)::int n FROM public.shipments WHERE client_id=$1', [A]), 0)
  assert.equal(await count("SELECT count(*)::int n FROM public.audit_log WHERE action IN ('billing_statement','billing_invoice_email_sent')"), 0)
  assert.equal(await count("SELECT count(*)::int n FROM public.audit_log WHERE action='shipment_data'"), 1)
  assert.equal(await count('SELECT count(*)::int n FROM public.billing_statements'), 0)
  assert.equal(await count('SELECT count(*)::int n FROM public.billing_emission_claims'), 0)
  assert.equal(await count("SELECT count(*)::int n FROM public.audit_log WHERE action='shipment_hard_deleted'"), 2)
  assert.equal(await count("SELECT count(*)::int n FROM public.audit_log WHERE action='billing_statement_test_deleted'"), 1)
  // Another client's shipment listed by mistake is never touched.
  assert.equal(await count('SELECT count(*)::int n FROM public.shipments WHERE id=$1', [OTHER]), 1)
})
test('SQL: production Moloni invoices and credited statements are refused without deleting anything', async () => {
  await seed({ moloni_document_id: 1, moloni_environment: 'live' })
  await assert.rejects(run(), /produção/)
  await seed({ moloni_document_id: 1 })
  await assert.rejects(run(), /produção/)
  await seed({ moloni_document_id: 10, moloni_environment: 'test' })
  const st = (await db.query("SELECT id FROM public.audit_log WHERE action='billing_statement'")).rows[0].id
  await db.query("INSERT INTO public.audit_log(tenant_id,action,details) VALUES ($1,'credit_note',$2)", [T, JSON.stringify({ source: { id: st } })])
  await assert.rejects(run(), /notas de crédito/)
  assert.equal(await count('SELECT count(*)::int n FROM public.shipments'), 3)
})
test('SQL: statements without an invoice can be removed; unknown statements fail', async () => {
  await seed({})
  assert.equal((await run()).rows[0].r.shipments_deleted, 2)
  await assert.rejects(db.query("SELECT public.delete_test_billing_statement($1,'NOPE','tester')", [T]), /não encontrado/)
})
