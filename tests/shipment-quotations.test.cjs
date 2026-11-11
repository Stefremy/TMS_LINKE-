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
 weightKg:1,volumesCount:1,lengthCm:20,widthCm:15,heightCm:10,serviceId:'cor-intl',parcelWeightsKg:[],observations:'Entregar à tarde'}
const setup=(failure)=>{
 const tables={audit_log:[],clients:[{id:A,tenant_id:T},{id:B,tenant_id:T}]}
 const db=fakeSupabase(tables,failure,{persistInserts:true})
 const api=createLoader({zod})('lib/shipments/quotations/server.ts')
 return{db,tables,api}
}

test('FedEx notification uses the registered store contact and fixed carrier link, without internal costs',async()=>{
 const tables={audit_log:[{tenant_id:T,action:'client_data',created_at:'2026-11-06',details:{id:A,email:'store@example.invalid'}}]}
 const db=fakeSupabase(tables)
 const emails=[]
 const load=createLoader({'@/lib/email/resend':{sendEmail:async value=>{emails.push(value);return{success:true}}},
  '@/lib/config/public-origins':{publicUrl:path=>`https://linke.example.invalid${path}`}})
 const {notifyQuotationTracking}=load('lib/shipments/quotations/tracking-notification.ts')
 const quote={id:ID,client_id:A,shipment_id:ID,status:'completed',reference:'COT-FIXTURE',tracking_carrier:'fedex',tracking_number:'123456789012',partner_cost:12345}
 await notifyQuotationTracking(db.client,T,quote)
 assert.equal(emails.length,1);assert.equal(emails[0].to,'store@example.invalid')
 assert.equal(emails[0].idempotencyKey,`quotation-tracking-${ID}`)
 assert.match(emails[0].html,/fedex\.com\/fedextrack\/\?trknbr=123456789012/)
 assert.doesNotMatch(emails[0].html,/12345<|partner_cost/)
 await assert.rejects(notifyQuotationTracking(db.client,B,quote),/email/)
 await assert.rejects(notifyQuotationTracking(db.client,T,{...quote,status:'accepted'}),/guia/)
 assert.equal(emails.length,1)
 const {partnerTrackingUrl}=load('lib/shipments/quotations/tracking.ts')
 assert.equal(partnerTrackingUrl(null),null)
 assert.equal(partnerTrackingUrl(undefined),null)
 assert.equal(partnerTrackingUrl({}),null)
 assert.equal(partnerTrackingUrl({...quote,tracking_number:'https://attacker.invalid'}),null)
 assert.equal(partnerTrackingUrl({ops_substatus:'tracking_fedex_externo',carrier_tracking_number:'123456789012'}),partnerTrackingUrl(quote))
})

test('a closed shipment modal is safe and manual FedEx shows an informational link without API sync controls',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
 const {ClientShipmentDetailModal}=createLoader({
  react:React,'react/jsx-runtime':require('react/jsx-runtime'),'lucide-react':require('lucide-react'),
  'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  './ClientScope':{useOptionalClientScope:()=>null},
  '@/lib/services/reembolsos/client-cod':{codCents:()=>null},
  '@/components/ui/refresh-icon':{RefreshIcon:'svg'},'@/components/ui/badge':{Badge:'span'},
  '@/app/actions/shipments':{},'@/app/actions/ctt':{},'@/lib/label-utils':{},'@/lib/official-shipment-label':{},
  '@/lib/carrier-logos':{getCarrierLogo:()=>null,getShipmentCarrierLogo:()=>null},
  '@/components/ui/confirm-dialog':{confirmAction:async()=>true},'@/components/ui/use-dialog-a11y':{useDialogA11y:()=>({})},'@/lib/status-helpers':{getShipmentStatusConfig:()=>({label:'Pendente'})},
  '@/lib/services/ctt/ctt-types':{},'@/components/shipments/CarrierMeasurementsPanel':{CarrierMeasurementsPanel:()=>null},
  sonner:{toast:Object.assign(()=>{},{success(){},error(){},info(){},warning(){}})},
 })('app/app/components/ClientShipmentDetailModal.tsx')
 const render=shipment=>renderToStaticMarkup(React.createElement(ClientShipmentDetailModal,{shipment,onClose(){}}))
 assert.equal(render(null),'')
 assert.equal(render(undefined),'')
 const markup=render({id:ID,tracking_number:'COT-FIXTURE',carrier_tracking_number:'123456789012',carrier_code:'correos',ops_substatus:'tracking_fedex_externo'})
 assert.match(markup,/Tracking informativo/);assert.match(markup,/Acompanhar na FedEx/)
 assert.doesNotMatch(markup,/Sincronizado com API|>Sincronizar<|preenchido automaticamente|Progresso do Envio na Rede/)
})

test('manual FedEx tracking never reaches the Correos or CTT tracking APIs',async()=>{
 const calls=[]
 const native={id:ID,tenant_id:T,client_id:A,carrier_code:'correos',carrier_tracking_number:'123456789012',ops_substatus:'tracking_fedex_externo'}
 const db=fakeSupabase({shipments:[native]})
 const {syncShipmentTracking}=createLoader({
  '@/lib/auth/context':{getTenantId:async()=>T},
  '@/lib/supabase/server':{createAdminClient:()=>db.client},
  './correos-tracking-sync':{fetchCorreosTrackingEvents:async()=>calls.push('correos')},
  './ctt-tracking-sync':{fetchCttTrackingEvents:async()=>calls.push('ctt')},
  './tracking-recorder':{recordTrackingEvents:async()=>calls.push('write')},
 })('lib/services/tracking/tracking-dispatcher.ts')
 const result=await syncShipmentTracking({shipmentId:ID},{userRole:'client',clientId:A,tenantId:T})
 assert.equal(result.success,false);assert.equal(result.carrier,'fedex');assert.match(result.error,/FedEx externo/)
 assert.deepEqual(calls,[]);assert.equal(db.writes.length,0)
})

test('quote creation stores shipment data once, without carrier, wallet or shipment writes; retries are idempotent',async()=>{
 const h=setup()
 const first=await h.api.createQuotation(h.db.client,ctx,ID,client,service,values)
 // PostgreSQL JSONB can reorder object keys on read-back.
 h.tables.audit_log[0].details.shipment=Object.fromEntries(Object.entries(h.tables.audit_log[0].details.shipment).reverse())
 const retry=await h.api.createQuotation(h.db.client,ctx,ID,client,service,values)
 assert.equal(first.id,retry.id);assert.equal(first.status,'pending');assert.equal(first.proposed_price,null)
 assert.equal(first.shipment.volumesCount,1,'quotation requests are strictly 1 volume')
 await assert.rejects(h.api.createQuotation(h.db.client,ctx,ID,client,service,{...values,volumesCount:2}),/limitado a 1 volume/)
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
test('unpriced countries use the assigned Correos service, while published estimates are server-derived and never accepted prices',async()=>{
 const h=setup()
 const priced={...service,zones:[{zone_code:'EU 1',tiers:[{id:'t',weight_max:30,label:'Até 30 kg',enabled:true,sell_price:8,cost_price:3,margin_pct:0}]}],fuel_surcharge_pct:10}
 const request=await h.api.createQuotation(h.db.client,ctx,ID,{...client,pricing:{standard_fuel_surcharge_pct:10}},priced,{...values,volumesCount:1,estimated_price:0.01,proposed_price:0.01})
 assert.equal(request.estimated_price,8.8);assert.equal(request.proposed_price,null);assert.equal(request.status,'pending')
 assert.equal(h.tables.audit_log[0].details.estimated_price,8.8)
 const foreign=setup()
 const noPrice=await foreign.api.createQuotation(foreign.db.client,ctx,ID,client,service,{...values,recipientCountry:'BR',recipientPostal:'01310-200'})
 assert.equal(noPrice.estimated_price,null);assert.equal(noPrice.proposed_price,null)
 for(const invalidService of [{...service,allowed_zones:[]},{...service,webservice_service_code:'93'}]){
  const invalid=setup();await assert.rejects(invalid.api.createQuotation(invalid.db.client,ctx,ID,client,invalidService,{...values,recipientCountry:'BR'}))
  assert.equal(invalid.db.writes.length,0)
 }
 assert.ok(h.db.writes.every(w=>w.table==='audit_log'&&w.value.action==='shipment_quote_request'))
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
 const proposed=await h.api.updateQuotation(h.db.client,staff,ID,0,{action:'reply',amount:25.5,hasIva:true,response:'Total final. Prazo de 3 dias úteis.'})
 assert.equal(proposed.status,'quoted');assert.equal(proposed.proposed_price,25.5);assert.equal(proposed.has_iva,true)
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
  '@/lib/shipments/quotations/tracking-notification':{notifyQuotationTracking:async()=>{}},
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
 const quote={...q,status:'quoted',proposed_price:25.5,has_iva:true,response:'Condições para o cliente.'}
 const render=mode=>renderToStaticMarkup(React.createElement(QuoteRequestsClient,{mode,basePath:'/app/store',clientId:A,initial:{requests:[quote],next:null}}))
 const customer=render('client')
 assert.match(customer,/Aceitar e criar envio/);assert.match(customer,/Condições para o cliente/);assert.match(customer,/23% IVA/)
 assert.doesNotMatch(customer,/my.correosexpress.pt|SECRET INTERNAL|Responder ao cliente/)
 const ops=render('ops')
 assert.match(ops,/https:\/\/my.correosexpress.pt\/account/)
 assert.match(ops,/Copiar dados do pedido|SECRET INTERNAL/)
 assert.match(ops,/23% IVA/)
 assert.doesNotMatch(ops,/Aceitar e criar envio/)
 const accepted=renderToStaticMarkup(React.createElement(QuoteRequestsClient,{mode:'ops',basePath:'/ops',canRecordBooking:true,initial:{requests:[{...quote,status:'accepted',shipment_id:ID}],next:null}}))
 assert.match(accepted,/Transportadora do tracking/);assert.match(accepted,/FedEx \(parceiro internacional\)/)
 assert.match(accepted,/Registar envio e notificar cliente/)
 const completed=renderToStaticMarkup(React.createElement(QuoteRequestsClient,{mode:'client',basePath:'/app/store',initial:{requests:[{...quote,status:'completed',shipment_id:ID,tracking_carrier:'fedex',tracking_number:'123456789012'}],next:null}}))
 assert.match(completed,/Acompanhar na FedEx/);assert.match(completed,/trknbr=123456789012/)
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

test('the dedicated air request is tenant-scoped, records air intent and cannot dispatch a forged carrier service',async()=>{
 const h=setup(),emissions=[]
 let configured=service
 const api=createLoader({zod,'@/lib/auth/context':{requireUser:async()=>ctx},'@/lib/supabase/server':{createAdminClient:()=>h.db.client},
  './shipments':{emitClientGuiaAction:async input=>{emissions.push(input);throw Error('No shipment allowed')}},
  '@/lib/pricing/shipment-pricing-context':{loadInternationalAirQuotationContext:async(db,actor,id)=>{assert.equal(id,A);return{client,service:configured}}},
  '@/lib/client-portal/suspension':{readPortalAccess:async()=>({suspended:false,blocked:false})},
 })('app/actions/shipment-form.ts')
 const result=await api.requestInternationalAirShipmentAction(values,B,ID)
 assert.equal(result.success,true,result.error);assert.equal(result.kind,'quotation')
 assert.equal(h.tables.audit_log[0].details.requested_transport,'air')
 assert.equal(h.tables.audit_log[0].details.client_id,A);assert.equal(h.tables.audit_log[0].details.proposed_price,null)
 assert.equal((await api.requestInternationalAirShipmentAction(values,B,ID)).quotation.id,ID)
 const before=h.db.writes.length
 for(const fake of [{...service,carrier_group:'ctt',webservice_service_code:'EMSF056.01'},{...service,webservice_service_code:'93'}]){
  configured=fake
  assert.equal((await api.requestInternationalAirShipmentAction(values,B,ID)).success,false)
 }
 configured=service
 assert.equal((await api.requestInternationalAirShipmentAction({...values,recipientCountry:'PT',recipientPostal:'1000-001'},B,ID)).success,false)
 assert.equal(emissions.length,0);assert.equal(h.db.writes.length,before)
 await assert.rejects(h.api.createQuotation(h.db.client,ctx,ID,client,service,values),/referência já/)
})

test('every client can request against the tenant general Correos reference, without changing emission rights or client prices',async()=>{
 const general={...service,id:'srv_linke_cor_intl',fuel_surcharge_pct:10,
  zones:[{zone_code:'EU 1',tiers:[{id:'tier',weight_max:30,enabled:true,sell_price:8,cost_price:7777,margin_pct:8888}]}]}
 const negotiated={...general,id:'private',client_id:B,zones:[{zone_code:'EU 1',tiers:[{weight_max:30,enabled:true,sell_price:999,cost_price:1}]}]}
 const details={...client,assigned_linke_service_ids:[],custom_tier_overrides:{srv_linke_cor_intl:[0.01]},pricing:{fuel_surcharge_pct:99}}
 const tables={clients:[{id:A,tenant_id:T}],servicos_linke:[{...general,tenant_id:T},{...negotiated,tenant_id:T}],
  audit_log:[{id:B,tenant_id:T,action:'client_data',details},{id:'fuel',tenant_id:T,action:'standard_fuel_surcharge',details:{percentage:10}}]}
 const db=fakeSupabase(tables,undefined,{persistInserts:true})
 let emissions=0
 const load=createLoader({zod,'@/lib/auth/context':{requireUser:async()=>ctx},'@/lib/supabase/server':{createAdminClient:()=>db.client},
  './shipments':{emitClientGuiaAction:async()=>{emissions++;throw Error('No carrier dispatch')}},
  '@/lib/client-portal/suspension':{readPortalAccess:async()=>({suspended:false,blocked:false})},
 })
 const pricing=load('lib/pricing/shipment-pricing-context.ts')
 const reference=await pricing.loadInternationalAirQuotationContext(db.client,ctx,A)
 assert.equal(reference.service.id,general.id);assert.deepEqual(reference.client.assigned_linke_service_ids,[])
 await assert.rejects(pricing.loadShipmentPricingContext(db.client,ctx,A,{serviceId:general.id}),/não autorizado/)
 await assert.rejects(pricing.loadInternationalAirQuotationContext(db.client,ctx,B),/inacessível/)
 const api=load('app/actions/shipment-form.ts')
 const dto=await api.getInternationalAirQuotationReferenceAction(B)
 assert.equal(dto.service.id,general.id);assert.equal(dto.service.zones[0].tiers[0].sell_price,8)
 assert.equal(dto.fuelSurchargePct,10)
 assert.doesNotMatch(JSON.stringify(dto),/7777|8888|cost_price|margin_pct|private|webservice_connection/)
 const result=await api.requestInternationalAirShipmentAction({...values,serviceId:general.id,volumesCount:1},B,ID)
 assert.equal(result.success,true,result.error)
 const saved=tables.audit_log.find(row=>row.action==='shipment_quote_request').details
 assert.equal(saved.client_id,A);assert.equal(saved.estimated_price,8.8);assert.equal(saved.proposed_price,null)
 assert.equal((await api.requestInternationalAirShipmentAction({...values,serviceId:negotiated.id},B,ID)).success,false)
 assert.equal(emissions,0);assert.ok(db.writes.every(write=>write.value.action==='shipment_quote_request'))
 assert.deepEqual(details.assigned_linke_service_ids,[])
 tables.servicos_linke=[]
 const noTariff=await pricing.loadInternationalAirQuotationContext(db.client,ctx,A)
 assert.equal(noTariff.service.id,general.id);assert.deepEqual(noTariff.service.zones,[])
 const unpriced=await api.requestInternationalAirShipmentAction({...values,serviceId:general.id,recipientCountry:'BR',recipientPostal:'01310-200'},B,'55555555-5555-4555-8555-555555555555')
 assert.equal(unpriced.success,true,unpriced.error)
 assert.equal(tables.audit_log.find(row=>row.id==='55555555-5555-4555-8555-555555555555'&&row.action==='shipment_quote_request').details.estimated_price,null)
})

test('authorized staff can request for the open store with a trusted audit identity; permissions, suspension and tenant boundaries remain enforced',async()=>{
 const general={...service,id:'srv_linke_cor_intl',fuel_surcharge_pct:10,
  zones:[{zone_code:'EU 1',tiers:[{id:'tier',weight_max:30,enabled:true,sell_price:8,cost_price:3,margin_pct:0}]}]}
 const operator={...staff,client_id:B,colaborador_id:'trusted-collaborator',permissions:['Gestão de Clientes & Contratos'],user:{id:'trusted-staff',email:'operator@example.invalid'}}
 let actor=operator,blocked=false,emissions=0
 const tables={clients:[{id:A,tenant_id:T},{id:B,tenant_id:B}],servicos_linke:[{...general,tenant_id:T}],
  audit_log:[{id:'profile',tenant_id:T,action:'client_data',details:{...client,assigned_linke_service_ids:[]}}]}
 const db=fakeSupabase(tables,undefined,{persistInserts:true})
 const {hasPermission}=baseLoad('lib/auth/permissions.ts')
 const api=createLoader({zod,'@/lib/auth/context':{requireUser:async required=>{
  if(actor.role!=='client'&&!(typeof required==='string'?[required]:required||[]).some(permission=>hasPermission(actor,permission)))throw Error('DENIED')
  return actor
 }},'@/lib/supabase/server':{createAdminClient:()=>db.client},
  './shipments':{emitClientGuiaAction:async()=>{emissions++;throw Error('No carrier dispatch')}},
  '@/lib/client-portal/suspension':{readPortalAccess:async(tenant,id)=>{assert.equal(tenant,T);assert.equal(id,A);return{suspended:blocked,blocked}}},
 })('app/actions/shipment-form.ts')
 const input={...values,serviceId:general.id,volumesCount:1,requested_by:'spoof',requested_by_email:'spoof@example.invalid',requested_by_role:'client'}
 assert.equal((await api.getInternationalAirQuotationReferenceAction(A)).service.id,general.id)
 const result=await api.requestInternationalAirShipmentAction(input,A,ID)
 assert.equal(result.success,true,result.error);assert.equal(result.kind,'quotation')
 assert.equal((await api.requestInternationalAirShipmentAction(input,A,ID)).quotation.id,ID)
 const saved=tables.audit_log.find(row=>row.id===ID).details
 assert.equal(saved.client_id,A,'the explicit store wins over an old staff impersonation cookie')
 assert.equal(saved.requested_by,operator.user.id);assert.equal(saved.requested_by_email,operator.user.email)
 assert.equal(saved.requested_by_role,'employee');assert.equal(saved.requested_by_collaborator_id,operator.colaborador_id)
 const views=baseLoad('lib/shipments/quotations/server.ts')
 const customer=(await views.listQuotations(db.client,ctx,A)).requests[0]
 assert.equal(customer.requested_by,undefined);assert.equal(customer.requested_by_email,undefined)
 assert.equal(customer.requested_by_role,undefined);assert.equal(customer.requested_by_collaborator_id,undefined)
 const ops=(await views.listQuotations(db.client,operator,A)).requests[0]
 assert.equal(ops.requested_by_email,operator.user.email);assert.equal(ops.requested_by_role,'employee')
 const writes=db.writes.length
 assert.equal((await api.requestInternationalAirShipmentAction(input,B,ID)).success,false,'another tenant is inaccessible')
 assert.equal((await api.requestInternationalAirShipmentAction(input,undefined,ID)).success,false,'a staff request needs a selected store')
 blocked=true
 assert.equal((await api.requestInternationalAirShipmentAction(input,A,ID)).success,false)
 assert.equal(db.writes.length,writes)
 const queries=db.queries.length
 actor={...operator,permissions:[]}
 await assert.rejects(api.requestInternationalAirShipmentAction(input,A,ID),/DENIED/)
 await assert.rejects(api.getInternationalAirQuotationReferenceAction(A),/DENIED/)
 assert.equal(db.queries.length,queries,'permission failures happen before data access')
 actor={...operator,role:'admin',permissions:[]};blocked=false
 const admin=await api.requestInternationalAirShipmentAction(input,A,'66666666-6666-4666-8666-666666666666')
 assert.equal(admin.success,true,admin.error)
 assert.equal(tables.audit_log.find(row=>row.id===admin.quotation.id).details.requested_by_role,'admin')
 assert.equal(emissions,0);assert.ok(db.writes.every(write=>write.value.action==='shipment_quote_request'))
})

test('quotation unread counts and receipts belong to each operator and do not modify business status or revision',async()=>{
 const h=setup(),{countUnreadQuotations,markQuotationRead}=baseLoad('lib/shipments/quotations/reads.ts')
 assert.equal(await countUnreadQuotations(h.db.client,staff),0)
 await h.api.createQuotation(h.db.client,ctx,ID,client,service,values)
 await h.api.createQuotation(h.db.client,ctx,B,client,service,values)
 h.tables.audit_log.push({id:T,tenant_id:B,action:'shipment_quote_request',details:{id:T,client_id:A}})
 const colleague={...staff,user:{id:'another-operator'}}
 assert.equal(await countUnreadQuotations(h.db.client,staff),2)
 assert.equal(await markQuotationRead(h.db.client,staff,ID),1)
 assert.equal(await markQuotationRead(h.db.client,staff,ID),1)
 assert.equal(await countUnreadQuotations(h.db.client,colleague),2)
 const receipts=h.tables.audit_log.filter(row=>row.action==='shipment_quote_read')
 assert.equal(receipts.length,1);assert.equal(receipts[0].details.user_id,staff.user.id)
 assert.equal(receipts[0].details.quotation_id,ID)
 const source=h.tables.audit_log.find(row=>row.id===ID).details
 assert.equal(source.revision,0);assert.equal(source.status,'pending')
 const page=await h.api.listQuotations(h.db.client,staff)
 assert.equal(page.requests.find(row=>row.id===ID).is_unread,false)
 assert.equal(page.requests.find(row=>row.id===B).is_unread,true)
 const before=h.db.queries.length
 const customer=await h.api.listQuotations(h.db.client,ctx)
 assert.ok(customer.requests.every(row=>row.is_unread===undefined))
 assert.ok(h.db.queries.slice(before).every(query=>!query.filters.some(filter=>filter.field==='action'&&filter.value==='shipment_quote_read')))
 assert.equal(await markQuotationRead(h.db.client,colleague,ID),1)
 assert.equal(h.tables.audit_log.filter(row=>row.action==='shipment_quote_read').length,2)
 const queries=h.db.queries.length,writes=h.db.writes.length
 for(const denied of [ctx,{...staff,permissions:[]}]){
  await assert.rejects(countUnreadQuotations(h.db.client,denied),/Sem permissão/)
  await assert.rejects(markQuotationRead(h.db.client,denied,ID),/Sem permissão/)
 }
 assert.equal(h.db.queries.length,queries)
 await assert.rejects(markQuotationRead(h.db.client,staff,T),/sem acesso/)
 await assert.rejects(markQuotationRead(h.db.client,staff,'invalid'),/inválido/)
 assert.equal(h.db.writes.length,writes)
})

test('unread counts exceed the API row limit without downloading request contents; read failures do not silently report success',async()=>{
 const {countUnreadQuotations,markQuotationRead}=baseLoad('lib/shipments/quotations/reads.ts')
 const audit_log=Array.from({length:1005},(_,i)=>({id:`q-${i}`,tenant_id:T,action:'shipment_quote_request',details:{}}))
 audit_log.push(...Array.from({length:1003},(_,i)=>({id:`r-${i}`,tenant_id:T,action:'shipment_quote_read',details:{user_id:staff.user.id,quotation_id:`q-${i}`}})))
 const db=fakeSupabase({audit_log})
 assert.equal(await countUnreadQuotations(db.client,staff),2)
 assert.equal(db.queries.length,2)
 assert.ok(db.queries.every(query=>query.projection==='id'&&query.count==='exact'&&query.filters.some(filter=>filter.field==='tenant_id'&&filter.value===T)))
 const broken=fakeSupabase({audit_log:[]},()=>({message:'private failure'}))
 await assert.rejects(countUnreadQuotations(broken.client,staff),error=>!error.message.includes('private'))
 const cannotRead=fakeSupabase({audit_log:[{id:ID,tenant_id:T,action:'shipment_quote_request',details:{}}]},query=>query.write?{code:'XX',message:'private insert failure'}:null)
 await assert.rejects(markQuotationRead(cannotRead.client,staff,ID),error=>!error.message.includes('private'))
 assert.equal(cannotRead.writes.length,0)
})
