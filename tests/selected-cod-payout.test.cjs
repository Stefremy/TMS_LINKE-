const {seedCodReleases}=require('./helpers/cod-releases.cjs')
const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs'),{fakeSupabase}=require('./helpers/fake-supabase.cjs')
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',T='tenant'
const customer={tenant_id:T,role:'client',client_id:A,user:{id:A}},finance={tenant_id:T,role:'admin',user:{id:'finance'}}
function fixture(approved=true){
 const tables={clients:[{id:A,name:'Store A',tenant_id:T},{id:B,name:'Store B',tenant_id:T}],shipments:[],audit_log:[]}
 for(const [id,owner,value,confirmed] of [['one',A,10,true],['two',A,20,true],['three',A,30,true],['foreign',B,99,true],['unconfirmed',A,40,false]]){
  tables.shipments.push({id,client_id:owner,tenant_id:T,tracking_number:`TRACK-${id}`,status:'entregue',created_at:'2026-10-29'})
  tables.audit_log.push({id:`s-${id}`,tenant_id:T,action:'shipment_data',created_at:'2026-10-29',details:{id,client_id:owner,cod_value:value}})
  if(confirmed)tables.audit_log.push({id:`b-${id}`,tenant_id:T,action:'reembolso_batch',created_at:'2026-10-30',details:{carrier:'ctt',clientSummaries:[{clientId:owner,isPaid:false,items:[{shipmentId:id,clientId:owner,carrierTracking:`TRACK-${id}`,processingDate:'30/10/2026',amount:value,reconcileStatus:'matched'}]}]}})
 }
 if(approved)seedCodReleases(tables,T,[['one',A,1000],['two',A,2000],['three',A,3000],['foreign',B,9900]].map(([id,clientId,cents])=>({id,clientId,cents,tracking:`TRACK-${id}`})))
 const db=fakeSupabase(tables,undefined,{persistInserts:true}),load=createLoader({'node:crypto':require('node:crypto')})
 return{tables,db,load,payout:load('lib/services/reembolsos/client-cod-payout.ts'),workflow:load('lib/services/reembolsos/ops-cod-workflow.ts')}
}
test('selected guides form independent immutable requests, leaving unselected funds available even with another pending request',async()=>{
 const h=fixture(),first=await h.payout.requestClientCodPayout(h.db.client,customer,A,['two'])
 let portal=await h.payout.loadClientCodPage(h.db.client,T,A)
 assert.equal(portal.payout.availableCents,4000);assert.equal(portal.payout.pendingCents,2000)
 const second=await h.payout.requestClientCodPayout(h.db.client,customer,A,['one'])
 assert.notEqual(first.requestId,second.requestId)
 const receipt=await h.load('lib/services/reembolsos/reembolso-receipt-data.ts').loadCodReceiptData(h.db.client,T,A,first.requestId)
 assert.equal(receipt.amountCents,2000);assert.deepEqual(receipt.items.map(i=>i.shipmentId),['two'])
 portal=await h.payout.loadClientCodPage(h.db.client,T,A)
 assert.equal(portal.payout.availableCents,3000);assert.equal(portal.payout.pendingCents,3000);assert.equal(portal.payout.history.length,2)
 const dashboard=await h.workflow.loadOpsCodWorkflow(h.db.client,T)
 assert.deepEqual(dashboard.requests.map(r=>[r.clientId,r.shipmentIds.length,r.amountCents]).sort((a,b)=>a[2]-b[2]),[[A,1,1000],[A,1,2000]])
 await h.payout.recordCodRequestPayment(h.db.client,finance,A,first.requestId,'TRANSFER-ONE')
 portal=await h.payout.loadClientCodPage(h.db.client,T,A)
 assert.equal(portal.payout.history.find(r=>r.id===first.requestId).state,'paid')
 assert.equal(portal.payout.history.find(r=>r.id===second.requestId).state,'requested')
 assert.equal(portal.payout.availableCents,3000);assert.equal(portal.payout.pendingCents,1000)
 assert.equal((await h.payout.requestClientCodPayout(h.db.client,customer,A,['two'])).requestId,first.requestId)
 assert.equal((await h.payout.loadClientCodPage(h.db.client,T,B)).payout.availableCents,9900)
})
test('empty, duplicate, foreign, unconfirmed and partially reserved selections fail entirely without reserving the other guides',async()=>{
 const h=fixture()
 for(const ids of [[],['one','one'],['foreign'],['unconfirmed'],['one','foreign']]) await assert.rejects(h.payout.requestClientCodPayout(h.db.client,customer,A,ids),/Selecione|não estão disponíveis/)
 assert.equal(h.db.writes.length,0)
 await h.payout.requestClientCodPayout(h.db.client,customer,A,['one'])
 await assert.rejects(h.payout.requestClientCodPayout(h.db.client,customer,A,['one','two']),/não estão disponíveis/)
 const portal=await h.payout.loadClientCodPage(h.db.client,T,A)
 assert.deepEqual(portal.payout.eligible.map(r=>r.id).sort(),['three','two'])
 assert.equal(portal.payout.history.length,1)
})
test('simultaneous identical selections return the same request and simultaneous different selections never return the wrong request',async()=>{
 const h=fixture(),same=await Promise.all([h.payout.requestClientCodPayout(h.db.client,customer,A,['one']),h.payout.requestClientCodPayout(h.db.client,customer,A,['one'])])
 assert.equal(same[0].requestId,same[1].requestId)
 const h2=fixture(),different=await Promise.allSettled([h2.payout.requestClientCodPayout(h2.db.client,customer,A,['one']),h2.payout.requestClientCodPayout(h2.db.client,customer,A,['two'])])
 assert.equal(different.filter(r=>r.status==='fulfilled').length,1)
 assert.equal(different.filter(r=>r.status==='rejected').length,1)
 const box=await h2.payout.readCodPayoutBox(h2.db.client,T,A)
 const remaining=box.requests[0].shipmentIds[0]==='one'?'two':'one'
 await h2.payout.requestClientCodPayout(h2.db.client,customer,A,[remaining])
 assert.equal((await h2.payout.readCodPayoutBox(h2.db.client,T,A)).requests.length,2)
})
test('the portal action requires explicit guide selection and never turns a missing selection into a request for the full balance',async()=>{
 const h=fixture()
 const api=createLoader({'node:crypto':require('node:crypto'),'next/cache':{revalidatePath(){}},'@/lib/auth/context':{requireClientAccess:async id=>{if(id!==A)throw Error('Forbidden');return customer}},'@/lib/supabase/server':{createAdminClient:()=>h.db.client}})('app/actions/client-reembolsos.ts')
 await assert.rejects(api.solicitarReembolsoAction(A),/Selecione/)
 assert.equal(h.db.queries.length,0)
 await api.solicitarReembolsoAction(A,['two'])
 const box=await h.payout.readCodPayoutBox(h.db.client,T,A)
 assert.equal(box.requests[0].amountCents,2000);assert.deepEqual(box.requests[0].shipmentIds,['two'])
})
test('the customer selects available guides and submits only those IDs, with no default selection of the whole balance',async()=>{
 const h=fixture(),overview=await h.payout.loadClientCodPage(h.db.client,T,A),calls=[]
 const jsx=(type,props)=>({type,props:props||{}}),flat=n=>Array.isArray(n)?n.flatMap(flat):n&&typeof n==='object'?[n,...flat(n.props.children)]:[],text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props.children):String(n??'')
 let cursor=0;const slots=[],refs=[]
 const React={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useMemo:fn=>fn(),useRef(initial){const i=cursor++;return refs[i]||(refs[i]={current:initial})}}
 const view=createLoader({'react':React,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useRouter:()=>({refresh(){}})},'next/link':{default:'link'},'lucide-react':new Proxy({},{get:(_,p)=>p}),'./ClientScope':{useClientScope:()=>({client:{id:A},basePath:'/app/store-a'})},'@/app/actions/client-reembolsos':{solicitarReembolsoAction:async(...args)=>{calls.push(args);return{alreadyRequested:false}}}})('app/app/components/ClientReembolsos.tsx').ClientReembolsos
 const render=()=>{cursor=0;return view({overview})},button=()=>flat(render()).find(n=>n.type==='button'&&text(n)==='Solicitar')
 flat(render()).find(n=>n.type==='button'&&n.props['aria-controls']==='cod-receivable').props.onClick()
 assert.equal(button().props.disabled,true)
 const checks=flat(render()).filter(n=>n.type==='input'&&n.props.type==='checkbox')
 assert.equal(checks.length,4);assert.ok(checks.every(n=>n.props.checked===false))
 checks.find(n=>n.props['aria-label']==='Selecionar guia TRACK-two').props.onChange({target:{checked:true}})
 assert.equal(button().props.disabled,false)
 assert.match(text(render()),/1 guia\(s\) selecionada\(s\)/)
 await button().props.onClick()
 assert.deepEqual(calls,[[A,['two']]])
 assert.equal(button().props.disabled,true)
})

test('Solicitados counts only unpaid requests while paid guides and their receipts remain in Devolvidos / Pagos',async()=>{
 const h=fixture(),first=await h.payout.requestClientCodPayout(h.db.client,customer,A,['one','two'])
 await h.payout.recordCodRequestPayment(h.db.client,finance,A,first.requestId,'TRANSFER')
 await h.payout.requestClientCodPayout(h.db.client,customer,A,['three'])
 const data=await h.workflow.loadOpsCodWorkflow(h.db.client,T)
 const jsx=(type,props)=>({type,props:props||{}}),flat=n=>Array.isArray(n)?n.flatMap(flat):n&&typeof n==='object'?[n,...flat(n.props.children)]:[],text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props.children):String(n??'')
 let cursor=0;const slots=[]
 const React={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]}}
 const view=createLoader({'react':React,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useRouter:()=>({refresh(){}})},'./ReembolsosClient':{default:'excel'},'@/app/actions/ops-client-cod':{recordOpsCodPaymentAction:async()=>{},setOpsCodDisputeAction:async()=>{},getOpsCodReceiptAction:async()=>{}}})('app/ops/tesouraria/reembolsos/ReembolsosWorkspace.tsx').ReembolsosWorkspace
 const render=()=>{cursor=0;return view({data,error:'',batches:[],initialPeriod:{from:'2026-10-01',to:'2026-10-31'}})}
 const click=label=>flat(render()).find(n=>n.type==='button'&&text(n).startsWith(label)).props.onClick()
 click('Solicitados')
 const tbody=flat(render()).find(n=>n.type==='tbody')
 assert.equal(flat(tbody).filter(n=>n.type==='tr').length,1)
 assert.match(text(flat(render()).find(n=>n.type==='button'&&text(n).startsWith('Solicitados'))),/Solicitados1/)
 assert.deepEqual(flat(tbody).filter(n=>n.type?.name==='ReembolsoStatusBadge').map(n=>n.props.state).sort(),['pending'])
 assert.equal(flat(tbody).filter(n=>n.type==='button'&&text(n)==='Registar pagamento').length,1)
 assert.doesNotMatch(text(tbody),/TRACK-one|TRACK-two/);assert.match(text(tbody),/1 guias/)
 click('Devolvidos / Pagos')
 const paid=flat(render()).find(n=>n.type==='tbody')
 assert.match(text(paid),/TRACK-one/);assert.match(text(paid),/TRACK-two/);assert.match(text(paid),/Comprovativo PDF/);assert.match(text(paid),/Comprovativo Excel/)
 click('Disponível para solicitar')
 assert.match(text(render()),/TRACK-foreign/)
 assert.doesNotMatch(text(flat(render()).find(n=>n.type==='tbody')),/TRACK-one|TRACK-two|TRACK-three/)
 assert.doesNotMatch(text(render()),/Preparar devolução/)
})

test('CTT matches become available automatically without any manual authorization, including legacy revoked flags',async()=>{
 const h=fixture(false)
 let portal=await h.payout.loadClientCodPage(h.db.client,T,A)
 assert.equal(portal.payout.availableCents,6000);assert.deepEqual(portal.payout.eligible.map(r=>r.id).sort(),['one','three','two'])
 assert.equal(h.db.writes.length,0)
 seedCodReleases(h.tables,T,[{clientId:A,id:'one',tracking:'TRACK-one',cents:1000}])
 h.tables.audit_log.find(r=>r.action==='client_cod_payout_requests').details.releases[0].revokedAt='2026-10-30'
 portal=await h.payout.loadClientCodPage(h.db.client,T,A)
 assert.equal(portal.payout.availableCents,6000)
 await h.payout.requestClientCodPayout(h.db.client,customer,A,['two'])
 assert.equal((await h.payout.loadClientCodPage(h.db.client,T,A)).payout.availableCents,4000)
})
test('a divergent guide is held without blocking valid guides, and ownership conflicts never expose another store snapshot',async()=>{
 const h=fixture(false)
 h.tables.audit_log.find(r=>r.id==='b-one').details.clientSummaries[0].items[0].amount=11
 h.tables.audit_log.find(r=>r.id==='s-two').details.client_id=B
 const portal=await h.payout.loadClientCodPage(h.db.client,T,A)
 assert.equal(portal.payout.availableCents,3000)
 assert.deepEqual(portal.payout.eligible.map(r=>r.id),['three'])
 assert.equal(portal.rows.find(r=>r.id==='one').state,'review')
 assert.equal(portal.rows.some(r=>r.id==='two'),false)
 const dashboard=await h.workflow.loadOpsCodWorkflow(h.db.client,T)
 assert.equal(dashboard.rows.find(r=>r.id==='one').state,'review')
 assert.equal(dashboard.clients.find(c=>c.id===A).availableCents,3000)
})
