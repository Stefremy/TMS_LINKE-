const test=require('node:test'),{before,after}=test,assert=require('node:assert/strict'),fs=require('node:fs')
const {PGlite}=require('@electric-sql/pglite')
const T='11111111-1111-1111-1111-111111111111',C='22222222-2222-2222-2222-222222222222',S='33333333-3333-4333-8333-333333333333',SN='44444444-4444-4444-8444-444444444444',M='55555555-5555-4555-8555-555555555555',E='66666666-6666-4666-8666-666666666666'
let db
before(async()=>{
 db=await PGlite.create();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE public.clients(id uuid PRIMARY KEY,tenant_id uuid NOT NULL);
 CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,action text NOT NULL,details jsonb,created_at timestamptz DEFAULT clock_timestamp());
 CREATE TABLE public.shipments(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,client_id uuid,status text,carrier_code text,sell_price numeric,buy_price numeric,billing_statement_id uuid,created_at timestamptz DEFAULT now());
 CREATE TABLE public.billing_emission_claims(tenant_id uuid,shipment_id uuid,emission_id uuid,PRIMARY KEY(tenant_id,shipment_id));`)
 await db.exec(fs.readFileSync('supabase/migrations/20260921100000_client_transactions.sql','utf8'))
 await db.exec(fs.readFileSync('supabase/migrations/20261022180000_atomic_wallet_operations.sql','utf8'))
 const source=fs.readFileSync('supabase/migrations/20261016140000_recurring_moloni_invoices.sql','utf8')
 const start=source.indexOf('create or replace function public.claim_billing_shipments('),end=source.indexOf('end $$;',start)+7
 await db.exec(source.slice(start,end))
 const migration=fs.readFileSync('supabase/migrations/20261023160000_carrier_weight_adjustments.sql','utf8');await db.exec(migration);await db.exec(migration)
})
after(async()=>db?.close())
const plan=()=>({previousWeightKg:1,weightKg:6,previousPrice:5.9,price:11.4,difference:5.5,buyPrice:6,basePrice:9,fuelAmount:0.9,fuelRatePct:10,previousTier:'Até 2 kg',tier:'Até 10 kg'})
async function reset(){
 await db.exec('TRUNCATE public.clients,public.audit_log,public.shipments,public.billing_emission_claims,public.wallet_reservations,public.client_transactions CASCADE')
 await db.query('INSERT INTO public.clients VALUES($1,$2)',[C,T]);await db.query("INSERT INTO public.shipments VALUES($1,$2,$3,'entregue','ctt',5.9,2,NULL)",[S,T,C])
 await db.query("INSERT INTO public.audit_log(tenant_id,action,details)VALUES($1,'client_data',$2)",[T,{id:C,credit_limit:20,billing_type:'pay_as_you_go'}])
 await db.query("INSERT INTO public.audit_log(id,tenant_id,action,details)VALUES($1,$2,'shipment_data',$3),($4,$2,'shipment_carrier_measurements',$5)",[SN,T,{id:S,client_id:C,weight_kg:1,base_price:4,fuel_tax_amount:0.4,special_fees_amount:1.5,weight_pricing_basis:{version:1}},M,{shipment_id:S,carrier:'ctt'}])
}
const apply=(p=plan(),args={})=>db.query('SELECT public.apply_carrier_weight_adjustment($1,$2,$3,$4,$5,$6,$7,$8) result',[args.tenant||T,args.client||C,S,args.snapshot||SN,args.measurement||M,args.expected??5.9,2,p])
const wallet=async()=> (await db.query('SELECT public.client_wallet_snapshot($1,$2) result',[T,C])).rows[0].result
const count=async(action)=>(await db.query('SELECT count(*)::int n FROM public.audit_log WHERE action=$1',[action])).rows[0].n
const native=async()=>(await db.query('SELECT * FROM public.shipments WHERE id=$1',[S])).rows[0]
test('SQL: one correction changes canonical total and wallet by the difference, preserving original declaration and credit',async()=>{
 await reset();const before=await wallet();assert.equal(before.balance,14.1)
 assert.equal((await apply()).rows[0].result.status,'adjusted');const after=await wallet()
 assert.equal(after.balance,8.6);assert.equal(after.credit,20);assert.equal(after.spent,11.4)
 const snapshot=(await db.query("SELECT details FROM public.audit_log WHERE action='shipment_data' ORDER BY created_at DESC LIMIT 1")).rows[0].details
 assert.equal(snapshot.weight_kg,1);assert.equal(snapshot.billing_weight_kg,6);assert.equal(snapshot.sell_price,11.4);assert.equal(snapshot.special_fees_amount,1.5)
 assert.equal(await count('shipment_weight_adjustment'),1)
})
test('SQL: duplicate/concurrent deliveries never debit the same difference twice',async()=>{
 await reset();const results=await Promise.all([apply(),apply(),apply()]);assert.equal(results.filter(r=>r.rows[0].result.status==='adjusted').length,1)
 assert.equal((await wallet()).balance,8.6);assert.equal(await count('shipment_weight_adjustment'),1)
})
test('SQL: any failure recording the adjustment rolls back price, audit snapshot and wallet change',async()=>{
 await reset();await db.exec(`CREATE FUNCTION public.fixture_fail_weight() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='shipment_weight_adjustment' THEN RAISE EXCEPTION 'fixture adjustment failure';END IF;RETURN NEW;END $$;CREATE TRIGGER fail_weight BEFORE INSERT ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.fixture_fail_weight();`)
 try{await assert.rejects(apply(),/fixture adjustment failure/);assert.equal(Number((await native()).sell_price),5.9);assert.equal((await wallet()).balance,14.1);assert.equal(await count('shipment_data'),1)}finally{await db.exec('DROP TRIGGER fail_weight ON public.audit_log;DROP FUNCTION public.fixture_fail_weight()')}
})
test('SQL: cross-tenant or cross-client requests cannot change a shipment',async()=>{
 await reset();for(const args of [{tenant:E},{client:E}])await assert.rejects(apply(plan(),args),/Invalid client scope/)
 assert.equal(Number((await native()).sell_price),5.9)
})
test('SQL: issued documents, pending invoice claims and reserved period statements preserve prices',async()=>{
 for(const action of ['claim','billing_statement','period_statement','native']){
  await reset()
  if(action==='claim')await db.query('INSERT INTO public.billing_emission_claims VALUES($1,$2,$3)',[T,S,E])
  else if(action==='native')await db.query('UPDATE public.shipments SET billing_statement_id=$1',[E])
  else await db.query('INSERT INTO public.audit_log(tenant_id,action,details)VALUES($1,$2,$3)',[T,action,{shipment_ids:[S]}])
  assert.equal((await apply()).rows[0].result.status,'locked');assert.equal((await wallet()).balance,14.1)
 }
})
test('SQL: stale evidence and a modified native price cannot be overwritten',async()=>{
 await reset();for(const args of [{snapshot:E},{measurement:E},{expected:99}])assert.equal((await apply(plan(),args)).rows[0].result.status,'unchanged')
 assert.equal(Number((await native()).sell_price),5.9)
})
test('SQL: malformed amounts, inconsistent totals and decreasing billing weights are rejected',async()=>{
 for(const patch of [{difference:1},{price:11.401},{price:-1},{basePrice:100},{weightKg:0},{previousWeightKg:99},{price:null}]){await reset();await assert.rejects(apply({...plan(),...patch}));assert.equal((await wallet()).balance,14.1)}
})
test('SQL: invoiced accounts do not acquire a prepaid wallet debit',async()=>{
 await reset();await db.query("UPDATE public.audit_log SET details=details||'{\"billing_type\":\"conta_corrente\"}' WHERE action IN ('client_data','shipment_data')")
 await apply();assert.equal((await wallet()).spent,0);assert.equal((await wallet()).credit,20)
})
test('SQL: insufficient balance becomes transparent debt and blocks further wallet reservations',async()=>{
 await reset();await db.query("UPDATE public.audit_log SET details=details||'{\"credit_limit\":6}' WHERE action='client_data'");await apply()
 assert.equal((await wallet()).balance,-5.4)
 const next=(await db.query('SELECT public.reserve_shipment_wallet($1,$2,$3,1,$4) result',[T,C,E,'next'])).rows[0].result
 assert.equal(next.refused,true)
})
test('SQL: an invoice loaded before correction cannot issue with the old total or leave orphan claims',async()=>{
 await reset();await apply();await assert.rejects(db.query('SELECT public.claim_weight_safe_billing_shipments($1,$2,$3,$4)',[T,C,E,[{id:S,price:5.9}]]),/prices changed/)
 assert.equal((await db.query('SELECT count(*)::int n FROM public.billing_emission_claims')).rows[0].n,0)
 await db.query('SELECT public.claim_weight_safe_billing_shipments($1,$2,$3,$4)',[T,C,E,[{id:S,price:11.4}]])
 assert.equal((await db.query('SELECT count(*)::int n FROM public.billing_emission_claims')).rows[0].n,1)
})
test('SQL: browser roles cannot invoke financial adjustment or guarded invoice claims',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec(`SET ROLE ${role}`)
  try{await assert.rejects(apply(),/permission denied/);await assert.rejects(db.query('SELECT public.claim_weight_safe_billing_shipments($1,$2,$3,$4)',[T,C,E,[]]),/permission denied/)}finally{await db.exec('RESET ROLE')}
 }
})
test('integration: a CTT/Correos reading automatically reprices once through the real wallet transaction',async()=>{
 const {createLoader}=require('./helpers/load-typescript.cjs'),{fakeSupabase}=require('./helpers/fake-supabase.cjs')
 const load=createLoader({}),{captureWeightPricingBasis}=load('lib/billing/carrier-weight-pricing.ts')
 const measurements=load('lib/services/tracking/carrier-measurements.ts')
 const service={id:'svc',name:'Teste',fuel_surcharge_pct:10,zones:[{zone_code:'PT-CONT',zone_name:'Continente',tiers:[{id:'a',label:'2 kg',weight_max:2,cost_price:2,sell_price:4,margin_pct:20,enabled:true},{id:'b',label:'10 kg',weight_max:10,cost_price:6,sell_price:9,margin_pct:20,enabled:true}]}]}
 const originalEnabled=process.env.CARRIER_WEIGHT_REPRICING_ENABLED,originalUnit=process.env.CTT_MEASURED_WEIGHT_UNIT
 process.env.CARRIER_WEIGHT_REPRICING_ENABLED='true';process.env.CTT_MEASURED_WEIGHT_UNIT='g'
 try{for(const carrier of ['ctt','correos']){
  await reset();await db.query('UPDATE public.shipments SET carrier_code=$1',[carrier])
  await db.query("UPDATE public.audit_log SET details=details||jsonb_build_object('weight_pricing_basis',$1::jsonb) WHERE action='shipment_data'",[captureWeightPricingBasis({},service,'PT','4800-001')])
  const reading=carrier==='ctt'?measurements.parseCttMeasurements({_PesoReal:'6000',_Valido:1}):measurements.parseCorreosMeasurements({kilos:'6.000'})
  await db.query("UPDATE public.audit_log SET details=$1 WHERE action='shipment_carrier_measurements'",[{shipment_id:S,carrier,measurements:reading,retrieved_at:'2026-10-23T10:00:00Z'}])
  async function sync(){
   const tables={shipments:(await db.query('SELECT * FROM public.shipments')).rows,audit_log:(await db.query('SELECT * FROM public.audit_log')).rows.map(row=>({...row,created_at:row.created_at.toISOString()}))},mock=fakeSupabase(tables)
   mock.client.rpc=async(name,args)=>{assert.equal(name,'apply_carrier_weight_adjustment');const result=await db.query('SELECT public.apply_carrier_weight_adjustment($1,$2,$3,$4,$5,$6,$7,$8) result',[args.p_tenant,args.p_client,args.p_shipment,args.p_snapshot,args.p_measurement,args.p_expected_price,args.p_expected_buy,args.p_plan]);return{data:result.rows[0].result,error:null}}
   return load('lib/billing/reconcile-carrier-weight.ts').reconcileCarrierWeight(mock.client,T,S)
  }
  assert.equal((await sync()).status,'adjusted');assert.equal((await wallet()).balance,8.6)
  const repeat=await sync();assert.equal(repeat.status,'unchanged',JSON.stringify(repeat));assert.equal((await wallet()).balance,8.6);assert.equal(await count('shipment_weight_adjustment'),1)
 }}finally{if(originalEnabled===undefined)delete process.env.CARRIER_WEIGHT_REPRICING_ENABLED;else process.env.CARRIER_WEIGHT_REPRICING_ENABLED=originalEnabled;if(originalUnit===undefined)delete process.env.CTT_MEASURED_WEIGHT_UNIT;else process.env.CTT_MEASURED_WEIGHT_UNIT=originalUnit}
})
