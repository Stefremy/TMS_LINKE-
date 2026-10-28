const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const load=createLoader({})
const {getDestinationServiceOptions:options,getServiceIslandTransportMode:mode,getAuthorizedDestinationCountries:countries,isDestinationPostalReady:ready}=load('lib/services/shipment-service-options.ts')
const {buildOfficialCeTruckZones}=load('lib/services/geo/international-zones.ts')
const service=(id,product,zones)=>({id,name:id,webservice_service_code:product,carrier_group:'ctt',is_active:true,allowed_zones:zones,zones:zones.map(zone_code=>({zone_code,tiers:[{weight_max:30,enabled:true,sell_price:10}]}))})
const eq=service('EQ','ENCF008.01',['PT-CONT'])
const dd=service('Ilhas Avião','EMSF056.01',['PT-ILHAS'])
const db=service('Marítimo Ilhas','EMSF057.01',['PT-ILHAS'])
const ids=items=>items.map(s=>s.id)
test('coverage is determined by configured zones, never by editable marketing names',()=>{
 const all=[eq,dd,db]
 assert.deepEqual(ids(options(all,'PT','4000-001')),['EQ'])
 for(const postal of ['9000-001','9500-001']){
  assert.deepEqual(ids(options(all,'PT',postal)),['Ilhas Avião','Marítimo Ilhas'])
  assert.deepEqual(ids(options(all,'PT',postal,'air')),['Ilhas Avião'])
  assert.deepEqual(ids(options(all,'PT',postal,'sea')),['Marítimo Ilhas'])
 }
 const mainlandDb=service('DB continental','EMSF057.01',['PT-CONT'])
 assert.deepEqual(ids(options([mainlandDb],'PT','4000-001')),['DB continental'])
 assert.deepEqual(options([mainlandDb],'PT','9500-001'),[])
 assert.equal(mode({...db,name:'Ilhas Avião'}),'sea')
 assert.equal(mode({...dd,name:'Barco'}),'air')
})
test('redacted DTOs preserve API-based mode without exposing the product',()=>{
 for(const service of [dd,db])assert.equal(mode({...service,island_transport_mode:mode(service),webservice_service_code:undefined,preferred_carrier_name:undefined}),mode(service))
 assert.equal(mode({...db,carrier_group:'correos'}),'other')
 assert.equal(mode({...db,island_transport_mode:'air'}),'sea')
})
test('country union is independent of selected service; disabled or missing coverage stays excluded',()=>{
 const es=service('Espanha','EMSF056.01',['ES-PENIN'])
 assert.deepEqual(countries([eq,dd,es]).map(c=>c.code),['PT','ES'])
 assert.deepEqual(options([eq,{...dd,is_active:false},{...db,zones:[]}],'PT','9000-001'),[])
 assert.deepEqual(options([{...dd,zones:[{zone_code:'PT-ILHAS',tiers:[{weight_max:30,enabled:false}]}]}],'PT','9000-001'),[])
})
test('incomplete domestic postal codes do not select mainland services and Spanish leading zero is preserved',()=>{
 for(const postal of ['', '9','9000','9000-00']) assert.deepEqual(options([eq,dd,db],'PT',postal),[])
 assert.equal(ready('PT','4000001'),true)
 assert.equal(ready('ES','7001'),false)
 assert.equal(ready('ES','07001'),true)
 assert.equal(ready('ES','00001'),false)
 const es=service('Península','EMSF056.01',['ES-PENIN']),isles=service('Baleares','63',['ES-ILHAS'])
 assert.deepEqual(ids(options([es,isles],'ES','28001')),['Península'])
 assert.deepEqual(ids(options([es,isles],'ES','07001')),['Baleares'])
 for(const postal of ['35001','38001','51001','52001'])assert.deepEqual(options([es,isles],'ES',postal),[])
})
test('international coverage uses each product map and keeps customs exclusions',()=>{
 const ce={...service('Europa','ENCF008.02',['Zona 2','Zona 3']),zones:buildOfficialCeTruckZones()}
 assert.deepEqual(ids(options([eq,dd,db,ce],'BE','1000')),['Europa'])
 assert.deepEqual(ids(options([eq,ce],'FI','00100')),['Europa'])
 assert.deepEqual(options([eq,ce],'FI','22100'),[])
 for(const country of ['NO','GB','IS','CH'])assert.deepEqual(options([ce],country,'12345'),[])
})

test('all enabled European fixture postcodes are ready without losing international formats',()=>{
 for(const {country,postal} of require('./fixtures/eu-public-destinations.json'))assert.equal(ready(country,postal),true,`${country}/${postal}`)
 for(const [country,postal] of [['BE','1'],['DE','1017'],['NL','1012'],['IE','D02']])assert.equal(ready(country,postal),false)
})
