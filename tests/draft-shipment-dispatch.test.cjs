const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const tenant='11111111-1111-1111-1111-111111111111',id='22222222-2222-4222-8222-222222222222'
const officialPdf=Buffer.from('%PDF-1.4\nCarrier fixture').toString('base64')

function harness({snapshot={},packages,role='employee',foreign=false,failure,result}={}){
 const calls=[],credentials=[]
 const tables={shipments:[{id,tenant_id:foreign?'other-company':tenant,client_id:'store-a',status:'rascunho',
  tracking_number:'LTK-FIXTURE',service_type:'Linke Económico'}],
  audit_log:[{tenant_id:tenant,action:'shipment_data',created_at:'2020-01-01',details:{id,tenant_id:tenant,client_id:'store-a',
   weight_kg:1.5,package_count:2,length_cm:30.5,width_cm:20,height_cm:10.2,
   webservice_service_code:'ENCF008.01',webservice_connection_id:'saved-connection',
   sender_name:'Fixture sender',sender_address:'Fixture street',sender_zip4:'4000',sender_zip3:'001',sender_city:'Porto',sender_phone:'+351910000001',
   recipient_name:'Fixture recipient',recipient_address:'Fixture street',recipient_postal:'4800-019',recipient_country:'PT',recipient_city:'Guimarães',recipient_phone:'+351910000002',
   ...snapshot}}],packages:packages||[]}
 const db=fakeSupabase(tables,failure,{persistInserts:true})
 const ctx={role,tenant_id:tenant,client_id:null}
 const api=createLoader({'next/cache':{},'@/lib/auth/context':{requireEmployee:async()=>{if(role==='client')throw Error('STAFF_REQUIRED');return ctx}},
  '@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},
  '@/lib/services/carriers/credentials':{resolveCttCredentials:async connection=>{credentials.push(connection);return{}}},
  '@/lib/services/carriers/ctt-provider':{CttProvider:class{async initialize(){} async createShipment(input){calls.push(input);return result||{success:true,trackingNumber:'EQ-FIXTURE',labelBase64:officialPdf}}}},
  '@/lib/label-utils':{convertZplToPdfBase64:async value=>value},'@/lib/billing/wallet':{},
 })('lib/services/shipments/shipment-creator.ts')
 return{calls,credentials,db,tables,dispatch:()=>api.dispatchShipment(id)}
}

test('draft dispatch uses saved decimal weight, dimensions, volume count and actual service rather than 1 kg / 1 parcel / DD',async()=>{
 const h=harness(),result=await h.dispatch(),sent=h.calls[0]
 assert.equal(result.success,true);assert.equal(result.labelBase64,officialPdf)
 assert.equal(sent.weightKg,1.5);assert.equal(sent.volumes,2)
 assert.deepEqual(sent.dimensionsCm,{length:30.5,width:20,height:10.2})
 assert.equal(sent.subProduct,'ENCF008.01');assert.deepEqual(h.credentials,['saved-connection'])
 assert.equal(sent.recipient.phone,'+351910000002');assert.equal(sent.recipient.zip,'4800-019')
 assert.equal(h.tables.shipments[0].carrier_tracking_number,'EQ-FIXTURE')
 assert.equal(h.tables.shipments[0].status,'pendente')
 const saved=h.db.writes.find(w=>w.table==='audit_log').value.details
 assert.equal(saved.ctt_label_base64,officialPdf);assert.equal(saved.package_count,2)
 assert.ok(h.db.queries.filter(q=>q.write?.kind!=='insert').every(q=>q.filters.some(f=>f.field==='tenant_id'&&f.value===tenant)))
 assert.ok(h.db.writes.filter(w=>w.kind==='insert').every(w=>w.value.tenant_id===tenant))
 await assert.rejects(()=>h.dispatch(),/já foi emitido/)
 assert.equal(h.calls.length,1)
})

test('existing customs drafts stop before loading credentials, writing data or contacting CTT',async()=>{
 for(const [country,postal] of [['IS','101'],['NO','0010'],['GB','SW1A 1AA'],['CH','8001'],['ES','35001']]){
  const h=harness({snapshot:{recipient_country:country,recipient_postal:postal}})
  await assert.rejects(()=>h.dispatch(),/aduaneiros.*temporariamente indisponíveis/)
  assert.equal(h.calls.length,0);assert.equal(h.credentials.length,0);assert.equal(h.db.writes.length,0)
 }
})
test('legacy frozen tariff identity remains usable without inventing a default service',async()=>{
 const h=harness({snapshot:{webservice_service_code:undefined,weight_pricing_basis:{service:{webservice_service_code:'EMSF057.01'}}}})
 await h.dispatch();assert.equal(h.calls[0].subProduct,'EMSF057.01')
})
test('a single stored package supplies missing weight and cm dimensions without a default weight',async()=>{
 const h=harness({snapshot:{weight_kg:null,package_count:null,length_cm:null,width_cm:null,height_cm:null},
  packages:[{tenant_id:tenant,shipment_id:id,weight_g:2750,dimensions:{length_cm:35.5,width_cm:25,height_cm:15,unit:'cm'}}]})
 await h.dispatch();assert.equal(h.calls[0].weightKg,2.75);assert.equal(h.calls[0].volumes,1)
 assert.deepEqual(h.calls[0].dimensionsCm,{length:35.5,width:25,height:15})
})
test('separate package weights can be added but their dimensions are never summed',async()=>{
 const h=harness({snapshot:{weight_kg:null,package_count:null},packages:[
  {tenant_id:tenant,shipment_id:id,weight_g:1500,dimensions:{length_cm:30,width_cm:20,height_cm:10,unit:'cm'}},
  {tenant_id:tenant,shipment_id:id,weight_g:2000,dimensions:{length_cm:40,width_cm:25,height_cm:15,unit:'cm'}},
 ]})
 await h.dispatch();assert.equal(h.calls[0].weightKg,3.5);assert.equal(h.calls[0].volumes,2)
 assert.deepEqual(h.calls[0].dimensionsCm,{length:30.5,width:20,height:10.2})
 const missing=harness({snapshot:{length_cm:null,width_cm:null,height_cm:null},packages:h.tables.packages})
 await assert.rejects(()=>missing.dispatch(),/Complete o peso/);assert.equal(missing.calls.length,0)
})
for(const snapshot of [{weight_kg:null},{length_cm:null},{width_cm:null},{height_cm:null},{package_count:0},
 {webservice_service_code:null},{carrier_code:'correos'},{carrier_tracking_number:'EXISTING'}]){
 test(`incomplete or previously emitted drafts stop before credentials and carrier calls (${JSON.stringify(snapshot)})`,async()=>{
  const h=harness({snapshot});await assert.rejects(()=>h.dispatch())
  assert.equal(h.calls.length,0);assert.equal(h.credentials.length,0);assert.equal(h.db.writes.length,0)
 })
}
test('legacy city data is recovered from the stored address instead of inventing Localidade',async()=>{
 const h=harness({snapshot:{sender_city:null,sender_address:'Fixture street, Porto',recipient_city:null,recipient_address:'Fixture street, Guimarães'}})
 await h.dispatch();assert.equal(h.calls[0].sender.city,'Porto');assert.equal(h.calls[0].recipient.city,'Guimarães')
})
test('missing recipient contacts ask for real data rather than substituting a fictitious mobile',async()=>{
 const h=harness({snapshot:{recipient_phone:null,recipient_email:null}})
 await assert.rejects(()=>h.dispatch(),/e-mail ou telemóvel/)
 assert.equal(h.calls.length,0);assert.equal(h.credentials.length,0)
})
test('another company cannot expose its measurements or create a carrier shipment',async()=>{
 const h=harness({foreign:true});await assert.rejects(()=>h.dispatch(),/não encontrado/)
 assert.equal(h.db.queries.length,1);assert.equal(h.calls.length,0)
})
test('client roles cannot dispatch staff drafts',async()=>{
 const h=harness({role:'client'});await assert.rejects(()=>h.dispatch(),/STAFF_REQUIRED/)
 assert.equal(h.db.adminClients,0);assert.equal(h.db.queries.length,0)
})
test('unavailable parcel data never produces a substitute 1 kg shipment',async()=>{
 const h=harness({failure:q=>q.table==='packages'?{message:'Fixture unavailable'}:null})
 await assert.rejects(()=>h.dispatch(),/dados guardados/);assert.equal(h.calls.length,0)
})
test('a carrier rejection leaves the draft unchanged and stores no substitute label',async()=>{
 const h=harness({result:{success:false,confirmedRejection:true,error:'Fixture carrier rejection'}})
 const result=await h.dispatch();assert.equal(result.success,false)
 assert.equal(h.tables.shipments[0].status,'rascunho');assert.equal(h.db.writes.length,0)
})
test('persistence failure after acceptance keeps the official result and asks for reconciliation without reissuing',async()=>{
 const h=harness({failure:q=>q.write?{message:'Fixture save failure'}:null})
 const result=await h.dispatch();assert.equal(result.success,true)
 assert.equal(result.labelBase64,officialPdf);assert.equal(result.trackingNumber,'EQ-FIXTURE')
 assert.match(result.dbWarning,/Não volte a emitir/);assert.equal(h.calls.length,1)
})
