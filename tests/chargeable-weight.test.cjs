const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const load=createLoader({})
const {calculateChargeableWeight,getServiceVolumetricRule}=load('lib/pricing/chargeable-weight.ts')
const {calculateShipmentQuote}=load('lib/pricing/calculate-shipment-quote.ts')
const {calculateClientShipmentPreview}=load('lib/pricing/calculate-client-shipment-preview.ts')
const {captureWeightPricingBasis,planWeightAdjustment}=load('lib/billing/carrier-weight-pricing.ts')
const {calculateConfiguredZonePrice}=load('lib/pricing/calculate-shipment-price.ts')
const dimensions={lengthCm:50,widthCm:40,heightCm:40,volumesCount:1}
const tiers=[1,5,10,15,20,30,40].map(kg=>({id:`tier-${kg}`,label:`Até ${kg} kg`,weight_max:kg,sell_price:kg,cost_price:kg/2,margin_pct:100,enabled:true}))
function service(code,zone){return{id:'fixture',name:'CTT fixture',preferred_carrier_name:'CTT Expresso',webservice_service_code:code,is_active:true,fuel_surcharge_pct:10,allowed_zones:[zone],zones:[{zone_code:zone,zone_name:zone,tiers}]}}
const client={default_linke_table_id:'fixture',pricing:{}}

for(const [code,country,postal,zone,divisor,expectedTier] of [
 ['EMSF056.01','PT','9000-001','PT-ILHAS',6000,'Até 15 kg'],
 ['EMSF056.01','PT','9500-001','PT-ILHAS',6000,'Até 15 kg'],
 ['EMSF057.01','PT','9000-001','PT-ILHAS',3000,'Até 30 kg'],
 ['EMSF057.01','PT','9500-001','PT-ILHAS',3000,'Até 30 kg'],
 ['EMSF057.01','PT','4000-001','PT-CONT',6000,'Até 15 kg'],
 ['EMSF001.02','FR','75001','EU 1',5000,'Até 20 kg'],
 ['ENCF008.02','FR','75001','Zona 2',5000,'Até 20 kg'],
])test(`${code}/${postal}: contract divisor ${divisor} selects the correct bracket in both previews`,()=>{
 const s=service(code,zone)
 const rating=calculateChargeableWeight(10,s,country,postal,dimensions)
 assert.equal(rating.declaredWeightKg,10)
 assert.equal(rating.volumetricDivisor,divisor)
 assert.equal(rating.billableWeightKg,80000/divisor)
 const quote=calculateShipmentQuote(10,client,s,country,postal,[],0,dimensions)
 assert.equal(quote.tierLabel,expectedTier)
 assert.equal(quote.billableWeightKg,rating.billableWeightKg)
 const redacted={...s,preferred_carrier_name:undefined,webservice_service_code:undefined,carrier_group:'ctt',volumetric_rule:getServiceVolumetricRule(s),zones:s.zones.map(z=>({...z,tiers:z.tiers.map(t=>({...t,cost_price:undefined,margin_pct:undefined}))}))}
 const preview=calculateClientShipmentPreview(10,client,redacted,country,postal,[],0,dimensions)
 assert.equal(preview.totalPrice,quote.totalPrice)
 assert.equal(preview.volumetricDivisor,divisor)
 assert.equal(preview.billableWeightKg,rating.billableWeightKg)
})

test('the higher real weight wins and dimensions apply once per parcel',()=>{
 const s=service('EMSF056.01','PT-ILHAS')
 const real=calculateChargeableWeight(30,s,'PT','9000-001',dimensions)
 assert.equal(real.billableWeightKg,30)
 const multi=calculateChargeableWeight(10,s,'PT','9000-001',{...dimensions,volumesCount:2})
 assert.equal(multi.volumetricWeightKg,160000/6000)
 assert.equal(calculateShipmentQuote(10,client,s,'PT','9000-001',[],0,{...dimensions,volumesCount:2}).tierLabel,'Até 30 kg')
})

test('exact division avoids the 167 coefficient boundary error and does not round below a tier',()=>{
 const s=service('EMSF056.01','PT-ILHAS')
 const exact={lengthCm:60,widthCm:50,heightCm:30}
 assert.equal(calculateShipmentQuote(10,client,s,'PT','9000-001',[],0,exact).tierLabel,'Até 15 kg')
 assert.equal(calculateShipmentQuote(10,client,s,'PT','9000-001',[],0,{...exact,lengthCm:60.0004}).tierLabel,'Até 20 kg')
})

test('configured overrides remain attached to the selected higher bracket',()=>{
 const s=service('EMSF057.01','PT-ILHAS')
 const customized={...client,custom_tier_overrides:{fixture:[1,5,10,15,20,25,40]}}
 const quote=calculateShipmentQuote(10,customized,s,'PT','9000-001',[],0,dimensions)
 assert.equal(quote.tierLabel,'Até 30 kg');assert.equal(quote.basePrice,25);assert.equal(quote.totalPrice,27.5)
})

test('unknown products do not inherit guessed divisors; invalid parcel data or configured factors fail',()=>{
 const unknown=service('ENCF008.01','PT-ILHAS')
 assert.equal(calculateChargeableWeight(10,unknown,'PT','9000-001',dimensions).billableWeightKg,10)
 assert.equal(getServiceVolumetricRule({...unknown,preferred_carrier_name:'Correos Express',webservice_service_code:'EMSF056.01'}),undefined)
 for(const parcel of [{...dimensions,lengthCm:0},{...dimensions,heightCm:NaN},{...dimensions,volumesCount:0},{...dimensions,volumesCount:1.5}])assert.throws(()=>calculateChargeableWeight(10,unknown,'PT','9000-001',parcel))
 for(const divisor of [0,-3000,Infinity,NaN])assert.throws(()=>calculateChargeableWeight(10,{...unknown,volumetric_rule:{divisor}},'PT','9000-001',dimensions))
})

test('carrier reconciliation retains the frozen volumetric floor and never rewrites historical rules',()=>{
 const s=service('EMSF057.01','PT-ILHAS')
 const rating=calculateChargeableWeight(10,s,'PT','9000-001',dimensions)
 const quote=calculateShipmentQuote(10,client,s,'PT','9000-001',[],0,dimensions)
 const basis=captureWeightPricingBasis(client,s,'PT','9000-001',rating)
 const input={basis,previousWeightKg:rating.billableWeightKg,sellPrice:quote.totalPrice,buyPrice:quote.buyPrice,basePrice:quote.basePrice,fuelAmount:quote.fuelSurchargeAmount,specialAmount:0}
 assert.equal(planWeightAdjustment({...input,weightKg:20}),null)
 const higher=planWeightAdjustment({...input,weightKg:31})
 assert.equal(higher.tier,'Até 40 kg');assert.equal(higher.previousWeightKg,rating.billableWeightKg)
 assert.equal(higher.difference,11)
 s.volumetric_rule={divisor:6000}
 assert.equal(basis.volumetricDivisor,3000)
 assert.equal(planWeightAdjustment({...input,weightKg:31}).difference,11)
})

test('the configuration simulator uses the real additional-kg pricing and refuses unconfigured upper ranges',()=>{
 const s=service('EMSF057.01','PT-ILHAS')
 s.zones[0].tiers=[{...tiers[5],weight_max:30,sell_price:30,cost_price:15},
  {id:'extra',label:'Kg adicional',weight_max:999,sell_price:2,cost_price:1,enabled:true}]
 const result=calculateConfiguredZonePrice(32.4,s,s.zones[0])
 assert.equal(result.basePrice,36)
 assert.equal(result.buyPrice,18)
 assert.equal(result.sellPrice,39.6)
 assert.throws(()=>calculateConfiguredZonePrice(1000,s,s.zones[0]),/Tarifa não configurada/)
 s.zones[0].tiers=s.zones[0].tiers.filter(t=>t.weight_max!==999)
 assert.throws(()=>calculateConfiguredZonePrice(32.4,s,s.zones[0]),/Tarifa não configurada/)
})
