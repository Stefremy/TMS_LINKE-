const {seedCodReleases}=require('./helpers/cod-releases.cjs')
const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs'),{fakeSupabase}=require('./helpers/fake-supabase.cjs')
const load=createLoader({'node:crypto':require('node:crypto')})
const service=load('lib/services/reembolsos/client-cod-payout.ts'),workflow=load('lib/services/reembolsos/ops-cod-workflow.ts')
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',T='tenant'
const staff={tenant_id:T,role:'employee',permissions:['Faturação & Contas Correntes'],user:{id:'finance'}},client={tenant_id:T,role:'client',client_id:A,user:{id:A}}
function fixture(){
 const tables={clients:[{id:A,tenant_id:T,name:'Loja A'},{id:B,tenant_id:T,name:'Loja B'},{id:'foreign',tenant_id:'other',name:'PRIVATE'}],shipments:[],audit_log:[]}
 function add(id,owner,status,amount,confirmed){
  tables.shipments.push({id,client_id:owner,tenant_id:T,tracking_number:`TRACK-${id}`,status,created_at:'2026-10-29'})
  tables.audit_log.push({id:`snapshot-${id}`,tenant_id:T,action:'shipment_data',created_at:'2026-10-29',details:{id,client_id:owner,cod_value:amount}})
  if(confirmed)tables.audit_log.push({id:`batch-${id}`,tenant_id:T,action:'reembolso_batch',created_at:'2026-10-30',details:{carrier:'ctt',filename:`${id}.xls`,items:[],clientSummaries:[{clientId:owner,isPaid:false,items:[{clientId:owner,shipmentId:id,carrierTracking:`TRACK-${id}`,processingDate:'30/10/2026',amount,reconcileStatus:'matched'}]}]}})
 }
 add('awaiting',A,'entregue',20,false);add('available',A,'entregue',10,true);add('new',A,'criado',5,false);add('other',B,'entregue',30,true)
 seedCodReleases(tables,T,[{clientId:A,id:'available',tracking:'TRACK-available',cents:1000},{clientId:B,id:'other',tracking:'TRACK-other',cents:3000}])
 const db=fakeSupabase(tables,undefined,{persistInserts:true})
 return{tables,db}
}
test('bulk management separates delivered collections, unconfirmed money and per-store available balances without foreign data',async()=>{
 const h=fixture()
 h.tables.audit_log.push({id:'missing',tenant_id:T,action:'reembolso_batch',created_at:'2026-10-30',details:{filename:'legacy.xls',carrier:'ctt',clientSummaries:[],items:[{trackingNotFound:true,carrierTracking:'OLD-GUIDE',amount:12.34,lineNumber:4}]}})
 const data=await workflow.loadOpsCodWorkflow(h.db.client,T)
 assert.equal(data.rows.filter(r=>r.delivered).length,3)
 assert.deepEqual(data.rows.filter(r=>r.delivered&&r.state==='unconfirmed').map(r=>r.id),['awaiting'])
 assert.equal(data.clients.find(c=>c.id===A).availableCents,1000)
 assert.equal(data.clients.find(c=>c.id===B).availableCents,3000)
 assert.deepEqual(data.missing,[{tracking:'OLD-GUIDE',amountCents:1234,filename:'legacy.xls',lineNumber:4,reason:'Guia não encontrada no TMS.'}])
 assert.doesNotMatch(JSON.stringify(data),/PRIVATE/)
 assert.equal(h.db.writes.length,0)
 for(const query of h.db.queries)assert.ok(query.filters.some(f=>f.field==='tenant_id'&&f.value===T))
})
test('recording precisely one requested payment updates the portal to paid, clears pending balance, and leaves another shop untouched',async()=>{
 const h=fixture(),request=await service.requestClientCodPayout(h.db.client,client,A)
 assert.equal((await service.loadClientCodPage(h.db.client,T,A)).payout.pendingCents,1000)
 await service.recordCodRequestPayment(h.db.client,staff,A,request.requestId,'TRANSFER-123')
 const portal=await service.loadClientCodPage(h.db.client,T,A)
 assert.equal(portal.payout.availableCents,0);assert.equal(portal.payout.pendingCents,0);assert.equal(portal.payout.history[0].state,'paid')
 assert.equal(portal.rows.find(r=>r.id==='available').state,'paid');assert.equal(portal.rows.find(r=>r.id==='available').paymentRef,'TRANSFER-123')
 assert.equal((await service.loadClientCodPage(h.db.client,T,B)).payout.availableCents,3000)
 assert.equal((await service.recordCodRequestPayment(h.db.client,staff,A,request.requestId,'RETRY')).alreadyPaid,true)
 const dashboard=await workflow.loadOpsCodWorkflow(h.db.client,T)
 assert.equal(dashboard.clients.find(c=>c.id===A).paidCents,1000)
 assert.equal(dashboard.requests[0].state,'paid')
 assert.equal(h.tables.audit_log.find(r=>r.id==='batch-available').details.clientSummaries[0].isPaid,false)
 assert.equal(h.db.writes.filter(w=>w.kind==='update').length,2)
})
test('open disputes withhold funds, block payment of pending requests, and resolving never marks an unconfirmed guide paid',async()=>{
 const h=fixture(),request=await service.requestClientCodPayout(h.db.client,client,A)
 await service.setCodDispute(h.db.client,staff,A,'available','Cliente contesta a cobrança')
 let portal=await service.loadClientCodPage(h.db.client,T,A)
 assert.equal(portal.payout.history[0].state,'review');assert.equal(portal.payout.availableCents,0)
 await assert.rejects(service.recordCodRequestPayment(h.db.client,staff,A,request.requestId,'transfer'),/divergências/)
 await service.setCodDispute(h.db.client,staff,A,'available',null)
 portal=await service.loadClientCodPage(h.db.client,T,A)
 assert.equal(portal.payout.history[0].state,'requested')
 await service.recordCodRequestPayment(h.db.client,staff,A,request.requestId,'transfer')
 await assert.rejects(service.setCodDispute(h.db.client,staff,A,'available','Already paid'),/já está marcado/)
 await service.setCodDispute(h.db.client,staff,A,'awaiting','Sem devolução CTT')
 await service.setCodDispute(h.db.client,staff,A,'awaiting',null)
 portal=await service.loadClientCodPage(h.db.client,T,A)
 assert.equal(portal.rows.find(r=>r.id==='awaiting').state,'unconfirmed')
 assert.equal(portal.payout.availableCents,0)
})
test('dispute-only mailboxes survive later payout requests and do not expose another store or allow client-side payment recording',async()=>{
 const h=fixture()
 await assert.rejects(service.recordCodRequestPayment(h.db.client,client,A,'x','ref'),/negado/)
 await assert.rejects(service.setCodDispute(h.db.client,client,A,'available','reason'),/negado/)
 assert.equal(h.db.queries.length,0)
 await assert.rejects(service.setCodDispute(h.db.client,staff,A,'other','wrong shop'),/não encontrada/)
 await service.setCodDispute(h.db.client,staff,A,'awaiting','A conferir')
 await service.requestClientCodPayout(h.db.client,client,A)
 const box=await service.readCodPayoutBox(h.db.client,T,A)
 assert.equal(box.disputes[0].reason,'A conferir');assert.equal(box.requests.length,1)
 await assert.rejects(service.recordCodRequestPayment(h.db.client,{...staff,tenant_id:'other'},A,box.requests[0].id,'ref'),/não encontrado/)
})
test('divergent source values block a payment and simultaneous confirmations cannot commit twice',async()=>{
 const h=fixture(),request=await service.requestClientCodPayout(h.db.client,client,A)
 const item=h.tables.audit_log.find(r=>r.id==='batch-available').details.clientSummaries[0].items[0]
 item.amount=9
 await assert.rejects(service.recordCodRequestPayment(h.db.client,staff,A,request.requestId,'ref'),/divergências/)
 item.amount=10
 const results=await Promise.allSettled([service.recordCodRequestPayment(h.db.client,staff,A,request.requestId,'ref1'),service.recordCodRequestPayment(h.db.client,staff,A,request.requestId,'ref2')])
 assert.ok(results.some(r=>r.status==='fulfilled'))
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
 assert.equal(results.filter(r=>r.status==='rejected').length,1)
 assert.equal((await service.loadClientCodPage(h.db.client,T,A)).payout.pendingCents,0)
})

test('workspace shows delivered collections, groups available money by shop, and requires explicit payment confirmation with a reference',async()=>{
 const h=fixture(),request=await service.requestClientCodPayout(h.db.client,client,A),data=await workflow.loadOpsCodWorkflow(h.db.client,T)
 const jsx=(type,props)=>({type,props:props||{}}),flat=n=>Array.isArray(n)?n.flatMap(flat):n&&typeof n==='object'?[n,...flat(n.props.children)]:[],text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props.children):String(n??'')
 let cursor=0;const slots=[],calls=[]
 const React={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]}}
 const view=createLoader({'react':React,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useRouter:()=>({refresh(){}})},'./ReembolsosClient':{default:'excel'},'@/app/actions/ops-client-cod':{prepareOpsCodPaymentAction:async()=>{},setOpsCodDisputeAction:async()=>{},recordOpsCodPaymentAction:async(...args)=>{calls.push(args)}}})('app/ops/tesouraria/reembolsos/ReembolsosWorkspace.tsx').ReembolsosWorkspace
 const render=()=>{cursor=0;return view({data,error:'',batches:[],initialPeriod:{from:'2026-10-01',to:'2026-10-31'}})}
 const click=label=>flat(render()).find(n=>n.type==='button'&&text(n).startsWith(label)).props.onClick()
 assert.match(text(render()),/TRACK-awaiting/);assert.doesNotMatch(text(render()),/TRACK-new/)
 click('Disponível para solicitar')
 assert.match(text(render()),/TRACK-other/);assert.doesNotMatch(text(flat(render()).find(n=>n.type==='tbody')),/TRACK-available/)
 click('Solicitados');click('Registar pagamento')
 let dialog=flat(render()).find(n=>n.props.role==='dialog')
 assert.ok(dialog);assert.equal(calls.length,0)
 assert.equal(flat(dialog).find(n=>n.type==='button'&&text(n)==='Confirmar pagamento efetuado').props.disabled,true)
 flat(dialog).find(n=>n.type==='input'&&n.props.maxLength===160).props.onChange({target:{value:'BANK-REFERENCE'}})
 flat(dialog).find(n=>n.type==='input'&&n.props.type==='date').props.onChange({target:{value:''}})
 assert.equal(flat(render()).find(n=>n.type==='button'&&text(n)==='Confirmar pagamento efetuado').props.disabled,true)
 flat(render()).find(n=>n.type==='input'&&n.props.type==='date').props.onChange({target:{value:'2026-10-29'}})
 dialog=flat(render()).find(n=>n.props.role==='dialog')
 await flat(dialog).find(n=>n.type==='button'&&text(n)==='Confirmar pagamento efetuado').props.onClick()
 assert.deepEqual(calls,[[A,request.requestId,'BANK-REFERENCE','2026-10-29']])
 assert.equal(flat(render()).some(n=>n.props.role==='dialog'),false)
})

test('the selected payment day is preserved in the ledger, portal, OPS and receipt separately from the recording timestamp',async()=>{
 const h=fixture(),request=await service.requestClientCodPayout(h.db.client,client,A,['available'])
 await service.recordCodRequestPayment(h.db.client,staff,A,request.requestId,'TRANSFER-BACKDATED','2026-10-29')
 const box=await service.readCodPayoutBox(h.db.client,T,A),saved=box.requests.find(r=>r.id===request.requestId)
 assert.equal(saved.paidAt,'2026-10-29');assert.match(saved.paidRecordedAt,/^\d{4}-\d{2}-\d{2}T/);assert.equal(saved.paidBy,staff.user.id)
 const portal=await service.loadClientCodPage(h.db.client,T,A)
 assert.equal(portal.payout.history[0].paidAt,'2026-10-29');assert.equal(portal.rows.find(r=>r.id==='available').paidAt,'2026-10-29')
 const dashboard=await workflow.loadOpsCodWorkflow(h.db.client,T)
 assert.equal(dashboard.requests[0].paidAt,'2026-10-29')
 const receipt=await load('lib/services/reembolsos/reembolso-receipt-data.ts').loadCodReceiptData(h.db.client,T,A,request.requestId)
 assert.equal(receipt.paidAt,'2026-10-29')
 const timestamp=saved.paidRecordedAt
 await service.recordCodRequestPayment(h.db.client,staff,A,request.requestId,'RETRY','2026-10-28')
 const repeated=(await service.readCodPayoutBox(h.db.client,T,A)).requests[0]
 assert.equal(repeated.paidAt,'2026-10-29');assert.equal(repeated.paidRecordedAt,timestamp)
})
test('blank, impossible and future payment dates are rejected before database reads, including missing dates on the public action',async()=>{
 const h=fixture()
 for(const day of ['', '2026-02-30','30/10/2026','2999-01-01']) await assert.rejects(service.recordCodRequestPayment(h.db.client,staff,A,'unused','ref',day),/data de pagamento válida/)
 assert.equal(h.db.queries.length,0)
 const api=createLoader({'node:crypto':require('node:crypto'),'next/cache':{revalidatePath(){}},'@/lib/auth/context':{requirePermission:async()=>staff},'@/lib/supabase/server':{createAdminClient:()=>h.db.client}})('app/actions/ops-client-cod.ts')
 await assert.rejects(api.recordOpsCodPaymentAction(A,'unused','ref'),/data de pagamento válida/)
 assert.equal(h.db.queries.length,0);assert.equal(h.db.writes.length,0)
})
