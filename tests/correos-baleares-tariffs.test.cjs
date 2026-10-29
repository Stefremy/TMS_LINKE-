const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const load=createLoader({})
const {buildBalearesExpressZones,resolveBalearesTariffZone}=load('lib/services/correos/baleares-tariffs.ts')
const {resolveServiceZoneCode,calculateShipmentPrice}=load('lib/pricing/calculate-shipment-price.ts')
const {getDestinationServiceOptions,getAuthorizedDestinationCountries}=load('lib/services/shipment-service-options.ts')
const {calculateShipmentQuote}=load('lib/pricing/calculate-shipment-quote.ts')
const zones=buildBalearesExpressZones(25)
const service={id:'islas',name:'Ilhas Express',code:'LK-COR-ISLAS-EXPRESS',carrier_group:'correos',webservice_service_code:'26',is_active:true,global_markup_pct:25,fuel_surcharge_pct:0,allowed_zones:zones.map(z=>z.zone_code),zones}
const client={default_linke_table_id:service.id}
test('all 16 partner tariffs match the supplied Baleares columns',()=>{
 assert.deepEqual(zones.map(z=>z.tiers.map(t=>t.cost_price)),[[9.98,11.29,13.23,14.17,15.12,19.89,24.64,0.89],[10.51,12.05,14.21,15.41,16.59,22.52,29.39,1.12]])
 assert.deepEqual(zones[0].tiers.map(t=>t.weight_max),[1,2,3,4,5,10,15,999])
})
test('postal routing separates Mallorca, Menorca and Ibiza/Formentera even in redacted DTOs',()=>{
 const dto={...service,webservice_service_code:undefined,carrier_group:undefined}
 for(const cp of ['07001','07181','07300','07400','07500','07600','07638'])assert.equal(resolveServiceZoneCode(dto,'ES',cp),zones[0].zone_code)
 for(const cp of ['07701','07760','07800','07860'])assert.equal(resolveServiceZoneCode(dto,'ES',cp),zones[1].zone_code)
 for(const cp of ['','070','7001','07900','28001','35001','38001','51001','52001'])assert.equal(resolveBalearesTariffZone('ES',cp),'')
 assert.equal(resolveServiceZoneCode(dto,'PT','9000-001'),'PT-ILHAS')
})
test('only Spain/Baleares is offered; other islands and mainland never receive these prices',()=>{
 assert.deepEqual(getAuthorizedDestinationCountries([service]).map(c=>c.code),['ES'])
 for(const cp of ['07001','07701','07860'])assert.equal(getDestinationServiceOptions([service],'ES',cp).length,1)
 for(const [country,cp] of [['ES','28001'],['ES','35001'],['ES','38001'],['ES','51001'],['PT','9500-001'],['PT','9000-001']]){
  assert.deepEqual(getDestinationServiceOptions([service],country,cp),[])
  assert.throws(()=>calculateShipmentPrice(1,client,[service],country,cp,{requireConfiguredTariff:true}))
 }
})
test('additional kilograms are charged above 15kg independently for each destination',()=>{
 for(const [cp,base,extra] of [['07001',24.64,.89],['07701',29.39,1.12]]){
  for(const [kg,steps] of [[15,0],[15.1,1],[16,1],[16.1,2],[20,5]]){
   const q=calculateShipmentPrice(kg,client,[service],'ES',cp,{requireConfiguredTariff:true})
   assert.equal(q.buyPrice,Number((base+extra*steps).toFixed(2)),`${cp}/${kg}`)
  }
 }
})
test('volumetric charge uses contract 167kg/m3 while preserving declared actual weight',()=>{
 const quote=calculateShipmentQuote(1,client,service,'ES','07001',[],0,{lengthCm:50,widthCm:40,heightCm:40,volumesCount:1})
 assert.equal(quote.declaredWeightKg,1)
 assert.ok(Math.abs(quote.volumetricWeightKg-13.36)<1e-8)
 assert.equal(quote.tierLabel,'Até 15 Kg')
 assert.equal(quote.buyPrice,24.64)
})

test('adding precise Baleares zones does not suppress other explicitly configured destinations',()=>{
 const combined={...service,allowed_zones:[...service.allowed_zones,'ES-PENIN'],zones:[...zones,{zone_code:'ES-PENIN',zone_name:'Península',tiers:[{id:'mainland',weight_max:10,cost_price:4,sell_price:5,enabled:true}]}]}
 assert.equal(resolveServiceZoneCode(combined,'ES','28001'),'ES-PENIN')
 assert.equal(getDestinationServiceOptions([combined],'ES','28001').length,1)
 assert.equal(calculateShipmentPrice(1,{default_linke_table_id:combined.id},[combined],'ES','28001',{requireConfiguredTariff:true}).buyPrice,4)
})
