const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const load=createLoader({})
const {isCttSpecialServiceAvailable:available}=load('lib/services/ctt/special-service-availability.ts')
const {calculateShipmentSpecialFees}=load('lib/pricing/calculate-shipment-quote.ts')
for(const code of ['auth_return','back','AuthorizeReturn'])test(`${code}: return authorization is restricted to complete mainland Portugal postcodes`,()=>{
 for(const postal of ['1000-001','4000-001','4815-410','8000001'])assert.equal(available(code,'PT',postal),true)
 for(const postal of ['','4','4000','9000-001','9400-001','9500-001','9900-001'])assert.equal(available(code,'PT',postal),false)
 for(const country of ['ES','BE','FR','FI'])assert.equal(available(code,country,'1000'),false)
 assert.equal(available('fragil','BE','1000'),true)
})
test('unsupported destinations cannot quote or charge return authorization, even with client configuration enabled',()=>{
 const client={pricing:{special_services_fees:['auth_return','back'].map(special_service_code=>({special_service_code,special_service_name:special_service_code,is_enabled:true,api_type_code:20,fee_type:'fixed',fixed_value:3.85}))}}
 for(const code of ['auth_return','back']){
  assert.equal(calculateShipmentSpecialFees(9,client,'ctt',[code],0,{country:'PT',postal:'4000-001'}).totalPrice,12.85)
  for(const destination of [undefined,{country:'PT',postal:'9000-001'},{country:'ES',postal:'28001'},{country:'BE',postal:'1000'}]){
   assert.throws(()=>calculateShipmentSpecialFees(9,client,'ctt',[code],0,destination),/apenas para Portugal Continental/)
  }
 }
})
