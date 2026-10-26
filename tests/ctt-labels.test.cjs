const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const pdf=Buffer.from('%PDF-1.4\nCarrier fixture only').toString('base64')
const {getCttShipmentLabel}=createLoader({})('lib/services/ctt/shipment-label.ts')

test('CE PDF documents are returned as the official label when LabelList is empty',async()=>{
 const sent=[]
 const Service=createLoader({'./ctt-soap-client':{CTTSoapClient:class{
  static escapeXml(s){return String(s||'')}
  async callSoap(input){sent.push(input);return{CreateShipmentResponse:{CreateShipmentResult:{Status:'Success',ShipmentData:{ShipmentDataOutput:{
   FirstObject:'CE000000001PT',DocumentsList:{DocumentData:{FileName:'CE000000001PT.pdf',File:pdf}},LabelList:{'@_nil':'true'},
  }}}}}}
 }}})('lib/services/ctt/ctt-shipment.service.ts').CTTShipmentService
 const Provider=createLoader({'../ctt':{CTTShipmentService:Service,CTTPickupService:class{},CTTTrackingService:class{}}})('lib/services/carriers/ctt-provider.ts').CttProvider
 const provider=new Provider()
 await provider.initialize({auth_id:'fixture',client_number:'fixture',contract_number:'fixture'})
 const result=await provider.createShipment({reference:'NO-REAL-SHIPMENT',subProduct:'ENCF008.02',autoClose:false,weightKg:1,volumes:1,
  sender:{name:'Fixture',address:'Fixture',city:'Porto',zip:'4000-001',country:'PT'},
  recipient:{name:'Fixture',address:'Fixture',city:'Helsinki',zip:'00100',country:'FI'},
  cttExportDetails:{exportType:'Permanent',contentType:'Goods',declaredValue:10}})
 assert.equal(sent.length,1)
 assert.equal(result.success,true);assert.equal(result.trackingNumber,'CE000000001PT')
 assert.equal(result.labelBase64,pdf);assert.equal(result.labelFormat,'pdf')
 assert.deepEqual(result.rawResponse.ShipmentData[0].DocumentsList,[{FileName:'CE000000001PT.pdf',File:pdf}])
})
test('ZPL labels, base64 ZPL and PDF labels retain their actual format',()=>{
 for(const data of ['^XA^FO20,20^FDfixture^FS^XZ',Buffer.from('^XA^FO20,20^FDfixture^FS^XZ').toString('base64')]){
  const label=getCttShipmentLabel({LabelList:[{FileName:'label.zpl',Label:data}]})
  assert.equal(label.format,'zpl');assert.ok(label.data.startsWith('^XA'))
 }
 assert.deepEqual(getCttShipmentLabel({LabelList:[{FileName:'label.pdf',Label:pdf}]}),{data:pdf,format:'pdf'})
})
test('customs documents and acceptance certificates are never used as a transport label',()=>{
 const docs=['CN23.pdf','commercial-invoice.pdf','certificado.pdf','declaracao.pdf'].map(FileName=>({FileName,File:pdf}))
 assert.equal(getCttShipmentLabel({DocumentsList:docs}),null)
 assert.equal(getCttShipmentLabel({DocumentsList:[{FileName:'unknown-a.pdf',File:pdf},{FileName:'unknown-b.pdf',File:pdf}]}),null)
 assert.deepEqual(getCttShipmentLabel({DocumentsList:[...docs,{FileName:'guia-transporte.pdf',File:pdf}]}),{data:pdf,format:'pdf'})
})

const tenant='11111111-1111-1111-1111-111111111111',owner='22222222-2222-2222-2222-222222222222',id='33333333-3333-4333-8333-333333333333'
function retrieval({snapshot={},native={},otherOwner=false}={}){
 const client=otherOwner?'other-store':owner
 const db=fakeSupabase({shipments:[{id,tenant_id:tenant,client_id:client,carrier_tracking_number:'CE000000001PT',carrier_code:'ctt',...native}],
  audit_log:[{tenant_id:tenant,action:'shipment_data',created_at:'2026-10-26',details:{id,client_id:client,carrier_tracking_number:'CE000000001PT',carrier_code:'ctt',...snapshot}}]})
 let substitute=0
 const api=createLoader({'@/lib/supabase/server':{createAdminClient:()=>db.client},'@/lib/auth/context':{requireUser:async()=>({role:'client',tenant_id:tenant,client_id:owner})},
  '@/lib/services/correos/correos-label-customizer':{},'@/lib/label-utils':{},'./transport-label-generator':{generateTransportLabelPdfBase64(){substitute++;return'NOT-OFFICIAL'}}})('lib/services/shipments/shipment-fetcher.ts')
 return{db,api,get substitute(){return substitute}}
}
test('stored carrier PDFs can be retrieved from the audit documents with the same tracking number',async()=>{
 const h=retrieval({snapshot:{ctt_documents:[{FileName:'guia.pdf',File:pdf}]}})
 assert.equal(await h.api.fetchShipmentLabel(id),pdf)
 assert.equal(h.db.writes.length,0);assert.equal(h.substitute,0)
 assert.ok(h.db.queries.every(q=>q.filters.some(f=>f.field==='tenant_id'&&f.value===tenant)))
})
test('missing official labels return unavailable and never generate substitute carrier labels',async()=>{
 const h=retrieval()
 assert.equal(await h.api.fetchShipmentLabel(id),null);assert.equal(h.substitute,0);assert.equal(h.db.writes.length,0)
})
test('another store cannot retrieve the stored PDF or document snapshot',async()=>{
 const h=retrieval({otherOwner:true,snapshot:{ctt_label_base64:pdf,ctt_documents:[{FileName:'guia.pdf',File:pdf}]}})
 assert.equal(await h.api.fetchShipmentLabel(id),null)
 assert.equal(h.substitute,0);assert.equal(h.db.writes.length,0)
})
