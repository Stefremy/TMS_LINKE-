const {test,before,after}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {PGlite}=require('@electric-sql/pglite')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {canInvoiceShipment}=createLoader({})('lib/billing/shipment-eligibility.ts')
const {shipmentChargeBreakdown}=createLoader({})('lib/billing/shipment-invoice-lines.ts')
const T='11111111-1111-4111-8111-111111111111',C='22222222-2222-4222-8222-222222222222'
const Q='33333333-3333-4333-8333-333333333333',U='44444444-4444-4444-8444-444444444444',X='55555555-5555-4555-8555-555555555555'
const migration=fs.readFileSync('supabase/migrations/20261105190000_quotation_shipments.sql','utf8')
let db
before(async()=>{
 db=await PGlite.create()
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE clients(id uuid PRIMARY KEY,tenant_id uuid NOT NULL);
 CREATE TABLE audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,action text NOT NULL,details jsonb,created_at timestamptz DEFAULT now());
 CREATE TYPE shipment_status AS ENUM('rascunho','pendente','entregue','anulado');
 CREATE TABLE shipments(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,client_id uuid NOT NULL REFERENCES clients(id),tracking_number text,
  carrier_tracking_number text,carrier_code text,service_type text,status shipment_status,ops_substatus text,
  sender_name text NOT NULL,sender_address text NOT NULL,sender_zip4 text,sender_zip3 text,sender_phone text,
  recipient_name text NOT NULL,recipient_address text NOT NULL,recipient_zip4 text,recipient_zip3 text,recipient_phone text,recipient_email text,
  buy_price numeric,sell_price numeric,billing_statement_id uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 CREATE TABLE packages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,shipment_id uuid REFERENCES shipments(id),weight_g integer NOT NULL,dimensions jsonb);`)
 for(const file of ['20260921100000_client_transactions.sql','20261022180000_atomic_wallet_operations.sql','20261026170000_current_account_credit_limit.sql'])await db.exec(fs.readFileSync(`supabase/migrations/${file}`,'utf8'))
 await db.exec(migration)
 await db.exec(fs.readFileSync('supabase/migrations/20261106140000_quotation_partner_tracking.sql','utf8'))
})
after(async()=>db?.close())
const initial=()=>({id:Q,reference:'COT-FIXTURE',revision:0,client_id:C,client_name:'Loja fixture',service_id:'cor-intl',service_name:'Correos Aéreo',
 status:'quoted',proposed_price:25.5,response:'Prazo acordado.',requested_by:U,updated_by:U,created_at:'2026-10-01T12:00:00Z',
 shipment:{senderName:'Loja fixture',senderAddress:'Rua A',senderCity:'Porto',senderPostal:'4000-001',senderPhone:'910000001',
 recipientName:'Destino',recipientAddress:'Rue B',recipientCity:'Paris',recipientCountry:'FR',recipientPostal:'75001',recipientPhone:'910000002',recipientEmail:'fixture@example.invalid',
 weightKg:3,volumesCount:1,lengthCm:20,widthCm:15,heightCm:10,parcelWeightsKg:[],observations:'Dados do pedido.'}})
async function reset(profile={}){
 await db.exec('TRUNCATE packages,shipments,audit_log,clients,credit_limit_reservations,wallet_reservations,client_transactions CASCADE')
 await db.query('INSERT INTO clients VALUES($1,$2),($3,$2)',[C,T,X])
 await db.query("INSERT INTO audit_log(tenant_id,action,details)VALUES($1,'client_data',$2)",[T,{id:C,is_active:true,billing_type:'conta_corrente',credit_limit:30,...profile}])
 await db.query("INSERT INTO audit_log(id,tenant_id,action,details)VALUES($1,$2,'shipment_quote_request',$3)",[Q,T,initial()])
}
const run=async(action,{revision=action==='accept'?0:1,client=action==='accept'?C:null,tenant=T,tracking='PARTNER-123',carrier='correos',cost=12.5,response='Emitido pela Linke.'}={})=>
 (await db.query('SELECT materialize_shipment_quotation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) result',[tenant,Q,revision,U,client,action,tracking,cost,response,carrier])).rows[0].result
const rows=async table=>(await db.query(`SELECT * FROM ${table}`)).rows
const quote=async()=>(await db.query('SELECT details FROM audit_log WHERE id=$1',[Q])).rows[0].details
const balance=async()=>(await db.query('SELECT client_wallet_snapshot($1,$2) result',[T,C])).rows[0].result

test('quotation migration reruns without changing any client, price or existing request',async()=>{
 await reset();const before=await rows('audit_log');await db.exec(migration);assert.deepEqual(await rows('audit_log'),before)
})
test('client acceptance creates one non-billable zero-charge draft, with full address and parcel metadata',async()=>{
 await reset();const accepted=await run('accept');const [shipment]=await rows('shipments')
 assert.equal(accepted.shipment_id,Q);assert.equal(accepted.status,'accepted');assert.equal(shipment.sell_price,'0')
 assert.equal(shipment.status,'rascunho');assert.equal(canInvoiceShipment(shipment),false);assert.equal(shipment.carrier_tracking_number,null)
 const snapshot=(await rows('audit_log')).find(r=>r.action==='shipment_data').details
 assert.equal(snapshot.quotation_id,Q);assert.equal(snapshot.agreed_price,25.5);assert.equal(snapshot.sell_price,0)
 assert.equal(snapshot.package_count,1);assert.equal(snapshot.recipient_country,'FR');assert.deepEqual(snapshot.parcel_weights_kg,[])
 assert.equal((await rows('packages')).length,1);assert.deepEqual((await rows('packages')).map(p=>p.weight_g),[3000])
 assert.equal((await rows('wallet_reservations')).length,0)
 await assert.rejects(run('accept'),/atualizada/);assert.equal((await rows('shipments')).length,1)
})
test('Linke booking makes the same shipment billable at the approved net price, without adding fuel twice',async()=>{
 await reset();await run('accept')
 await db.query("UPDATE shipments SET created_at='2026-01-01T12:00:00Z'")
 const completed=await run('complete');const [shipment]=await rows('shipments')
 assert.equal(completed.status,'completed');assert.equal(completed.shipment_id,Q);assert.equal(shipment.carrier_tracking_number,'PARTNER-123')
 assert.equal(completed.response,'Prazo acordado.')
 assert.equal(completed.completion_notes,'Emitido pela Linke.')
 assert.equal(shipment.sell_price,'25.5');assert.equal(shipment.buy_price,'12.5');assert.equal(canInvoiceShipment(shipment),true)
 assert.ok(new Date(shipment.created_at)>new Date('2026-01-01T12:00:00Z'),'invoice date follows emission, preserving old request dates in metadata')
 const snapshot=(await rows('audit_log')).find(r=>r.action==='shipment_data').details
 assert.equal(snapshot.billing_type,'conta_corrente');assert.equal(snapshot.booking_source,'linke_partner_account');assert.equal(snapshot.base_price,25.5)
 assert.equal(shipmentChargeBreakdown(snapshot).total,2550);assert.equal(snapshot.fuel_tax_amount,0);assert.equal(snapshot.special_fees_amount,0)
 assert.equal((await rows('packages')).length,1)
 await assert.rejects(run('complete'),/atualizada/);assert.equal((await rows('shipments')).length,1)
})
test('bindings, state and partner cost fail closed; a customer cannot record a carrier booking',async()=>{
 await reset();for(const args of [{tenant:X},{client:X}])await assert.rejects(run('accept',args),/sem acesso/)
 await assert.rejects(run('accept',{client:null}),/estado atual/);assert.equal((await rows('shipments')).length,0)
 await run('accept');await assert.rejects(run('complete',{client:C}),/estado atual/)
 for(const cost of [null,-1,1.001,'NaN','Infinity'])await assert.rejects(run('complete',{cost}),/custo/)
 assert.equal((await rows('shipments'))[0].status,'rascunho');assert.equal((await quote()).status,'accepted')
})
test('a late snapshot failure rolls back quote, shipment and consumed wallet reservation together',async()=>{
 await reset({billing_type:'pay_as_you_go'});await run('accept')
 await db.exec(`CREATE FUNCTION fixture_quote_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.action='shipment_quote_request' AND NEW.details->>'status'='completed' THEN RAISE EXCEPTION 'fixture final write failure';END IF;RETURN NEW;END $$;
 CREATE TRIGGER fixture_quote_fail BEFORE UPDATE ON audit_log FOR EACH ROW EXECUTE FUNCTION fixture_quote_failure();`)
 try{await assert.rejects(run('complete'),/fixture final write failure/)}finally{await db.exec('DROP TRIGGER fixture_quote_fail ON audit_log;DROP FUNCTION fixture_quote_failure()')}
 assert.equal((await rows('shipments'))[0].sell_price,'0');assert.equal((await rows('shipments'))[0].status,'rascunho')
 assert.equal((await quote()).status,'accepted');assert.equal((await rows('wallet_reservations')).length,0)
 assert.equal((await rows('audit_log')).find(r=>r.action==='shipment_data').details.sell_price,0)
 await run('complete');assert.equal((await balance()).balance,4.5)
})
test('prepaid and opted-in credit limits reuse their existing rules and charge only once on completion',async()=>{
 for(const billing_type of ['pay_as_you_go','conta_corrente']){
  await reset({billing_type,credit_limit:10,credit_limit_enabled:true});await run('accept')
  await assert.rejects(run('complete'),/insuficiente/);assert.equal((await rows('shipments'))[0].status,'rascunho')
  await db.query("UPDATE audit_log SET details=jsonb_set(details,'{credit_limit}','30') WHERE action='client_data'")
  await run('complete');const holds=await rows(billing_type==='pay_as_you_go'?'wallet_reservations':'credit_limit_reservations')
  assert.equal(holds.length,1);assert.equal(holds[0].state,'consumed');assert.equal(Number(holds[0].amount),25.5)
  if(billing_type==='pay_as_you_go')assert.equal((await balance()).balance,4.5)
 }
})
test('two completions cannot create two shipments or replace the first carrier booking',async()=>{
 await reset();await run('accept')
 const result=await Promise.allSettled([run('complete'),run('complete',{tracking:'OTHER-456',cost:11})])
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1)
 assert.equal((await rows('shipments')).length,1);assert.equal((await rows('shipments'))[0].carrier_tracking_number,'PARTNER-123')
})
test('legacy accepted quotes materialize safely; billed or foreign shipments cannot be reused',async()=>{
 await reset();await db.query("UPDATE audit_log SET details=details||'{\"status\":\"accepted\",\"revision\":1}' WHERE id=$1",[Q])
 await run('complete');assert.equal((await rows('shipments')).length,1)
 await reset();await run('accept');await db.query('UPDATE shipments SET billing_statement_id=$1',[X])
 await assert.rejects(run('complete'),/faturado/)
})
test('browser roles have no access to the quotation materialization RPC',async()=>{
 for(const role of ['anon','authenticated','service_role']){
  const result=await db.query("SELECT has_function_privilege($1,'public.materialize_shipment_quotation(uuid,uuid,integer,uuid,uuid,text,text,numeric,text)','EXECUTE') allowed",[role])
  assert.equal(result.rows[0].allowed,role==='service_role')
  const extended=await db.query("SELECT has_function_privilege($1,'public.materialize_shipment_quotation(uuid,uuid,integer,uuid,uuid,text,text,numeric,text,text)','EXECUTE') allowed",[role])
  assert.equal(extended.rows[0].allowed,role==='service_role')
 }
})

test('manual FedEx booking retains Correos commercial pricing and atomically records the tracking carrier',async()=>{
 await reset();await run('accept')
 await assert.rejects(run('complete',{carrier:'fedex',tracking:'NOT-FEDEX'}),/guia/)
 await assert.rejects(run('complete',{carrier:'unknown'}),/guia/)
 const completed=await run('complete',{carrier:'fedex',tracking:'123456789012'})
 const [shipment]=await rows('shipments')
 assert.equal(completed.tracking_carrier,'fedex');assert.equal(completed.tracking_number,'123456789012')
 assert.equal(shipment.carrier_code,'correos');assert.equal(shipment.ops_substatus,'tracking_fedex_externo')
 assert.equal(shipment.sell_price,'25.5');assert.equal(canInvoiceShipment(shipment),true)
 const snapshot=(await rows('audit_log')).find(row=>row.action==='shipment_data').details
 assert.equal(snapshot.tracking_carrier,'fedex');assert.equal(snapshot.carrier_tracking_number,'123456789012')
 assert.equal(snapshot.ops_substatus,'tracking_fedex_externo')
})
