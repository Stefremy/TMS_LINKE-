const test = require('node:test')
const assert = require('node:assert/strict')
const Stripe = require('stripe')
const {createLoader} = require('./helpers/load-typescript.cjs')
const {fakeSupabase} = require('./helpers/fake-supabase.cjs')

// Financial regression tests: all rows, sessions and balances below are fictional.
// Stripe's real SDK verifies local signatures. No Stripe/Supabase requests are made.
// SQL transaction semantics are tested separately with an isolated PostgreSQL engine.
const TENANT='11111111-1111-1111-1111-111111111111',OTHER_TENANT='99999999-9999-9999-9999-999999999999'
const A='22222222-2222-2222-2222-222222222222',B='33333333-3333-3333-3333-333333333333'
const TX='44444444-4444-4444-4444-444444444444',CHECKOUT_TX='55555555-5555-4555-8555-555555555555'
const SESSION='cs_test_local_audit_A',SECRET='whsec_local_audit_fixture_only'
const verifier=new Stripe('sk_test_local_audit_fixture_only')
function harness(options={}) {
 const tables={clients:[{id:A,tenant_id:TENANT,email:'a@example.invalid',short_name:'Fixture A'},{id:B,tenant_id:OTHER_TENANT,email:'b@example.invalid',short_name:'Fixture B'}],
  client_transactions:[{id:TX,tenant_id:TENANT,client_id:A,amount:10,status:'pending',stripe_session_id:SESSION}],
  audit_log:options.noProfile?[]:[{id:'profile-a',tenant_id:TENANT,action:'client_data',details:{id:A,credit_limit:0,billing_type:Object.hasOwn(options,'billingType')?options.billingType:'pay_as_you_go'}},{id:'profile-b',tenant_id:OTHER_TENANT,action:'client_data',details:{id:B,credit_limit:0,billing_type:'pay_as_you_go'}}]}
 const db=fakeSupabase(tables,options.failure,{persistInserts:true}),calls={rpc:[],checkout:[]}
 // Simulate the UUID default only, rather than weakening the production payload requirements.
 const from=db.client.from
 db.client.from=table=>{const q=from(table),insert=q.insert;q.insert=value=>insert({...value,id:value.id||CHECKOUT_TX});return q}
 let failCredit=Boolean(options.failCredit)
 db.client.rpc=async(name,payload)=>{
  assert.equal(name,'settle_stripe_topup')
  const tx=tables.client_transactions.find(t=>t.id===payload.p_transaction)
  const profile=tables.audit_log.find(r=>r.action==='client_data'&&r.tenant_id===payload.p_tenant&&r.details.id===payload.p_client)
  const txFailure=options.failure?.({write:{kind:'update',value:{status:'paid'}}})
  if(txFailure)return{data:null,error:txFailure}
  if(failCredit||!profile)return{data:null,error:{message:'Fixture credit write failed'}}
  if(tx.credited_at||tx.status==='paid')return{data:'already_credited',error:null}
  calls.rpc.push(structuredClone(payload))
  profile.details.credit_limit+=tx.amount;tx.status='paid';tx.credited_at='2026-10-22'
  return{data:'credited',error:null}
 }
 class StripeFixture {
  webhooks=verifier.webhooks
  checkout={sessions:{create:async(payload)=>{
   calls.checkout.push(structuredClone(payload))
   const cents=payload.line_items[0].price_data.unit_amount
   if(!Number.isSafeInteger(cents)||cents<100)throw Error('Fixture Stripe rejects invalid amount')
   return{id:'cs_test_local_checkout',url:'https://fixture.invalid/checkout'}
  }}}
 }
 const emails=[]
 const ctx=options.ctx||{user:{id:'client-a'},role:'client',tenant_id:TENANT,client_id:A,permissions:[]}
 const load=createLoader({stripe:StripeFixture,'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  '@/lib/supabase/server':{createAdminClient:()=>db.createAdminClient()},'@/lib/auth/context':{requireUser:async()=>ctx},
  'next/headers':{headers:async()=>new Headers({origin:'https://fixture.invalid'})},
  '@/lib/config/public-origins':{checkoutReturnOrigin:()=> 'https://fixture.invalid'},
  '@/lib/client-portal/access':{getPortalDestination:async()=>'/app/fixture-a'},
  '@/lib/email/resend':{sendEmail:async email=>{emails.push(email);if(options.emailFails)throw Error('Fixture email down');return{success:true}}},
 })
 const previous=process.env.STRIPE_WEBHOOK_SECRET;process.env.STRIPE_WEBHOOK_SECRET=SECRET
 let post
 try{post=load('app/api/webhooks/stripe/route.ts').POST}finally{if(previous===undefined)delete process.env.STRIPE_WEBHOOK_SECRET;else process.env.STRIPE_WEBHOOK_SECRET=previous}
 const session={id:SESSION,object:'checkout.session',mode:'payment',currency:'eur',amount_total:1000,payment_status:'paid',client_reference_id:TX,metadata:{transaction_id:TX,client_id:A,tenant_id:TENANT}}
 const event=(type='checkout.session.completed',patch={},eventId='evt_local_audit')=>({id:eventId,object:'event',created:Math.floor(Date.now()/1000),livemode:false,type,data:{object:{...session,...patch}}})
 async function deliver(value=event(),options={}) {
  const signed=JSON.stringify(value),header=verifier.webhooks.generateTestHeaderString({payload:signed,secret:options.wrongSecret?'whsec_wrong_fixture':SECRET,timestamp:options.timestamp||Math.floor(Date.now()/1000)})
  return post(new Request('https://fixture.invalid/api/webhooks/stripe',{method:'POST',headers:options.noSignature?{}:{'stripe-signature':header},body:options.tamper?signed+' ':signed}))
 }
 return{tables,db,calls,emails,event,deliver,setCreditFailure:v=>{failCredit=v},checkout:(amount,id=A)=>load('app/actions/stripe.ts').createTopUpCheckoutSession(id,amount),balance:(id=A)=>tables.audit_log.find(r=>r.details.id===id)?.details.credit_limit||0,tx:()=>tables.client_transactions.find(r=>r.id===TX)}
}

test('CONTROL: a correctly signed paid EUR checkout credits the transaction once',async()=>{
 const h=harness();assert.equal((await h.deliver()).status,200)
 assert.equal(h.balance(),10);assert.equal(h.tx().status,'paid');assert.equal(h.calls.rpc.length,1)
})
for(const [name,options]of [['missing signature',{noSignature:true}],['wrong signature',{wrongSecret:true}],['tampered raw body',{tamper:true}],['expired timestamp',{timestamp:Math.floor(Date.now()/1000)-3600}]]) {
 test(`CONTROL: ${name} is refused before privileged database access`,async()=>{
  const h=harness();assert.equal((await h.deliver(h.event(),options)).status,400)
  assert.equal(h.db.adminClients,0);assert.equal(h.db.writes.length,0);assert.equal(h.calls.rpc.length,0)
 })
}
test('a credited top-up emails geral@linke.pt once per transaction; a failed email never fails the webhook',async()=>{
 const h=harness();await h.deliver();await h.deliver(h.event('checkout.session.completed',{},'evt_local_retry'))
 assert.equal(h.emails.length,2,'retries may call again; Resend dedupes by idempotency key')
 assert.ok(h.emails.every(e=>e.to==='geral@linke.pt'&&e.idempotencyKey===`stripe-topup-${TX}`))
 assert.match(h.emails[0].subject,/10,00/)
 const failing=harness({emailFails:true});assert.equal((await failing.deliver()).status,200);assert.equal(failing.balance(),10)
 const failed=harness();await failed.deliver(failed.event('checkout.session.async_payment_failed'));assert.equal(failed.emails.length,0)
})
test('CONTROL: unpaid completion waits; asynchronous payment success credits once',async()=>{
 const h=harness();assert.equal((await h.deliver(h.event('checkout.session.completed',{payment_status:'unpaid'}))).status,200)
 assert.equal(h.tx().status,'pending');assert.equal(h.balance(),0)
 await h.deliver(h.event('checkout.session.async_payment_succeeded',{},'evt_local_paid'))
 assert.equal(h.balance(),10);assert.equal(h.calls.rpc.length,1)
})
test('CONTROL: repeated and simultaneous successful deliveries credit only once',async()=>{
 const h=harness()
 await Promise.all([h.deliver(),h.deliver(),h.deliver(h.event('checkout.session.async_payment_succeeded',{},'evt_local_second_event'))])
 assert.equal(h.balance(),10);assert.equal(h.calls.rpc.length,1)
})
test('CONTROL: a failure event arriving after successful credit cannot undo the paid transaction',async()=>{
 const h=harness();await h.deliver();await h.deliver(h.event('checkout.session.async_payment_failed',{},'evt_local_stale_failure'))
 assert.equal(h.tx().status,'paid');assert.equal(h.balance(),10)
})
test('CONTROL: a transaction-write error is retryable and causes no credit',async()=>{
 let failed=true
 const h=harness({failure:q=>failed&&q.write?.kind==='update'&&q.write.value.status==='paid'?{message:'Fixture database unavailable'}:null})
 assert.equal((await h.deliver()).status,500);assert.equal(h.tx().status,'pending');assert.equal(h.calls.rpc.length,0)
 failed=false;await h.deliver();assert.equal(h.balance(),10)
})
test('CONTROL: a client cannot initiate a top-up for another store',async()=>{
 const h=harness();assert.equal((await h.checkout(10,B)).success,false)
 assert.equal(h.db.writes.length,0);assert.equal(h.calls.checkout.length,0)
})
test('CONTROL: a normal top-up stores the pending amount and checkout binding',async()=>{
 const h=harness();assert.equal((await h.checkout(10)).success,true)
 const tx=h.tables.client_transactions.find(r=>r.id===CHECKOUT_TX)
 assert.equal(tx.amount,10);assert.equal(tx.status,'pending');assert.equal(tx.client_id,A);assert.equal(tx.stripe_session_id,'cs_test_local_checkout')
 assert.equal(h.calls.checkout[0].line_items[0].price_data.unit_amount,1000)
})

test('top-ups reject conta corrente and unspecified billing models for clients and staff before financial writes',async()=>{
 for(const role of ['client','employee','admin']) for(const billingType of ['conta_corrente',undefined]) {
  const h=harness({billingType,ctx:{user:{id:'fixture'},role,tenant_id:TENANT,client_id:role==='client'?A:null}})
  const result=await h.checkout(10)
  assert.equal(result.success,false)
  assert.match(result.error,/apenas para contas em pré-pagamento/)
  assert.equal(h.db.writes.length,0);assert.equal(h.calls.checkout.length,0)
 }
})
test('top-up eligibility uses the latest saved billing model, ignoring stale prepaid data',async()=>{
 const h=harness()
 h.tables.clients[0].billing_type='pay_as_you_go'
 h.tables.audit_log.push({id:'new-profile-a',tenant_id:TENANT,action:'client_data',created_at:'2026-11-12T12:00:00Z',details:{id:A,billing_type:'conta_corrente'}})
 const result=await h.checkout(10)
 assert.equal(result.success,false);assert.equal(h.db.writes.length,0);assert.equal(h.calls.checkout.length,0)
})
test('unavailable or missing billing settings cannot open a payment session',async()=>{
 for(const options of [{noProfile:true},{failure:q=>q.table==='audit_log'&&!q.write?{message:'Fixture profile read failed'}:null}]) {
  const h=harness(options),result=await h.checkout(10)
  assert.equal(result.success,false);assert.equal(h.db.writes.length,0);assert.equal(h.calls.checkout.length,0)
 }
})

test('SW01: failed credit must not acknowledge successful fulfillment to Stripe',async()=>{
 const h=harness({failCredit:true}),response=await h.deliver()
 assert.equal(response.status,500,'a transient credit failure must remain retryable')
})
test('SW01: retry after a failed credit must recover the paid amount without being skipped',async()=>{
 const h=harness({failCredit:true});await h.deliver();h.setCreditFailure(false);await h.deliver()
 assert.equal(h.balance(),10,'payment was marked paid before credit; the retry must restore the missing credit')
})
for(const [name,patch]of [
 ['different client',{metadata:{transaction_id:TX,client_id:B,tenant_id:TENANT}}],
 ['different tenant',{metadata:{transaction_id:TX,client_id:A,tenant_id:OTHER_TENANT}}],
 ['different checkout session',{id:'cs_test_local_unrelated'}],
 ['different amount',{amount_total:5000}],
 ['different currency',{currency:'usd'}],
]) {
 test(`SW02: a validly signed event with ${name} must not settle or credit this transaction`,async()=>{
  const h=harness();await h.deliver(h.event('checkout.session.completed',patch))
  assert.equal(h.tx().status,'pending','transaction binding must be checked before marking paid')
  assert.equal(h.balance(A),0);assert.equal(h.balance(B),0);assert.equal(h.calls.rpc.length,0)
 })
}
test('SW01: a successful RPC that updated no client profile must not count as credited',async()=>{
 const h=harness({noProfile:true});await h.deliver()
 assert.notEqual(h.tx().status,'paid','absence of the target balance must not be reported as complete fulfillment')
})
test('SW03: a staff session cannot initiate checkout for a different tenant',async()=>{
 const h=harness({ctx:{user:{id:'staff-a'},role:'employee',tenant_id:TENANT,client_id:null,permissions:['Faturação & Contas Correntes']}})
 assert.equal((await h.checkout(10,B)).success,false)
 assert.equal(h.db.writes.length,0);assert.equal(h.calls.checkout.length,0)
})
for(const amount of [NaN,Infinity,1.005])test(`SW04: invalid/non-cent amount ${String(amount)} is rejected before creating a transaction`,async()=>{
 const h=harness();await h.checkout(amount)
 assert.equal(h.db.writes.length,0,'invalid money must be refused before database writes or provider calls')
 assert.equal(h.calls.checkout.length,0)
})
test('SW05: an unsaved checkout session binding cannot be returned as a completed setup',async()=>{
 const h=harness({failure:q=>q.write?.kind==='update'&&q.write.value.stripe_session_id==='cs_test_local_checkout'?{message:'Fixture binding write failed'}:null})
 const result=await h.checkout(10)
 assert.equal(result.success,false,'the checkout session binding was not persisted')
})

const balances=createLoader({})('lib/billing/client-balance.ts')
test('SW06: fuel already included in the shipment selling total is not debited twice',()=>{
 const shipment={sell_price:4.15,fuel_tax_amount:0.46,status:'pendente'}
 assert.equal(balances.payAsYouGoBalance(10,[shipment],[]),5.85)
})
test('SW06: the same selling total does not add fuel again to account-current debt',()=>{
 assert.equal(balances.currentAccountOutstanding([{sell_price:4.15,fuel_tax_amount:0.46,status:'pendente'}],[]),4.15)
})
test('SW07: issuing a receipt for already prepaid shipments does not replenish wallet money',()=>{
 const shipment={sell_price:4,status:'entregue',billing_statement_id:'statement-a'}
 const before=balances.payAsYouGoBalance(10,[shipment],[{id:'statement-a',moloni_document_id:1,total_value:4}])
 const after=balances.payAsYouGoBalance(10,[shipment],[{id:'statement-a',moloni_document_id:1,total_value:4,moloni_receipt_id:321,status:'paid'}])
 assert.equal(after,before,'a receipt alone is not a new top-up')
})

function shipmentHarness(credit=1) {
 const tables={shipments:[],audit_log:[{id:'wallet-profile',tenant_id:TENANT,action:'client_data',details:{id:A,billing_type:'pay_as_you_go',credit_limit:credit}}],packages:[]},db=fakeSupabase(tables,undefined,{persistInserts:true})
 db.client.rpc=async(name,p)=>{
  const reservations=tables.wallet_reservations ||= []
  if(name==='reserve_shipment_wallet') {
   const persisted=tables.shipments.reduce((n,s)=>n+s.sell_price,0)
   const held=reservations.filter(r=>r.state!=='released'&&!tables.shipments.some(s=>s.id===r.shipment_id)).reduce((n,r)=>n+r.amount,0)
   const balance=credit-persisted-held
   if(balance-p.p_amount < balances.PAY_AS_YOU_GO_OVERDRAFT_LIMIT)return{data:{refused:true,balance},error:null}
   reservations.push({shipment_id:p.p_shipment,amount:p.p_amount,state:'reserved'})
   return{data:{reserved:true},error:null}
  }
  assert.equal(name,'transition_wallet_reservation')
  const row=reservations.find(r=>r.shipment_id===p.p_shipment&&r.state===p.p_from)
  if(row)row.state=p.p_to
  return{data:!!row,error:null}
 }
 const ctx={user:{id:'client-a'},role:'client',tenant_id:TENANT,client_id:A,permissions:[]}
 class PricingError extends Error {}
 const load=createLoader({
  '@/lib/supabase/server':{createAdminClient:()=>db.client},'next/cache':{revalidatePath(){}},
  '@/lib/auth/context':{requireUser:async()=>ctx,requireEmployee:async()=>ctx,getTenantId:async()=>TENANT},
  '@/lib/client-portal/suspension':{readPortalAccess:async()=>({suspended:false,blocked:false})},
  '@/lib/pricing/calculate-shipment-price':{...createLoader({})('lib/pricing/calculate-shipment-price.ts'),resolveZoneCode:()=> 'PT-CONT',calculateShipmentPrice:()=>({sellPrice:3,buyPrice:2,basePrice:3,fuelSurchargeAmount:0,tierLabel:'Fixture'})},
  '@/lib/pricing/shipment-pricing-context':{validateShipmentPricingInput(){},ShipmentPricingError:PricingError,ShipmentPricingUnavailableError:PricingError,
   loadShipmentPricingContext:async()=>({client:{id:A,tenant_id:TENANT,billing_type:'pay_as_you_go',credit_limit:credit},service:{id:'fixture-service',name:'Fixture service',carrier_group:'ctt',fuel_surcharge_pct:0,zones:[{zone_code:'PT-CONT',zone_name:'Continente',tiers:[]}]}})},
  '@/lib/services/carriers/credentials':{},'@/lib/services/carriers/ctt-provider':{},'@/lib/label-utils':{},
 })
 const create=()=>{const form=new FormData();form.set('weight_kg','1');form.set('length_cm','30');form.set('width_cm','20');form.set('height_cm','10');return load('lib/services/shipments/shipment-creator.ts').createShipment(form)}
 return{tables,create}
}
test('CONTROL: a 3 EUR shipment uses a 3 EUR wallet down to exactly 0 EUR (no overdraft)',async()=>{
 const h=shipmentHarness(3);assert.equal((await h.create()).success,true)
 assert.equal(h.tables.shipments.length,1);assert.equal(balances.payAsYouGoBalance(3,h.tables.shipments,[]),0)
})
test('NO OVERDRAFT: a client with 1 EUR creating a 3 EUR shipment is refused with a clear message and nothing is created',async()=>{
 const h=shipmentHarness(1),result=await h.create()
 assert.equal(result.success,false)
 assert.equal(result.error,'Saldo insuficiente para criar este envio. O envio custa 3,00 € e o seu saldo é de 1,00 €. Faltam 2,00 €. Carregue saldo para continuar.')
 assert.equal(h.tables.shipments.length,0)
})
test('SW08: simultaneous draft creation must reserve credit so the combined balance cannot exceed the overdraft',async()=>{
 const h=shipmentHarness(),results=await Promise.all([h.create(),h.create()])
 assert.ok(results.filter(r=>r.success).length<=1,'both requests read the same 1 EUR balance and each accepted a 3 EUR draft')
 assert.ok(balances.payAsYouGoBalance(1,h.tables.shipments,[])>=balances.PAY_AS_YOU_GO_OVERDRAFT_LIMIT)
})

function receiptProviderHarness({lostResponse=false}={}) {
 const {MoloniClient}=createLoader({})('lib/moloni/moloni-client.ts')
 const provider=new MoloniClient({companyId:'42',refreshToken:'fixture-unused'})
 const documents=[],calls=[]
 provider.request=async(endpoint,payload)=>{
  assert.equal(endpoint,'receipts/insert');calls.push(structuredClone(payload))
  const doc={...structuredClone(payload),document_id:900+documents.length};documents.push(doc)
  if(lostResponse&&documents.length===1)throw Error('Fixture timeout after confirmed fiscal creation')
  return {document_id:doc.document_id}
 }
 const emit=()=>provider.createReceipt({customerId:7,documentSetId:8,date:'2026-10-22',invoiceId:123,value:12.3,paymentMethodId:200})
 return{calls,documents,emit}
}
test('CONTROL: the receipt provider submits one closed receipt on an ordinary success',async()=>{
 const h=receiptProviderHarness();assert.equal((await h.emit()).document_id,900)
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].status,1)
})
test('SW09: losing a receipt-insert response must not trigger a second insert as a draft',async()=>{
 const h=receiptProviderHarness({lostResponse:true});await h.emit().catch(()=>{})
 assert.equal(h.calls.length,1,'the first receipt already exists; a second insert creates another document')
})
function receiptActionHarness(options={}) {
 let archiveFailure=Boolean(options.archiveFailure),receiptSaveFailure=Boolean(options.receiptSaveFailure)
 const tables={clients:[{id:A,tenant_id:TENANT}],audit_log:[{id:'connection',tenant_id:TENANT,action:'moloni_connection_config',details:{company_id:'42',refresh_token:'fixture'}},
  {id:TX,tenant_id:TENANT,action:'billing_statement',details:{id:TX,client_id:A,moloni_document_id:123,total_value:10,...options.statement}}]}
 const db=fakeSupabase(tables,q=>q.write?.kind==='update'&&(
  (archiveFailure&&q.filters.some(f=>f.field==='action'&&f.value==='billing_statement'))||
  (receiptSaveFailure&&q.write.value.details?.receipt_id))?{message:'Fixture archive unavailable'}:null,{persistInserts:true})
 if(options.preparedWriteLost) {
  const from=db.client.from;let lost=false
  db.client.from=table=>{
   const q=from(table),insert=q.insert
   q.insert=value=>{
    insert(value)
    if(table==='audit_log'&&value.action==='receipt_operation'&&!lost) {
     const then=q.then;lost=true
     q.then=(resolve,reject)=>then(()=>({data:null,error:{message:'Fixture lost commit response'}})).then(resolve,reject)
    }
    return q
   }
   return q
  }
 }
 const calls=[]
 class MoloniFixture {
  async getDocumentSet(){return 8}
  async resolveDocumentSet(preferred){return preferred||this.getDocumentSet()}
  async getCustomerByVat(){return{customer_id:7}}
  async request(endpoint,payload){
   if(endpoint==='receipts/getAll')return options.delayedSearch?[]:calls.map((_,i)=>({document_id:901+i}))
   assert.equal(endpoint,'documents/getOne')
   if(payload.document_id===123)return{document_id:123,company_id:42,customer_id:7,status:1,document_type:{saft_code:'FT'},taxes_value:2.3,net_value:12.3,reconciled_value:0,...options.invoiceDocument}
   const call=calls[payload.document_id-901]
   return{document_id:payload.document_id,company_id:42,customer_id:7,status:1,document_type:{saft_code:'RE'},notes:call.notes,net_value:call.value,associated_documents:[{associated_id:123,value:call.value}],...options.receiptDocument}
  }
  async createReceipt(payload){calls.push(structuredClone(payload));if(options.lostResponse&&calls.length===1)throw Error('Fixture lost response');return{document_id:900+calls.length}}
  async getDocumentPDFLink(){if(options.pdfFailure)throw Error('PDF pending');return 'https://fixture.invalid/receipt.pdf'}
 }
 const load=createLoader({
  'node:crypto':require('node:crypto'),
  '@/lib/supabase/server':{createAdminClient:()=>db.client},
  '@/lib/auth/context':{requireEmployee:async()=>options.ctx||({user:{id:'finance'},tenant_id:TENANT,role:'employee',permissions:['Faturação & Contas Correntes']})},
  '@/app/actions/clientes':{getClientesAction:async()=>[{id:A,tenant_id:TENANT,nif:'123456789',legal_name:'Fixture A'}]},
  '@/app/actions/shipments':{},'@/app/actions/billing-config':{},'next/cache':{revalidatePath(){}},
  '@/lib/services/shipments/shipment-fetcher':{SHIPMENT_LIST_COLUMNS:'*'},
  '@/lib/config/public-origins':{moloniRedirectUri:()=> 'https://fixture.invalid/callback'},
  '@/lib/moloni/moloni-client':{MoloniClient:MoloniFixture},
 })
 const emit=()=>load('app/actions/moloni.ts').emitMoloniReceiptForStatementAction(TX,{paymentMethodId:200})
 return{calls,tables,db,emit,setArchiveFailure:value=>{archiveFailure=value},setReceiptSaveFailure:value=>{receiptSaveFailure=value}}
}
test('CONTROL: an existing receipt PDF prevents another manual receipt',async()=>{
 const h=receiptActionHarness({statement:{moloni_receipt_pdf:'https://fixture.invalid/receipt.pdf',moloni_receipt_id:321,status:'paid'}})
 assert.equal((await h.emit()).success,false);assert.equal(h.calls.length,0)
})
test('SW10: two simultaneous manual receipt requests must not both submit a receipt',async()=>{
 const h=receiptActionHarness();await Promise.all([h.emit(),h.emit()])
 assert.equal(h.calls.length,1,'both requests read an invoice without receipt before either archives its result')
})
test('SW10: a stored receipt ID remains authoritative when its PDF is missing',async()=>{
 const h=receiptActionHarness({statement:{moloni_receipt_id:321,status:'paid',moloni_receipt_pdf:''}})
 await h.emit();assert.equal(h.calls.length,0,'missing PDF must not permit another receipt')
})
test('SW10: archive failure after receipt creation must prevent silent repeat issuance',async()=>{
 const h=receiptActionHarness({archiveFailure:true});await h.emit();await h.emit()
 assert.equal(h.calls.length,1,'the first fiscal result was not durably recorded before retry')
})
test('SW11: a manual receipt must use the actual remaining Moloni total including VAT',async()=>{
 const h=receiptActionHarness();await h.emit()
 assert.equal(h.calls[0].value,12.3,'the TMS net amount is 10 EUR; the original invoice remains 12.30 EUR including VAT')
})


test('RECEIPT: confirmed fiscal creation archives the receipt ID and paid state',async()=>{
 const h=receiptActionHarness(),result=await h.emit()
 assert.equal(result.success,true,result.error)
 const statement=h.tables.audit_log.find(r=>r.action==='billing_statement').details
 assert.equal(statement.moloni_receipt_id,901);assert.equal(statement.status,'paid')
 assert.ok(!h.tables.audit_log.some(r=>r.action==='invoice_financial_lock'))
})
test('RECEIPT: a lost insert response is recovered by the exact notes marker, never another insert',async()=>{
 const h=receiptActionHarness({lostResponse:true})
 assert.equal((await h.emit()).success,false)
 assert.equal((await h.emit()).success,true)
 assert.equal(h.calls.length,1)
})
test('RECEIPT: a delayed/empty search cannot prove that an uncertain insert did not happen',async()=>{
 const h=receiptActionHarness({lostResponse:true,delayedSearch:true})
 for(let i=0;i<3;i++)assert.equal((await h.emit()).success,false)
 assert.equal(h.calls.length,1);assert.ok(h.tables.audit_log.some(r=>r.action==='invoice_financial_lock'))
})
test('RECEIPT: failing to save the returned document ID remains recoverable without another insert',async()=>{
 const h=receiptActionHarness({receiptSaveFailure:true})
 assert.equal((await h.emit()).success,false)
 h.setReceiptSaveFailure(false)
 assert.equal((await h.emit()).success,true);assert.equal(h.calls.length,1)
})
test('RECEIPT: a recovered confirmed document repairs a previously failed statement archive',async()=>{
 const h=receiptActionHarness({archiveFailure:true})
 assert.equal((await h.emit()).success,false)
 h.setArchiveFailure(false)
 assert.equal((await h.emit()).success,true);assert.equal(h.calls.length,1)
})
test('RECEIPT: PDF failure retains the confirmed receipt ID and prevents another fiscal insert',async()=>{
 const h=receiptActionHarness({pdfFailure:true})
 assert.equal((await h.emit()).success,true)
 await h.emit();assert.equal(h.calls.length,1)
 assert.equal(h.tables.audit_log.find(r=>r.action==='billing_statement').details.status,'paid')
})
for(const patch of [{status:0},{company_id:99},{customer_id:99},{net_value:1},{notes:'wrong marker'},
 {document_type:{saft_code:'FT'}},{associated_documents:[{associated_id:999,value:12.3}]}]) {
 test(`RECEIPT: unconfirmed/mismatched fiscal document ${JSON.stringify(patch)} never marks the statement paid`,async()=>{
  const h=receiptActionHarness({receiptDocument:patch})
  assert.equal((await h.emit()).success,false)
  assert.notEqual(h.tables.audit_log.find(r=>r.action==='billing_statement').details.status,'paid')
  await h.emit();assert.equal(h.calls.length,1)
 })
}


test('RECEIPT: clients and unprivileged staff cannot claim or emit a receipt',async()=>{
 for(const ctx of [{role:'client',permissions:[]},{role:'employee',permissions:[]}]) {
  const h=receiptActionHarness({ctx:{...ctx,user:{id:'fixture'},tenant_id:TENANT,client_id:A}})
  assert.equal((await h.emit()).success,false);assert.equal(h.db.writes.length,0);assert.equal(h.calls.length,0)
 }
})
test('RECEIPT: a foreign-tenant employee cannot emit against the statement reference',async()=>{
 const h=receiptActionHarness({ctx:{user:{id:'fixture'},tenant_id:OTHER_TENANT,role:'employee',permissions:['Faturação & Contas Correntes']}})
 assert.equal((await h.emit()).success,false);assert.equal(h.db.writes.length,0);assert.equal(h.calls.length,0)
})
test('RECEIPT: the original Moloni remainder, rather than an original gross or net amount, is receipted',async()=>{
 const h=receiptActionHarness({invoiceDocument:{reconciled_value:2.46}})
 assert.equal((await h.emit()).success,true);assert.equal(h.calls[0].value,9.84)
})
test('RECEIPT: a pending credit-note claim blocks receipt issuance on the same invoice',async()=>{
 const h=receiptActionHarness()
 const {financialId}=createLoader({'node:crypto':require('node:crypto')})('lib/billing/invoice-financial-lock.ts')
 h.tables.audit_log.push({id:financialId('invoice-finance',TENANT,'42',123),tenant_id:TENANT,action:'invoice_financial_lock',details:{operation_id:'credit-fixture'}})
 assert.equal((await h.emit()).success,false);assert.equal(h.calls.length,0)
})


test('RECEIPT: a lost database preparation response keeps the invoice lock and resumes the same operation once',async()=>{
 const h=receiptActionHarness({preparedWriteLost:true})
 assert.equal((await h.emit()).success,false);assert.equal(h.calls.length,0)
 assert.ok(h.tables.audit_log.some(r=>r.action==='invoice_financial_lock'))
 assert.equal(h.tables.audit_log.find(r=>r.action==='receipt_operation').details.state,'prepared')
 assert.equal((await h.emit()).success,true);assert.equal(h.calls.length,1)
})

test('RECEIPT: real Moloni RE documents can recover an already-issued receipt without another insert',async()=>{
 const h=receiptActionHarness({receiptDocument:{document_type:{document_type_id:2,saft_code:'RE'}},archiveFailure:true})
 assert.equal((await h.emit()).success,false)
 assert.equal(h.calls.length,1)
 h.setArchiveFailure(false)
 const recovered=await h.emit()
 assert.equal(recovered.success,true,recovered.error)
 assert.equal(h.calls.length,1)
 assert.equal(h.tables.audit_log.find(r=>r.action==='billing_statement').details.status,'paid')
})
test('RECEIPT: legacy RC receipts remain recognizable without allowing invoices as receipt confirmations',async()=>{
 const legacy=receiptActionHarness({receiptDocument:{document_type:{saft_code:'RC'}}})
 assert.equal((await legacy.emit()).success,true)
 const invoice=receiptActionHarness({receiptDocument:{document_type:{saft_code:'FT'}}})
 assert.equal((await invoice.emit()).success,false)
 assert.equal(invoice.calls.length,1)
 assert.ok(invoice.tables.audit_log.some(r=>r.action==='invoice_financial_lock'))
})

// ── Métodos de pagamento: o saldo só entra quando o Stripe confirma o dinheiro recebido ──
const voucher = { payment_status: 'unpaid' } // Multibanco/MB WAY: checkout concluído = referência gerada, ainda sem dinheiro
test('MULTIBANCO: generating the reference (and repeated deliveries of it) never credits the wallet', async () => {
 const h = harness()
 for (const id of ['evt_mb_ref', 'evt_mb_ref', 'evt_mb_ref_retry']) {
  assert.equal((await h.deliver(h.event('checkout.session.completed', voucher, id))).status, 200)
 }
 assert.equal(h.balance(), 0); assert.equal(h.tx().status, 'pending'); assert.equal(h.calls.rpc.length, 0)
 await h.deliver(h.event('checkout.session.async_payment_succeeded', {}, 'evt_mb_paid'))
 assert.equal(h.balance(), 10, 'credited only when the customer pays the reference'); assert.equal(h.tx().status, 'paid')
})
test('MULTIBANCO: an expired/unpaid reference is marked failed and credits nothing', async () => {
 const h = harness()
 await h.deliver(h.event('checkout.session.completed', voucher, 'evt_mb_ref'))
 assert.equal((await h.deliver(h.event('checkout.session.async_payment_failed', voucher, 'evt_mb_expired'))).status, 200)
 assert.equal(h.tx().status, 'failed'); assert.equal(h.balance(), 0); assert.equal(h.calls.rpc.length, 0)
})
test('MB WAY: waiting for approval in the app credits nothing; approval credits once', async () => {
 const h = harness()
 await h.deliver(h.event('checkout.session.completed', voucher, 'evt_mbway_pending'))
 assert.equal(h.balance(), 0)
 await h.deliver(h.event('checkout.session.async_payment_succeeded', {}, 'evt_mbway_ok'))
 await h.deliver(h.event('checkout.session.async_payment_succeeded', {}, 'evt_mbway_ok'))
 assert.equal(h.balance(), 10); assert.equal(h.calls.rpc.length, 1)
})
test('MB WAY: a refused or timed-out approval credits nothing', async () => {
 const h = harness()
 await h.deliver(h.event('checkout.session.completed', voucher, 'evt_mbway_pending'))
 await h.deliver(h.event('checkout.session.async_payment_failed', voucher, 'evt_mbway_refused'))
 assert.equal(h.balance(), 0); assert.equal(h.tx().status, 'failed')
})
test('CARD: a paid checkout credits immediately and exactly once', async () => {
 const h = harness()
 await h.deliver(h.event('checkout.session.completed', { payment_status: 'paid' }, 'evt_card'))
 await h.deliver(h.event('checkout.session.completed', { payment_status: 'paid' }, 'evt_card'))
 assert.equal(h.balance(), 10); assert.equal(h.calls.rpc.length, 1)
})
test('no money, no credit: other statuses, other event types and amount mismatches never credit', async () => {
 const cases = [
  ['checkout.session.completed', { payment_status: 'no_payment_required' }],
  ['checkout.session.async_payment_succeeded', { payment_status: 'unpaid' }],
  ['payment_intent.succeeded', {}],
  ['checkout.session.expired', { payment_status: 'unpaid' }],
  ['checkout.session.completed', { amount_total: 2000 }],
  ['checkout.session.completed', { currency: 'usd' }],
 ]
 for (const [type, patch] of cases) {
  const h = harness(); await h.deliver(h.event(type, patch, `evt_${type}`))
  assert.equal(h.balance(), 0, `${type} ${JSON.stringify(patch)}`); assert.equal(h.calls.rpc.length, 0)
 }
})
test('SHARED ACCOUNT: another shop\'s checkout is acknowledged without database access; a TMS session with a broken binding is still refused', async () => {
 const h = harness()
 const foreign = h.event('checkout.session.completed', { metadata: { order_id: 'kazi-123' }, client_reference_id: null }, 'evt_other_shop')
 const res = await h.deliver(foreign)
 assert.equal(res.status, 200); assert.equal((await res.json()).ignored, 'not_a_tms_top_up')
 assert.equal(h.db.writes.length, 0); assert.equal(h.calls.rpc.length, 0); assert.equal(h.balance(), 0)
 const tampered = h.event('checkout.session.completed', { metadata: { transaction_id: 'tx-other', client_id: 'x', tenant_id: 'y' } }, 'evt_bad_binding')
 assert.equal((await h.deliver(tampered)).status, 400); assert.equal(h.balance(), 0)
})
test('MINIMUM: top-ups below 5€ are refused before any transaction or Stripe call; 5€ is accepted', async () => {
 for (const amount of [1, 4.99]) {
  const h = harness(), result = await h.checkout(amount)
  assert.equal(result.success, false); assert.match(result.error, /mínimo é de 5€/)
  assert.equal(h.db.writes.length, 0); assert.equal(h.calls.checkout.length, 0)
 }
 const ok = harness(); assert.equal((await ok.checkout(5)).success, true); assert.equal(ok.calls.checkout.length, 1)
})
