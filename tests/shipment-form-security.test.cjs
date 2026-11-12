const {test}=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const schema=createLoader({zod:require('zod')})('components/shipments/form/schema.ts')
const {shipmentOverrideError}=createLoader({})('lib/services/shipments/shipment-form-authorization.ts')
const valid=()=>({...schema.shipmentDefaults({short_name:'Loja',address:'Rua 1',city:'Porto',postal_code:'4000-001',phone:'912345678'}),recipientName:'Destino',recipientAddress:'Rua 2',recipientCity:'Lisboa',recipientPostal:'1000-001',recipientPhone:'923456789',serviceId:'service',lengthCm:30,widthCm:20,heightCm:10})
function harness(role='client',options={}) {
 const calls=[], db=fakeSupabase({audit_log:[]})
 const ctx={role,tenant_id:'tenant',client_id:role==='client'?'own-client':null,user:{id:'trusted-operator'}}
 const load=createLoader({zod:require('zod'),
  '@/lib/auth/context':{requireUser:async()=>ctx},'@/lib/supabase/server':{createAdminClient:()=>db.client},
  './shipments':{emitClientGuiaAction:async input=>{calls.push(input);return options.result || {success:true,id:'shipment',guia:'EQ-FIXTURE',sellPrice:5.5,labelBase64:null}}},
  '@/lib/pricing/shipment-pricing-context':{loadShipmentPricingContext:async(db,ctx,clientId)=>{if(options.foreign)throw Error('Foreign');return{client:{id:clientId},service:{id:'service',name:'Configured service',carrier_group:options.carrier || 'ctt',webservice_service_code:'EMSF056.01'}}}},
 })
 return {api:load('app/actions/shipment-form.ts'),calls,db}
}
test('client session rejects every protected field even when the browser claims an ops role',async()=>{
 for(const field of ['manualPrice','manual_price','carrierOverride','carrier_override','internalNotes','internal_notes','specialFeeOverrides','emitMoloniGt']) {
  assert.equal(shipmentOverrideError('client',{[field]:''}).field,field)
  const h=harness(),result=await h.api.submitShipmentFormAction({...valid(),role:'ops',[field]:field==='manualPrice'?0.01:'forged'},'foreign-client')
  assert.equal(result.success,false,field);assert.equal(h.calls.length,0);assert.deepEqual(h.db.writes,[])
 }
})
test('server schema returns named errors before any carrier emission',async()=>{
 const h=harness(),result=await h.api.submitShipmentFormAction({...valid(),weightKg:0,recipientName:'',recipientPostal:'1000'})
 assert.equal(result.success,false)
 for(const field of ['weightKg','recipientName','recipientPostal']) assert.ok(result.fieldErrors.some(error=>error.field===field&&error.message),field)
 assert.equal(h.calls.length,0)
})
test('client ownership comes from the session and all original prices are calculated by the existing action',async()=>{
 const h=harness(),result=await h.api.submitShipmentFormAction(valid(),'forged-other-client')
 assert.equal(result.success,true);assert.equal(h.calls[0].clientId,'own-client');assert.equal(h.calls[0].calculatedPrice,0)
 assert.equal(h.calls[0].serviceName,'Configured service');assert.equal(h.calls[0].clientName,'Loja');assert.equal(h.calls[0].manualPrice,undefined)
})
test('mainland submission accepts omitted dimensions and clears hidden measurements before emission; islands require them',async()=>{
 for(const dimensions of [{lengthCm:0,widthCm:0,heightCm:0},{lengthCm:200,widthCm:100,heightCm:100}]) {
  const h=harness(),result=await h.api.submitShipmentFormAction({...valid(),...dimensions})
  assert.equal(result.success,true)
  for(const field of ['lengthCm','widthCm','heightCm']) assert.equal(h.calls[0][field],0)
 }
 for(const postal of ['9000-001','9500-001']) {
  const h=harness(),result=await h.api.submitShipmentFormAction({...valid(),recipientPostal:postal,lengthCm:0,widthCm:0,heightCm:0})
  assert.equal(result.success,false);assert.equal(h.calls.length,0)
 }
})
test('ops uses verified services and stores internal notes separately from client shipment metadata',async()=>{
 const h=harness('employee'),result=await h.api.submitShipmentFormAction({...valid(),carrierOverride:'ctt',internalNotes:'Nota só para operações'},'owned-client')
 assert.equal(result.success,true);assert.equal(h.calls[0].internalNotes,undefined)
 assert.equal(h.db.writes[0].value.action,'shipment_ops_notes');assert.equal(h.db.writes[0].value.tenant_id,'tenant');assert.equal(h.db.writes[0].value.details.user_id,'trusted-operator')
 const mismatch=harness('employee');assert.equal((await mismatch.api.submitShipmentFormAction({...valid(),carrierOverride:'correos'},'owned-client')).success,false);assert.equal(mismatch.calls.length,0)
 const foreign=harness('employee',{foreign:true});assert.equal((await foreign.api.submitShipmentFormAction(valid(),'foreign')).success,false);assert.equal(foreign.calls.length,0)
})
test('manual prices stay unavailable to ops and structured carrier failures never report success',async()=>{
 const h=harness('admin');assert.equal((await h.api.submitShipmentFormAction({...valid(),manualPrice:0.01},'owned')).success,false);assert.equal(h.calls.length,0)
 const refused=harness('client',{result:{success:false,error:'A transportadora recusou o envio.'}})
 const result=await refused.api.submitShipmentFormAction(valid());assert.equal(result.success,false);assert.deepEqual(result.fieldErrors,[{field:'root',message:'A transportadora recusou o envio.'}])
})
test('international content errors are associated with export fields; Correos requires a real phone',async()=>{
 const h=harness(),result=await h.api.submitShipmentFormAction({...valid(),recipientCountry:'ES',recipientPostal:'28013',recipientEmail:'destino@example.pt'})
 assert.equal(result.success,false);assert.equal(result.fieldErrors[0].field,'exportFields');assert.equal(h.calls.length,0)
 const correos=harness('client',{carrier:'correos'}),phone=await correos.api.submitShipmentFormAction({...valid(),recipientPhone:'',recipientEmail:'destino@example.pt'})
 assert.equal(phone.success,false);assert.equal(phone.fieldErrors[0].field,'recipientPhone')
})
