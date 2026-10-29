const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const pure=createLoader({})('lib/services/shipments/shipment-list-filters.ts')
const {EMPTY_SHIPMENT_FILTERS:empty,matchesShipmentListFilters:match,shipmentFiltersError,shipmentListQuery,readShipmentListFilters}=pure
const row={id:'a',service_type:'Guia DD',carrier_code:'ctt',status:'em_transito',recipient_country:'PT',recipient_postal:'4000-001',created_at:'2026-10-28T23:30:00Z',updated_at:'2026-10-29T10:00:00Z',picked_up_at:'2026-10-29T09:00:00Z',is_return:false,recipient_name:'Álvaro',driver_id:'d1',driver_name:'João'}
test('all filters intersect, support carrier exclusion, and keep missing-driver and return types distinct',()=>{
 assert.equal(match(row,{...empty,service:'Guia DD',carrier:'ctt',context:'mainland',type:'shipment',driver:'d1'}),true)
 for(const filters of [{service:'Guia DB'},{carrier:'ctt',carrierOp:'neq'},{context:'islands'},{type:'return'},{driver:'d2'}])assert.equal(match(row,{...empty,...filters}),false)
 assert.equal(match({...row,driver_id:undefined,driver_name:undefined},{...empty,driver:'__none__'}),true)
 assert.equal(match({...row,recipient_country:'ES',recipient_postal:'07001'},{...empty,context:'spain'}),true)
 assert.equal(match({...row,recipient_country:'BE',is_return:true},{...empty,context:'international',type:'return'}),true)
 assert.equal(match(row,empty,'alvaro','Em Trânsito'),true)
 assert.equal(match(row,empty,'alvaro','Entregue'),false)
})
test('date ranges are inclusive in Lisbon, use the selected field, and never treat label creation as collection',()=>{
 assert.equal(match(row,{...empty,dateFrom:'2026-10-29',dateTo:'2026-10-29'}),true)
 assert.equal(match({...row,picked_up_at:null},{...empty,dateFrom:'2026-10-29'}),false)
 // Portugal summer time: 23:30 UTC belongs to the next calendar day in Lisbon.
 assert.equal(match({...row,created_at:'2026-07-01T23:30:00Z'},{...empty,dateField:'created',dateFrom:'2026-07-02',dateTo:'2026-07-02'}),true)
 assert.equal(match(row,{...empty,dateField:'created',dateFrom:'2026-10-29'}),false)
 assert.equal(match(row,{...empty,dateField:'updated',dateTo:'2026-10-29'}),true)
 assert.ok(shipmentFiltersError({...empty,dateFrom:'2026-10-30',dateTo:'2026-10-29'}))
 assert.ok(shipmentFiltersError({...empty,dateFrom:'2026-02-30'}))
})
test('query roundtrip preserves all active filters and resets page without losing zeroes or accented values',()=>{
 const filters={...empty,dateField:'created',dateFrom:'2026-10-01',dateTo:'2026-10-29',service:'Guia DD · Ilhas',carrier:'ctt',carrierOp:'neq',context:'islands',type:'return',driver:'d1'}
 const query=shipmentListQuery(filters,'CE123PT','Entregue')
 assert.deepEqual(readShipmentListFilters(Object.fromEntries(new URLSearchParams(query))),filters)
 assert.equal(new URLSearchParams(query).has('page'),false)
})
const TENANT='t1',CLIENT='c1'
function harness({rows=[],snapshots=[],events=[],ctx={tenant_id:TENANT,role:'employee'},failure}={}){
 const db=fakeSupabase({shipments:rows,audit_log:snapshots,tracking_events:events},failure)
 const load=createLoader({
  '@/lib/supabase/server':{createAdminClient:()=>db.client},'@/lib/auth/context':{requireUser:async()=>ctx},
  './shipment-fetcher':{SHIPMENT_LIST_COLUMNS:'id,tenant_id,client_id,service_type,carrier_code,status,created_at,updated_at,recipient_name,tracking_number'},
  './shipment-parcel-summaries':{loadShipmentParcelSummaries:async()=>new Map()},
 })
 return{db,load:load('lib/services/shipments/filtered-shipment-list.ts').loadFilteredShipmentPage}
}
const native=(id,extra={})=>({id,tenant_id:TENANT,client_id:CLIENT,service_type:'DD',status:'pendente',created_at:'2026-10-29T10:00:00Z',carrier_code:'ctt',...extra})
const snapshot=(id,details,tenant=TENANT)=>({id:`audit-${id}`,tenant_id:tenant,action:'shipment_data',created_at:'2026-10-29T10:00:00Z',details:{id,...details}})
test('global filtering reaches later database batches and happens before pagination with exact totals and complete facets',async()=>{
 const rows=Array.from({length:1005},(_,i)=>native(String(i).padStart(4,'0'),{service_type:i<1000?'DD':'DB'}))
 const h=harness({rows})
 const result=await h.load({page:2,pageSize:2,filters:{...empty,service:'DB'}})
 assert.equal(result.total,5);assert.equal(result.totalPages,3)
 assert.deepEqual(result.data.map(s=>s.id),['1002','1003'])
 assert.deepEqual(result.facets.services,['DB','DD'])
 const nativeReads=h.db.queries.filter(q=>q.table==='shipments')
 assert.deepEqual(nativeReads.map(q=>q.range),[[0,999],[1000,1999]])
 assert.ok(nativeReads.every(q=>q.filters.some(f=>f.field==='tenant_id'&&f.value===TENANT)))
})
test('metadata is scoped to authorized rows; newest snapshot wins and PDFs are not requested',async()=>{
 const h=harness({ctx:{tenant_id:TENANT,role:'client',client_id:CLIENT},rows:[native('a'),native('other-client',{client_id:'c2'}),native('foreign',{tenant_id:'t2'})],snapshots:[
  {...snapshot('a',{recipient_country:'PT',recipient_postal:'9000-001',is_return:true}),created_at:'2026-10-29T11:00:00Z'},
  snapshot('a',{recipient_country:'BE',is_return:false}),snapshot('a',{recipient_country:'ES'},'t2'),snapshot('other-client',{recipient_country:'ES'}),
 ]})
 const result=await h.load({filters:{...empty,context:'islands',type:'return'}})
 assert.deepEqual(result.data.map(s=>s.id),['a'])
 for(const q of h.db.queries.filter(q=>q.table==='audit_log')){
  assert.ok(q.filters.some(f=>f.field==='tenant_id'&&f.value===TENANT))
  assert.ok(q.filters.some(f=>f.field==='details->>id'&&f.value.length===1&&f.value[0]==='a'))
  assert.doesNotMatch(q.projection,/ctt_label|base64|credentials|\*/)
 }
})
test('pickup filtering uses the earliest confirmed collection, not arrival scans or a later duplicate',async()=>{
 const h=harness({rows:[native('a'),native('b'),native('c')],events:[
  {id:'arrival',tenant_id:TENANT,shipment_id:'a',event_code:'EMO',timestamp:'2026-10-29T10:00:00Z'},
  {id:'first',tenant_id:TENANT,shipment_id:'b',event_code:'EMP',timestamp:'2026-10-28T10:00:00Z'},
  {id:'again',tenant_id:TENANT,shipment_id:'b',event_code:'EMP',timestamp:'2026-10-29T10:00:00Z'},
  {id:'ok',tenant_id:TENANT,shipment_id:'c',event_code:'EMP',timestamp:'2026-10-29T10:00:00Z'},
 ]})
 const result=await h.load({filters:{...empty,dateFrom:'2026-10-29',dateTo:'2026-10-29'}})
 assert.deepEqual(result.data.map(s=>s.id),['c'])
 assert.equal(result.total,1)
})
test('invalid ranges return a clear error; database failures cannot silently broaden or partially return the results',async()=>{
 const h=harness({rows:[native('a')]})
 const invalid=await h.load({filters:{...empty,dateFrom:'2026-10-30',dateTo:'2026-10-29'}})
 assert.equal(invalid.total,0);assert.match(invalid.filterError,/posterior/)
 const failed=harness({rows:[native('a')],failure:q=>q.table==='audit_log'?{message:'offline'}:null})
 await assert.rejects(failed.load(),/Não foi possível/)
})

test('legacy Correos shipments use the same carrier identity as the displayed list',()=>{
 for(const legacy of [{carrier_code:undefined,service_type:'Correos Paq 24'},{carrier_code:undefined,tracking_number:'1234567890123456'},{carrier_code:'correos_express'}]){
  assert.equal(match({...row,...legacy},{...empty,carrier:'correos'}),true)
  assert.equal(match({...row,...legacy},{...empty,carrier:'ctt'}),false)
 }
})
