const {seedCodReleases}=require('./helpers/cod-releases.cjs')
const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs'),{fakeSupabase}=require('./helpers/fake-supabase.cjs')
const load=createLoader({'node:crypto':require('node:crypto')})
const model=load('lib/services/reembolsos/client-cod.ts')
const payout=load('lib/services/reembolsos/client-cod-payout.ts')
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',T='tenant'
const ctx={tenant_id:T,role:'client',user:{id:'actor'},client_id:A}
function fixture(){const t={clients:[{id:A,name:'Own Store',tenant_id:T}],shipments:[{id:'one',client_id:A,tenant_id:T,tracking_number:'OWN-ONE',status:'entregue',created_at:'2026-10-30'}],audit_log:[
 {id:'snapshot',tenant_id:T,action:'shipment_data',created_at:'2026-10-30',details:{id:'one',client_id:A,cod_value:10}},
 {id:'batch',tenant_id:T,action:'reembolso_batch',created_at:'2026-10-30',details:{carrier:'ctt',clientSummaries:[{clientId:A,isPaid:false,items:[{clientId:A,shipmentId:'one',carrierTracking:'OWN-ONE',processingDate:'31/10/2026',amount:10,reconcileStatus:'matched'}]}]}}
]};seedCodReleases(t,T,[{clientId:A,id:'one',tracking:'OWN-ONE',cents:1000}]);return t}
test('monthly defaults cover the full Lisbon calendar month, including leap years',()=>{
 assert.deepEqual(model.currentCodMonth('2026-10-30'),{from:'2026-10-01',to:'2026-10-31'})
 assert.equal(model.currentCodMonth('2024-02-20').to,'2024-02-29')
 assert.equal(model.currentCodMonth('2026-12-31').to,'2026-12-31')
})
test('receivable requires matched CTT evidence, excludes paid/unknown/other carriers and is independent of the collections date range',async()=>{
 const t=fixture(),db=fakeSupabase(t,undefined,{persistInserts:true})
 const current=await payout.loadClientCodPage(db.client,T,A)
 assert.equal(current.payout.availableCents,1000)
 t.audit_log[1].details.carrier='correos'
 assert.equal((await payout.loadClientCodPage(db.client,T,A)).payout.availableCents,0)
 t.audit_log[1].details.carrier='ctt';t.audit_log[1].details.clientSummaries[0].isPaid=true
 assert.equal((await payout.loadClientCodPage(db.client,T,A)).payout.availableCents,0)
 t.audit_log=t.audit_log.filter(r=>r.action!=='reembolso_batch')
 assert.equal((await payout.loadClientCodPage(db.client,T,A)).payout.availableCents,0)
 assert.equal(db.writes.length,0)
})
test('simultaneous clicks create one own-client request for the server-calculated balance, with no payment or email',async()=>{
 const t=fixture(),db=fakeSupabase(t,undefined,{persistInserts:true})
 const results=await Promise.all([payout.requestClientCodPayout(db.client,ctx,A),payout.requestClientCodPayout(db.client,ctx,A)])
 assert.ok(results.every(r=>r.success));assert.equal(results[0].requestId,results[1].requestId)
 const boxes=t.audit_log.filter(r=>r.action==='client_cod_payout_requests')
 assert.equal(boxes.length,1);assert.equal(boxes[0].details.requests.length,1)
 assert.equal(boxes[0].details.requests[0].amountCents,1000)
 assert.deepEqual(boxes[0].details.requests[0].shipmentIds,['one'])
 const current=await payout.loadClientCodPage(db.client,T,A)
 assert.equal(current.payout.availableCents,0);assert.equal(current.payout.pendingCents,1000)
 assert.equal(current.payout.history[0].state,'requested')
 const inbox=await payout.loadCodPayoutInbox(db.client,T)
 assert.equal(inbox.length,1);assert.equal(inbox[0].clientName,'Own Store');assert.deepEqual(inbox[0].tracking,['OWN-ONE'])
})
test('an existing pending request is not duplicated; another request can be made only after its CTT items are recorded paid',async()=>{
 const t=fixture(),db=fakeSupabase(t,undefined,{persistInserts:true})
 await payout.requestClientCodPayout(db.client,ctx,A)
 assert.equal((await payout.requestClientCodPayout(db.client,ctx,A)).alreadyRequested,true)
 t.audit_log.find(r=>r.id==='batch').details.clientSummaries[0].isPaid=true
 assert.equal((await payout.loadClientCodPage(db.client,T,A)).payout.history[0].state,'paid')
 t.shipments.push({id:'two',client_id:A,tenant_id:T,tracking_number:'OWN-TWO',status:'entregue',created_at:'2026-10-31'})
 t.audit_log.push({id:'snapshot-two',tenant_id:T,action:'shipment_data',created_at:'2026-10-31',details:{id:'two',client_id:A,cod_value:20}},
 {id:'batch-two',tenant_id:T,action:'reembolso_batch',created_at:'2026-10-31',details:{carrier:'ctt',clientSummaries:[{clientId:A,isPaid:false,items:[{clientId:A,shipmentId:'two',carrierTracking:'OWN-TWO',processingDate:'31/10/2026',amount:20,reconcileStatus:'matched'}]}]}})
 seedCodReleases(t,T,[{clientId:A,id:'two',tracking:'OWN-TWO',cents:2000}])
 await payout.requestClientCodPayout(db.client,ctx,A)
 const current=await payout.loadClientCodPage(db.client,T,A)
 assert.equal(current.payout.history.length,2);assert.equal(current.payout.pendingCents,2000)
 assert.deepEqual(current.payout.history[1].shipmentIds,['two'])
})
test('another tenant/client, mismatched source or unconfirmed money cannot produce a request',async()=>{
 const t=fixture(),db=fakeSupabase(t,undefined,{persistInserts:true})
 await assert.rejects(payout.requestClientCodPayout(db.client,ctx,B),/negado/)
 await assert.rejects(payout.requestClientCodPayout(db.client,{...ctx,tenant_id:'other'},A),/não encontrado/)
 t.audit_log[0].details.client_id=B
 await assert.rejects(payout.requestClientCodPayout(db.client,ctx,A),/não existem valores/)
 t.audit_log[0].details.client_id=A;t.audit_log[1].details.clientSummaries[0].items[0].amount=99
 await assert.rejects(payout.requestClientCodPayout(db.client,ctx,A),/não existem valores/)
 assert.equal(db.writes.length,0)
})

test('the public request action rejects a forged client before reads and blocks staff without finance permission',async()=>{
 const t=fixture(),db=fakeSupabase(t,undefined,{persistInserts:true})
 const action=createLoader({'node:crypto':require('node:crypto'),'@/lib/auth/context':{requireClientAccess:async client=>{if(client!==A)throw Error('Forbidden');return ctx}},'@/lib/supabase/server':{createAdminClient:()=>db.client},'next/cache':{revalidatePath(){}}})('app/actions/client-reembolsos.ts').solicitarReembolsoAction
 await assert.rejects(action(B),/Forbidden/);assert.equal(db.queries.length,0)
 await assert.rejects(payout.requestClientCodPayout(db.client,{...ctx,role:'employee',permissions:[]},A),/negado/)
 assert.equal(db.writes.length,0)
 const result=await action(A,['one'])
 assert.equal(result.success,true)
})

test('a lost database response after committing a request remains recoverable without creating another request',async()=>{
 const t=fixture(),db=fakeSupabase(t,undefined,{persistInserts:true})
 const from=db.client.from;let lost=false
 db.client.from=table=>{const q=from(table),insert=q.update
  q.update=value=>{insert(value);if(table==='audit_log'&&value.details?.requests?.length>0&&!lost){lost=true;const then=q.then;q.then=(resolve,reject)=>then(result=>result.error?result:{data:null,error:{message:'lost response'}}).then(resolve,reject)}return q};return q}
 await assert.rejects(payout.requestClientCodPayout(db.client,ctx,A),/pedido mudou/)
 const recovered=await payout.requestClientCodPayout(db.client,ctx,A)
 assert.equal(recovered.success,true);assert.equal(recovered.alreadyRequested,true)
 assert.equal(t.audit_log.filter(r=>r.action==='client_cod_payout_requests').length,1)
 assert.equal(t.audit_log.find(r=>r.action==='client_cod_payout_requests').details.requests.length,1)
})

test('a carrier statement pointing to a different tracking code cannot fund a payout request',async()=>{
 const t=fixture(),db=fakeSupabase(t,undefined,{persistInserts:true})
 t.audit_log[1].details.clientSummaries[0].items[0].carrierTracking='ANOTHER-STORE-TRACKING'
 const view=await payout.loadClientCodPage(db.client,T,A)
 assert.equal(view.rows[0].state,'review');assert.equal(view.payout.availableCents,0)
 await assert.rejects(payout.requestClientCodPayout(db.client,ctx,A),/não existem valores/)
 assert.equal(db.writes.length,0)
})
