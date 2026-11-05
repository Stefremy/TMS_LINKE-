const test=require('node:test')
const assert=require('node:assert/strict')
const pdfLib=require('pdf-lib')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {fakeSupabase}=require('./helpers/fake-supabase.cjs')
const conversions=[]
const load=createLoader({'pdf-lib':pdfLib,'@/lib/label-utils':{convertZplToPdfBase64:async zpl=>{conversions.push(zpl);return fixture(7)}}})
const {combineCarrierLabels}=load('lib/services/shipments/label-bundle.ts')
const {getCttShipmentLabels}=load('lib/services/ctt/shipment-label.ts')
const {getCorreosShipmentLabels}=load('lib/services/correos/shipment-labels.ts')
async function fixture(...parcels){
 const doc=await pdfLib.PDFDocument.create()
 for(const parcel of parcels) doc.addPage([200+parcel,300]).drawText(`PARCEL ${parcel} - UNIQUE BARCODE ${parcel}`)
 return Buffer.from(await doc.save()).toString('base64')
}
async function widths(label){return(await pdfLib.PDFDocument.load(Buffer.from(label.data,'base64'))).getPages().map(page=>page.getWidth())}

test('CTT: three separate parcel labels become three pages in their original order and dimensions',async()=>{
 const files=await Promise.all([1,2,3].map(n=>fixture(n)))
 const labels=getCttShipmentLabels({LabelList:files.map((Label,n)=>({FileName:`parcel-${n+1}.pdf`,Label}))})
 assert.equal(labels.length,3)
 const combined=await combineCarrierLabels(labels)
 assert.deepEqual(await widths(combined),[201,202,203])
})
test('Correos: numbered keys, separate entries and a precombined PDF all retain three distinct pages',async()=>{
 const [one,two,three]=await Promise.all([1,2,3].map(n=>fixture(n)))
 for(const response of [
  {etiqueta:[{etiqueta3:three,etiqueta1:one,etiqueta2:two}]},
  {etiqueta:[{etiqueta1:one},{etiqueta2:two},{etiqueta3:three}]},
  {listaInformacionAdicional:[{etiquetaPDF:await fixture(1,2,3)}]},
  {etiqueta:[{etiqueta2:'No se ha generado etiqueta'}],listaInformacionAdicional:[{etiquetaPDF:await fixture(1,2,3)}]},
  {etiqueta:[{etiqueta1:Buffer.from(await fixture(1,2,3)).toString('base64')}]},
 ]) assert.deepEqual(await widths(await combineCarrierLabels(getCorreosShipmentLabels(response))),[201,202,203])
 const alternate={etiqueta:[{etiqueta1:one},{etiqueta2:two},{etiqueta3:three}],listaInformacionAdicional:[{etiquetaPDF:await fixture(1,2,3)}]}
 assert.deepEqual(await widths(await combineCarrierLabels(getCorreosShipmentLabels(alternate))),[201,202,203],'alternate representations must not double the pages')
})
test('CTT documents include every transport label while excluding customs and acceptance documents',async()=>{
 const labels=await Promise.all([1,2,3].map(async n=>({FileName:`etiqueta-${n}.pdf`,File:await fixture(n)})))
 labels.push({FileName:'CN23.pdf',File:await fixture(99)},{FileName:'acceptance.pdf',File:await fixture(98)})
 assert.deepEqual(await widths(await combineCarrierLabels(getCttShipmentLabels({DocumentsList:labels}))),[201,202,203])
})
test('ZPL entries are concatenated for one conversion and Labelary requests all pages instead of index zero',async()=>{
 const zpls=[1,2,3].map(n=>`^XA^FO20,20^FDBARCODE-${n}^FS^XZ`)
 const labels=getCttShipmentLabels({LabelList:zpls.map(Label=>({FileName:'parcel.zpl',Label:Buffer.from(Label).toString('base64')}))})
 const combined=await combineCarrierLabels(labels)
 assert.equal(combined.format,'zpl');assert.equal(combined.data,zpls.join('\n'))
 const requests=[]
 const realConvert=createLoader({fetch:async(url,options)=>{requests.push({url,options});return{ok:true,arrayBuffer:async()=>Buffer.from(await fixture(1,2,3),'base64')}}})('lib/label-utils.ts').convertZplToPdfBase64
 assert.deepEqual(await widths({data:await realConvert(combined.data)}),[201,202,203])
 assert.equal(requests[0].url,'https://api.labelary.com/v1/printers/8dpmm/labels/4x6/')
 assert.equal(requests[0].options.body,combined.data)
})
test('mixed PDF and ZPL responses retain both labels and single PDFs stay byte-identical',async()=>{
 const pdf=await fixture(1)
 assert.equal((await combineCarrierLabels([{data:pdf,format:'pdf'}])).data,pdf)
 assert.deepEqual(await widths(await combineCarrierLabels([{data:pdf,format:'pdf'},{data:'^XA^FDfixture^FS^XZ',format:'zpl'}])),[201,207])
 assert.equal(conversions.length,1)
 assert.equal(await combineCarrierLabels([]),null)
})

test('the authenticated browser conversion action also requests every ZPL page',async()=>{
 const requests=[]
 let authorized=0
 const api=createLoader({
  '@/lib/supabase/server':{},'next/cache':{},'@/lib/auth/context':{requireUser:async()=>{authorized++}},
  '@/lib/services/tracking':{},'@/lib/services/carriers/ctt-provider':{},'@/lib/services/carriers/credentials':{},
  '@/lib/services/ctt':{},'@/lib/services/ctt/close-manifest':{},
  fetch:async(url,options)=>{requests.push({url,options});return{ok:true,arrayBuffer:async()=>Buffer.from(await fixture(1,2,3),'base64')}},
 })('app/actions/ctt.ts')
 const zpl=[1,2,3].map(n=>`^XA^FDBARCODE-${n}^FS^XZ`).join('\n')
 const result=await api.convertZplToPdfAction(zpl)
 assert.equal(authorized,1)
 assert.equal(result.success,true)
 assert.equal(requests[0].url,'https://api.labelary.com/v1/printers/8dpmm/labels/4x6/')
 assert.deepEqual(await widths({data:result.base64}),[201,202,203])
})

test('CTT provider returns all parcel labels across shipment outputs, preserving accepted creation on a PDF processing failure',async()=>{
 const files=await Promise.all([1,2,3].map(n=>fixture(n)))
 let calls=0
 const outputs=files.map((Label,n)=>({FirstObject:`DD00000000${n+1}PT`,LabelList:[{FileName:`label-${n}.pdf`,Label}]}))
 const providerLoad=createLoader({'pdf-lib':pdfLib,'../ctt':{CTTShipmentService:class{
  async createShipment(){calls++;return{Status:1,ShipmentData:outputs}}
 },CTTPickupService:class{},CTTTrackingService:class{}}})
 const provider=new(providerLoad('lib/services/carriers/ctt-provider.ts').CttProvider)()
 await provider.initialize({})
 const input={reference:'FIXTURE-ONLY',subProduct:'EMSF010.01',volumes:3,weightKg:1,autoClose:false,
  sender:{name:'Fixture',address:'Fixture',city:'Porto',zip:'4000-001',country:'PT'},
  recipient:{name:'Fixture',address:'Fixture',city:'Lisboa',zip:'1000-001',country:'PT'}}
 const result=await provider.createShipment(input)
 assert.equal(result.success,true);assert.equal(calls,1)
 assert.deepEqual(await widths({data:result.labelBase64}),[201,202,203])
 for(const country of ['LT','DE']) {
  const denied=await provider.createShipment({...input,codValue:50,recipient:{...input.recipient,country,zip:'12345'}})
  assert.equal(denied.success,false);assert.equal(denied.confirmedRejection,true);assert.equal(calls,1)
 }
 outputs[1].LabelList[0].Label='JVBERi0broken'
 const accepted=await provider.createShipment(input)
 assert.equal(accepted.success,true);assert.equal(accepted.labelBase64,undefined)
 assert.equal(accepted.rawResponse.ShipmentData.length,3)
 assert.equal(calls,2,'never repeat creation to recover a label')
})

test('authorized reprints recover every retained CTT label even when an older cache contains only the first page',async()=>{
 const files=await Promise.all([1,2,3].map(n=>fixture(n)))
 const id='22222222-2222-4222-8222-222222222222'
 const db=fakeSupabase({shipments:[{id,tenant_id:'tenant',client_id:'own-client',carrier_code:'ctt'}],audit_log:[{
  tenant_id:'tenant',action:'shipment_data',details:{id,client_id:'own-client',carrier_code:'ctt',ctt_label_base64:files[0],
   rawResponse:{ShipmentData:[{LabelList:files.map((Label,n)=>({FileName:`label-${n}.pdf`,Label}))}]}}}]})
 const api=createLoader({'pdf-lib':pdfLib,'@/lib/supabase/server':{createAdminClient:()=>db.client},
  '@/lib/auth/context':{requireUser:async()=>({role:'client',tenant_id:'tenant',client_id:'own-client'})},
  '@/lib/services/correos/correos-label-customizer':{},'@/lib/label-utils':{}})('lib/services/shipments/shipment-fetcher.ts')
 const data=await api.fetchShipmentLabel(id)
 assert.deepEqual(await widths({data}),[201,202,203])
 assert.equal(db.writes.length,0)
})
