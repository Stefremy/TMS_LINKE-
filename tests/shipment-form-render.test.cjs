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
