const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')

// Executes the shipped PL/pgSQL in an isolated PostgreSQL engine, not a mocked RPC.
// PGlite serializes queries on one backend; this verifies transaction/constraint behavior,
// while deployment still needs a two-connection PostgreSQL concurrency smoke test.
const T = '11111111-1111-1111-1111-111111111111', A = '22222222-2222-2222-2222-222222222222'
const B = '33333333-3333-3333-3333-333333333333', TX = '44444444-4444-4444-4444-444444444444'
const S1 = '55555555-5555-4555-8555-555555555555', S2 = '66666666-6666-4666-8666-666666666666'
let db
before(async () => {
  db = await PGlite.create()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.clients(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,name text);
    CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,action text NOT NULL,details jsonb,created_at timestamptz DEFAULT now());
    CREATE TYPE public.shipment_status AS ENUM ('rascunho','pendente','entregue','anulado');
    CREATE TABLE public.shipments(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,client_id uuid,status public.shipment_status,sell_price numeric,created_at timestamptz DEFAULT now());
  `)
  await db.exec(fs.readFileSync('supabase/migrations/20260921100000_client_transactions.sql','utf8'))
  const migration = fs.readFileSync('supabase/migrations/20261022180000_atomic_wallet_operations.sql','utf8')
  await db.exec(migration)
  await db.exec(migration) // Reruns must not alter money or fail on existing schema.
})
after(async () => db?.close())
async function reset({ credit = 10, profile = true, status = 'pending' } = {}) {
  await db.exec('TRUNCATE public.wallet_reservations,public.client_transactions,public.shipments,public.audit_log,public.clients CASCADE')
  await db.query('INSERT INTO public.clients(id,tenant_id) VALUES ($1,$2),($3,$3)', [A,T,B])
  if (profile) await db.query("INSERT INTO public.audit_log(tenant_id,action,details) VALUES ($1,'client_data',$2)", [T,JSON.stringify({id:A,credit_limit:credit,billing_type:'pay_as_you_go'})])
  await db.query("INSERT INTO public.client_transactions(id,tenant_id,client_id,amount,status,stripe_session_id) VALUES ($1,$2,$3,10,$4,'cs_fixture')",[TX,T,A,status])
}
const settle = (args={}) => db.query('SELECT public.settle_stripe_topup($1,$2,$3,$4,$5,$6) result',
  [TX,args.tenant||T,args.client||A,args.session===null?null:args.session||'cs_fixture',args.cents===undefined?1000:args.cents,'evt_fixture'])
const snapshot = async () => (await db.query('SELECT public.client_wallet_snapshot($1,$2) result',[T,A])).rows[0].result
const reserve = (id=S1,amount=3) => db.query('SELECT public.reserve_shipment_wallet($1,$2,$3,$4,$5) result',[T,A,id,amount,'LTK-FIXTURE'])
const move = (from,to) => db.query('SELECT public.transition_wallet_reservation($1,$2,$3,$4,$5,NULL) result',[T,A,S1,from,to])
const tx = async () => (await db.query('SELECT * FROM public.client_transactions WHERE id=$1',[TX])).rows[0]

test('SQL: top-up status, amount and fulfillment commit once, including duplicate delivery', async () => {
  await reset(); await Promise.all([settle(),settle(),settle()])
  assert.equal((await snapshot()).credit,20)
  assert.equal((await tx()).status,'paid'); assert.ok((await tx()).credited_at)
})
test('SQL: a failure after the balance UPDATE rolls the entire settlement back; retry recovers', async () => {
  await reset()
  await db.exec(`CREATE FUNCTION public.fixture_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture write failure'; END $$;
    CREATE TRIGGER fixture_failure BEFORE UPDATE ON public.client_transactions FOR EACH ROW EXECUTE FUNCTION public.fixture_fail();`)
  try { await assert.rejects(settle(),/fixture write failure/); assert.equal((await snapshot()).credit,10); assert.equal((await tx()).status,'pending') }
  finally { await db.exec('DROP TRIGGER fixture_failure ON public.client_transactions; DROP FUNCTION public.fixture_fail()') }
  await settle(); assert.equal((await snapshot()).credit,20)
})
test('SQL: absence of a balance profile fails without settling the transaction', async () => {
  await reset({profile:false}); await assert.rejects(settle(),/profile missing/); assert.equal((await tx()).status,'pending')
})
test('SQL: historical paid transactions are quarantined, never recredited on replay', async () => {
  await reset({status:'paid'}); assert.equal((await settle()).rows[0].result,'legacy_reconciliation_required')
  assert.equal((await snapshot()).credit,10); assert.equal((await tx()).credited_at,null)
})
test('SQL: a paid event after an earlier failed event can fulfill exactly once', async () => {
  await reset({status:'failed'}); await settle(); await settle(); assert.equal((await snapshot()).credit,20)
})
test('SQL: tenant, client, session, amount and missing bindings cannot be substituted', async () => {
  for (const args of [{tenant:B},{client:B},{session:'cs_wrong'},{session:null},{cents:5000},{cents:null}]) {
    await reset(); await assert.rejects(settle(args)); assert.equal((await tx()).status,'pending'); assert.equal((await snapshot()).credit,10)
  }
})
test('SQL: two simultaneous reservation queries cannot spend the same credit twice', async () => {
  await reset({credit:1}); const result=await Promise.all([reserve(),reserve(S2)])
  assert.equal(result.filter(r=>r.rows[0].result.reserved).length,1); assert.equal((await snapshot()).balance,-2)
})
test('SQL: top-up and reservation use the same client lock and amounts remain conserved', async () => {
  await reset({credit:1}); await Promise.all([reserve(),settle()]); assert.equal((await snapshot()).balance,8)
})
test('SQL: reserved/submitted/consumed funds are held until explicit confirmed rejection or durable shipment', async () => {
  await reset({credit:1}); await reserve(); await move('reserved','submitted'); assert.equal((await snapshot()).balance,-2)
  await move('submitted','consumed'); assert.equal((await snapshot()).balance,-2)
  const failed=await move('reserved','released'); assert.equal(failed.rows[0].result,false); assert.equal((await snapshot()).balance,-2)
  await db.query("INSERT INTO public.shipments VALUES ($1,$2,$3,'pendente',3)",[S1,T,A])
  assert.equal((await snapshot()).balance,-2); assert.equal((await snapshot()).reserved,0)
})
test('SQL: confirmed rejection releases funds, invalid transitions and duplicate IDs are refused', async () => {
  await reset({credit:1}); await reserve(); await move('reserved','submitted'); await move('submitted','released')
  assert.equal((await snapshot()).balance,1)
  await assert.rejects(reserve(),/already reserved/); await assert.rejects(move('released','consumed'),/Invalid transition/)
})
test('SQL: shipment totals include fuel once, native/audit records deduplicate, receipts do not restore wallet', async () => {
  await reset()
  await db.query("INSERT INTO public.shipments VALUES ($1,$2,$3,'entregue',4.15)",[S1,T,A])
  await db.query("INSERT INTO public.audit_log(tenant_id,action,details) VALUES ($1,'shipment_data',$2),($1,'billing_statement',$3)",
    [T,JSON.stringify({id:S1,client_id:A,status:'entregue',sell_price:4.15,fuel_tax_amount:0.46}),JSON.stringify({client_id:A,status:'paid',moloni_receipt_id:1})])
  assert.equal((await snapshot()).balance,5.85)
  await db.query("UPDATE public.shipments SET status='anulado' WHERE id=$1",[S1]); assert.equal((await snapshot()).balance,10)
})
test('SQL: recovered audit-only shipments consume credit even if the native insert failed', async () => {
  await reset(); await reserve(); await move('reserved','consumed')
  await db.query("INSERT INTO public.audit_log(tenant_id,action,details) VALUES ($1,'shipment_data',$2)",
    [T,JSON.stringify({id:S1,client_id:A,status:'pendente',sell_price:3})])
  assert.equal((await snapshot()).balance,7); assert.equal((await snapshot()).reserved,0)
})
test('SQL: invalid money and cross-tenant reservations fail closed', async () => {
  await reset()
  for (const amount of [-1,1.005,'NaN','Infinity',null]) await assert.rejects(reserve(S1,amount),/Invalid reservation amount/)
  await assert.rejects(db.query('SELECT public.reserve_shipment_wallet($1,$2,$3,1,$4)',[T,B,S1,'fixture']),/Client not found/)
})
test('SQL: profile edits cannot overwrite a top-up committed after the form read its credit', async () => {
  await reset(); await settle()
  const details=JSON.stringify({id:A,credit_limit:10,billing_type:'pay_as_you_go'})
  await assert.rejects(db.query('SELECT public.save_client_financial_profile($1,$2,$3,$4)',[T,A,details,10]),/Balance changed/)
  assert.equal((await snapshot()).credit,20)
  await db.query('SELECT public.save_client_financial_profile($1,$2,$3,$4)',[T,A,JSON.stringify({id:A,credit_limit:20,billing_type:'pay_as_you_go'}),20])
  assert.equal((await snapshot()).credit,20)
  assert.equal((await db.query("SELECT count(*)::int n FROM public.audit_log WHERE action='client_data'")).rows[0].n,1)
})
test('SQL: anon and authenticated have neither money-changing RPCs nor access to reservations', async () => {
  await reset()
  for (const role of ['anon','authenticated']) {
    await db.exec(`SET ROLE ${role}`)
    try {
      await assert.rejects(settle(),/permission denied/)
      await assert.rejects(reserve(),/permission denied/)
      await assert.rejects(snapshot(),/permission denied/)
      await assert.rejects(db.query('SELECT * FROM public.wallet_reservations'),/permission denied/)
    } finally { await db.exec('RESET ROLE') }
  }
})


test('SQL: explicit account-current shipment snapshots cannot consume the wallet after a model change',async()=>{
 await reset()
 await db.query("INSERT INTO public.shipments VALUES ($1,$2,$3,'entregue',4.15)",[S1,T,A])
 await db.query("INSERT INTO public.audit_log(tenant_id,action,details) VALUES ($1,'shipment_data',$2)",
  [T,JSON.stringify({id:S1,client_id:A,billing_type:'conta_corrente',status:'entregue',sell_price:4.15})])
 assert.equal((await snapshot()).balance,10)
})
test('SQL: a recorded wallet reservation remains authoritative over a conflicting audit billing model',async()=>{
 await reset();await reserve();await move('reserved','consumed')
 await db.query("INSERT INTO public.shipments VALUES ($1,$2,$3,'entregue',3)",[S1,T,A])
 await db.query("INSERT INTO public.audit_log(tenant_id,action,details) VALUES ($1,'shipment_data',$2)",
  [T,JSON.stringify({id:S1,client_id:A,billing_type:'conta_corrente',status:'entregue',sell_price:3})])
 assert.equal((await snapshot()).balance,7)
})
test('SQL: malformed historical prices cannot silently increase available credit',async()=>{
 for(const price of [-1,null,'NaN','Infinity']) {
  await reset();await db.query("INSERT INTO public.shipments VALUES ($1,$2,$3,'entregue',$4)",[S1,T,A,price])
  await assert.rejects(snapshot(),/Invalid shipment charges/)
 }
})
test('SQL: backend execution is granted; every financial RPC is denied to browser roles',async()=>{
 await reset()
 for(const role of ['anon','authenticated']) {
  const functions=await db.query("SELECT p.oid::regprocedure::text signature,has_function_privilege($1,p.oid,'EXECUTE') allowed FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('settle_stripe_topup','client_wallet_snapshot','reserve_shipment_wallet','transition_wallet_reservation','save_client_financial_profile')",[role])
  assert.equal(functions.rows.length,5);assert.ok(functions.rows.every(r=>!r.allowed))
 }
 await db.exec('SET ROLE service_role')
 try {await settle()} finally {await db.exec('RESET ROLE')}
 assert.equal((await snapshot()).credit,20)
})


test('SQL: browser roles cannot read or reset payment fulfillment records directly',async()=>{
 await reset();await settle()
 for(const role of ['anon','authenticated']) {
  await db.exec(`SET ROLE ${role}`)
  try {
   await assert.rejects(db.query('SELECT * FROM public.client_transactions'),/permission denied/)
   await assert.rejects(db.query("UPDATE public.client_transactions SET credited_at=NULL,status='pending'"),/permission denied/)
  } finally {await db.exec('RESET ROLE')}
 }
 assert.ok((await tx()).credited_at);assert.equal((await snapshot()).credit,20)
})
