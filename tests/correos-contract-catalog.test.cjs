const test=require('node:test'),assert=require('node:assert/strict')
const {plan}=require('../scripts/configure-correos-contract.cjs')
const products=require('../lib/services/correos/product-catalog.json')
const {createLoader}=require('./helpers/load-typescript.cjs')
test('only PAQ24, ePAQ24 and Ilhas Express are enabled; product codes are distinct',()=>{
 const records=plan([])
 assert.deepEqual(records.filter(s=>s.is_active).map(s=>s.webservice_service_code).sort(),['26','63','93'])
 assert.equal(new Set(products.map(s=>s.api)).size,products.length)
 assert.equal(records.find(s=>s.webservice_service_code==='26').zones.every(z=>z.tiers.length===8),true)
 assert.equal(records.find(s=>s.webservice_service_code==='90').name.includes('Standard'),true)
})
test('migration preserves tier identities/prices/indexes and existing IDs; no tariff is copied to a new destination',()=>{
 const old={id:'existing-paq24',webservice_service_code:'63',allowed_zones:['PT-CONT'],zones:[{zone_code:'PT-CONT',tiers:[{id:'second',sell_price:7},{id:'first',sell_price:2}]}]}
 const records=plan([old]);const s=records.find(s=>s.webservice_service_code==='63')
 assert.equal(s.id,old.id);assert.deepEqual(s.zones[0],old.zones[0]);assert.deepEqual(s.zones[1].tiers,[])
 assert.deepEqual(plan(records,'fixed').map(s=>s.id),records.map(s=>s.id))
})
test('custom services using unselected products are disabled without changing tariffs',()=>{
 const old={id:'custom-61',webservice_service_code:'61',zones:[{zone_code:'PT-CONT',tiers:[{id:'original',sell_price:19}]}],is_active:true}
 const records=plan([{...old,id:'srv_linke_cor_24'},old]);const s=records.find(s=>s.id===old.id)
 assert.equal(s.is_active,false);assert.deepEqual(s.zones,old.zones)
})
test('new Correos products never receive prices borrowed from CTT or other products',()=>{
 const {buildSubproductContractZones,getCarrierSubproductPreset,detectCarrierGroup}=createLoader({})('lib/pricing/carrier-zone-templates.ts')
 for(const api of ['46','79','91','92','54']){
  const matrix=buildSubproductContractZones('correos',api)
  assert.equal(matrix.zones.every(z=>z.tiers.length===0),true,api)
  assert.equal(detectCarrierGroup({webservice_service_code:api}),'correos')
 }
 assert.equal(getCarrierSubproductPreset('correos','63').shortTitle,'PAQ24')
 assert.equal(getCarrierSubproductPreset('correos','93').shortTitle,'ePAQ24 B2C')
})
