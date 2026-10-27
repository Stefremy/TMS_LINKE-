const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const load=createLoader({})
const {getServiceDestinationCountries,getServiceDestinationZone}=load('lib/services/service-destinations.ts')
const {buildOfficialCeTruckZones,buildOfficialLinkeInternationalZones,resolveInternationalZone}=load('lib/services/geo/international-zones.ts')
const tier={weight_max:30,sell_price:5,enabled:true}
const service=(zones,allowed_zones)=>({id:'table',is_active:true,zones:zones.map(zone_code=>({zone_code,tiers:[{...tier}]})),allowed_zones})
const codes=s=>getServiceDestinationCountries(s).map(c=>c.code)

test('national and Iberian tables expose only countries with configured and permitted zones',()=>{
  assert.deepEqual(codes(service(['PT-CONT'])),['PT'])
  assert.deepEqual(codes(service(['PT-CONT','ES-PENIN'])),['PT','ES'])
  assert.deepEqual(codes(service(['PT-CONT','ES-PENIN'],['PT-CONT'])),['PT'])
  assert.deepEqual(codes(service(['PT-CONT'],['PT-CONT','ES-PENIN'])),['PT'])
})
test('island-only tariffs still expose their country and postal codes refine the zone',()=>{
  assert.deepEqual(codes(service(['PT-ILHAS'])),['PT'])
  assert.deepEqual(codes(service(['ES-ILHAS'])),['ES'])
  const s=service(['ES-ILHAS'])
  assert.equal(getServiceDestinationZone(s,'ES','07001'),'ES-ILHAS')
  assert.equal(getServiceDestinationZone(s,'ES','28013'),'ES-PENIN')
})
test('international destinations include every mapped region, with Portuguese names and no duplicate aliases',()=>{
  const s={...service([]),zones:buildOfficialLinkeInternationalZones(20)}
  const before=JSON.stringify(s),countries=getServiceDestinationCountries(s),list=countries.map(c=>c.code)
  for(const code of ['DE','FR','BE','NL','SE','FI'])assert.ok(list.includes(code),code)
  for(const code of ['NO','GB','UK','CH','IS','US','CA','BR','JP','SA','AU','AO','CV'])assert.equal(list.includes(code),false,code)
  assert.equal(list.includes('PT'),false);assert.equal(list.includes('ES'),false)
  assert.equal(list.length,new Set(list).size)
  assert.equal(countries.find(c=>c.code==='DE').name,'Alemanha')
  assert.equal(JSON.stringify(s),before)
})
test('CE road tariffs follow their contract countries rather than the air-zone country groups',()=>{
  const s={...service([]),webservice_service_code:'ENCF008.02',zones:buildOfficialCeTruckZones(),allowed_zones:['Zona 2','Zona 3']}
  const list=codes(s)
  for(const code of ['DE','FR','PL','SE','MT'])assert.ok(list.includes(code),code)
  for(const code of ['PT','ES','US','RO','BG','UK','GB','NO','IS','CH'])assert.equal(list.includes(code),false,code)
  assert.equal(getServiceDestinationZone(s,'PL'),'Zona 3')
  assert.equal(getServiceDestinationZone(s,'AT'),'Zona 2')
  const redactedCustomCe={id:'srv_linke_custom_ce',code:'LK-901',is_active:true,zones:buildOfficialCeTruckZones(),allowed_zones:['Zona 2','Zona 3']}
  assert.deepEqual(codes(redactedCustomCe),list)
  assert.equal(getServiceDestinationZone(redactedCustomCe,'DE'),'Zona 2')
  assert.equal(getServiceDestinationZone(redactedCustomCe,'PL'),'Zona 3')
  s.zones=s.zones.filter(z=>z.zone_code==='Zona 2')
  assert.equal(codes(s).includes('PL'),false)
})
test('disabled, missing and empty tiers never offer arbitrary countries',()=>{
  for(const s of [undefined,{...service(['PT-CONT']),is_active:false},service([]),{zones:[{zone_code:'EU 1',tiers:[]}]},
    {zones:[{zone_code:'EU 1',tiers:[{...tier,enabled:false}]}]}])assert.deepEqual(codes(s),[])
  assert.deepEqual(codes(service(['PT-CONT'],['INTL'])),[])
})
test('zone aliases, broad coverage and published tables without internal costs retain their countries',()=>{
  const s=service(['EU-Z1'],['INTL-AERO'])
  assert.ok(codes(s).includes('FR'));assert.equal(codes(s).includes('US'),false)
  assert.deepEqual(codes(service(['PT-CONT'])),['PT'])
  assert.equal(resolveInternationalZone('SA'),'O2')
  assert.equal(resolveInternationalZone('BA'),'SA')
})
