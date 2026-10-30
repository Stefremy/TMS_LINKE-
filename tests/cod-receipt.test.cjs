const {seedCodReleases}=require('./helpers/cod-releases.cjs')
const test=require('node:test'),assert=require('node:assert/strict'),pdf=require('pdf-lib')
const {createLoader}=require('./helpers/load-typescript.cjs'),{fakeSupabase}=require('./helpers/fake-supabase.cjs')
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',T='tenant'
const data=()=>({requestId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',requestedAt:'2026-10-29T12:00:00Z',generatedAt:'2026-10-30T12:00:00Z',state:'requested',client:{name:'Loja Demonstração',code:'DEMO',nif:'999999990',address:'Rua de Demonstração, 25',city:'4800-019 Guimarães'},amountCents:1234,items:[{shipmentId:'one',tracking:'DD000000001PT',amountCents:1234,date:'2026-10-28'}]})
function pdfHarness(){const draws=[];const load=createLoader({'pdf-lib':{...pdf,PDFDocument:{create:async()=>{const doc=await pdf.PDFDocument.create(),add=doc.addPage.bind(doc);doc.addPage=(...args)=>{const page=add(...args),index=doc.getPageCount(),draw=page.drawText.bind(page);page.drawText=(text,options)=>{draws.push({text,...options,page:index});return draw(text,options)};return page};return doc}}},'node:fs/promises':require('node:fs/promises'),'node:path':require('node:path')});return{draws,generate:load('lib/services/reembolsos/reembolso-receipt-pdf.ts').generateCodReceiptPdf}}
function dbHarness(){const tables={clients:[{id:A,name:'Own Store',tenant_id:T},{id:B,name:'Other Store',tenant_id:T}],shipments:[{id:'one',client_id:A,tenant_id:T,tracking_number:'DD000000001PT',status:'entregue',created_at:'2026-10-28'}],audit_log:[{id:'profile',tenant_id:T,action:'client_data',created_at:'2026-10-29',details:{id:A,legal_name:'Own Store Lda',nif:'999999990',billing_address:'Own billing street',code:'OWN'}},{id:'snapshot',tenant_id:T,action:'shipment_data',created_at:'2026-10-28',details:{id:'one',client_id:A,cod_value:12.34}},{id:'batch',tenant_id:T,action:'reembolso_batch',created_at:'2026-10-29',details:{carrier:'ctt',clientSummaries:[{clientId:A,isPaid:false,items:[{clientId:A,shipmentId:'one',carrierTracking:'DD000000001PT',processingDate:'29/10/2026',amount:12.34,reconcileStatus:'matched'}]}]}}]};seedCodReleases(tables,T,[{clientId:A,id:'one',tracking:'DD000000001PT',cents:1234}]);const db=fakeSupabase(tables,undefined,{persistInserts:true}),load=createLoader({'node:crypto':require('node:crypto')});return{tables,db,payout:load('lib/services/reembolsos/client-cod-payout.ts'),read:load('lib/services/reembolsos/reembolso-receipt-data.ts').loadCodReceiptData}}
test('pending PDFs describe a request without claiming payment; paid PDFs include the recorded reference and date',async()=>{
 const pending=pdfHarness();await pending.generate(data())
 assert.ok(pending.draws.some(d=>d.text==='DETALHE DO PEDIDO DE REEMBOLSO'));assert.ok(pending.draws.some(d=>d.text==='SOLICITADO - AGUARDA PAGAMENTO'));assert.ok(pending.draws.some(d=>d.text==='Este documento não confirma uma transferência efetuada.'))
 assert.ok(pending.draws.some(d=>d.text==='12,34 EUR'));assert.ok(pending.draws.some(d=>d.text==='DD000000001PT'))
 const paid=pdfHarness();await paid.generate({...data(),state:'paid',paidAt:'2026-10-30T12:00:00Z',paymentRef:'BANK-123'})
 assert.ok(paid.draws.some(d=>d.text==='COMPROVATIVO DE REEMBOLSO'));assert.ok(paid.draws.some(d=>d.text==='PAGO AO CLIENTE'));assert.ok(paid.draws.some(d=>d.text.includes('BANK-123')));assert.ok(paid.draws.some(d=>d.text==='Pagamento registado em 30/10/2026'))
 await assert.rejects(paid.generate({...data(),amountCents:500}),/não coincidem/)
})
test('large reimbursement requests paginate with full tracking numbers, repeated headings and numbered footers',async()=>{
 const h=pdfHarness(),items=Array.from({length:90},(_,i)=>({shipmentId:`s${i}`,tracking:`LONG-TRACKING-${String(i).padStart(3,'0')}-`+'1234567890'.repeat(8),amountCents:100,date:'2026-10-29'}))
 const buffer=await h.generate({...data(),items,amountCents:9000,client:{name:'Comércio de Demonstração '.repeat(7),address:'Rua Longa '.repeat(15)}}),doc=await pdf.PDFDocument.load(buffer)
 assert.ok(doc.getPageCount()>=4)
 const tracking=h.draws.filter(d=>d.x===165).map(d=>d.text).join('')
 for(const item of items)assert.ok(tracking.includes(item.tracking))
 for(const draw of h.draws){assert.ok(draw.y>=30);assert.ok(draw.x>=29);assert.ok(draw.x+draw.font.widthOfTextAtSize(draw.text,draw.size)<=566)}
 for(let i=1;i<=doc.getPageCount();i++) assert.ok(h.draws.some(d=>d.page===i&&d.text===`Página ${i} de ${doc.getPageCount()}`))
})
test('receipt data is read-only, bound to the request customer and uses frozen original amounts after payment',async()=>{
 const h=dbHarness(),request=await h.payout.requestClientCodPayout(h.db.client,{tenant_id:T,role:'client',client_id:A,user:{id:A}},A),writes=h.db.writes.length
 const receipt=await h.read(h.db.client,T,A,request.requestId)
 assert.equal(receipt.amountCents,1234);assert.equal(receipt.client.nif,'999999990');assert.equal(receipt.client.address,'Own billing street');assert.equal(receipt.state,'requested')
 assert.equal(h.db.writes.length,writes)
 await assert.rejects(h.read(h.db.client,T,B,request.requestId),/não encontrado/)
 await assert.rejects(h.read(h.db.client,'other',A,request.requestId),/não encontrado/)
 await h.payout.recordCodRequestPayment(h.db.client,{tenant_id:T,role:'admin',user:{id:'finance'}},A,request.requestId,'BANK-456')
 h.tables.audit_log.find(r=>r.id==='snapshot').details.cod_value=99
 const paid=await h.read(h.db.client,T,A,request.requestId)
 assert.equal(paid.state,'paid');assert.equal(paid.amountCents,1234);assert.equal(paid.items[0].amountCents,1234);assert.equal(paid.paymentRef,'BANK-456')
})
test('document action enforces finance permission and validates identities before reading or rendering',async()=>{
 const h=dbHarness(),request=await h.payout.requestClientCodPayout(h.db.client,{tenant_id:T,role:'client',client_id:A,user:{id:A}},A)
 let permitted=false,rendered=0
 const api=createLoader({'node:crypto':require('node:crypto'),'next/cache':{revalidatePath(){}},'@/lib/auth/context':{requirePermission:async()=>{if(!permitted)throw Error('Forbidden');return{tenant_id:T}}},'@/lib/supabase/server':{createAdminClient:()=>h.db.client},'@/lib/services/reembolsos/reembolso-receipt-excel':{generateCodReceiptExcel:()=>Buffer.from('demo excel')},'@/lib/services/reembolsos/reembolso-receipt-pdf':{generateCodReceiptPdf:async()=>{rendered++;return Buffer.from('demo pdf')}}})('app/actions/ops-client-cod.ts')
 const reads=h.db.queries.length
 await assert.rejects(api.getOpsCodReceiptAction(A,request.requestId),/Forbidden/);assert.equal(h.db.queries.length,reads)
 permitted=true;await assert.rejects(api.getOpsCodReceiptAction(A,request.requestId,'html'),/Formato/);assert.equal(h.db.queries.length,reads)
 await assert.rejects(api.getOpsCodReceiptAction(A,'invalid'),/inválido/);assert.equal(h.db.queries.length,reads)
 await assert.rejects(api.getOpsCodReceiptAction(B,request.requestId),/não encontrado/);assert.equal(rendered,0)
 const result=await api.getOpsCodReceiptAction(A,request.requestId)
 assert.equal(result.filename,`Reembolso_${request.requestId}.pdf`);assert.equal(Buffer.from(result.base64,'base64').toString(),'demo pdf');assert.equal(rendered,1)
 const writes=h.db.writes.length,excel=await api.getOpsCodReceiptAction(A,request.requestId,'xlsx')
 assert.equal(excel.filename,`Reembolso_${request.requestId}.xlsx`);assert.equal(Buffer.from(excel.base64,'base64').toString(),'demo excel');assert.equal(h.db.writes.length,writes)
})
