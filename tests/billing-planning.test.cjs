const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const {buildBillingPlanning,filterBillingPlanning,countdownLabel,calendarDaysUntil}=createLoader({})('lib/billing/planning.ts')
const today='2026-10-30'
const invoice=(id,dueDate,extra={})=>({id,reference:`FT ${id}`,clientName:'Loja Ágata',clientKey:'client:a',dueDate,amountCents:1000,paid:false,state:'open',...extra})
const preview={ready:true,enabled:false,clients:[]}

test('invoice maturity and billing closure have separate countdowns while automation is disabled',()=>{
 const periods={...preview,clients:[{id:'a',name:'Loja A',start:'2026-10-16',end:'2026-10-30',shipmentCount:2,total:10},{id:'b',name:'Loja B',start:'2026-10-24',end:'2026-10-31',shipmentCount:1,total:5}]}
 const rows=buildBillingPlanning({invoices:[invoice('old','2026-10-29'),invoice('today',today),invoice('soon','2026-11-06'),invoice('later','2026-11-07')]},periods,today)
 assert.equal(rows.find(r=>r.id==='invoice:old').bucket,'overdue')
 assert.equal(rows.find(r=>r.id==='invoice:today').bucket,'payment_soon')
 assert.equal(rows.find(r=>r.id==='invoice:soon').days,7)
 assert.equal(rows.find(r=>r.id==='invoice:later').bucket,'later')
 assert.equal(rows.find(r=>r.id==='billing:a').bucket,'billing_due')
 assert.equal(rows.find(r=>r.id==='billing:b').bucket,'billing_soon')
 assert.equal(countdownLabel(0),'Hoje');assert.equal(countdownLabel(1),'Amanhã');assert.equal(countdownLabel(-2),'Há 2 dias')
 assert.equal(rows.filter(r=>r.kind==='billing').length,2)
})
test('paid, fully credited and empty cycles are excluded; partial credits and missing dates remain explicit',()=>{
 const rows=buildBillingPlanning({invoices:[invoice('paid','2026-10-01',{paid:true}),invoice('credit','2026-10-01',{state:'credited'}),invoice('partial','2026-10-29',{creditedCents:300}),invoice('unknown',null)]},{...preview,clients:[{id:'empty',name:'Empty',start:'2026-10-16',end:today,shipmentCount:0},{id:'unset',name:'Unset',error:'Condição por definir'}]},today)
 assert.equal(rows.length,3)
 assert.equal(rows.find(r=>r.id==='invoice:partial').amountCents,700)
 assert.equal(rows.find(r=>r.id==='invoice:unknown').bucket,'invoice_unknown')
 assert.equal(rows.find(r=>r.id==='billing:unset').bucket,'cycle_unknown')
 assert.equal(rows.find(r=>r.id==='invoice:unknown').days,null)
})
test('calendar countdowns handle DST, year changes, filters and accent-insensitive search',()=>{
 assert.equal(calendarDaysUntil('2026-10-25','2026-10-24'),1)
 assert.equal(calendarDaysUntil('2027-01-01','2026-12-31'),1)
 const rows=buildBillingPlanning({invoices:[invoice('a','2026-10-29'),invoice('b',null)]},preview,today)
 assert.equal(filterBillingPlanning(rows,'priority','agata').length,1)
 assert.equal(filterBillingPlanning(rows,'invoice_unknown').length,1)
 assert.equal(filterBillingPlanning(rows,'all').length,2)
})
test('an unavailable source is not converted into fabricated zero invoices or projected cycles',()=>{
 assert.deepEqual(buildBillingPlanning(null,{ready:false,clients:[{id:'x',error:'offline'}]},today),[])
})
test('manual billing projection skips empty closed periods, honors issued shipment IDs, and stops on unbilled closed work without writing anything',async()=>{
 const tenant='tenant',client='client'
 const base={id:client,billing_type:'conta_corrente',is_active:true,payment_terms:'A 7 dias',created_at:'2026-10-01'}
 function harness(shipments,logs=[]){const db=fakeSupabase({clients:[{id:client,tenant_id:tenant}],audit_log:[{id:'profile',tenant_id:tenant,action:'client_data',created_at:'2026-10-01',details:base},...logs],recurring_statement_settings:[{tenant_id:tenant,enabled:false,anchor_date:'2026-10-01'}],recurring_statement_cycles:[],shipments});const load=createLoader({'@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},'@/lib/billing/recurring-invoices':{},'@/lib/email/resend':{},'@/lib/services/billing/statement-pdf':{}});return{db,read:load('lib/billing/recurring-statements.ts').recurringPlanningPreview}}
 const ship=(id,date)=>({id,tenant_id:tenant,client_id:client,created_at:date,status:'delivered',sell_price:5})
 const h=harness([ship('old','2026-10-02'),ship('current','2026-10-29')],[{id:'invoice',tenant_id:tenant,action:'billing_statement',created_at:'2026-10-03',details:{moloni_document_id:123,shipment_ids:['old']}}])
 const result=await h.read(tenant,today)
 assert.equal(result.enabled,false);assert.equal(result.ready,true)
 assert.equal(result.clients[0].start,'2026-10-29');assert.equal(result.clients[0].end,'2026-11-05')
 assert.equal(result.clients[0].shipmentCount,1);assert.equal(h.db.writes.length,0)
 const overdue=harness([ship('unbilled','2026-10-02')])
 const row=(await overdue.read(tenant,today)).clients[0]
 assert.equal(row.end,'2026-10-08');assert.equal(row.due,true)
 assert.equal(overdue.db.writes.length,0)
})

test('the agenda UI exposes overdue and unknown invoices separately and lets staff choose a longer planning window',()=>{
 let cursor=0;const slots=[]
 const React={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useMemo:fn=>fn(),useEffect(){}}
 const jsx=(type,props)=>({type,props:props||{}})
 const flat=n=>Array.isArray(n)?n.flatMap(flat):n&&typeof n==='object'?[n,...flat(n.props.children)]:[]
 const text=n=>Array.isArray(n)?n.map(text).join(''):n&&typeof n==='object'?text(n.props.children):String(n??'')
 const Panel=createLoader({react:React,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useRouter:()=>({refresh(){}})},'lucide-react':new Proxy({},{get:(_,p)=>p})})('app/ops/faturacao/contas-corrente/BillingPlanningPanel.tsx').BillingPlanningPanel
 const props={statistics:{today,invoices:[invoice('late','2026-10-29'),invoice('future','2026-11-10'),invoice('missing',null)]},recurring:preview}
 const render=()=>{cursor=0;return Panel(props)}
 const header=()=>flat(render()).find(n=>n.type==='button'&&n.props['aria-controls']==='billing-planning-details')
 assert.equal(header().props['aria-expanded'],false)
 header().props.onClick()
 assert.equal(header().props['aria-expanded'],true)
 assert.match(text(render()),/FT late/)
 assert.doesNotMatch(text(render()),/FT future/)
 flat(render()).find(n=>n.type==='button'&&text(n).includes('Faturas sem vencimento')).props.onClick()
 assert.match(text(render()),/FT missing/)
 assert.doesNotMatch(text(render()),/FT late/)
 header().props.onClick()
 assert.equal(header().props['aria-expanded'],false)
 header().props.onClick()
 assert.equal(header().props['aria-expanded'],true)
 assert.match(text(render()),/FT missing/)

 flat(render()).find(n=>n.type==='select'&&n.props.value==='invoice_unknown').props.onChange({target:{value:'priority'}})
 flat(render()).find(n=>n.type==='select'&&n.props.value===7).props.onChange({target:{value:'15'}})
 assert.match(text(render()),/FT future/)
 assert.match(text(render()),/Daqui a 11 dias/)
})
