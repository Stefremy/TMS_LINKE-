const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')

const T = '11111111-1111-1111-1111-111111111111', C = '44444444-4444-4444-4444-444444444444'
const OTHER = '99999999-9999-4999-8999-999999999999'
const migration = fs.readFileSync('supabase/migrations/20261026150000_client_profile_save.sql', 'utf8')
let db
before(async () => {
  db = await PGlite.create()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.clients(id uuid PRIMARY KEY, tenant_id uuid NOT NULL);
    CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
      action text NOT NULL, details jsonb, created_at timestamptz DEFAULT now());`)
})
after(async () => db?.close())
async function reset() {
  await db.exec('TRUNCATE public.audit_log, public.clients')
  await db.query('INSERT INTO public.clients VALUES ($1,$2)', [C,T])
  await db.query("INSERT INTO public.audit_log(tenant_id,action,details) VALUES ($1,'client_data',$2)",
    [T,JSON.stringify({ id:C, short_name:'GO Linke fixture', credit_limit:15000, assigned_linke_service_ids:['national'] })])
}
const profile = async () => (await db.query("SELECT details FROM public.audit_log WHERE tenant_id=$1 AND action='client_data'",[T])).rows[0].details
const save = (details, expected=15000, tenant=T) => db.query('SELECT public.save_client_financial_profile($1,$2,$3,$4)', [tenant,C,JSON.stringify(details),expected])

test('standalone migration publishes the RPC without wallet tables and reruns without changing existing clients or money', async () => {
  await reset()
  const before = await db.query('SELECT * FROM public.audit_log')
  await db.exec(migration); await db.exec(migration)
  assert.deepEqual((await db.query('SELECT * FROM public.audit_log')).rows, before.rows)
  assert.equal((await db.query("SELECT to_regclass('public.wallet_reservations') present")).rows[0].present, null)
})
test('the real PostgreSQL function saves two price tables and a default, preserving all other submitted fields', async () => {
  await reset()
  const details = { ...await profile(), assigned_linke_service_ids:['national','spain'], default_linke_table_id:'national' }
  await save(details)
  assert.deepEqual(await profile(), details)
  assert.equal((await db.query("SELECT count(*)::int n FROM public.audit_log WHERE action='client_data'")).rows[0].n, 1)
})
test('a real balance change rejects stale profile data instead of replacing the newer credit', async () => {
  await reset()
  const stale = await profile()
  await db.query("UPDATE public.audit_log SET details=jsonb_set(details,'{credit_limit}','15001')")
  await assert.rejects(save({ ...stale, assigned_linke_service_ids:['national','spain'] }), /Balance changed/)
  assert.equal((await profile()).credit_limit,15001)
  assert.deepEqual((await profile()).assigned_linke_service_ids,['national'])
})
test('foreign tenants, wrong clients and invalid credits cannot save a profile', async () => {
  await reset(); const before = await profile()
  for (const [details, tenant, message] of [[before,OTHER,/binding/], [{...before,id:OTHER},T,/binding/],
    [{...before,credit_limit:null},T,/Invalid credit/], [{...before,credit_limit:'NaN'},T,/Invalid credit/]]) {
    await assert.rejects(save(details,15000,tenant),message)
    assert.deepEqual(await profile(),before)
  }
})
test('only the server role can execute the client-save function', async () => {
  for (const role of ['anon','authenticated','service_role']) {
    const result=await db.query("SELECT has_function_privilege($1,'public.save_client_financial_profile(uuid,uuid,jsonb,numeric)','EXECUTE') allowed",[role])
    assert.equal(result.rows[0].allowed,role==='service_role')
  }
})
