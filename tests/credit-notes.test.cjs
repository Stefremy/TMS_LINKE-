const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs'),{fakeSupabase}=require('./helpers/fake-supabase.cjs')
const TENANT='11111111-1111-1111-1111-111111111111',CLIENT='22222222-2222-2222-2222-222222222222',SOURCE='33333333-3333-4333-8333-333333333333',OP='44444444-4444-4444-8444-444444444444'
const source={id:SOURCE,kind:'billing_statement'}
const line={document_product_id:101,product_id:5,name:'Transporte',summary:'Envios',price:5,qty:2,discount:0,taxes:[{tax_id:2,value:23,order:1,cumulative:0}]}
function harness(options={}) {
 const tables={clients:[{id:CLIENT,tenant_id:TENANT}],audit_log:[
  {id:SOURCE,tenant_id:TENANT,action:'billing_statement',created_at:'2026-10-22',details:{id:SOURCE,client_id:CLIENT,client_name:'Store A',statement_number:'EXT-1',moloni_document_id:10,total_value:10}},
  {id:'connection',tenant_id:TENANT,action:'moloni_connection_config',details:{company_id:'42',refresh_token:'fixture'}}]}
 const invoice={document_id:10,company_id:42,customer_id:7,status:1,document_type:{saft_code:'FT'},document_set_id:8,net_value:12.3,taxes_value:2.3,products:[line],...options.invoice}
 const calls=[],docs=new Map();let next=900,closeCount=0,insertCount=0
 const db=fakeSupabase(tables,options.failure,{persistInserts:true})
 let ctx={user:{id:'admin'},role:'admin',permissions:[],tenant_id:TENANT,client_id:null}
 class Moloni {
  async request(endpoint,payload){
   calls.push({endpoint,payload:structuredClone(payload)})
   if(endpoint==='documents/getOne'){
    if(payload.document_id===10)return structuredClone(invoice)
    const doc=docs.get(payload.document_id);if(!doc)throw Error('Document missing');return structuredClone(doc)
   }
   if(endpoint==='documents/getUnrelatedProducts')return structuredClone(options.available||[line])
   if(endpoint==='creditNotes/insert'){
    insertCount++;const id=next++,p=payload.products[0],net=Number((p.qty*p.price*(1-p.discount/100)).toFixed(2)),tax=Number((net*.23).toFixed(2))
    docs.set(id,{...structuredClone(payload),document_id:id,company_id:42,document_type:{saft_code:'NC'},document_set:{name:'2026'},number:1,net_value:net+tax,taxes_value:tax})
    if(options.insertTimeout)throw Error('Timeout after insert')
    return{document_id:id}
   }
   if(endpoint==='creditNotes/update'){
    closeCount++;Object.assign(docs.get(payload.document_id),structuredClone(payload),{status:1})
    if(options.closeTimeout)throw Error('Timeout after close')
    return{document_id:payload.document_id}
   }
   if(endpoint==='creditNotes/delete'){docs.delete(payload.document_id);return{valid:1}}
   if(endpoint==='creditNotes/getAll')return [...docs.values()].filter(d=>d.our_reference===payload.our_reference).map(d=>({document_id:d.document_id,our_reference:d.our_reference}))
   throw Error(`Unexpected endpoint ${endpoint}`)
  }
  async getDocumentPDFLink(){return 'https://www.moloni.pt/fixture.pdf'}
 }
 const load=createLoader({'node:crypto':require('node:crypto'),
  '@/lib/moloni/moloni-client':{MoloniClient:Moloni},'@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},
  '@/lib/auth/context':{requireUser:async()=>{if(!ctx?.user)throw Error('LOGIN_REQUIRED');return ctx}},'next/cache':{revalidatePath(){}},'next/navigation':{unstable_rethrow(){}},
 })
 return{tables,db,invoice,docs,calls,load,actions:new Proxy(load('app/actions/credit-notes.ts'),{get:(actions,key)=>key==='listCreditNotesAction'?actions[key]:async(...args)=>{const result=await actions[key](...args);if(result.error)throw new Error(result.error);return result.data}}),setContext:value=>{ctx=value},get inserts(){return insertCount},get closes(){return closeCount},get note(){return tables.audit_log.find(r=>r.action==='credit_note')?.details}}
}
const prepare=h=>h.actions.prepareCreditNoteAction(source,OP,[{id:101,qty:1}],'Correção de valor cobrado')

test('preparation uses original product/line/tax IDs, creates only one draft and never closes it without confirmation',async()=>{
 const h=harness(),note=await prepare(h)
 assert.equal(note.state,'draft');assert.equal(note.total,6.15);assert.equal(note.net,5);assert.equal(h.inserts,1);assert.equal(h.closes,0)
 const payload=h.calls.find(c=>c.endpoint==='creditNotes/insert').payload
 assert.equal(payload.status,0);assert.equal(payload.customer_id,7)
 assert.deepEqual(payload.products[0],{product_id:5,related_id:101,origin_id:10,name:'Transporte',summary:'Envios',qty:1,price:5,discount:0,exemption_reason:'',taxes:line.taxes,has_stock:0})
 assert.equal('payload'in note,false);assert.equal('reference'in note,false)
 const original=h.tables.audit_log.find(r=>r.id===SOURCE).details
 assert.equal(original.total_value,10);assert.equal(original.moloni_document_id,10)
 assert.equal(h.db.writes.some(w=>w.table!=='audit_log'),false)
 assert.equal((await prepare(h)).id,OP);assert.equal(h.inserts,1)
})
test('confirmed issuance closes the saved draft once, uses the exact Moloni total for association and preserves the original invoice',async()=>{
 const h=harness();await prepare(h)
 const result=await h.actions.confirmCreditNoteAction(OP)
 assert.equal(result.state,'issued');assert.equal(result.document_id,900);assert.match(result.number,/NC 2026\/1/)
 const payload=h.calls.find(c=>c.endpoint==='creditNotes/update').payload
 assert.deepEqual(payload.associated_documents,[{associated_id:10,value:6.15}])
 assert.equal(payload.document_id,900);assert.equal(payload.status,1)
 assert.equal((await h.actions.confirmCreditNoteAction(OP)).state,'issued');assert.equal(h.closes,1)
 assert.equal(h.tables.audit_log.filter(r=>r.action==='credit_note_lock').length,0)
})
test('simultaneous confirmations can send only one close request',async()=>{
 const h=harness();await prepare(h)
 const results=await Promise.allSettled([h.actions.confirmCreditNoteAction(OP),h.actions.confirmCreditNoteAction(OP)])
 assert.equal(h.closes,1);assert.ok(results.some(r=>r.status==='fulfilled'&&r.value.state==='issued'))
})
test('a different request against the same invoice cannot create another draft while preparation is open',async()=>{
 const h=harness();await prepare(h)
 await assert.rejects(h.actions.prepareCreditNoteAction(source,'55555555-5555-4555-8555-555555555555',[{id:101,qty:1}],'Novo pedido duplicado'),/em preparação ou por confirmar/)
 assert.equal(h.inserts,1)
})
test('a lost insert response is recovered by the unique reference with reads, without another insert',async()=>{
 const h=harness({insertTimeout:true})
 assert.equal((await prepare(h)).state,'review_required')
 assert.equal((await prepare(h)).state,'review_required');assert.equal(h.inserts,1)
 const recovered=await h.actions.refreshCreditNoteAction(OP)
 assert.equal(recovered.state,'draft');assert.equal(recovered.document_id,900);assert.equal(h.inserts,1)
})
test('a lost close response retains the lock and blocks repeated emission; read-only reconciliation recovers the issued document',async()=>{
 const h=harness({closeTimeout:true});await prepare(h)
 assert.equal((await h.actions.confirmCreditNoteAction(OP)).state,'review_required')
 await assert.rejects(h.actions.confirmCreditNoteAction(OP),/precisa de confirmação/)
 assert.equal(h.closes,1);assert.ok(h.tables.audit_log.some(r=>r.action==='credit_note_lock'))
 assert.equal((await h.actions.refreshCreditNoteAction(OP)).state,'issued');assert.equal(h.closes,1)
})
test('cancellation deletes only the known open draft, releases its invoice and never changes the invoice or wallet',async()=>{
 const h=harness();await prepare(h)
 assert.equal((await h.actions.cancelCreditNoteDraftAction(OP)).state,'cancelled')
 assert.equal(h.closes,0);assert.equal(h.docs.size,0)
 assert.equal(h.calls.filter(c=>c.endpoint==='creditNotes/delete').length,1)
 assert.equal(h.tables.audit_log.filter(r=>r.action==='credit_note_lock').length,0)
})
test('unknown lines, over-credits, duplicate selection and invalid quantities fail before creating any draft',async()=>{
 for(const items of [[{id:999,qty:1}],[{id:101,qty:3}],[{id:101,qty:-1}],[{id:101,qty:NaN}],[{id:101,qty:1},{id:101,qty:1}],[]]){
  const h=harness();await assert.rejects(h.actions.prepareCreditNoteAction(source,OP,items,'Motivo válido'))
  assert.equal(h.inserts,0);assert.equal(h.db.writes.length,0)
 }
})
test('original zero-rate taxes and exemption reason are preserved rather than replaced with today’s rate',()=>{
 const {availableCreditLines,selectedCreditProducts}=createLoader({})('lib/billing/credit-notes/products.ts')
 const p={...line,taxes:[{tax_id:2,value:0,order:1,cumulative:0}],exemption_reason:'M01'}
 const products=selectedCreditProducts(availableCreditLines({products:[p]},[p]),[{id:101,qty:1}],10)
 assert.equal(products[0].taxes[0].value,0);assert.equal(products[0].exemption_reason,'M01')
})
test('clients, anonymous users and employees without finance permission cannot preview or mutate credit notes',async()=>{
 for(const ctx of [null,{user:{id:'client'},role:'client',tenant_id:TENANT,client_id:CLIENT,permissions:[]},{user:{id:'staff'},role:'employee',tenant_id:TENANT,permissions:[]}]){
  const h=harness();h.setContext(ctx)
  await assert.rejects(h.actions.previewCreditNoteAction(source));await assert.rejects(prepare(h))
  assert.equal(h.db.adminClients,0);assert.equal(h.calls.length,0)
 }
})
test('foreign invoice references, wrong company, mismatched monetary values and proformas are refused before mutation',async()=>{
 for(const kind of ['foreign','company','value','proforma']){
  const h=harness(kind==='company'?{invoice:{company_id:999}}:kind==='value'?{invoice:{net_value:999}}:{})
  const row=h.tables.audit_log.find(r=>r.id===SOURCE)
  if(kind==='foreign')row.tenant_id='other-tenant'
  if(kind==='proforma')row.details.is_pro_forma=true
  await assert.rejects(prepare(h));assert.equal(h.inserts,0)
 }
})
test('client listing ignores a forged requested client ID and includes only their issued notes',async()=>{
 const h=harness();await prepare(h);await h.actions.confirmCreditNoteAction(OP)
 h.tables.audit_log.push({id:'other',tenant_id:TENANT,action:'credit_note',details:{...h.note,id:'other',client_id:'other-store'}})
 h.tables.audit_log.push({id:'draft-own',tenant_id:TENANT,action:'credit_note',details:{...h.note,id:'draft-own',state:'draft'}})
 h.setContext({user:{id:'client'},role:'client',tenant_id:TENANT,client_id:CLIENT,permissions:[]})
 const notes=await h.actions.listCreditNotesAction('other-store')
 assert.deepEqual(notes.map(n=>n.id),[OP]);assert.equal(notes[0].state,'issued')
})
test('a persistence failure before dispatch creates no external document',async()=>{
 const h=harness({failure:q=>q.write?.kind==='insert'&&q.write.value.action==='credit_note'?{message:'write unavailable'}:null})
 await assert.rejects(prepare(h),/Nenhum pedido de criação/);assert.equal(h.inserts,0)
 assert.equal(h.tables.audit_log.filter(r=>r.action==='credit_note_lock').length,0)
})

test('changes to the remote draft cannot silently change the credit that the operator approved',async()=>{
 const h=harness();await prepare(h)
 h.docs.get(900).products[0].qty=0.5
 await assert.rejects(h.actions.confirmCreditNoteAction(OP),/linhas do rascunho mudaram/)
 assert.equal(h.closes,0)
 assert.equal((await h.actions.cancelCreditNoteDraftAction(OP)).state,'cancelled')
})
test('a confirmed Moloni document is never deleted even if the operator clicks cancel after an external close',async()=>{
 const h=harness();await prepare(h);h.docs.get(900).status=1
 assert.equal((await h.actions.cancelCreditNoteDraftAction(OP)).state,'issued')
 assert.equal(h.calls.some(c=>c.endpoint==='creditNotes/delete'),false)
})
test('a failed write after closing is reconciled with reads and never sends a second fiscal close',async()=>{
 let fail=false
 const h=harness({failure:q=>fail&&q.write?.kind==='update'&&q.write.value.details.state==='issued'?{message:'db lost response'}:null})
 await prepare(h);fail=true
 const result=await h.actions.confirmCreditNoteAction(OP)
 assert.equal(result.state,'review_required');assert.equal(h.closes,1)
 fail=false
 assert.equal((await h.actions.refreshCreditNoteAction(OP)).state,'issued');assert.equal(h.closes,1)
})
test('only confirmed, correctly associated notes reduce outstanding account-current debt; invoice totals remain intact',()=>{
 const {invoiceCreditSummary}=createLoader({})('lib/billing/credit-notes/balances.ts')
 const original={id:SOURCE,client_id:CLIENT,moloni_document_id:10,total_value:10}
 const note={id:OP,source,client_id:CLIENT,invoice_document_id:10,state:'issued',net:2,total:2.46}
 const result=invoiceCreditSummary(original,'billing_statement',[note,{...note,client_id:'other'},{...note,state:'draft'}])
 assert.equal(result.credited_net,2);assert.equal(result.credited_total,2.46);assert.equal(result.outstanding_value,8);assert.equal(result.credit_pending,true)
 assert.equal(original.total_value,10)
 assert.equal(invoiceCreditSummary({...original,status:'paid'},'billing_statement',[note]).outstanding_value,0)
 assert.throws(()=>invoiceCreditSummary(original,'billing_statement',[{...note,net:100,total:123}]),/excedem/)
 const custom={...original,total_value:12.3}
 assert.equal(invoiceCreditSummary(custom,'custom_invoice',[{...note,source:{...source,kind:'custom_invoice'}}]).outstanding_value,9.84)
})

function pdfHarness({ctx,notes,url='https://www.moloni.pt/fixture.pdf',redirect,badContent=false}={}) {
 const db=fakeSupabase({audit_log:notes||[]});const calls={provider:0,fetch:0}
 const load=createLoader({
  '@/lib/auth/context':{getAuthContext:async()=>ctx},
  '@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},
  '@/lib/billing/credit-notes/service':{creditMoloni:async()=>{calls.provider++;return{moloni:{getDocumentPDFLink:async()=>url}}}},
  fetch:async()=>{calls.fetch++;return redirect?new Response(null,{status:302,headers:{location:redirect}}):new Response(badContent?'not a pdf':'%PDF-1.4 fixture',{headers:{'content-type':'application/pdf'}})},
 })
 return{calls,db,get:()=>load('app/api/credit-notes/[id]/pdf/route.ts').GET(new Request('https://fixture.invalid/api/credit-notes/'+OP+'/pdf'),{params:Promise.resolve({id:OP})})}
}
const pdfRow=(client_id=CLIENT,state='issued')=>({id:OP,tenant_id:TENANT,action:'credit_note',details:{id:OP,client_id,state,document_id:900,company_id:'42'}})
const clientContext={user:{id:'client'},role:'client',tenant_id:TENANT,client_id:CLIENT,permissions:[]}
test('credit-note PDFs enforce real tenant/client ownership and never disclose draft PDFs to clients',async()=>{
 const own=pdfHarness({ctx:clientContext,notes:[pdfRow()]});const response=await own.get()
 assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.equal(await response.text(),'%PDF-1.4 fixture')
 for(const options of [{ctx:null,notes:[pdfRow()]},{ctx:clientContext,notes:[pdfRow('other-client')]},{ctx:{...clientContext,tenant_id:'other'},notes:[pdfRow()]},{ctx:clientContext,notes:[pdfRow(CLIENT,'draft')]}]){
  const h=pdfHarness(options);assert.equal((await h.get()).status,404);assert.equal(h.calls.provider,0)
 }
})
test('credit-note PDF downloads reject untrusted hosts, redirects and non-PDF content',async()=>{
 for(const options of [{url:'https://evil.invalid/private'},{url:'http://www.moloni.pt/private'},{redirect:'https://evil.invalid/private'},{badContent:true}]){
  const h=pdfHarness({ctx:clientContext,notes:[pdfRow()],...options})
  assert.equal((await h.get()).status,502);assert.ok(h.calls.fetch<=1)
 }
})

test('the receipt preview after a credit uses the remaining gross amount from Moloni and refuses a settled invoice',async()=>{
 const h=harness({invoice:{reconciled_value:2.46}})
 assert.deepEqual(await h.actions.previewCreditAdjustedReceiptAction(source),{remainingTotal:9.84})
 assert.equal(h.calls.some(c=>c.endpoint.endsWith('/insert')),false)
 const settled=harness({invoice:{reconciled_value:12.3}})
 await assert.rejects(settled.actions.previewCreditAdjustedReceiptAction(source),/integralmente liquidada/)
})
