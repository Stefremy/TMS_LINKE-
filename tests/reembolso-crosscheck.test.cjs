const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs'),{fakeSupabase}=require('./helpers/fake-supabase.cjs')
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',T='tenant'
const raw=(carrierTracking,amount=10,extra={})=>({lineNumber:1,carrierTracking,amount,processingDate:'30/10/2026',deliveryDate:'29/10/2026',recipientName:'Old-platform recipient',recipientAddress:'',recipientPostalCode:'',recipientCity:'',clientReference:'',additionalInfo:'',clientNotes:'',paymentMethod:'Dinheiro',...extra})
function harness(){const tables={clients:[{id:A,tenant_id:T,name:'Native own store'}],shipments:[{id:'one',client_id:A,tenant_id:T,tracking_number:'LTK-CURRENT',carrier_tracking_number:'DD000000001PT',status:'entregue',created_at:'2026-10-20T12:00:00Z'}],audit_log:[{id:'profile',tenant_id:T,action:'client_data',created_at:'2026-10-20',details:{id:A,short_name:'Own Store',iban:'OWN-IBAN'}},{id:'cod',tenant_id:T,action:'shipment_data',created_at:'2026-10-20',details:{id:'one',client_id:A,cod_value:10}}]};const db=fakeSupabase(tables);const load=createLoader({'node:crypto':require('node:crypto'),'@/lib/supabase/server':{createAdminClient:()=>db.client}});return{tables,db,load,check:items=>load('lib/services/reembolsos/reembolso-reconciler.ts').reconcileReembolsoItems(items,{filename:'legacy-ctt.xls',carrier:'ctt'},T)}}
test('only exact current-TMS carrier guides with an owned customer and matching COD amount become eligible',async()=>{
 const h=harness(),batch=await h.check([raw('DD000000001PT'),raw('DD999999999PT',50,{clientReference:'Old customer 175'})])
 assert.equal(batch.matchedCount,1);assert.equal(batch.unmatchedCount,1);assert.equal(batch.totalAmount,60)
 assert.equal(batch.clientSummaries.find(c=>c.clientId===A).totalAmount,10)
 const legacy=batch.items.find(i=>i.carrierTracking==='DD999999999PT')
 assert.equal(legacy.trackingNotFound,true);assert.equal(legacy.clientId,undefined);assert.equal(legacy.shipmentId,undefined);assert.match(legacy.reconcileReason,/plataforma antiga/)
 assert.equal(batch.clientSummaries.find(c=>c.clientId==='unmatched_group').totalAmount,0)
 assert.equal(batch.reconciliationVersion,2);assert.equal(h.db.writes.length,0)
})
test('a reference from the old platform cannot match a different current carrier guide',async()=>{
 const h=harness(),batch=await h.check([raw('OLD-CARRIER-CODE',10,{clientReference:'LTK-CURRENT'})])
 assert.equal(batch.matchedCount,0);assert.equal(batch.items[0].clientId,undefined)
})
test('missing, zero or disabled COD declarations never count as a confirmed correspondence',async()=>{
 for(const value of [null,0]){const h=harness();h.tables.audit_log[1].details.cod_value=value;const batch=await h.check([raw('DD000000001PT')]);assert.equal(batch.matchedCount,0);assert.equal(batch.reviewCount,1);assert.equal(batch.clientSummaries.find(c=>c.clientId===A).totalAmount,0)}
 const h=harness();h.tables.audit_log[1].details.is_cod=false
 assert.equal((await h.check([raw('DD000000001PT')])).matchedCount,0)
})
test('value discrepancies, cancelled guides and reports predating the current shipment remain for review',async()=>{
 for(const change of ['value','cancelled','old-date','missing-date']){
 const h=harness();let item=raw('DD000000001PT')
 if(change==='value')item.amount=9
 if(change==='cancelled')h.tables.shipments[0].status='cancelado'
 if(change==='old-date')item.processingDate='15/01/2026'
 if(change==='missing-date')item.processingDate=''
 const batch=await h.check([item]);assert.equal(batch.matchedCount,0);assert.equal(batch.reviewCount,1);assert.equal(batch.clientSummaries[0].totalAmount,0)
 }
})
test('ambiguous carrier tracking or repeated file lines cannot credit the first or last customer by accident',async()=>{
 const h=harness();h.tables.clients.push({id:B,tenant_id:T,name:'Other Store'});h.tables.shipments.push({...h.tables.shipments[0],id:'two',client_id:B})
 const ambiguous=await h.check([raw('DD000000001PT')]);assert.equal(ambiguous.items[0].trackingNotFound,false);assert.equal(ambiguous.items[0].clientId,undefined);assert.equal(ambiguous.matchedCount,0)
 const duplicate=await harness().check([raw('DD000000001PT'),raw('DD000000001PT')]);assert.equal(duplicate.matchedCount,0);assert.equal(duplicate.reviewCount,2);assert.equal(duplicate.clientSummaries[0].totalAmount,0)
})
test('another company and orphan customer profiles cannot claim a current company guide',async()=>{
 const h=harness();h.tables.shipments.push({...h.tables.shipments[0],id:'foreign',tenant_id:'other',client_id:B})
 assert.equal((await h.check([raw('DD000000001PT')])).items[0].clientId,A)
 h.tables.clients=[]
 assert.equal((await h.check([raw('DD000000001PT')])).items[0].clientId,undefined)
 for(const query of h.db.queries)assert.ok(query.filters.some(f=>f.field==='tenant_id'&&f.value===T))
})
test('previewing a historical paid batch performs reads only and preserves its original payment records',async()=>{
 const h=harness(),old={id:'old-batch',filename:'legacy.xls',carrier:'ctt',items:[raw('LEGACY-ONLY')],clientSummaries:[{clientId:A,isPaid:true,totalAmount:10}],created_at:'2026-01-15'}
 h.tables.audit_log.push({id:'old-batch',tenant_id:T,action:'reembolso_batch',details:old})
 const api=createLoader({'node:crypto':require('node:crypto'),fs:{},path:{},'fast-xml-parser':{XMLParser:class{}},'@/lib/auth/context':{requirePermission:async()=>({tenant_id:T,user:{id:'finance'}})},'@/lib/supabase/server':{createAdminClient:()=>h.db.client},'next/cache':{revalidatePath(){}}})('app/actions/reembolsos.ts')
 const result=await api.previewReembolsoReconciliationAction('old-batch')
 assert.equal(result.reconciliationPreview,true);assert.equal(result.legacyPaidGroups,1);assert.equal(result.matchedCount,0)
 assert.equal(h.tables.audit_log.find(r=>r.id==='old-batch').details.clientSummaries[0].isPaid,true)
 assert.equal(h.db.writes.length,0)
})

test('missing tracking warning lists only absent guides and states that no customer balance is released',()=>{
 const jsx=(type,props)=>({type,props:props||{}})
 const component=createLoader({'react/jsx-runtime':{jsx,jsxs:jsx}})('app/ops/tesouraria/reembolsos/MissingTrackingWarning.tsx').MissingTrackingWarning
 const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props.children):String(node??'')
 assert.equal(component({carrier:'ctt',items:[{...raw('EXISTS'),trackingNotFound:false}]}),null)
 const warning=component({carrier:'ctt',items:[{...raw('MISSING',12.34),trackingNotFound:true},{...raw('AMBIGUOUS',99),trackingNotFound:false}]})
 assert.equal(warning.props.role,'alert')
 assert.match(text(warning),/Reembolsos CTT sem guia no TMS/)
 assert.match(text(warning),/MISSING/)
 assert.match(text(warning),/12,34/)
 assert.match(text(warning),/não entram em «A receber»/)
 assert.doesNotMatch(text(warning),/AMBIGUOUS|99,00/)
})
