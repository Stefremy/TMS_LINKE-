const {test,before,after} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const {PGlite} = require('@electric-sql/pglite')
const {createLoader} = require('./helpers/load-typescript.cjs')
const T='11111111-1111-1111-1111-111111111111', C='22222222-2222-2222-2222-222222222222'
const S='33333333-3333-4333-8333-333333333333', S2='44444444-4444-4444-8444-444444444444'
const X='99999999-9999-4999-8999-999999999999'
const sql=fs.readFileSync('supabase/migrations/20261026170000_current_account_credit_limit.sql','utf8')
let db
before(async()=>{
  db=await PGlite.create()
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
    CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid NOT NULL);
    CREATE TABLE audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,action text,details jsonb,created_at timestamptz DEFAULT now());
    CREATE TABLE shipments(id uuid PRIMARY KEY,tenant_id uuid,client_id uuid,status text,sell_price numeric,billing_statement_id uuid);`)
  await db.exec(sql)
})
after(async()=>db?.close())
async function reset(profile={credit_limit_enabled:true}){
  await db.exec('TRUNCATE credit_limit_reservations,audit_log,shipments,clients CASCADE')
  await db.query('INSERT INTO clients VALUES($1,$2)',[C,T])
  await db.query("INSERT INTO audit_log(tenant_id,action,details)VALUES($1,'client_data',$2)",
    [T,{id:C,billing_type:'conta_corrente',credit_limit:10,credit_limit_enabled:true,...profile}])
}
const reserve=async(amount,id=S,tenant=T)=>(await db.query('SELECT reserve_current_account_credit($1,$2,$3,$4,$5) result',[tenant,C,id,amount,'LTK-test'])).rows[0].result
const transition=async(from,to)=>(await db.query('SELECT transition_credit_limit_reservation($1,$2,$3,$4,$5,NULL) result',[T,C,S,from,to])).rows[0].result
async function audit(action,details,tenant=T){await db.query('INSERT INTO audit_log(tenant_id,action,details)VALUES($1,$2,$3)',[tenant,action,{client_id:C,...details}])}
test('off and legacy profiles are unlimited without destroying the configured value; migration reruns preserve data',async()=>{
  for(const enabled of [false,undefined]){
    await reset({credit_limit_enabled:enabled});await db.exec(sql)
    assert.deepEqual(await reserve(100000),{reserved:false})
    const rows=(await db.query("SELECT details FROM audit_log WHERE action='client_data'")).rows
    assert.equal(rows[0].details.credit_limit,10)
  }
})
test('exact limit is accepted, a second request is refused and a duplicate ID cannot spend twice',async()=>{
  await reset();assert.equal((await reserve(10)).reserved,true)
  assert.equal((await reserve(.01,S2)).refused,true)
  await assert.rejects(reserve(10),/already reserved/)
})
test('unbilled shipments plus unpaid invoices count once, excluding cancelled shipments and paid invoices',async()=>{
  await reset()
  await db.query('INSERT INTO shipments VALUES($1,$2,$3,\'entregue\',3,NULL)',[S,T,C])
  await audit('shipment_data',{id:S,sell_price:3,status:'entregue'})
  await audit('shipment_data',{id:X,sell_price:100,status:'anulado'})
  await audit('billing_statement',{id:'invoice-a',moloni_document_id:1,total_value:5,outstanding_value:2})
  await audit('billing_statement',{id:'invoice-paid',moloni_document_id:2,total_value:100,moloni_receipt_id:42})
  assert.equal((await reserve(5.01,S2)).refused,true)
  assert.equal((await reserve(5,S2)).reserved,true)
})
test('moving a reserved shipment to a persisted invoice does not double count its debt',async()=>{
  await reset();await reserve(6);assert.equal(await transition('reserved','submitted'),true)
  assert.equal(await transition('submitted','consumed'),true)
  await db.query('INSERT INTO shipments VALUES($1,$2,$3,\'entregue\',6,$4)',[S,T,C,X])
  await audit('billing_statement',{id:X,moloni_document_id:1,total_value:6})
  assert.equal((await reserve(4,S2)).reserved,true)
})
test('an invoice binding recovered from the full audit snapshot also prevents double counting native shipment rows',async()=>{
  await reset()
  await db.query('INSERT INTO shipments VALUES($1,$2,$3,\'entregue\',6,NULL)',[S,T,C])
  await audit('shipment_data',{id:S,sell_price:6,status:'entregue',billing_statement_id:X})
  await audit('billing_statement',{id:X,moloni_document_id:1,total_value:6})
  assert.equal((await reserve(4,S2)).reserved,true)
})
test('a shipment marked invoiced without its invoice snapshot cannot disappear from the debt calculation',async()=>{
  await reset()
  await db.query('INSERT INTO shipments VALUES($1,$2,$3,\'entregue\',6,$4)',[S,T,C,X])
  assert.equal((await reserve(4.01,S2)).refused,true)
})
test('release permits a new request; an unresolved submitted request retains credit',async()=>{
  await reset();await reserve(10);await transition('reserved','submitted')
  assert.equal((await reserve(1,S2)).refused,true)
  await transition('submitted','released');assert.equal((await reserve(10,S2)).reserved,true)
})
test('zero credit is enforceable; malformed amounts, invalid debt and foreign tenants fail closed',async()=>{
  await reset({credit_limit:0});assert.equal((await reserve(.01)).refused,true)
  await assert.rejects(reserve(1,S,X),/tenant/)
  for(const amount of [-1,'NaN','Infinity',1.001])await assert.rejects(reserve(amount),/Invalid/)
  await reset();await audit('shipment_data',{id:X,status:'pendente',sell_price:'NaN'})
  await assert.rejects(reserve(1),/Invalid account/)
})
test('no anonymous/client access to reservations or RPCs; prepaid clients cannot bypass their wallet',async()=>{
  for(const role of ['anon','authenticated','service_role']){
    const access=(await db.query("SELECT has_function_privilege($1,'public.reserve_current_account_credit(uuid,uuid,uuid,numeric,text)','EXECUTE') rpc,has_table_privilege($1,'public.credit_limit_reservations','SELECT') tbl",[role])).rows[0]
    assert.deepEqual(access,{rpc:role==='service_role',tbl:role==='service_role'})
  }
  await reset({billing_type:'pay_as_you_go'});await assert.rejects(reserve(1),/Billing model/)
})
test('server uses credit reservations only when opted in; missing migration blocks before carrier submission',async()=>{
  let profile={billing_type:'conta_corrente',credit_limit:10,credit_limit_enabled:false},calls=[]
  const db={from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,maybeSingle:async()=>({data:{details:profile},error:null})};return q},
    rpc:async(name,p)=>{calls.push(name);return {data:null,error:{code:'PGRST202'}}}}
  const {reserveWallet}=createLoader({})('lib/billing/wallet.ts')
  assert.equal((await reserveWallet(db,T,C,S,50,'test')).reserved,false);assert.deepEqual(calls,[])
  profile.credit_limit_enabled=true
  await assert.rejects(reserveWallet(db,T,C,S,1,'test'),/20261026170000_current_account_credit_limit/)
  assert.deepEqual(calls,['reserve_current_account_credit'])
  profile={billing_type:'pay_as_you_go',credit_limit:10,credit_limit_enabled:false}
  db.rpc=async name=>{calls.push(name);return {data:{reserved:true,balance:10},error:null}}
  assert.equal((await reserveWallet(db,T,C,S,1,'test')).reserved,true)
  assert.equal(calls.at(-1),'reserve_shipment_wallet')
})
