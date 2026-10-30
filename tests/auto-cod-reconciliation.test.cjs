const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs'),{fakeSupabase}=require('./helpers/fake-supabase.cjs')
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',T='tenant'
function harness(){
 const tables={clients:[{id:A,name:'Store A',tenant_id:T},{id:B,name:'Store B',tenant_id:T}],shipments:[],audit_log:[]}
 for(const [id,tracking,owner,cod] of [['valid','GOOD',A,10],['value','VALUE',A,20],['no-cod','NO-COD',A,0],['ambiguous-a','AMBIGUOUS',A,5],['ambiguous-b','AMBIGUOUS',B,5]]){
  tables.shipments.push({id,tracking_number:tracking,client_id:owner,tenant_id:T,status:'entregue',created_at:'2026-10-29',carrier_code:'ctt'})
  tables.audit_log.push({id:`s-${id}`,tenant_id:T,action:'shipment_data',created_at:'2026-10-29',details:{id,client_id:owner,cod_value:cod}})
 }
 const items=[['GOOD',10],['WRONG-TRACKING',7],['VALUE',99],['NO-COD',8],['AMBIGUOUS',5]].map(([carrierTracking,amount],i)=>({lineNumber:i+1,carrierTracking,amount,processingDate:'30/10/2026',deliveryDate:'30/10/2026',clientReference:'',recipientName:'Recipient',recipientAddress:'',recipientPostalCode:'',recipientCity:'',paymentMethod:'Dinheiro',additionalInfo:'',clientNotes:''}))
 const db=fakeSupabase(tables,undefined,{persistInserts:true}),invalidations=[]
 const load=createLoader({'node:crypto':require('node:crypto'),fs:{},path:{},'@/lib/auth/context':{requirePermission:async()=>({tenant_id:T,role:'admin',user:{id:'finance'}})},'@/lib/supabase/server':{createAdminClient:()=>db.client},'next/cache':{revalidatePath:(...args)=>invalidations.push(args)},'@/lib/services/reembolsos/ctt-reembolso-parser':{parseCttReembolsoFile:()=>({items})}})
 return{tables,items,db,load,invalidations}
}
test('processing a mixed CTT file makes matches immediately selectable and routes every other line to review, including guides with no COD or ambiguous tracking',async()=>{
 const h=harness(),result=await h.load('app/actions/reembolsos.ts').processReembolsoUploadAction('demo','ctt.xls','ctt')
 assert.equal(result.success,true);assert.equal(result.batch.matchedCount,1)
 assert.equal(result.batch.unmatchedCount+result.batch.reviewCount,4)
 const portal=await h.load('lib/services/reembolsos/client-cod-payout.ts').loadClientCodPage(h.db.client,T,A)
 assert.equal(portal.payout.availableCents,1000);assert.deepEqual(portal.payout.eligible.map(r=>r.id),['valid'])
 const ops=await h.load('lib/services/reembolsos/ops-cod-workflow.ts').loadOpsCodWorkflow(h.db.client,T)
 assert.equal(ops.rows.filter(r=>r.state==='review').length+ops.missing.length,4)
 assert.deepEqual(ops.missing.map(i=>i.tracking).sort(),['AMBIGUOUS','NO-COD','WRONG-TRACKING'])
 assert.ok(ops.missing.every(i=>i.reason))
 assert.match(ops.rows.find(r=>r.id==='value').disputeReason,/valor CTT não coincide/)
 assert.equal(h.tables.audit_log.filter(r=>r.action==='client_cod_payout_requests').length,0)
 assert.deepEqual(h.invalidations,[['/ops/tesouraria/reembolsos'],['/app/[storeSlug]/reembolsos','page']])
 const jsx=(type,props)=>({type,props:props||{}}),text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props.children):String(node??''),flat=node=>Array.isArray(node)?node.flatMap(flat):node&&typeof node==='object'?[node,...flat(node.props.children)]:[]
 const warning=createLoader({'react/jsx-runtime':{jsx,jsxs:jsx}})('app/ops/tesouraria/reembolsos/MissingTrackingWarning.tsx').MissingTrackingWarning
 let opened=false
 const rendered=warning({items:result.batch.items,carrier:'ctt',onViewDisputes:()=>{opened=true}})
 assert.equal(rendered.props.role,'alert');assert.match(text(rendered),/4 linha\(s\)/);assert.match(text(rendered),/disponíveis automaticamente/)
 assert.match(text(rendered),/WRONG-TRACKING/);assert.match(text(rendered),/VALUE/);assert.match(text(rendered),/NO-COD/);assert.match(text(rendered),/AMBIGUOUS/)
 flat(rendered).find(n=>n.type==='button').props.onClick();assert.equal(opened,true)
})
test('a conflicting client snapshot remains in OPS divergences without blocking valid guides or exposing the conflicting snapshot in the client portal',async()=>{
 const h=harness()
 h.tables.audit_log.find(r=>r.id==='s-value').details.client_id=B
 const result=await h.load('app/actions/reembolsos.ts').processReembolsoUploadAction('demo','ctt.xls','ctt')
 assert.equal(result.success,true)
 const portal=await h.load('lib/services/reembolsos/client-cod-payout.ts').loadClientCodPage(h.db.client,T,A)
 assert.equal(portal.payout.availableCents,1000);assert.equal(portal.rows.some(r=>r.id==='value'),false)
 const ops=await h.load('lib/services/reembolsos/ops-cod-workflow.ts').loadOpsCodWorkflow(h.db.client,T)
 assert.equal(ops.rows.filter(r=>r.state==='review').length+ops.missing.length,4)
 assert.match(ops.missing.find(r=>r.tracking==='VALUE').reason,/clientes diferentes/)
})
