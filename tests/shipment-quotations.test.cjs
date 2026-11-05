const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const zod=require('zod')
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',T='33333333-3333-4333-8333-333333333333'
const ID='44444444-4444-4444-8444-444444444444'
const ctx={tenant_id:T,role:'client',client_id:A,user:{id:'client-user'},permissions:[]}
const staff={...ctx,role:'employee',client_id:null,user:{id:'staff-user'},permissions:['Emissão e Controlo de Guias CTT']}
const client={id:A,short_name:'Loja A',is_active:true}
const service={id:'cor-intl',code:'LK-COR-INTL',name:'Correos Internacional',carrier_group:'correos',is_active:true,webservice_service_code:'90',allowed_zones:['EU 1'],zones:[]}
const baseLoad=createLoader({zod})
const {shipmentDefaults}=baseLoad('components/shipments/form/schema.ts')
const values={...shipmentDefaults(client),senderName:'Origem',senderAddress:'Rua A',senderCity:'Porto',senderPostal:'4000-001',senderPhone:'910000001',
 recipientName:'Destino',recipientAddress:'Rue B',recipientCity:'Paris',recipientCountry:'FR',recipientPostal:'75001',recipientPhone:'910000002',
 weightKg:1,volumesCount:3,lengthCm:20,widthCm:15,heightCm:10,serviceId:'cor-intl',parcelWeightsKg:[],observations:'Entregar à tarde'}
const setup=(failure)=>{
 const tables={audit_log:[],clients:[{id:A,tenant_id:T},{id:B,tenant_id:T}]}
 const db=fakeSupabase(tables,failure,{persistInserts:true})
 const api=createLoader({zod})('lib/shipments/quotations/server.ts')
 return{db,tables,api}
}

test('quote creation stores shipment data once, without carrier, wallet or shipment writes; retries are idempotent',async()=>{
 const h=setup()
 const first=await h.api.createQuotation(h.db.client,ctx,ID,client,service,values)
 // PostgreSQL JSONB can reorder object keys on read-back.
 h.tables.audit_log[0].details.shipment=Object.fromEntries(Object.entries(h.tables.audit_log[0].details.shipment).reverse())
 const retry=await h.api.createQuotation(h.db.client,ctx,ID,client,service,values)
 assert.equal(first.id,retry.id);assert.equal(first.status,'pending');assert.equal(first.proposed_price,null)
 assert.equal(first.shipment.volumesCount,3,'a request can ask the partner for multiple parcels without calling the monovolume API')
 assert.equal(h.tables.audit_log.length,1)
 assert.ok(h.db.writes.every(w=>w.table==='audit_log'&&w.value.action==='shipment_quote_request'))
 assert.equal(first.requested_by,undefined);assert.equal(first.internal_notes,undefined)
 await assert.rejects(h.api.createQuotation(h.db.client,ctx,ID,client,service,{...values,weightKg:2}),/referência já/)
 assert.equal(h.tables.audit_log.length,1)
})
test('quote creation rejects foreign clients, unauthorized staff, domestic services, COD and disabled accounts',async()=>{
 for(const [actor,c,s,v] of [
  [ctx,{...client,id:B},service,values],
  [{...staff,permissions:[]},client,service,values],
  [ctx,client,service,{...values,recipientCountry:'PT'}],
  [ctx,client,service,{...values,codValue:20}],
  [ctx,{...client,is_active:false},service,values],
 ]){const h=setup();await assert.rejects(h.api.createQuotation(h.db.client,actor,ID,c,s,v));assert.equal(h.db.writes.length,0)}
})
test('own-store reads cannot be widened by clientId, and internal notes and actors never reach a client',async()=>{
 const h=setup()
 await h.api.createQuotation(h.db.client,staff,ID,client,service,{...values,internalNotes:'Interno'})
 const other={...h.tables.audit_log[0],id:B,details:{...h.tables.audit_log[0].details,id:B,client_id:B,client_name:'Foreign'}}
 h.tables.audit_log.push(other)
 const own=await h.api.listQuotations(h.db.client,ctx,B)
 assert.equal(own.requests.length,1);assert.equal(own.requests[0].client_id,A)
 assert.equal(own.requests[0].internal_notes,undefined);assert.equal(own.requests[0].updated_by,undefined)
 assert.equal((await h.api.listQuotations(h.db.client,staff)).requests.find(r=>r.id===ID).internal_notes,'Interno')
 assert.ok(h.db.queries.every(q=>q.write||q.filters.some(f=>f.field==='tenant_id'&&f.value===T)))
})
test('quote workflow permits an ops proposal, a client decision and a manual partner reference, with optimistic concurrency',async()=>{
 const h=setup();await h.api.createQuotation(h.db.client,ctx,ID,client,service,values)
 const transitions=[]
 // Contract mock only; the actual atomic SQL and money operations run in quotation-shipments-sql.test.cjs.
 h.db.client.rpc=async(name,p)=>{
  assert.equal(name,'materialize_shipment_quotation');transitions.push(p)
  const current=h.tables.audit_log[0].details
  const next={...current,revision:current.revision+1,status:p.p_action==='accept'?'accepted':'completed',shipment_id:ID,
   shipment_audit_id:B,...(p.p_action==='complete'?{tracking_number:p.p_tracking,partner_cost:p.p_buy_price}:{}),updated_by:p.p_actor}
  h.tables.audit_log[0].details=next
  return{data:next,error:null}
 }
 const proposed=await h.api.updateQuotation(h.db.client,staff,ID,0,{action:'reply',amount:25.5,response:'Total final. Prazo de 3 dias úteis.'})
 assert.equal(proposed.status,'quoted');assert.equal(proposed.proposed_price,25.5)
 await assert.rejects(h.api.updateQuotation(h.db.client,staff,ID,0,{action:'cancel'}),/atualizada/)
 await assert.rejects(h.api.updateQuotation(h.db.client,ctx,ID,1,{action:'reply',amount:0.01,response:'forged'}),/Apenas a equipa/)
 await assert.rejects(h.api.updateQuotation(h.db.client,{...ctx,client_id:B},ID,1,{action:'accept'}),/sem acesso/)
 const accepted=await h.api.updateQuotation(h.db.client,ctx,ID,1,{action:'accept'})
 assert.equal(accepted.status,'accepted')
 await assert.rejects(h.api.updateQuotation(h.db.client,ctx,ID,2,{action:'complete',trackingNumber:'FAKE',buyPrice:1,response:''}),/Apenas a equipa/)
 await assert.rejects(h.api.updateQuotation(h.db.client,{...staff,permissions:['Atendimento & Suporte a Incidências']},ID,2,{action:'complete',trackingNumber:'FAKE',buyPrice:1,response:''}),/Sem permissão/)
 const completed=await h.api.updateQuotation(h.db.client,staff,ID,2,{action:'complete',trackingNumber:'PARTNER-123',buyPrice:12.5,response:'Emitido no parceiro.'})
 assert.equal(completed.status,'completed');assert.equal(completed.tracking_number,'PARTNER-123')
 assert.equal(h.tables.audit_log[0].details.updated_by,'staff-user')
 assert.equal(completed.shipment_id,ID);assert.equal(completed.partner_cost,undefined);assert.equal(completed.shipment_audit_id,undefined)
 assert.equal(transitions.length,2);assert.equal(transitions[0].p_client,A);assert.equal(transitions[1].p_client,null)
 assert.equal(transitions[1].p_buy_price,12.5)
 const customer=(await h.api.listQuotations(h.db.client,ctx)).requests[0]
 assert.equal(customer.partner_cost,undefined);assert.equal(customer.shipment_audit_id,undefined)
 assert.ok(h.db.writes.every(w=>w.table==='audit_log'))
})
test('failed persistence, cross-tenant keys and invalid proposed amounts never report success',async()=>{
 const h=setup();await h.api.createQuotation(h.db.client,ctx,ID,client,service,values)
 for(const amount of [0,-1,Infinity,NaN,1.001])await assert.rejects(h.api.updateQuotation(h.db.client,staff,ID,0,{action:'reply',amount,response:'Quote'}),/Verifique/)
 await assert.rejects(h.api.createQuotation(h.db.client,{...ctx,tenant_id:B},ID,client,service,values),/referência já/)
 const failing=setup(q=>q.write?{code:'XX',message:'Secret database failure'}:null)
 await assert.rejects(failing.api.createQuotation(failing.db.client,ctx,ID,client,service,values),e=>!e.message.includes('Secret'))
 assert.equal(failing.tables.audit_log.length,0)
})

test('the form adapter persists international quotations without emission or balance checks, and clamps the customer to the session',async()=>{
 const h=setup();const emissions=[]
 const api=createLoader({zod,'@/lib/auth/context':{requireUser:async()=>ctx},'@/lib/supabase/server':{createAdminClient:()=>h.db.client},
  './shipments':{emitClientGuiaAction:async input=>{emissions.push(input);throw Error('No shipment allowed')}},
  '@/lib/pricing/shipment-pricing-context':{loadShipmentPricingContext:async(db,actor,id)=>{assert.equal(id,A);return{client,service}}},
  '@/lib/client-portal/suspension':{readPortalAccess:async()=>({suspended:false,blocked:false})},
 })('app/actions/shipment-form.ts')
 const result=await api.submitShipmentFormAction(values,B,ID)
 assert.equal(result.success,true,result.error);assert.equal(result.kind,'quotation')
 assert.equal(result.quotation.id,ID);assert.equal(emissions.length,0)
 assert.equal(h.tables.audit_log[0].details.client_id,A)
 assert.equal((await api.submitShipmentFormAction(values,B,ID)).quotation.id,ID)
})

test('ops replies notify the customer inbox, and staff previews in /app return only customer fields',async()=>{
 const h=setup();await h.api.createQuotation(h.db.client,staff,ID,client,service,{...values,internalNotes:'SECRET INTERNAL'})
 const messages=[]
 const api=createLoader({zod,'next/cache':{revalidatePath(){}},'@/lib/auth/context':{requireUser:async()=>staff},
  '@/lib/supabase/server':{createAdminClient:()=>h.db.client},'@/lib/client-messages/server':{sendClientMessage:async(db,actor,input)=>messages.push(input)},
 })('app/actions/shipment-quotations.ts')
 const result=await api.updateShipmentQuotationAction(ID,0,{action:'reply',amount:25.5,response:'Entrega em 3 dias úteis.'})
 assert.equal(result.success,true);assert.equal(messages.length,1);assert.equal(messages[0].clientId,A)
 assert.match(messages[0].body,/25.50/);assert.doesNotMatch(messages[0].body,/SECRET INTERNAL/)
 const preview=await api.getShipmentQuotationsAction(A,undefined,true)
 assert.equal(preview.requests[0].internal_notes,undefined)
 await assert.rejects(api.getShipmentQuotationsAction(undefined,undefined,true),/Selecione a loja/)
})

test('client and ops quotation views expose the correct proposal controls and partner portal',async()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const h=setup()
 const q=await h.api.createQuotation(h.db.client,staff,ID,client,service,{...values,internalNotes:'SECRET INTERNAL'})
 const {QuoteRequestsClient}=createLoader({react:React,'react/jsx-runtime':require('react/jsx-runtime'),'lucide-react':require('lucide-react'),
  'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  '@/app/actions/shipment-quotations':{},
 })('components/shipments/quotations/QuoteRequestsClient.tsx')
 const quote={...q,status:'quoted',proposed_price:25.5,response:'Condições para o cliente.'}
 const render=mode=>renderToStaticMarkup(React.createElement(QuoteRequestsClient,{mode,basePath:'/app/store',clientId:A,initial:{requests:[quote],next:null}}))
 const customer=render('client')
 assert.match(customer,/Aceitar e criar envio/);assert.match(customer,/Condições para o cliente/)
 assert.doesNotMatch(customer,/my.correosexpress.pt|SECRET INTERNAL|Responder ao cliente/)
 const ops=render('ops')
 assert.match(ops,/https:\/\/my.correosexpress.pt\/account/)
 assert.match(ops,/Copiar dados do pedido|SECRET INTERNAL/)
 assert.doesNotMatch(ops,/Aceitar e criar envio/)
})

test('a missing or failed atomic shipment RPC never marks a quotation accepted or complete',async()=>{
 const h=setup();await h.api.createQuotation(h.db.client,ctx,ID,client,service,values)
 await h.api.updateQuotation(h.db.client,staff,ID,0,{action:'reply',amount:25.5,response:'Condições.'})
 for(const code of ['PGRST202','XX']){
  h.db.client.rpc=async()=>({data:null,error:{code,message:'Secret SQL exception'}})
  await assert.rejects(h.api.updateQuotation(h.db.client,ctx,ID,1,{action:'accept'}),e=>!e.message.includes('Secret'))
  assert.equal(h.tables.audit_log[0].details.status,'quoted');assert.equal(h.tables.audit_log[0].details.revision,1)
 }
})
