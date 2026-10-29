const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const load=createLoader({})
const {applyPaq24Tariffs,buildPaq24Zone}=load('lib/services/correos/paq24-tariffs.ts')
const {calculateShipmentPrice}=load('lib/pricing/calculate-shipment-price.ts')
const {getDestinationServiceOptions}=load('lib/services/shipment-service-options.ts')
const fixture=(product,margin=25)=>({id:`paq-${product}`,code:'LK-COR',name:'Correos',carrier_group:'correos',webservice_service_code:product,is_active:true,global_markup_pct:margin,fuel_surcharge_pct:0,allowed_zones:['PT-CONT'],zones:[]})
for(const product of ['63','93'])test(`${product}: all contract costs are filled and Spain adds 90 cents only to base brackets`,()=>{
 const s=applyPaq24Tariffs(fixture(product))
 const costs=zone=>s.zones.find(z=>z.zone_code===zone).tiers.map(t=>t.cost_price)
 assert.deepEqual(costs('PT-CONT'),[3.40,3.45,3.50,3.60,3.67,4,4.20,.28])
 assert.deepEqual(costs('ES-PENIN'),[4.30,4.35,4.40,4.50,4.57,4.90,5.10,.28])
 assert.deepEqual(applyPaq24Tariffs(s),s)
 for(const kg of [1,2,3,4,5,10,15,15.1,16,16.1,20,30]){
  const pt=calculateShipmentPrice(kg,{default_linke_table_id:s.id},[s],'PT','4000-001',{requireConfiguredTariff:true})
  const es=calculateShipmentPrice(kg,{default_linke_table_id:s.id},[s],'ES','28001',{requireConfiguredTariff:true})
  assert.equal(Math.round((es.buyPrice-pt.buyPrice)*100),90,`${kg} kg`)
 }
 assert.equal(calculateShipmentPrice(20,{default_linke_table_id:s.id},[s],'ES','28001',{requireConfiguredTariff:true}).buyPrice,6.5)
 assert.equal(getDestinationServiceOptions([s],'ES','28001').length,1)
 for(const cp of ['07001','07701','35001','51001'])assert.deepEqual(getDestinationServiceOptions([s],'ES',cp),[])
})
test('existing tier IDs/storage indexes, per-tier margins and negotiated override semantics remain stable',()=>{
 const old={zone_code:'PT-CONT',zone_name:'old',tiers:[
  {id:'old-1',weight_max:1,margin_pct:12,enabled:true},
  {id:'old-3',weight_max:3,margin_pct:15,enabled:true},
  {id:'old-20',weight_max:20,margin_pct:12,enabled:true},
  {id:'old-extra',weight_max:999,margin_pct:12,enabled:true},
 ]}
 const zone=buildPaq24Zone('PT-CONT',25,old)
 for(let i=0;i<old.tiers.length;i++)assert.equal(zone.tiers[i].id,old.tiers[i].id)
 assert.equal(zone.tiers[0].sell_price,3.81)
 assert.equal(zone.tiers[1].sell_price,4.02)
 assert.equal(zone.tiers[2].enabled,false)
 assert.equal(zone.tiers[3].weight_max,999)
 assert.equal(zone.tiers[3].label,'Kg Adicional (+15kg)')
 const service=applyPaq24Tariffs({...fixture('63',12),zones:[old]})
 const quote=calculateShipmentPrice(3,{default_linke_table_id:service.id,custom_tier_overrides:{[service.id]:[8,9]}},[service],'PT','4000-001',{requireConfiguredTariff:true})
 assert.equal(quote.basePrice,9)
 assert.equal(quote.buyPrice,3.5)
})
test('different table margins are retained and unrelated services/zones are not mutated',()=>{
 for(const margin of [12,25]){
  const s=applyPaq24Tariffs(fixture('63',margin))
  assert.equal(s.global_markup_pct,margin)
  assert.equal(s.zones.find(z=>z.zone_code==='ES-PENIN').tiers[0].sell_price,Number((4.30*(1+margin/100)).toFixed(2)))
 }
 const island={zone_code:'ES-BALEARES-MAIORCA',tiers:[{cost_price:9.98}]}
 assert.deepEqual(applyPaq24Tariffs({...fixture('63'),zones:[island]}).zones[0],island)
 assert.throws(()=>applyPaq24Tariffs(fixture('26')),/diferente/)
 assert.throws(()=>buildPaq24Zone('PT-ILHAS'),/fora/)
})
