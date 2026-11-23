const {test}=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {orderToShipmentParams,shipmentPrefillFromParams,orderObservations,recipientDisplayName}=createLoader({})('lib/ecommerce/order-shipment-prefill.ts')

const order={order_number:'#1042',customer_name:'Ana Silva',customer_company:'Padaria Central',customer_email:'ana@x.pt',customer_phone:'912 345 678',
  shipping_address:'Rua das Flores 10, 2º Esq',shipping_city:'Braga',shipping_postal:'4700-001',shipping_country:'pt',
  customer_note:'Entregar   depois das 14h',total_weight_kg:2.35,is_cod:true,cod_amount:39.9}

test('every imported order field reaches the new shipment form',()=>{
  const prefill=shipmentPrefillFromParams(new URLSearchParams(orderToShipmentParams(order).toString()))
  assert.deepEqual(prefill,{
    recipientName:'Padaria Central (Ana Silva)',recipientAddress:'Rua das Flores 10, 2º Esq',recipientPostal:'4700-001',recipientCity:'Braga',
    recipientCountry:'PT',recipientPhone:'912 345 678',recipientEmail:'ana@x.pt',codValue:39.9,selectedSpecialServices:['cod'],
    observations:'Encomenda 1042 · Entregar depois das 14h',reference:'1042',weightKg:2.35,
  })
})
test('the store-order link stays first in the notes, which are kept within the form limit',()=>{
  const long=orderObservations('#7','x'.repeat(900))
  assert.ok(long.startsWith('Encomenda 7 · '));assert.equal(long.length,500)
  assert.match(long,/(?:encomenda\s*#?|#)([\w-]+)/i)
})
test('paid orders carry no cash on delivery and missing weight keeps the form default',()=>{
  const prefill=shipmentPrefillFromParams(orderToShipmentParams({...order,is_cod:false,total_weight_kg:undefined,customer_company:'',customer_note:''}))
  assert.equal(prefill.codValue,0);assert.deepEqual(prefill.selectedSpecialServices,[]);assert.equal('weightKg' in prefill,false)
  assert.equal(prefill.recipientName,'Ana Silva');assert.equal(prefill.observations,'Encomenda 1042')
})
test('company names are not duplicated and older short links still work',()=>{
  assert.equal(recipientDisplayName('Padaria Central','padaria central'),'Padaria Central')
  assert.equal(recipientDisplayName('Cliente','Loja X'),'Loja X')
  const legacy=shipmentPrefillFromParams(new URLSearchParams('name=Rui&address=Rua 1&city=Porto&postal=4000-001&phone=91&cod=12&ref=%2355'))
  assert.equal(legacy.recipientName,'Rui');assert.equal(legacy.codValue,12);assert.equal(legacy.reference,'55');assert.equal(legacy.observations,'Encomenda 55')
  assert.equal(shipmentPrefillFromParams(new URLSearchParams('obs=nada')),undefined)
})

const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const links=createLoader({})('lib/ecommerce/online-order-links.ts')
const sync=(details,tenant='t1')=>({tenant_id:tenant,action:'client_ecommerce_fulfillment_sync',created_at:'2026-11-23',details})
test('shipments created from web orders are found by id or tracking, per client and tenant only',async()=>{
  const db=fakeSupabase({audit_log:[
    sync({shipment_id:'s1',tracking_code:'EQ1PT',client_id:'c1',store_id:'w',store_name:'Loja W',order_id:'9',order_number:'#1042',status:'failed'}),
    sync({shipment_id:'s1',tracking_code:'EQ1PT',client_id:'c1',store_id:'w',store_name:'Loja W',order_id:'9',order_number:'#1042',status:'synced'}),
    sync({shipment_id:'s2',tracking_code:'EQ2PT',client_id:'c2',store_id:'w',order_id:'10',order_number:'#7'}),
    sync({shipment_id:'s9',client_id:'c1',store_id:'w',order_id:'11'},'other-tenant'),
  ]})
  const mine=await links.loadOnlineOrderLinks(db.client,'t1',{clientId:'c1'})
  assert.equal(mine.length,1,'repeated sync attempts are one link; other clients and tenants are excluded')
  const badges=links.onlineOrderBadges(await links.loadOnlineOrderLinks(db.client,'t1',{shipmentKeys:['EQ2PT','s1']}))
  assert.deepEqual(badges.s1,{order_number:'#1042',store_name:'Loja W'});assert.deepEqual(badges.EQ1PT,badges.s1)
  assert.equal(badges.EQ2PT.store_name,'Loja online');assert.equal(badges.s9,undefined)
})
