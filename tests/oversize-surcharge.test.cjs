const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const load = createLoader({})
const { calculateOversizeSurcharge: calc, getServiceParcelLimitProduct } = load('lib/pricing/oversize-surcharge.ts')
const { calculateShipmentQuote } = load('lib/pricing/calculate-shipment-quote.ts')
const { calculateClientShipmentPreview } = load('lib/pricing/calculate-client-shipment-preview.ts')
const domestic = {webservice_service_code:'EMSF056.01'}
const europa = {webservice_service_code:'ENCF008.02'}
const air = {webservice_service_code:'EMSF001.02'}
const box = (lengthCm=10,widthCm=10,heightCm=10,volumesCount=1,parcelWeightsKg) => ({lengthCm,widthCm,heightCm,volumesCount,parcelWeightsKg})
test('domestic boundaries are inclusive; dimensions and actual weight trigger one charge',()=>{
 assert.equal(calc(domestic,'PT',30,box(150,50,40)).amount,0)
 assert.equal(calc(domestic,'PT',30.001,box()).amount,69.9)
 assert.equal(calc(domestic,'PT',31,box(151,50,40)).amount,69.9)
 assert.equal(calc(domestic,'PT',1,box(100,100,40.001)).amount,69.9)
 assert.equal(calc(domestic,'PT',1,box(10,151,10)).amount,69.9)
})
test('multi-parcel fees use individual weights and do not assume equal weight',()=>{
 assert.equal(calc(domestic,'PT',50,box(10,10,10,2,[31,19])).amount,69.9)
 assert.equal(calc(domestic,'PT',50,box(10,10,10,2,[25,25])).amount,0)
 assert.equal(calc(domestic,'PT',65,box(10,10,10,2,[32,33])).amount,139.8)
 assert.throws(()=>calc(domestic,'PT',50,box(10,10,10,2)),/peso real de cada/)
 assert.throws(()=>calc(domestic,'PT',50,box(10,10,10,2,[20,20])),/somar/)
 assert.throws(()=>calc(domestic,'PT',50,box(10,10,10,2,[50])),/somar/)
 assert.equal(calc(domestic,'PT',20,box(10,10,10,2)).amount,0)
 assert.equal(calc(domestic,'PT',65,box(151,10,10,2)).amount,139.8)
})
test('Europa uses girth and Swedish actual-weight exception, international uses destination box limits',()=>{
 assert.equal(calc(europa,'BE',30,box(150,40,35)).amount,0)
 assert.equal(calc(europa,'BE',30,box(150,40,35.01)).amount,69.9)
 assert.equal(calc(europa,'SE',20,box()).amount,0)
 assert.equal(calc(europa,'SE',20.01,box()).amount,69.9)
 assert.equal(calc(air,'SE',25,box(80,100,80)).amount,0)
 assert.equal(calc(air,'BE',25,box(100,81,80)).amount,69.9)
 assert.equal(calc(air,'BE',25.01,box()).amount,69.9)
 assert.equal(calc({carrier_group:'correos',...domestic},'PT',60,box(200)).amount,0)
})
test('fee is additive after fuel and client redaction preserves calculation',()=>{
 const service={...domestic,id:'test',name:'CTT',preferred_carrier_name:'CTT Expresso',fuel_surcharge_pct:10,allowed_zones:['PT-CONT'],zones:[{zone_code:'PT-CONT',tiers:[{id:'t',label:'Até 100 kg',weight_max:100,sell_price:10,cost_price:5,margin_pct:100,enabled:true}]}]}
 const client={default_linke_table_id:'test',pricing:{}}
 const dimensions=box(151,10,10)
 const quote=calculateShipmentQuote(1,client,service,'PT','4000-001',[],0,dimensions)
 assert.equal(quote.fuelSurchargeAmount,1)
 assert.equal(quote.specialFeesAmount,69.9)
 assert.equal(quote.totalPrice,80.9)
 assert.equal(quote.specialItems.length,1)
 const redacted={...service,webservice_service_code:undefined,preferred_carrier_name:undefined,carrier_group:'ctt',parcel_limit_product:getServiceParcelLimitProduct(service)}
 assert.equal(calculateClientShipmentPreview(1,client,redacted,'PT','4000-001',[],0,dimensions).totalPrice,quote.totalPrice)
 // Large volumetric weight alone never triggers the fee.
 assert.equal(calc(europa,'BE',1,box(100,50,50)).amount,0)
})

test('form summary shows the fee and asks for individual weights only when needed',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const {ShipmentOversizeSummary}=createLoader({react:React,'react/jsx-runtime':require('react/jsx-runtime')})('components/shipments/ShipmentOversizeSummary.tsx')
 const render=extra=>renderToStaticMarkup(React.createElement(ShipmentOversizeSummary,{service:domestic,country:'PT',weightKg:50,...box(10,10,10,2),weights:[],onWeightsChange(){},...extra}))
 assert.match(render({}),/Peso real de cada volume/)
 assert.equal((render({}).match(/name="parcel_weight_kg"/g)||[]).length,2)
 assert.match(render({parcelWeightsKg:[31,19]}),/69,90/)
 assert.doesNotMatch(render({weightKg:20}),/name="parcel_weight_kg"/)
 assert.match(render({weightKg:10,lengthCm:151}),/139,80/)
})

test('unverified international destination limits fail closed instead of silently omitting the fee',()=>{
 assert.throws(()=>calc(air,'ZZ',30,box()),/Limites por volume não configurados/)
})
