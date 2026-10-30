const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs'),{fakeSupabase}=require('./helpers/fake-supabase.cjs')
const model=createLoader({})('lib/services/reembolsos/client-cod.ts')
const TENANT='11111111-1111-1111-1111-111111111111',OTHER='99999999-9999-4999-8999-999999999999'
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const shipment=(id,cod_value=10,status='entregue')=>({id,cod_value,status,created_at:'2026-10-30T12:00:00Z',tracking_number:`TRK-${id}`,recipient_name:'Ágata'})
const nativeShipment=(...args)=>{const {cod_value,...row}=shipment(...args);return row}
const settlement=(shipmentId,extra={})=>({carrier:'ctt',shipmentId,amountCents:1000,matched:true,paid:false,paidAt:null,processingDate:'2026-10-30',paymentRef:null,...extra})

test('delivery does not prove collection, and cancellation/drafts do not inflate COD totals',()=>{
 const rows=model.buildClientCodRows([shipment('delivered'),shipment('cancelled',10,'cancelado'),shipment('draft',20,'rascunho'),shipment('not-cod',0)],[])
 assert.equal(rows.length,3)
 assert.equal(rows[0].state,'unconfirmed')
 assert.deepEqual(model.summarizeClientCod(rows),{count:1,requestedCents:1000,statementCents:0,paidCents:0,missingRequested:0,unconfirmed:1,review:0})
})
test('collections appear only after delivery, while receivable eligibility still depends on carrier reconciliation',()=>{
 const shipments=[shipment('new',10,'criado'),shipment('transit',10,'em_transito'),shipment('delivered'),shipment('pudo',10,'entregue_pudo'),shipment('pudo-alias',10,'entregue_em_pudo'),shipment('cancelled',10,'cancelado')]
 const rows=model.buildClientCodRows(shipments,[settlement('transit')])
 assert.deepEqual(model.deliveredClientCodRows(rows).map(r=>r.id),['delivered','pudo','pudo-alias'])
 const payout=model.clientCodReceivable({clientId:A,rows,updatedAt:'2026-10-30'},null)
 assert.equal(payout.availableCents,1000)
 assert.deepEqual(payout.eligible.map(r=>r.id),['transit'])
 assert.equal(rows.find(r=>r.id==='delivered').state,'unconfirmed')
})
test('carrier evidence and staff-recorded payout are separate; repeated batch imports do not multiply totals or undo a payout',()=>{
 const rows=model.buildClientCodRows([shipment('a'),shipment('b')],[settlement('a'),settlement('a',{paid:true,paidAt:'2026-10-30',paymentRef:'Transfer 1'}),settlement('a'),settlement('b')])
 assert.equal(rows[0].state,'paid');assert.equal(rows[0].paymentRef,'Transfer 1');assert.equal(rows[1].state,'statement')
 assert.equal(model.summarizeClientCod(rows).paidCents,1000)
 assert.equal(model.summarizeClientCod(rows).statementCents,2000)
})
test('conflicting or mismatched amounts are held for review; missing requested values remain distinct from zero',()=>{
 const rows=model.buildClientCodRows([shipment('conflict'),shipment('mismatch'),{...shipment('unknown',null),cod_enabled:true}],[settlement('conflict'),settlement('conflict',{amountCents:1100}),settlement('mismatch',{amountCents:900}),settlement('unknown',{amountCents:2000,paid:true})])
 assert.equal(rows[0].state,'review');assert.equal(rows[1].state,'review');assert.equal(rows[2].requestedCents,null)
 assert.equal(model.summarizeClientCod(rows).missingRequested,1)
 assert.equal(model.summarizeClientCod(rows).paidCents,0)
 assert.equal(model.summarizeClientCod(rows).statementCents,0)
 const flagged=model.buildClientCodRows([{...shipment('flagged',0),cod_enabled:true}],[])
 assert.equal(flagged[0].requestedCents,null);assert.equal(flagged[0].state,'unconfirmed')
})
test('customer filters search tracking and apply shipment dates and COD state before summarizing',()=>{
 const rows=model.buildClientCodRows([shipment('a'),shipment('b')],[settlement('a',{paid:true})])
 assert.equal(model.filterClientCodRows(rows,{state:'paid',search:'TRK-a',from:'2026-10-30',to:'2026-10-30'}).length,1)
 assert.equal(model.filterClientCodRows(rows,{state:'all',search:'TRK-b',from:'',to:''})[0].id,'b')
 assert.equal(model.filterClientCodRows(rows,{state:'all',search:'',from:'2026-10-31',to:''}).length,0)
})
function tables(){return {clients:[{id:A,tenant_id:TENANT},{id:B,tenant_id:OTHER}],shipments:[{...nativeShipment('one'),client_id:A,tenant_id:TENANT},{...nativeShipment('other'),client_id:B,tenant_id:TENANT}],audit_log:[
 {id:'snapshot',tenant_id:TENANT,action:'shipment_data',created_at:'2026-10-30',details:{id:'one',client_id:A,cod_value:10}},
 {id:'foreign',tenant_id:OTHER,action:'shipment_data',created_at:'2026-10-31',details:{id:'one',client_id:B,cod_value:999}},
 {id:'batch',tenant_id:TENANT,action:'reembolso_batch',created_at:'2026-10-30',details:{carrier:'ctt',clientSummaries:[
  {clientId:A,isPaid:true,paidAt:'2026-10-30',paymentRef:'own-ref',items:[{shipmentId:'one',carrierTracking:'TRK-one',processingDate:'31/10/2026',clientId:A,amount:10,reconcileStatus:'matched'},{shipmentId:'other',carrierTracking:'TRK-other',processingDate:'31/10/2026',clientId:A,amount:999,reconcileStatus:'matched'}]},
  {clientId:B,isPaid:true,clientIban:'PRIVATE-OTHER-IBAN',clientEmail:'other@private.invalid',items:[{shipmentId:'one',carrierTracking:'TRK-one',processingDate:'31/10/2026',clientId:B,amount:500,reconcileStatus:'matched'}]},
 ]}},
 {id:'foreign-batch',tenant_id:OTHER,action:'reembolso_batch',created_at:'2026-10-31',details:{carrier:'ctt',clientSummaries:[{clientId:A,isPaid:true,items:[{shipmentId:'one',carrierTracking:'TRK-one',processingDate:'31/10/2026',amount:900,reconcileStatus:'matched'}]}]}}
]}}
test('the portal reads only tenant/client shipments, joins the latest COD snapshot and never returns other clients or raw batches',async()=>{
 const db=fakeSupabase(tables())
 const reader=createLoader({})('lib/services/reembolsos/client-cod-data.ts').loadClientCodOverview
 const result=await reader(db.client,TENANT,A)
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].requestedCents,1000);assert.equal(result.rows[0].state,'paid')
 assert.equal(result.rows[0].paymentRef,'own-ref')
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE|private.invalid|other|foreign|clientSummaries/)
 assert.equal(db.writes.length,0)
 for(const q of db.queries)assert.ok(q.filters.some(f=>f.field==='tenant_id'&&f.value===TENANT))
 assert.ok(db.queries.filter(q=>q.table==='shipments').every(q=>q.filters.some(f=>f.field==='client_id'&&f.value===A)))
 await assert.rejects(reader(db.client,TENANT,B),/não encontrado/)
})
test('latest zero snapshot clears an older COD; failure to read confirmations does not masquerade as no reembolsos',async()=>{
 const t=tables();t.audit_log=t.audit_log.filter(r=>r.action!=='reembolso_batch')
 t.audit_log.push({id:'new',tenant_id:TENANT,action:'shipment_data',created_at:'2026-10-31',details:{id:'one',client_id:A,cod_value:0}})
 const db=fakeSupabase(t)
 const reader=createLoader({})('lib/services/reembolsos/client-cod-data.ts').loadClientCodOverview
 assert.equal((await reader(db.client,TENANT,A)).rows.length,0)
 const failed=fakeSupabase(t,q=>q.table==='audit_log'?{message:'offline'}:null)
 await assert.rejects(reader(failed.client,TENANT,A),/Não foi possível carregar/)
})
test('all shipment pages are read, including COD declared beyond the first thousand rows',async()=>{
 const t={clients:[{id:A,tenant_id:TENANT}],shipments:Array.from({length:1001},(_,i)=>({...nativeShipment(String(i)),client_id:A,tenant_id:TENANT})),audit_log:[{id:'last',tenant_id:TENANT,action:'shipment_data',created_at:'2026-10-30',details:{id:'0',client_id:A,cod_value:20}}]}
 const db=fakeSupabase(t)
 const result=await createLoader({})('lib/services/reembolsos/client-cod-data.ts').loadClientCodOverview(db.client,TENANT,A)
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].requestedCents,2000)
 assert.equal(db.queries.filter(q=>q.table==='shipments').length,2)
})
test('the server action rejects another client before querying data and cross-tenant staff targets fail ownership checks',async()=>{
 const db=fakeSupabase(tables())
 let role='client'
 const action=createLoader({'@/lib/auth/context':{requireClientAccess:async id=>{if(role==='client'&&id!==A)throw Error('Forbidden');return {tenant_id:TENANT,role,client_id:A}}},'@/lib/supabase/server':{createAdminClient:()=>db.client},'node:crypto':require('node:crypto'),'next/cache':{revalidatePath(){}}})('app/actions/client-reembolsos.ts').getClientReembolsosAction
 await assert.rejects(action(B),/Forbidden/);assert.equal(db.queries.length,0)
 assert.equal((await action(A)).rows.length,1)
 role='employee';await assert.rejects(action(B),/não encontrado/)
 assert.equal(db.writes.length,0)
})
test('Reembolsos is reserved as a portal section, and each sidebar points to the active store',()=>{
 const paths=createLoader({})('lib/client-portal/paths.ts')
 assert.ok(paths.PORTAL_SECTIONS.includes('reembolsos'))
 assert.notEqual(paths.buildStoreSlugs([{id:A,name:'Reembolsos'}]).get(A),'reembolsos')
 const jsx=(type,props)=>({type,props:props||{}}),base='/app/loja-a'
 const load=createLoader({react:{},'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'link'},'next/navigation':{usePathname:()=>`${base}/reembolsos`},'lucide-react':new Proxy({},{get:(_,p)=>p}),'./ClientScope':{useClientScope:()=>({basePath:base})},'./ClientMessages':{ClientMessageBell:()=>null}})
 const tree=load('app/app/components/ClientSidebarNav.tsx').ClientSidebarNav()
 const link=tree.props.children.find(n=>n.props.href===`${base}/reembolsos`)
 assert.ok(link);assert.match(link.props.className,/accent-soft/)
})

test('the collections screen defaults to the current month, contains no recipient-store details and rejects another store payload',()=>{
 const jsx=(type,props)=>({type,props:props||{}})
 const flat=n=>Array.isArray(n)?n.flatMap(flat):n&&typeof n==='object'?[n,...flat(n.props.children)]:[]
 const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props.children):String(n??'')
 const overview={clientId:A,rows:model.buildClientCodRows([shipment('a'),shipment('b'),shipment('pending-secret',10,'em_transito')],[settlement('a',{paid:true,paidAt:'2026-10-30'})]),updatedAt:'2026-10-30'}
 overview.payout=model.clientCodReceivable(overview,null)
 function harness(props){let cursor=0;const slots=[];const React={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useMemo:fn=>fn(),useRef:initial=>({current:initial})}
 const load=createLoader({react:React,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useRouter:()=>({refresh(){}})},'next/link':{default:'link'},'lucide-react':new Proxy({},{get:(_,p)=>p}),'./ClientScope':{useClientScope:()=>({basePath:'/app/own-store',client:{id:A}})},'@/app/actions/client-reembolsos':{},'@/lib/billing/recurring-periods':{lisbonDate:()=> '2026-10-30'}})
 const View=load('app/app/components/ClientReembolsos.tsx').ClientReembolsos
 return ()=>{cursor=0;return View(props)}}
 const render=harness({overview})
 const dates=flat(render()).filter(n=>n.type==='input'&&n.props.type==='date')
 assert.deepEqual(dates.map(n=>n.props.value),['2026-10-01','2026-10-31'])
 assert.match(text(render()),/TRK-a/);assert.match(text(render()),/Pagamentos à cobrança/)
 assert.doesNotMatch(text(render()),/Ágata|Destinatário|TRK-pending-secret/)
 assert.equal(flat(render()).some(n=>n.type==='select'&&n.props['aria-label']==='Filtrar cobranças'),false)
 dates[1].props.onChange({target:{value:'2026-10-29'}})
 assert.doesNotMatch(text(flat(render()).find(n=>n.type==='tbody')),/TRK-a|TRK-b/)
 flat(render()).find(n=>n.type==='button'&&n.props['aria-controls']==='cod-receivable').props.onClick()
 assert.match(text(render()),/Disponível para solicitar à Linke/)
 assert.equal(flat(render()).find(n=>n.type==='button'&&text(n)==='Solicitar').props.disabled,true)
 const errorView=harness({overview:null,error:'Não foi possível carregar'})()
 assert.ok(flat(errorView).some(n=>n.props.role==='alert'))
 const foreign=harness({overview:{...overview,clientId:B}})()
 assert.doesNotMatch(text(foreign),/TRK-a|TRK-b|Disponível para solicitar/)
 assert.ok(flat(foreign).some(n=>n.props.role==='alert'))
})
test('the store route authorizes the slug before loading only its verified client; legacy URLs redirect to the same section',async()=>{
 const calls=[],jsx=(type,props)=>({type,props})
 const load=createLoader({'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/client-portal/access':{requirePortalStore:async slug=>{calls.push(['authorize',slug]);return {client:{id:A}}},redirectLegacyPortal:async(section,query)=>({section,query})},'@/app/actions/client-reembolsos':{getClientReembolsosAction:async id=>{calls.push(['read',id]);return {rows:[]}}},'../../components/ClientReembolsos':{ClientReembolsos:'view'}})
 await load('app/app/[storeSlug]/reembolsos/page.tsx').default({params:Promise.resolve({storeSlug:'verified-store'})})
 assert.deepEqual(calls,[['authorize','verified-store'],['read',A]])
 const legacy=await load('app/app/reembolsos/page.tsx').default({searchParams:Promise.resolve({from:'2026-10-01'})})
 assert.equal(legacy.section,'reembolsos')
})

test('carrier statement dates are interpreted as Portuguese dates and invalid dates stay unknown',()=>{
 assert.equal(model.reembolsoDay('01/02/2026'),'2026-02-01')
 assert.equal(model.reembolsoDay('30-10-2026'),'2026-10-30')
 assert.equal(model.reembolsoDay('31/02/2026'),null)
 assert.equal(model.reembolsoDay('2026-10-30'), '2026-10-30')
})

test('two legitimate stores in the same tenant receive strictly disjoint results and no destination-store metadata',async()=>{
 const t=tables();t.clients.find(c=>c.id===B).tenant_id=TENANT
 t.audit_log=t.audit_log.filter(r=>r.tenant_id===TENANT)
 t.audit_log.push({id:'own-b',tenant_id:TENANT,action:'shipment_data',created_at:'2026-10-31',details:{id:'other',client_id:B,cod_value:500}})
 const db=fakeSupabase(t),reader=createLoader({})('lib/services/reembolsos/client-cod-data.ts').loadClientCodOverview
 const a=await reader(db.client,TENANT,A),b=await reader(db.client,TENANT,B)
 assert.equal(a.clientId,A);assert.equal(b.clientId,B)
 assert.deepEqual(a.rows.map(r=>r.id),['one']);assert.deepEqual(b.rows.map(r=>r.id),['other'])
 assert.equal(a.rows[0].requestedCents,1000);assert.equal(b.rows[0].requestedCents,50000)
 assert.doesNotMatch(JSON.stringify(a),/recipient|PRIVATE|50000|TRK-other/)
 assert.doesNotMatch(JSON.stringify(b),/TRK-one/)
})
