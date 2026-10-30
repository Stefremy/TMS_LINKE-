const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs'),{fakeSupabase}=require('./helpers/fake-supabase.cjs')
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',T='tenant'
function fixture(){return{clients:[{id:A,tenant_id:T,name:'Native A'},{id:B,tenant_id:'other',name:'Private B'}],shipments:[{id:'one',client_id:A,tenant_id:T,created_at:'2026-10-01T12:00:00Z',tracking_number:'A-ONE',status:'entregue'},{id:'two',client_id:A,tenant_id:T,created_at:'2026-09-30T12:00:00Z',tracking_number:'A-TWO',status:'entregue'}],audit_log:[
{id:'profile',tenant_id:T,action:'client_data',created_at:'2026-10-01',details:{id:A,short_name:'Store A',code:'C001',iban:'PRIVATE-BANK'}},
{id:'not-native',tenant_id:T,action:'client_data',created_at:'2026-10-01',details:{id:'orphan',short_name:'Orphan'}},
{id:'one-data',tenant_id:T,action:'shipment_data',created_at:'2026-10-01',details:{id:'one',client_id:A,cod_value:10}},
{id:'two-data',tenant_id:T,action:'shipment_data',created_at:'2026-10-01',details:{id:'two',client_id:A,cod_value:20}},
]}}
function harness(authorized=true){const tables=fixture(),db=fakeSupabase(tables);const api=createLoader({'@/lib/auth/context':{requirePermission:async name=>{assert.equal(name,'Faturação & Contas Correntes');if(!authorized)throw Error('Forbidden');return{tenant_id:T}}},'@/lib/supabase/server':{createAdminClient:()=>db.client}})('app/actions/ops-client-cod.ts');return{api,tables,db}}
test('the Ops customer selector contains only registered, undeleted customers of the current company and minimal identity fields',async()=>{
 const h=harness()
 assert.deepEqual(await h.api.getOpsCodClientsAction(),[{id:A,name:'Store A',code:'C001'}])
 assert.equal(h.db.writes.length,0)
 h.tables.audit_log.push({id:'deleted',tenant_id:T,action:'deleted_client',created_at:'2026-10-30',details:{id:A}})
 assert.deepEqual(await h.api.getOpsCodClientsAction(),[])
})
test('the dated collections query is inclusive, store-scoped and read-only',async()=>{
 const h=harness(),result=await h.api.getOpsClientCodCollectionsAction(A,'2026-10-01','2026-10-01')
 assert.equal(result.clientId,A)
 assert.deepEqual(result.rows.map(r=>r.tracking),['A-ONE'])
 assert.equal(result.rows[0].requestedCents,1000)
 assert.doesNotMatch(JSON.stringify(result),/Private B|PRIVATE-BANK|A-TWO/)
 await assert.rejects(h.api.getOpsClientCodCollectionsAction(B,'2026-10-01','2026-10-31'),/não encontrado/)
 assert.equal(h.db.writes.length,0)
})
test('authorization and invalid ranges are checked before customer/collection reads',async()=>{
 const denied=harness(false)
 await assert.rejects(denied.api.getOpsCodClientsAction(),/Forbidden/)
 await assert.rejects(denied.api.getOpsClientCodCollectionsAction(A,'2026-10-01','2026-10-31'),/Forbidden/)
 assert.equal(denied.db.queries.length,0)
 const h=harness()
 for(const args of [[A,'2026-02-30','2026-10-31'],[A,'2026-11-01','2026-10-01'],['bad','2026-10-01','2026-10-31']])await assert.rejects(h.api.getOpsClientCodCollectionsAction(...args),/válido/)
 assert.equal(h.db.queries.length,0)
})
test('changing the customer discards late responses and never labels store A results as store B',async()=>{
 const slots=[];let cursor=0;const calls=[]
 const React={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i]},useMemo:fn=>fn(),useEffect(){}}
 const jsx=(type,props)=>({type,props:props||{}}),flat=n=>Array.isArray(n)?n.flatMap(flat):n&&typeof n==='object'?[n,...flat(n.props.children)]:[],text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props.children):String(n??'')
 const load=createLoader({react:React,'react/jsx-runtime':{jsx,jsxs:jsx},'@/app/actions/ops-client-cod':{getOpsClientCodCollectionsAction:(id,from,to)=>new Promise(resolve=>calls.push({id,from,to,resolve}))}})
 const Panel=load('app/ops/tesouraria/reembolsos/OpsCodCollectionsPanel.tsx').OpsCodCollectionsPanel
 const render=()=>{cursor=0;return Panel({clients:[{id:A,name:'Store A',code:'A'},{id:B,name:'Store B',code:'B'}],initialPeriod:{from:'2026-10-01',to:'2026-10-31'}})}
 const select=id=>flat(render()).find(n=>n.type==='select'&&n.props['aria-label']==='Cliente das cobranças').props.onChange({target:{value:id}})
 const submit=()=>flat(render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
 const result=(id,tracking)=>({clientId:id,from:'2026-10-01',to:'2026-10-31',rows:[{id:tracking,tracking,date:'2026-10-01',requestedCents:1000,state:'unconfirmed',shipmentStatus:'entregue'}]})
 select(A);submit();select(B);submit()
 assert.equal(calls.length,2)
 calls[0].resolve(result(A,'A-PRIVATE'))
 await new Promise(r=>setImmediate(r))
 assert.doesNotMatch(text(render()),/A-PRIVATE/)
 calls[1].resolve(result(B,'B-OWN'))
 await new Promise(r=>setImmediate(r))
 assert.match(text(render()),/B-OWN/);assert.doesNotMatch(text(render()),/A-PRIVATE/)
 select(A)
 assert.doesNotMatch(text(render()),/B-OWN/)
})

test('date ranges use the Lisbon shipment day rather than the UTC date prefix',async()=>{
 const h=harness()
 h.tables.shipments.find(s=>s.id==='two').created_at='2026-09-30T23:30:00Z'
 const result=await h.api.getOpsClientCodCollectionsAction(A,'2026-10-01','2026-10-01')
 assert.deepEqual(new Set(result.rows.map(r=>r.tracking)),new Set(['A-ONE','A-TWO']))
})
