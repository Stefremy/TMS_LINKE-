const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const { fakeSupabase } = require('./helpers/fake-supabase.cjs')

const TENANT='11111111-1111-1111-1111-111111111111',OTHER_TENANT='99999999-9999-9999-9999-999999999999'
const A='22222222-2222-2222-2222-222222222222',B='33333333-3333-3333-3333-333333333333'
// Native table columns confirmed through read-only Supabase OpenAPI metadata.
// A schema-aware fixture reproduces the real 42703 error that permissive mocks miss.
const nativeColumns=new Set('id tenant_id client_id tracking_number status ops_substatus sender_name sender_address sender_zip3 sender_zip4 recipient_name recipient_address recipient_zip3 recipient_zip4 service_type buy_price sell_price created_at updated_at carrier_tracking_number carrier_code billing_statement_id recipient_email recipient_phone sender_phone'.split(' '))
const row=(id,client=A,tenant=TENANT)=>({id,tenant_id:tenant,client_id:client,tracking_number:`LTK${id}`,
  carrier_tracking_number:'EQ000000001PT',carrier_code:'ctt',status:'entrada_rede',created_at:'2026-10-22T10:00:00Z',
  sender_name:'Fixture sender',sender_zip4:'4800',sender_zip3:'001',recipient_name:'Fixture recipient',
  sell_price:4.15,buy_price:3,billing_statement_id:'statement-fixture'})

function harness({ctx={role:'employee',tenant_id:TENANT,client_id:null},rows=[row('a'),row('b',B),row('foreign',A,OTHER_TENANT)],events=[],failure}={}) {
  const db=fakeSupabase({shipments:rows,tracking_events:events},q=>{
    if(q.table==='shipments'&&q.projection!=='*') {
      const unknown=q.projection.split(',').map(s=>s.trim()).find(column=>!nativeColumns.has(column))
      if(unknown)return{code:'42703',message:`column shipments.${unknown} does not exist`}
    }
    return failure?.(q)
  })
  const load=createLoader({
    '@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},
    '@/lib/auth/context':{requireUser:async()=>{if(!ctx)throw Error('LOGIN_REQUIRED');return ctx}},
    '@/lib/services/correos/correos-label-customizer':{},'@/lib/label-utils':{},
  })
  return{db,api:load('lib/services/shipments/shipment-fetcher.ts')}
}
test('native projection loads shipments without requiring display aliases or unapplied optional columns',async()=>{
  const h=harness(),result=await h.api.fetchPaginatedShipments()
  assert.equal(result.total,2);assert.equal(result.data.length,2)
  assert.equal(result.data[0].reference,'LTKa');assert.equal(result.data[0].status,'em_transito')
  assert.equal(result.data[0].ctt_object_id,'EQ000000001PT');assert.equal(result.data[0].carrier_name,'CTT Expresso')
  assert.equal(result.data[0].sender_zip4,'4800');assert.equal(result.data[0].sender_zip3,'001')
  assert.equal(result.data[0].billing_statement_id,'statement-fixture');assert.equal(result.data[0].sell_price,4.15)
  assert.ok(!h.api.SHIPMENT_LIST_COLUMNS.split(',').map(c=>c.trim()).some(c=>['reference','fuel_tax_amount','ctt_label_base64','sender_zip','cost_price'].includes(c)))
})
test('pagination preserves the count and deterministic ordering when creation times tie',async()=>{
  const h=harness({rows:[row('c'),row('a'),row('b'),row('foreign',B,OTHER_TENANT)]})
  const result=await h.api.fetchPaginatedShipments({page:2,pageSize:2})
  assert.deepEqual(result.data.map(s=>s.id),['c']);assert.equal(result.total,3);assert.equal(result.totalPages,2)
  assert.deepEqual(h.db.queries[0].range,[2,3])
})
test('client pagination filters both the company and the signed-in store',async()=>{
  const h=harness({ctx:{role:'client',tenant_id:TENANT,client_id:A}})
  assert.deepEqual((await h.api.fetchPaginatedShipments()).data.map(s=>s.id),['a'])
  assert.ok(h.db.queries.filter(q=>q.table==='shipments').every(q=>q.filters.some(f=>f.field==='tenant_id'&&f.value===TENANT)&&q.filters.some(f=>f.field==='client_id'&&f.value===A)))
})
test('the same native projection works for unpaginated portal and billing lists',async()=>{
  const h=harness({ctx:{role:'client',tenant_id:TENANT,client_id:A}})
  const result=await h.api.fetchShipments({limit:10})
  assert.deepEqual(result.map(s=>s.id),['a']);assert.equal(result[0].reference,'LTKa')
  assert.notEqual(h.db.queries[0].projection,'*')
})
test('status filters remain applied within the company scope',async()=>{
  const h=harness({rows:[row('transit'),{...row('delivered'),status:'entregue'},{...row('foreign',A,OTHER_TENANT),status:'entregue'}]})
  const result=await h.api.fetchPaginatedShipments({status:'Entregues'})
  assert.deepEqual(result.data.map(s=>s.id),['delivered']);assert.equal(result.total,1)
})
for(const ctx of [null,{role:'employee',tenant_id:null},{role:'client',tenant_id:TENANT,client_id:null}]) {
  test(`incomplete session ${JSON.stringify(ctx)} is refused before querying shipments`,async()=>{
    const h=harness({ctx});await assert.rejects(h.api.fetchPaginatedShipments());assert.equal(h.db.queries.length,0);assert.equal(h.db.adminClients,0)
  })
}
test('invalid pagination defaults safely and oversized pages are bounded',async()=>{
  const h=harness()
  const invalid=await h.api.fetchPaginatedShipments({page:-1,pageSize:NaN})
  assert.equal(invalid.page,1);assert.equal(invalid.pageSize,50)
  const large=await h.api.fetchPaginatedShipments({pageSize:1000000});assert.equal(large.pageSize,200)
})
test('an unrelated database failure cannot return data from another tenant or a broader fallback',async()=>{
  const h=harness({failure:()=>({code:'08006',message:'Fixture connection failure'})})
  const result=await h.api.fetchPaginatedShipments()
  assert.equal(result.total,0);assert.deepEqual(result.data,[]);assert.equal(h.db.queries.length,1)
})


test('pickup dates come from the earliest confirmed scan, scoped to the authorized company and page',async()=>{
 const events=[
  {id:'arrival',tenant_id:TENANT,shipment_id:'a',event_code:'EMO',description:'Chegada ao No Cliente',timestamp:'2026-10-22T09:00:00Z'},
  {id:'first',tenant_id:TENANT,shipment_id:'a',event_code:'EMP',timestamp:'2026-10-22T11:00:00Z'},
  {id:'later',tenant_id:TENANT,shipment_id:'a',event_code:'EMP',timestamp:'2026-10-22T15:00:00Z'},
  {id:'foreign',tenant_id:OTHER_TENANT,shipment_id:'a',event_code:'EMP',timestamp:'2026-10-21T08:00:00Z'},
  {id:'store-b',tenant_id:TENANT,shipment_id:'b',event_code:'EMP',timestamp:'2026-10-20T08:00:00Z'},
 ]
 const h=harness({ctx:{role:'client',tenant_id:TENANT,client_id:A},events})
 const result=await h.api.fetchPaginatedShipments()
 assert.equal(result.data[0].picked_up_at,'2026-10-22T11:00:00.000Z')
 const queries=h.db.queries.filter(q=>q.table==='tracking_events')
 assert.equal(queries.length,1)
 assert.ok(queries[0].filters.some(f=>f.field==='tenant_id'&&f.value===TENANT))
 assert.deepEqual(queries[0].filters.find(f=>f.field==='shipment_id').value,['a'])
})
test('an unavailable tracking table leaves the shipment visible with no invented pickup date',async()=>{
 const h=harness({failure:q=>q.table==='tracking_events'?{message:'Fixture read failed'}:null})
 const result=await h.api.fetchPaginatedShipments()
 assert.equal(result.data.length,2);assert.equal(result.data[0].picked_up_at,null)
})
const pickup=createLoader({})('lib/services/shipments/shipment-pickup-dates.ts')
test('collection recognition excludes label creation, customer-node arrival and failed pickup requests',()=>{
 for(const description of ['Envio criado','Chegada ao Nó Cliente','Recolha não efetuada','Não recolhido','Recogida solicitada','Recogida fallida','Pendente de recolha']) {
  assert.equal(pickup.confirmedPickupTimestamp({shipment_id:'a',description,timestamp:'2026-10-22T10:00:00Z'}),null,description)
 }
 assert.equal(pickup.confirmedPickupTimestamp({shipment_id:'a',event_code:'EMP',timestamp:'invalid'}),null)
})
test('explicit collection confirmations from CTT and Correos are supported',()=>{
 for(const description of ['Recolha Efetuada (Braga)','Recolhido','Recogido (Madrid)','Recogida realizada']) {
  assert.equal(pickup.confirmedPickupTimestamp({shipment_id:'a',description,timestamp:'2026-10-22T10:00:00Z'}),'2026-10-22T10:00:00.000Z')
 }
})
test('pickup display uses Lisbon date/time instead of the server timezone and handles missing dates',()=>{
 assert.deepEqual(pickup.pickupDateDisplay('2026-10-22T23:30:00Z'),{date:'23/10/2026',time:'00:30'})
 assert.equal(pickup.pickupDateDisplay(null),null);assert.equal(pickup.pickupDateDisplay('invalid'),null)
})
