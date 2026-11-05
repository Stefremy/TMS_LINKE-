const {test}=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const load=createLoader({react:{useMemo:fn=>fn()},zod:require('zod')})
const {getShipmentQuote}=load('components/shipments/form/useShipmentQuote.ts')
const {shipmentDefaults}=load('components/shipments/form/schema.ts')
const tier={id:'t',label:'Até 30 kg',weight_max:30,sell_price:5,cost_price:2,margin_pct:25,enabled:true}
const service={id:'air',code:'LK-DD-STD',name:'CTT Expresso',carrier_group:'ctt',webservice_service_code:'EMSF056.01',is_active:true,fuel_surcharge_pct:10,
 zones:[{zone_code:'PT-CONT',tiers:[tier]},{zone_code:'PT-ILHAS',tiers:[{...tier,sell_price:15}]}]}
const client={id:'client',is_active:true,assigned_linke_service_ids:['air'],pricing:{standard_fuel_surcharge_pct:13.9,special_services_fees:[]}}
const values={...shipmentDefaults(client),recipientPostal:'4000-001',weightKg:1,lengthCm:30,widthCm:20,heightCm:10,serviceId:'air'}
const quote=(v={},c={},services=[service])=>getShipmentQuote({client:{...client,...c},services,values:{...values,...v},role:'client'})
test('hook uses the existing selling-price calculation and exposes no costs or margins',()=>{
 const result=quote()
 assert.equal(result.isBlocked,false);assert.equal(result.quote.basePrice,5);assert.equal(result.quote.totalPrice,5.7)
 assert.equal(result.fuelPct,13.9,'display the actual configured rate, not a percentage inferred from rounded cents')
 assert.equal(result.quote.buyPrice,undefined);assert.equal(result.quote.margin,undefined)
 assert.equal(result.selected.zone,'PT-CONT')
})
test('quote rejects missing service, incomplete destinations, unavailable tables and suspended clients',()=>{
 for(const v of [{serviceId:''},{recipientPostal:'4000'},{weightKg:0},{lengthCm:0}]) assert.equal(quote(v).isBlocked,true)
 assert.equal(quote({}, {assigned_linke_service_ids:[]}).options.length,0)
 assert.equal(quote({}, {portal_access_status:'suspended'}).isBlocked,true)
})
test('islands require a choice when configured air and sea services coexist',()=>{
 const sea={...service,id:'sea',name:'CTT Marítimo',webservice_service_code:'EMSF057.01'}
 const input={client:{...client,assigned_linke_service_ids:['air','sea']},services:[service,sea],role:'client',values:{...values,recipientPostal:'9000-001'}}
 assert.match(getShipmentQuote(input).blockedReason,/transporte/)
 const selected=getShipmentQuote({...input,values:{...input.values,islandTransportMode:'sea',serviceId:'sea'}})
 assert.deepEqual(selected.options.map(option=>option.service.id),['sea']);assert.equal(selected.isBlocked,false)
})
test('COD resolves destination rates and ignores stale extras from the other carrier',()=>{
 const fees=[{special_service_code:'cod',special_service_name:'Cobrança',is_enabled:true,fee_type:'fixed',fixed_value:1,cod_destination_rates:{'PT-ILHAS':{fee_type:'fixed',fixed_value:3}}}]
 const result=quote({recipientPostal:'9000-001',selectedSpecialServices:['cod','correos_cod'],codValue:50},{pricing:{standard_fuel_surcharge_pct:0,special_services_fees:fees}})
 assert.equal(result.quote.specialFeesAmount,3);assert.deepEqual(result.activeSpecialServices,['cod'])
})
test('postal code and volume count eliminate non-matching services and isolate Múltiplo tables',()=>{
 const ptSingle={...service,id:'pt-19h',name:'CTT 19h',webservice_service_code:'EMSF001.01',allowed_zones:['PT-CONT'],zones:[{zone_code:'PT-CONT',tiers:[tier]}]}
 const ptMulti={...service,id:'pt-mult',name:'CTT Múltiplo',code:'LK-MULT-STD',webservice_service_code:'EMSF010.01',allowed_zones:['PT-CONT'],zones:[{zone_code:'PT-CONT',tiers:[{...tier,sell_price:8}]}]}
 const esOnly={...service,id:'es-24h',name:'Espanha 24h',webservice_service_code:'EMSF056.01',allowed_zones:['ES-PENIN'],zones:[{zone_code:'ES-PENIN',tiers:[{...tier,sell_price:9}]}]}
 const all=[ptSingle,ptMulti,esOnly]
 const c={assigned_linke_service_ids:['pt-19h','pt-mult','es-24h']}
 const pt1=quote({recipientCountry:'PT',recipientPostal:'4000-001',volumesCount:1,serviceId:'pt-19h'},c,all)
 assert.deepEqual(pt1.options.map(o=>o.service.id),['pt-19h'])
 const pt2=quote({recipientCountry:'PT',recipientPostal:'4000-001',volumesCount:2,parcelWeightsKg:[0.5,0.5],serviceId:'pt-mult'},c,all)
 assert.deepEqual(pt2.options.map(o=>o.service.id),['pt-mult'])
 const es1=quote({recipientCountry:'ES',recipientPostal:'28013',volumesCount:1,serviceId:'es-24h'},c,all)
 assert.deepEqual(es1.options.map(o=>o.service.id),['es-24h'])
})
