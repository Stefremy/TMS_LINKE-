const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const load=createLoader({})
const {DEFAULT_CORREOS_SPECIAL_SERVICES_FEES:correos,mergeClientSpecialFees,isCorreosConfigurationOnly,CORREOS_INCLUDED_SERVICES}=load('lib/services/correos/complementary-services.ts')
const {DEFAULT_CTT_SPECIAL_SERVICES_FEES:ctt,DEFAULT_CLIENT_PRICING}=load('app/ops/entidades/clientes/types.ts')
const {getClientSpecialFees,calculateShipmentSpecialFees}=load('lib/pricing/calculate-shipment-quote.ts')
test('new clients and reset defaults include both carriers with unique stable codes',()=>{
 const fees=DEFAULT_CLIENT_PRICING.special_services_fees
 assert.equal(new Set(fees.map(f=>f.special_service_code)).size,fees.length)
 assert.equal(fees.length,ctt.length+correos.length)
 assert.ok(fees.some(f=>f.special_service_code==='correos_signed_guide_return'))
 assert.deepEqual(mergeClientSpecialFees(fees,ctt),fees)
})
test('opening old clients retains negotiated prices and explicit disabled states while adding missing extras once',()=>{
 const saved=[{...correos[0],percentage_value:3.2,min_value:2.3,is_enabled:false}, {...correos[1],fixed_value:12.2}]
 const merged=mergeClientSpecialFees(saved,ctt)
 assert.deepEqual(merged.slice(0,2),saved)
 assert.equal(merged.filter(f=>f.special_service_code==='correos_cod').length,1)
 assert.equal(merged.filter(f=>f.special_service_code==='correos_delivery_window').length,1)
 assert.deepEqual(saved[0].percentage_value,3.2)
})
test('contract references distinguish optional supplements from included services',()=>{
 const fee=code=>correos.find(f=>f.special_service_code===code)
 assert.equal(fee('correos_saturday').fixed_value,10)
 assert.equal(fee('correos_delivery_window').fixed_value,.4)
 assert.equal(fee('correos_signed_guide_return').fixed_value,3)
 assert.equal(fee('correos_spain_supplement').fixed_value,1)
 assert.equal(fee('correos_insurance').percentage_value,1.5)
 assert.equal(fee('correos_insurance').min_value,10)
 assert.equal(fee('correos_insurance').is_enabled,false)
 assert.ok(CORREOS_INCLUDED_SERVICES.some(s=>s.includes('previsão de franja horária gratuita')))
 assert.ok(!correos.some(f=>/POD|previsão gratuita/.test(f.special_service_name)))
})
test('configuration-only rates cannot be selected or charged even if a stored flag is enabled',()=>{
 for(const fee of correos.filter(f=>isCorreosConfigurationOnly(f.special_service_code))){
  const client={pricing:{special_services_fees:[{...fee,is_enabled:true}]}}
  assert.deepEqual(getClientSpecialFees(client),[])
  assert.throws(()=>calculateShipmentSpecialFees(10,client,'correos',[fee.special_service_code],0),/inexistente|desativado/)
  assert.equal(mergeClientSpecialFees(client.pricing.special_services_fees,ctt).find(f=>f.special_service_code===fee.special_service_code).is_enabled,false)
 }
})
test('carrier fees remain isolated and configured Saturday prices take precedence',()=>{
 const client={pricing:{special_services_fees:[{...correos.find(f=>f.special_service_code==='correos_saturday'),fixed_value:11}]}}
 assert.equal(calculateShipmentSpecialFees(10,client,'correos',['correos_saturday']).amount,11)
 assert.throws(()=>calculateShipmentSpecialFees(10,client,'ctt',['correos_saturday']),/transportadora/)
})
