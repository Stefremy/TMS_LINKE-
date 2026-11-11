const {test}=require('node:test')
const assert=require('node:assert/strict')
const React=require('react')
const {renderToStaticMarkup}=require('react-dom/server')
const {createLoader}=require('./helpers/load-typescript.cjs')
const jsx=require('react/jsx-runtime')
let portalScope=null
const load=createLoader({react:React,'react/jsx-runtime':jsx,zod:require('zod'),'react-hook-form':require('react-hook-form'),'@hookform/resolvers/zod':require('@hookform/resolvers/zod'),
 'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
 'next/image':{__esModule:true,default:props=>{const imageProps={...props};delete imageProps.unoptimized;return React.createElement('img',imageProps)}},'lucide-react':require('lucide-react'),
 '@/app/actions/shipment-form':{submitShipmentFormAction:async()=>{throw Error('No real emission permitted')}},
 '@/app/actions/shipments':{getShipmentLabelAction:async()=>null},'@/app/actions/ctt':{convertZplToPdfAction:async()=>({success:false})},
 '@/app/actions/destinatarios':{saveDestinatarioAction:async()=>({success:true})},'@/app/actions/servicos-linke':{getServicosLinkeAction:async()=>[]},
 '@/app/app/components/ClientScope':{useOptionalClientScope:()=>portalScope},'@/app/app/components/ClientTopUpModal':{ClientTopUpModal:()=>null},
 '@/lib/hooks/usePostalCodeLookup':{usePostalCodeLookup:()=>({lookup:value=>value,info:null,loading:false,reset(){}})},
 '@/lib/hooks/useRecipientAgenda':{useRecipientAgenda:()=>({recipients:[],loading:false,error:null})},
})
const {ShipmentForm}=load('components/shipments/form/ShipmentForm.tsx')
const service={id:'service',name:'CTT Expresso',code:'LK-DD-STD',carrier_group:'ctt',is_active:true,fuel_surcharge_pct:10,zones:[{zone_code:'PT-CONT',tiers:[{weight_max:30,sell_price:5,cost_price:9187,margin_pct:9876,enabled:true}]}]}
const client={id:'fixture',code:'TEST',short_name:'Loja de demonstração',phone:'912345678',address:'Rua de Origem 1',city:'Porto',postal_code:'4000-001',is_active:true,assigned_linke_service_ids:['service']}
const render=role=>renderToStaticMarkup(React.createElement(ShipmentForm,{role,client,services:[service],initialValues:{recipientName:'Destino',recipientAddress:'Rua de Destino 2',recipientCity:'Porto',recipientPostal:'4000-001',recipientPhone:'923456789',lengthCm:30,widthCm:20,heightCm:10,serviceId:'service'}}))
test('shared form renders the two accessible steps, client chip and native mobile summary without internal costs',()=>{
 const html=render('client')
 for(const text of ['Dados do envio','Remetente','Destinatário','Volumes e medidas','Serviço e preço','Revisão','Loja de demonstração','TEST','Guardar na agenda','Resumo do envio','aria-haspopup="dialog"','aria-valuemax="2"']) assert.ok(html.includes(text),text)
 assert.doesNotMatch(html,/Apenas Ops|internalNotes|carrierOverride|9187|9876/)
 assert.doesNotMatch(html,/alert\(/)
})
test('ops renders the same form with a collapsed internal panel, while archived forms remain available',()=>{
 const html=render('ops')
 assert.match(html,/Apenas Ops/);assert.match(html,/name="internalNotes"/);assert.match(html,/name="carrierOverride"/);assert.doesNotMatch(html,/name="manualPrice"/)
 const fs=require('node:fs')
 for(const file of ['app/app/components/LegacyClientCreateGuia.tsx','app/ops/envios/novo/LegacyNovoEnvioPageClient.tsx']) assert.ok(fs.existsSync(file))
})
test('the client portal never exposes ops controls, including staff previews with a requested ops role',()=>{
 portalScope={client,isEmployee:true,basePath:'/app/fixture'}
 try {
  const html=render('ops')
  assert.doesNotMatch(html,/Apenas Ops|internalNotes|carrierOverride|\/ops\/entidades\/clientes/)
  assert.match(html,/href="\/app\/fixture"/)
 } finally {portalScope=null}
})
test('Correos international form shows a quotation request instead of a sale price or COD',()=>{
 const table={...service,carrier_group:'correos',code:'LK-COR-INTL',name:'Correos Internacional',webservice_service_code:'90',
  allowed_zones:['EU 1'],zones:[]}
 const html=renderToStaticMarkup(React.createElement(ShipmentForm,{role:'client',client,services:[table],initialValues:{
  recipientName:'Destino',recipientCountry:'FR',recipientPostal:'75001',lengthCm:20,widthCm:15,heightCm:10,serviceId:'service'}}))
 assert.match(html,/Preço sob consulta/);assert.match(html,/Rever pedido de cotação/)
 assert.match(html,/Após aceitar a proposta, cria o envio no TMS/)
 assert.doesNotMatch(html,/Valor a cobrar ao destinatário|Transporte base \(tabela\)|9187|9876/)
})
test('Correos covered destinations display the table estimate without carrier costs or a confirmed price',()=>{
 const table={...service,carrier_group:'correos',code:'LK-COR-INTL',name:'Correos Internacional',webservice_service_code:'90',
  allowed_zones:['EU 1'],zones:[{zone_code:'EU 1',tiers:[{weight_max:30,enabled:true,sell_price:33.33,cost_price:9187,margin_pct:9876}]}]}
 const html=renderToStaticMarkup(React.createElement(ShipmentForm,{role:'client',client,services:[table],initialValues:{
  recipientName:'Destino',recipientCountry:'FR',recipientPostal:'75001',weightKg:1,lengthCm:20,widthCm:15,heightCm:10,serviceId:'service'}}))
 assert.match(html,/Preço estimado da tabela/);assert.match(html,/36,66/)
 assert.match(html,/<strong[^>]*>[^<]*\*<\/strong>/);assert.match(html,/\* Estimativa indicativa; o preço final e a disponibilidade serão confirmados pela equipa Linke/)
 assert.doesNotMatch(html,/Valor a cobrar ao destinatário|9187|9876|Preço sob consulta/)
})
test('requests have a store-scoped sidebar entry on desktop and mobile, without a panel above new shipment',()=>{
 const scope={client,isEmployee:false,basePath:'/app/fixture'}
 const uiLoad=createLoader({react:React,'react/jsx-runtime':jsx,'lucide-react':require('lucide-react'),
  'next/link':{__esModule:true,default:({children,...props})=>{delete props.prefetch;return React.createElement('a',props,children)}},
  'next/image':{__esModule:true,default:()=>null},'next/navigation':{usePathname:()=>'/app/fixture/cotacoes',useSearchParams:()=>new URLSearchParams()},
  '@/app/app/components/ClientScope':{useClientScope:()=>scope},'./ClientScope':{useClientScope:()=>scope},
  './ClientMessages':{ClientMessageBell:()=>null},'@/components/ui/mobile-drawer':{MobileDrawer:({children})=>children},
  './ClientAccountDetailsModal':{ClientAccountDetailsModal:()=>null},'./ClientImpersonationBanner':{ClientProfileSidebar:()=>null},
  '@/components/shipments/form/ShipmentForm':{ShipmentForm:()=>React.createElement('div',null,'Novo envio')},
 })
 const {ClientSidebarNav}=uiLoad('app/app/components/ClientSidebarNav.tsx')
 const {ClientMobileNav}=uiLoad('app/app/components/ClientMobileNav.tsx')
 for(const Component of [ClientSidebarNav,ClientMobileNav]){
  const html=renderToStaticMarkup(React.createElement(Component))
  assert.match(html,/href="\/app\/fixture\/cotacoes"/);assert.match(html,/Envio aéreo internacional/)
 }
 const {ClientCreateGuia}=uiLoad('app/app/components/ClientCreateGuia.tsx')
 const html=renderToStaticMarkup(React.createElement(ClientCreateGuia))
 assert.match(html,/Novo envio/);assert.doesNotMatch(html,/Pedidos e propostas|<details/)
})
test('requests page authorizes the store before fetching only its client view and selects the requested item',async()=>{
 let authorized=false
 const initial={requests:[],next:null}
 const {default:Page}=createLoader({'react/jsx-runtime':jsx,
  '@/lib/client-portal/access':{requirePortalStore:async slug=>{assert.equal(slug,'fixture');authorized=true;return {client,basePath:'/app/fixture'}}},
  '@/app/actions/shipment-quotations':{getShipmentQuotationsAction:async(...args)=>{assert.equal(authorized,true);assert.deepEqual(args,[client.id,undefined,true]);return initial}},
  '@/components/shipments/quotations/InternationalAirRequestsClient':{InternationalAirRequestsClient:()=>null},
 })('app/app/[storeSlug]/cotacoes/page.tsx')
 const page=await Page({params:Promise.resolve({storeSlug:'fixture'}),searchParams:Promise.resolve({pedido:'request-id'})})
 assert.equal(page.props.selectedId,'request-id');assert.equal(page.props.initial,initial)
})
test('the air request uses the general 90 estimate for every client and never links to new shipment',()=>{
 const table={...service,carrier_group:'correos',code:'LK-COR-INTL',name:'Correos Internacional',webservice_service_code:'90',
  allowed_zones:['EU 1'],zones:[{zone_code:'EU 1',tiers:[{weight_max:30,enabled:true,sell_price:33.33,cost_price:9187,margin_pct:9876}]}]}
 const {InternationalAirRequestForm}=load('components/shipments/quotations/InternationalAirRequestForm.tsx')
 const initialValues={recipientName:'Destino',recipientCountry:'FR',recipientPostal:'75001',weightKg:1,lengthCm:20,widthCm:15,heightCm:10,serviceId:'service'}
 const props={client,services:[table],initialValues,onCreated:()=>{},onNewRequest:()=>{}}
 const html=renderToStaticMarkup(React.createElement(InternationalAirRequestForm,props))
 assert.match(html,/aria-label="Pedido de envio internacional aéreo"/);assert.match(html,/Enviar pedido de cotação/)
 assert.match(html,/36,66/);assert.match(html,/disponibilidade do transporte aéreo serão confirmados/)
 assert.doesNotMatch(html,/Emitir guia|Rever pedido|criar-guia|9187|9876|COD|name="codValue"/)
 const unpriced=renderToStaticMarkup(React.createElement(InternationalAirRequestForm,{...props,initialValues:{...initialValues,recipientCountry:'BR',recipientPostal:'01310-200'}}))
 assert.match(unpriced,/Preço sob consulta/);assert.match(unpriced,/Enviar pedido de cotação/)
 const unauthorized=renderToStaticMarkup(React.createElement(InternationalAirRequestForm,{...props,client:{...client,assigned_linke_service_ids:[]}}))
 assert.match(unauthorized,/36,66/);assert.doesNotMatch(unauthorized,/não tem uma tabela Correos Internacional autorizada|<fieldset disabled/)
 const missingTable=renderToStaticMarkup(React.createElement(InternationalAirRequestForm,{...props,services:[],client:{...client,assigned_linke_service_ids:[]}}))
 assert.match(missingTable,/Preço sob consulta/);assert.match(missingTable,/Enviar pedido de cotação/);assert.doesNotMatch(missingTable,/<fieldset disabled/)
 const employee=renderToStaticMarkup(React.createElement(InternationalAirRequestForm,{...props,isEmployee:true}))
 assert.match(employee,/O pedido será registado em nome de Loja de demonstração/)
 assert.doesNotMatch(employee,/<fieldset disabled|O pedido deve ser enviado pela conta do cliente/)
 const normal=renderToStaticMarkup(React.createElement(ShipmentForm,{role:'client',client,services:[service,table],hideQuotationServices:true,initialValues}))
 assert.doesNotMatch(normal,/Correos Internacional|Rever pedido de cotação/)
})

test('the Ops quotations counter is a red numeric circle in full and collapsed menus and obeys route permissions',()=>{
 const uiLoad=createLoader({react:React,'react/jsx-runtime':jsx,'lucide-react':require('lucide-react'),
  'next/link':{__esModule:true,default:({children,...props})=>{delete props.prefetch;return React.createElement('a',props,children)}},
  'next/navigation':{usePathname:()=>'/ops'},
 })
 const {SidebarNav}=uiLoad('app/ops/components/SidebarNav.tsx')
 for(const collapsed of [false,true]){
  const html=renderToStaticMarkup(React.createElement(SidebarNav,{collapsed,quotationUnreadCount:4,access:{role:'admin',permissions:[]}}))
  assert.match(html,/href="\/ops\/envios\/cotacoes"/);assert.match(html,/aria-label="4 pedidos por ler"/)
  assert.match(html,/bg-red-600/);assert.match(html,/>4<\/span>/)
 }
 const hidden=renderToStaticMarkup(React.createElement(SidebarNav,{quotationUnreadCount:4,access:{role:'employee',permissions:['Faturação & Contas Correntes']}}))
 assert.doesNotMatch(hidden,/\/ops\/envios\/cotacoes|pedidos por ler/)
 const {QuotationUnreadBadge}=uiLoad('components/shipments/quotations/QuotationUnreadBadge.tsx')
 assert.equal(renderToStaticMarkup(React.createElement(QuotationUnreadBadge,{count:0})),'')
 const large=renderToStaticMarkup(React.createElement(QuotationUnreadBadge,{count:101}))
 assert.match(large,/101 pedidos por ler/);assert.match(large,/>99\+<\/span>/)
})

test('only a displayed Ops request is marked read, then refreshes the badge; failures keep the request unread',async t=>{
 const previous={window:global.window,document:global.document}
 t.after(()=>{global.window=previous.window;global.document=previous.document})
 for(const [mode,is_unread,fail,hidden] of [['ops',true,false],['ops',false,false],['client',true,false],['ops',true,true],['ops',true,false,true]]){
  const effects=[],tasks=[],state=[],events=[],calls=[]
  let visible
  global.document={visibilityState:hidden?'hidden':'visible',addEventListener:(name,fn)=>{visible=fn},removeEventListener:()=>{visible=undefined}}
  global.window={dispatchEvent:event=>events.push(event)}
  const fakeReact={useRef:value=>({current:value}),useState:value=>{const index=state.length;state.push(value);return[value,next=>{state[index]=typeof next==='function'?next(state[index]):next}]},useEffect:fn=>effects.push(fn),startTransition:fn=>tasks.push(fn())}
  const uiLoad=createLoader({react:fakeReact,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'lucide-react':new Proxy({},{get:(_,key)=>key}),
   'next/link':{__esModule:true,default:'a'},'@/app/actions/shipment-quotations':{markShipmentQuotationReadAction:async id=>{calls.push(id);if(fail)throw Error('Unavailable');return{count:2}}},
  })
  const {QuoteRequestsClient}=uiLoad('components/shipments/quotations/QuoteRequestsClient.tsx')
  QuoteRequestsClient({mode,basePath:'/ops',initial:{requests:[{id:'request',reference:'COT-TEST',status:'pending',created_at:'2026-11-06T10:00:00Z',shipment:{recipientCountry:'FR',volumesCount:1},is_unread}],next:null}})
  const cleanup=effects[0]()
  if(hidden){assert.equal(calls.length,0);document.visibilityState='visible';visible()}
  await Promise.all(tasks)
  const shouldRead=mode==='ops'&&is_unread
  assert.equal(calls.length,shouldRead?1:0)
  if(shouldRead&&!fail){assert.equal(state[0].requests[0].is_unread,false);assert.equal(events[0].detail.count,2)}
  else {assert.equal(state[0].requests[0].is_unread,is_unread);assert.equal(events.length,0)}
  cleanup?.()
 }
})

test('the unread poll pauses in hidden tabs, avoids duplicate requests and cannot overwrite a newer read event',async t=>{
 const previous={window:global.window,document:global.document}
 t.after(()=>{global.window=previous.window;global.document=previous.document})
 const listeners={},effects=[],tasks=[],updates=[]
 let timer,cleared=false,resolveCount,calls=0
 global.document={visibilityState:'visible',addEventListener:(name,fn)=>{listeners[name]=fn},removeEventListener:name=>{delete listeners[name]}}
 global.window={setInterval:(fn,ms)=>{assert.equal(ms,30000);timer=fn;return 1},clearInterval:()=>{cleared=true},addEventListener:(name,fn)=>{listeners[name]=fn},removeEventListener:name=>{delete listeners[name]}}
 const uiLoad=createLoader({react:{useState:()=>[0,value=>updates.push(value)],useEffect:fn=>effects.push(fn),startTransition:fn=>tasks.push(fn())},
  '@/app/actions/shipment-quotations':{getUnreadShipmentQuotationsAction:async()=>{calls++;return new Promise(resolve=>{resolveCount=resolve})}},
 })
 const {useQuotationUnread}=uiLoad('components/shipments/quotations/useQuotationUnread.ts')
 const {QUOTATION_UNREAD_EVENT}=uiLoad('lib/shipments/quotations/types.ts')
 assert.equal(useQuotationUnread(true),0)
 const cleanup=effects[0]()
 await new Promise(resolve=>setImmediate(resolve))
 listeners.focus();assert.equal(calls,1,'a focus event cannot start a second poll while one is running')
 listeners[QUOTATION_UNREAD_EVENT]({detail:{count:2}})
 resolveCount(7);await Promise.all(tasks)
 assert.deepEqual(updates,[2],'the old poll must not overwrite the count returned by marking a request read')
 document.visibilityState='hidden';timer();assert.equal(calls,1)
 cleanup();assert.equal(cleared,true);assert.deepEqual(Object.keys(listeners),[])
})
