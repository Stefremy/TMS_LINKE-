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
test('international CTT and Correos services hide stale COD; server quotes reject COD outside the agreed regions',()=>{
 const {calculateShipmentQuote}=load('lib/pricing/calculate-shipment-quote.ts')
 for(const carrier of ['ctt','correos']) for(const [country,postal,zone] of [['DE','10115','EU 1'],['LT','01100','EU 2']]) {
  const code=carrier==='ctt'?'cod':'correos_cod'
  const table={...service,id:'international',name:carrier==='ctt'?'CTT Internacional':'Correos Internacional',code:carrier==='ctt'?'LK-EU-STD':'LK-COR-INTL',
   carrier_group:carrier,webservice_service_code:carrier==='ctt'?'EMSF001.02':'90',allowed_zones:[zone],zones:[{zone_code:zone,tiers:[tier]}]}
  const customer={...client,assigned_linke_service_ids:[table.id]}
  const result=getShipmentQuote({role:'client',services:[table],client:customer,values:{...values,serviceId:table.id,
   recipientCountry:country,recipientPostal:postal,selectedSpecialServices:[code],codValue:50}})
  assert.equal(result.isBlocked,false,result.blockedReason)
  assert.ok(result.specialFees.every(f=>!['cod','correos_cod'].includes(f.special_service_code)))
  assert.deepEqual(result.activeSpecialServices,[])
  if(carrier==='ctt') assert.equal(result.quote.specialFeesAmount,0)
  else { assert.equal(result.quote,null);assert.equal(result.requiresQuotation,true) }
  assert.throws(()=>calculateShipmentQuote(1,customer,table,country,postal,[code],50),/COD.*apenas/)
  if(carrier==='correos') {
   const multi=getShipmentQuote({role:'client',services:[table],client:customer,values:{...values,serviceId:table.id,
    recipientCountry:country,recipientPostal:postal,volumesCount:3,parcelWeightsKg:[0.3,0.3,0.4]}})
   assert.equal(multi.isBlocked,false);assert.equal(multi.requiresQuotation,true)
  }
 }
})
test('Correos international requests remain available without tariffs and for customs destinations, while CTT retains its emission policy',()=>{
 const table={...service,code:'LK-COR-INTL',carrier_group:'correos',name:'Correos Internacional',webservice_service_code:'90',
  allowed_zones:['EU 1','NA'],zones:[]}
 for(const [country,postal] of [['FR','75001'],['US','10001']]) {
  const result=quote({recipientCountry:country,recipientPostal:postal,volumesCount:3,selectedSpecialServices:['correos_cod'],codValue:50},{},[table])
  assert.equal(result.isBlocked,false,result.blockedReason)
  assert.equal(result.requiresQuotation,true);assert.equal(result.quote,null)
  assert.deepEqual(result.activeSpecialServices,[]);assert.deepEqual(result.specialFees,[])
  assert.ok(result.countries.some(c=>c.code===country))
 }
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
test('CTT DD, CTT DB and Correos expose COD for mainland Spain in both portals using the customer Spain tariff',()=>{
 const fees=['cod','correos_cod'].map(code=>({special_service_code:code,special_service_name:'Cobrança',is_enabled:true,
  fee_type:'fixed',fixed_value:9,cod_destination_rates:{'ES-PENIN':{fee_type:'percentage',percentage_value:3,min_value:2.5}}}))
 for(const [carrier,product] of [['ctt','EMSF056.01'],['ctt','EMSF057.01'],['correos','93']]) {
  const table={...service,id:product,code:carrier==='correos'?'LK-COR-PAQ24':product==='EMSF056.01'?'LK-DD-STD':'LK-DB-STD',
   name:carrier==='correos'?'Correos Paq 24':'CTT Expresso',carrier_group:carrier,webservice_service_code:product,
   allowed_zones:['ES-PENIN'],zones:[{zone_code:'ES-PENIN',tiers:[tier]}]}
  const customer={...client,assigned_linke_service_ids:[product],pricing:{standard_fuel_surcharge_pct:0,special_services_fees:fees}}
  const code=carrier==='ctt'?'cod':'correos_cod'
  for(const role of ['client','ops']) for(const postal of ['28013','08001']) for(const [codValue,feeAmount] of [[20,2.5],[100,3]]) {
   const input={role,services:[table],client:customer,values:{...values,serviceId:product,recipientCountry:'ES',recipientPostal:postal,
    selectedSpecialServices:['cod','correos_cod'],codValue}}
   const result=getShipmentQuote(input)
   assert.equal(result.isBlocked,false,`${role} ${product} ${postal}: ${result.blockedReason}`)
   assert.equal(result.selected.zone,'ES-PENIN')
   assert.deepEqual(result.activeSpecialServices,[code])
   assert.deepEqual(result.specialFees.map(f=>f.special_service_code),[code])
   assert.equal(result.quote.specialFeesAmount,feeAmount)
   assert.equal(result.quote.totalPrice,5+feeAmount)
   const disabled={...customer,pricing:{...customer.pricing,special_services_fees:fees.map(f=>({...f,is_enabled:false}))}}
   const unavailable=getShipmentQuote({...input,client:disabled})
   assert.deepEqual(unavailable.specialFees,[])
   assert.deepEqual(unavailable.activeSpecialServices,[])
  }
 }
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
test('multi-carrier matrix has zero conflicts across PT Continental, PT Islands, ES Peninsula, Baleares, EU and Múltiplo',()=>{
 const {buildBalearesExpressZones}=load('lib/services/correos/baleares-tariffs.ts')
 const {buildOfficialCeTruckZones}=load('lib/services/geo/international-zones.ts')
 const ctt19={...service,id:'ctt-19',name:'CTT 19h',carrier_group:'ctt',webservice_service_code:'EMSF001.01',allowed_zones:['PT-CONT'],zones:[{zone_code:'PT-CONT',tiers:[tier]}]}
 const cttMult={...service,id:'ctt-mult',name:'CTT Múltiplo',code:'LK-MULT-STD',carrier_group:'ctt',webservice_service_code:'EMSF010.01',allowed_zones:['PT-CONT'],zones:[{zone_code:'PT-CONT',tiers:[{...tier,sell_price:8}]}]}
 const cttAir={...service,id:'ctt-air',name:'CTT Ilhas Avião',carrier_group:'ctt',webservice_service_code:'EMSF056.01',allowed_zones:['PT-ILHAS'],zones:[{zone_code:'PT-ILHAS',tiers:[{...tier,sell_price:14}]}]}
 const cttSea={...service,id:'ctt-sea',name:'CTT Ilhas Barco',carrier_group:'ctt',webservice_service_code:'EMSF057.01',allowed_zones:['PT-ILHAS'],zones:[{zone_code:'PT-ILHAS',tiers:[{...tier,sell_price:11}]}]}
 const corIber={...service,id:'cor-iber',name:'Correos Paq 24',code:'LK-COR-PAQ24',carrier_group:'correos',webservice_service_code:'93',allowed_zones:['PT-CONT','ES-PENIN'],zones:[{zone_code:'PT-CONT',tiers:[{...tier,sell_price:6}]},{zone_code:'ES-PENIN',tiers:[{...tier,sell_price:7}]}]}
 const balearesZones=buildBalearesExpressZones(25)
 const corBal={...service,id:'cor-bal',name:'Correos Baleares',code:'LK-COR-ISLAS-EXPRESS',carrier_group:'correos',webservice_service_code:'26',allowed_zones:balearesZones.map(z=>z.zone_code),zones:balearesZones}
 const cttEu={...service,id:'ctt-eu',name:'CTT Europa',code:'LK-CE-STD',carrier_group:'ctt',webservice_service_code:'ENCF008.02',allowed_zones:['Zona 2','Zona 3'],zones:buildOfficialCeTruckZones()}
 const all=[ctt19,cttMult,cttAir,cttSea,corIber,corBal,cttEu]
 const c={assigned_linke_service_ids:all.map(s=>s.id)}
 // 1) PT Continental 1 volume -> ctt-19 and cor-iber only (ctt-mult, islands, Spain, EU excluded)
 assert.deepEqual(quote({recipientCountry:'PT',recipientPostal:'4000-001',volumesCount:1},c,all).options.map(o=>o.service.id),['ctt-19','cor-iber'])
 // 2) PT Continental 2 volumes -> ctt-mult and cor-iber only (ctt-19 excluded)
 assert.deepEqual(quote({recipientCountry:'PT',recipientPostal:'4000-001',volumesCount:2,parcelWeightsKg:[0.5,0.5]},c,all).options.map(o=>o.service.id),['ctt-mult','cor-iber'])
 // 3) PT Islands 1 volume air vs sea -> only matching island service
 assert.deepEqual(quote({recipientCountry:'PT',recipientPostal:'9000-001',volumesCount:1,islandTransportMode:'air'},c,all).options.map(o=>o.service.id),['ctt-air'])
 assert.deepEqual(quote({recipientCountry:'PT',recipientPostal:'9500-001',volumesCount:1,islandTransportMode:'sea'},c,all).options.map(o=>o.service.id),['ctt-sea'])
 // 4) PT Islands 2 volumes -> CTT island tables excluded for multi-volume; clear block reason
 const islMulti=quote({recipientCountry:'PT',recipientPostal:'9000-001',volumesCount:2,parcelWeightsKg:[0.5,0.5],islandTransportMode:'air'},c,all)
 assert.deepEqual(islMulti.options,[]);assert.equal(islMulti.multiVolumeServiceUnavailable,true)
 // 5) ES Peninsula -> cor-iber only
 assert.deepEqual(quote({recipientCountry:'ES',recipientPostal:'28013',volumesCount:1},c,all).options.map(o=>o.service.id),['cor-iber'])
 // 6) ES Baleares (Mallorca 07001) -> cor-bal only
 assert.deepEqual(quote({recipientCountry:'ES',recipientPostal:'07001',volumesCount:1},c,all).options.map(o=>o.service.id),['cor-bal'])
 // 7) Belgium (BE 1000) -> ctt-eu only
 assert.deepEqual(quote({recipientCountry:'BE',recipientPostal:'1000',volumesCount:1},c,all).options.map(o=>o.service.id),['ctt-eu'])
})
test('PT-CONT applies 23% IVA on table price, fuel surcharge and each supplement (Frágil, COD), while Islands and International apply 0% IVA',()=>{
 const fees=[
  {special_service_code:'fragil',special_service_name:'Frágil',is_enabled:true,fee_type:'fixed',fixed_value:1.5},
  {special_service_code:'cod',special_service_name:'Cobrança',is_enabled:true,fee_type:'fixed',fixed_value:2.5},
 ]
 const pt=quote({recipientCountry:'PT',recipientPostal:'4000-001',selectedSpecialServices:['fragil','cod'],codValue:50},{pricing:{standard_fuel_surcharge_pct:10,special_services_fees:fees}})
 assert.equal(pt.quote.vatPct,23)
 assert.equal(pt.quote.basePrice,5)
 assert.equal(pt.quote.baseVatAmount,1.15)
 assert.equal(pt.quote.basePriceWithVat,6.15)
 assert.equal(pt.quote.fuelSurchargeAmount,0.5)
 assert.equal(pt.quote.fuelVatAmount,0.12)
 assert.equal(pt.quote.fuelSurchargeWithVat,0.62)
 assert.deepEqual(pt.quote.specialItems.map(i=>({name:i.name,amount:i.amount,vatAmount:i.vatAmount,totalWithVat:i.totalWithVat})),[
  {name:'Frágil',amount:1.5,vatAmount:0.35,totalWithVat:1.85},
  {name:'Cobrança',amount:2.5,vatAmount:0.58,totalWithVat:3.08},
 ])
 assert.equal(pt.quote.totalPrice,9.5)
 assert.equal(pt.quote.vatAmount,2.2)
 assert.equal(pt.quote.totalWithVat,11.7)
 // PT Islands -> 0% IVA
 const ilhas=quote({recipientCountry:'PT',recipientPostal:'9000-001',selectedSpecialServices:['fragil','cod'],codValue:50},{pricing:{standard_fuel_surcharge_pct:10,special_services_fees:fees}})
 assert.equal(ilhas.quote.vatPct,0)
 assert.equal(ilhas.quote.baseVatAmount,0)
 assert.equal(ilhas.quote.fuelVatAmount,0)
 assert.equal(ilhas.quote.specialVatAmount,0)
 assert.equal(ilhas.quote.vatAmount,0)
 assert.equal(ilhas.quote.totalWithVat,ilhas.quote.totalPrice)
})
