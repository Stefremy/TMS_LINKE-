const test = require('node:test')
const assert = require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const TENANT='11111111-1111-1111-1111-111111111111', CLIENT='22222222-2222-2222-2222-222222222222'
const client={id:CLIENT,tenant_id:TENANT,nif:'999999990',address:'Morada de teste',postal_code:'1000-001',city:'Lisboa',billing_type:'conta_corrente',short_name:'Teste'}
const statement={id:'cycle',client_id:CLIENT,client_name:'Teste',period_start:'2026-10-01',period_end:'2026-10-08',shipments:[{id:'s1',sell_price:3.91,service_type:'CTT'},{id:'s2',sell_price:4.50,service_type:'CTT'}]}
function harness({failInsert=false,failPdf=false,failFinish=false,missingConfig=false,blocked=false,period=statement,snapshots=[]}={}){
 const rows={audit_log:[{id:'period',tenant_id:TENANT,action:'period_statement',details:period},...snapshots,
   ...(!missingConfig?[{id:'config',tenant_id:TENANT,action:'moloni_connection_config',details:{company_id:'42',refresh_token:'saved'}}]:[])],recurring_statement_cycles:[]}
 const db=fakeSupabase(rows), calls=[],rpcs=[]
 const cycle={id:'cycle',statement_id:'period',client_id:CLIENT,invoice_status:'pending',invoice_token:'token',invoice_document_id:null,invoice_statement_id:'invoice'}
 let leased=false
 const api={...db.client,rpc:async(name,args)=>{
  assert.equal(args.p_tenant,TENANT);rpcs.push({name,args})
  if(name==='claim_recurring_invoice'){
   if(cycle.invoice_status==='issued')return {data:{...cycle},error:null}
   if(leased||cycle.invoice_status==='review_required'||blocked)return {data:null,error:null}
   leased=true;cycle.invoice_status='preparing';return {data:{...cycle},error:null}
  }
  if(name==='arm_recurring_invoice'){cycle.invoice_status='issuing';return {data:true,error:null}}
  if(name==='finish_recurring_invoice'){
   if(failFinish)return {data:null,error:{message:'unavailable'}}
   cycle.invoice_status='issued';cycle.invoice_document_id=args.p_document
   rows.recurring_statement_cycles.push({...cycle,tenant_id:TENANT})
   rows.audit_log.push({id:'invoice',tenant_id:TENANT,action:'billing_statement',details:{moloni_document_id:123}})
   return {data:true,error:null}
  }
  if(name==='fail_recurring_invoice'){cycle.invoice_status=cycle.invoice_status==='issuing'?'review_required':'blocked';leased=false;return {data:null,error:null}}
  throw Error(name)
 }}
 class Moloni {
  constructor(config){assert.equal(config.tenantId,TENANT);assert.equal(config.companyId,'42')}
  async getCustomerByVat(){return {customer_id:7}}
  async getTaxId(rate){assert.equal(rate,23);return 8}
  async getDocumentSet(){return 9}
  async getGenericProductId(){return 10}
  async getDocumentPDFLink(){if(failPdf)throw Error('PDF unavailable');return 'https://fixture.invalid/invoice.pdf'}
  async request(name,payload){calls.push({name,payload});if(name==='maturityDates/getAll')return [{maturity_date_id:4,days:30}]
   if(name==='invoices/insert'){if(failInsert)throw Error('Network outcome unknown');return {valid:1,document_id:123}}
   if(name==='documents/getOne')return {document_id:123,status:1,number:42,year:2026,document_type:{saft_code:'FT'}}
   throw Error(name)
  }
 }
 const load=createLoader({'@/lib/moloni/moloni-client':{MoloniClient:Moloni},fetch:async()=>new Response('%PDF-1.7 fictional official invoice')})
 return {...load('lib/billing/recurring-invoices.ts'),api,db,calls,rpcs,cycle,Moloni}
}
test('automatic invoicing creates one closed invoice with the exact period, configured tax, due date and reference',async()=>{
 const h=harness();assert.equal(await h.ensureRecurringInvoice(TENANT,'cycle',client,h.api),true)
 const inserts=h.calls.filter(c=>c.name==='invoices/insert');assert.equal(inserts.length,1)
 const p=inserts[0].payload;assert.equal(p.status,1);assert.equal(p.your_reference,'TMS-PERIOD-cycle');assert.equal(p.products[0].price,8.41)
 assert.equal(p.products[0].taxes[0].value,23);assert.equal(p.maturity_date_id,4);assert.match(p.notes,/01\/10\/2026 a 07\/10\/2026/)
 const finish=h.rpcs.find(c=>c.name==='finish_recurring_invoice');assert.equal(finish.args.p_document,123)
 assert.equal(await h.ensureRecurringInvoice(TENANT,'cycle',client,h.api),true)
 assert.equal(h.calls.filter(c=>c.name==='invoices/insert').length,1)
})
test('automatic invoices also preserve historical fuel and each charged extra',async()=>{
 const period={...statement,shipments:[{id:'s1',sell_price:6.5,service_type:'CTT'}]}
 const snapshots=[{id:'historical',tenant_id:TENANT,action:'shipment_data',created_at:'2026-10-01',details:{
  id:'s1',client_id:CLIENT,sell_price:6.5,base_price:4,fuel_tax_amount:0.5,special_fees_amount:2,
  special_fees_description:JSON.stringify([{name:'Seguro',amount:1.5},{name:'SMS',amount:0.5}])}}]
 const h=harness({period,snapshots});assert.equal(await h.ensureRecurringInvoice(TENANT,'cycle',client,h.api),true)
 const products=h.calls.find(c=>c.name==='invoices/insert').payload.products
 assert.deepEqual(products.map(p=>p.price),[4,0.5,1.5,0.5]);assert.match(products[2].name,/Seguro/)
 assert.equal(products.reduce((n,p)=>n+Math.round(p.price*100),0),650)
 assert.equal(h.calls.filter(c=>c.name==='invoices/insert').length,1)
})
test('a lost insert response never triggers a second insert or a fallback draft',async()=>{
 const h=harness({failInsert:true});assert.equal(await h.ensureRecurringInvoice(TENANT,'cycle',client,h.api),false)
 assert.equal(h.cycle.invoice_status,'review_required')
 assert.equal(await h.ensureRecurringInvoice(TENANT,'cycle',client,h.api),false)
 assert.equal(h.calls.filter(c=>c.name==='invoices/insert').length,1)
})
test('a failure to persist the issued invoice blocks reissuance and retains the provider ID in the error',async()=>{
 const h=harness({failFinish:true});assert.equal(await h.ensureRecurringInvoice(TENANT,'cycle',client,h.api),false)
 assert.equal(h.cycle.invoice_status,'review_required')
 assert.match(h.rpcs.at(-1).args.p_error,/123.*Não repita/)
 assert.equal(await h.ensureRecurringInvoice(TENANT,'cycle',client,h.api),false)
 assert.equal(h.calls.filter(c=>c.name==='invoices/insert').length,1)
})
test('concurrent workers can only insert once',async()=>{
 const h=harness();const results=await Promise.all([h.ensureRecurringInvoice(TENANT,'cycle',client,h.api),h.ensureRecurringInvoice(TENANT,'cycle',client,h.api)])
 assert.equal(results.filter(Boolean).length,1);assert.equal(h.calls.filter(c=>c.name==='invoices/insert').length,1)
})
test('a missing tenant connection blocks before issuing and never uses another company',async()=>{
 const h=harness({missingConfig:true});assert.equal(await h.ensureRecurringInvoice(TENANT,'cycle',client,h.api),false)
 assert.equal(h.cycle.invoice_status,'blocked');assert.equal(h.calls.length,0)
 assert.ok(h.db.queries.every(q=>q.filters.some(f=>f.field==='tenant_id'&&f.value===TENANT)))
})
test('missing fiscal data blocks before insertion; obtaining the PDF is a separate retryable step',async()=>{
 const h=harness();assert.equal(await h.ensureRecurringInvoice(TENANT,'cycle',{...client,nif:''},h.api),false)
 assert.equal(h.calls.length,0)
 const issued=harness();await issued.ensureRecurringInvoice(TENANT,'cycle',client,issued.api)
 const attachment=await issued.recurringInvoiceAttachment(TENANT,'cycle',issued.api)
 assert.equal(attachment.number,'FT 2026/42');assert.ok(Buffer.from(attachment.content,'base64').toString().startsWith('%PDF-'))
 assert.equal(issued.calls.filter(c=>c.name==='invoices/insert').length,1)
})
test('PDF failure does not lose the issued invoice or insert another one',async()=>{
 const h=harness({failPdf:true});await h.ensureRecurringInvoice(TENANT,'cycle',client,h.api)
 await assert.rejects(h.recurringInvoiceAttachment(TENANT,'cycle',h.api),/PDF unavailable/)
 assert.equal(await h.ensureRecurringInvoice(TENANT,'cycle',client,h.api),true)
 assert.equal(h.calls.filter(c=>c.name==='invoices/insert').length,1)
})

test('cron authentication uses its explicit tenant and never requires a signed-in browser session',async()=>{
 const db=fakeSupabase({audit_log:[{tenant_id:TENANT,action:'moloni_connection_config',created_at:'2026-10-16',details:{company_id:'42',refresh_token:'saved',access_token:'valid',access_token_expires_at:Date.now()+60000}}]})
 const load=createLoader({'@/lib/supabase/server':{createAdminClient:()=>db.client},'@/lib/auth/context':{getTenantId:()=>{throw Error('No browser session in cron')}},fetch:async()=>new Response('{}')})
 const {MoloniClient}=load('lib/moloni/moloni-client.ts')
 await new MoloniClient({tenantId:TENANT,companyId:'42',refreshToken:'old'}).request('fixture/read')
 assert.ok(db.queries.every(q=>q.filters.some(f=>f.field==='tenant_id'&&f.value===TENANT)))
})
test('manual invoice insertion never retries an uncertain result as a second draft',async()=>{
 let inserts=0
 const db=fakeSupabase({audit_log:[{tenant_id:TENANT,action:'moloni_connection_config',created_at:'2026-10-16',details:{company_id:'42',refresh_token:'saved',access_token:'valid',access_token_expires_at:Date.now()+60000}}]})
 const load=createLoader({'@/lib/supabase/server':{createAdminClient:()=>db.client},'@/lib/auth/context':{getTenantId:async()=>TENANT},fetch:async()=>{inserts++;throw Error('Unknown result')}})
 const {MoloniClient}=load('lib/moloni/moloni-client.ts')
 await assert.rejects(new MoloniClient({companyId:'42'}).createInvoice({customerId:7,date:'2026-10-16',expirationDate:'2026-10-23',documentSetId:9,products:[]}),/Unknown result/)
 assert.equal(inserts,1)
})

test('a configured payment deadline absent from Moloni is created without discounts before any invoice insertion',async()=>{
 const h=harness(), requests=[]
 const m={getCustomerByVat:async()=>({customer_id:7}),getTaxId:async()=>8,getDocumentSet:async()=>9,getGenericProductId:async()=>10,
  request:async(name,payload)=>{requests.push({name,payload});if(name==='maturityDates/getAll')return [];if(name==='maturityDates/insert')return {valid:1,maturity_date_id:55};throw Error('No fiscal insertion in preparation')}}
 const {DEFAULT_BILLING_CONFIG}=createLoader({})('app/actions/billing-config-types.ts')
 const payload=await h.buildRecurringInvoice(m,client,statement,{...DEFAULT_BILLING_CONFIG,defaultPaymentDays:7})
 assert.equal(payload.maturity_date_id,55);assert.equal(requests[1].payload.days,7);assert.equal(requests[1].payload.associated_discount,0)
 assert.equal(requests.length,2)
})

test('automatic invoice receipts use the official amount including VAT and subtract already reconciled payments',()=>{
 const h=harness(), doc={document_id:123,status:1,customer_id:7,net_value:'10.34',reconciled_value:'2.00'}
 assert.deepEqual(h.automaticInvoicePayment(doc,123),{customerId:7,value:8.34})
 assert.throws(()=>h.automaticInvoicePayment({...doc,reconciled_value:'10.34'},123),/já está paga/)
 assert.throws(()=>h.automaticInvoicePayment({...doc,document_id:999},123),/validar/)
})

test('client payment days accept custom deadlines including zero and reject invalid values',()=>{
 const {paymentDueDays}=createLoader({})('lib/billing/payment-terms.ts')
 assert.equal(paymentDueDays(undefined,7),7)
 for(const days of [0,10,15,30,365])assert.equal(paymentDueDays(days,7),days)
 for(const bad of [null,'10',-1,1.5,366,NaN,Infinity])assert.throws(()=>paymentDueDays(bad,7),/prazo para pagar/)
})
test('each client invoice uses its own payment deadline independently of a fifteen-day billing cycle',async()=>{
 const h=harness()
 const {DEFAULT_BILLING_CONFIG}=createLoader({})('app/actions/billing-config-types.ts')
 const {addCalendarDays}=createLoader({})('lib/billing/recurring-periods.ts')
 for(const days of [0,10,30]){
  const m={getCustomerByVat:async()=>({customer_id:7}),getTaxId:async()=>8,getDocumentSet:async()=>9,getGenericProductId:async()=>10,
   request:async(name)=>{assert.equal(name,'maturityDates/getAll');return [{days,maturity_date_id:77}]}}
  const payload=await h.buildRecurringInvoice(m,{...client,payment_terms:'A 15 dias',payment_due_days:days},statement,{...DEFAULT_BILLING_CONFIG,defaultPaymentDays:7})
  assert.equal(payload.expiration_date,addCalendarDays(payload.date,days));assert.equal(payload.maturity_date_id,77)
 }
})
