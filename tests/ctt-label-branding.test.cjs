const test=require('node:test')
const assert=require('node:assert/strict')
const path=require('node:path')
const {PDFDocument,PDFName,rgb,decodePDFRawStream}=require('pdf-lib')
const {createLoader}=require('./helpers/load-typescript.cjs')

function harness({missingLogo=false}={}){
 const {applyLinkeLogoToCttLabel}=createLoader({
  'pdf-lib':require('pdf-lib'),'node:path':path,
  'node:crypto':require('node:crypto'),
  'node:fs/promises':missingLogo?{readFile:async()=>{throw Error('fixture missing asset')}}:require('node:fs/promises'),
 })('lib/services/ctt/ctt-label-customizer.ts')
 return applyLinkeLogoToCttLabel
}
async function fixture({pages=1,size=[288,432],rotation=0,creator='Labelary fixture'}={}){
 const doc=await PDFDocument.create()
 doc.setCreator(creator)
 for(let i=0;i<pages;i++){
  const page=doc.addPage(size)
  if(rotation)page.setRotation({type:'degrees',angle:rotation})
  page.drawText('OFFICIAL CARRIER FIXTURE',{x:100,y:250,size:9,color:rgb(0,0,0)})
 }
 return Buffer.from(await doc.save()).toString('base64')
}

test('EQ branding retains page geometry and original content streams on every parcel label',async()=>{
 const original=await fixture({pages:2}),before=await PDFDocument.load(Buffer.from(original,'base64'))
 const branded=await harness()(original,'EQ000000001PT')
 assert.notEqual(branded,original)
 const after=await PDFDocument.load(Buffer.from(branded,'base64'))
 assert.equal(after.getPageCount(),2)
 assert.ok(after.catalog.has(PDFName.of('LinkeCttEqBranding')))
 for(let i=0;i<2;i++){
  const a=before.getPage(i),b=after.getPage(i)
  assert.deepEqual(b.getSize(),a.getSize());assert.deepEqual(b.getRotation(),a.getRotation())
  const source=a.node.Contents(),result=b.node.Contents()
  const originalStreams=source.asArray().map(ref=>before.context.lookup(ref).getContents())
  const finalStreams=result.asArray().map(ref=>after.context.lookup(ref).getContents())
  for(const stream of originalStreams)assert.ok(finalStreams.some(value=>Buffer.from(value).equals(Buffer.from(stream))))
 }
})

test('branding is idempotent across creation, download and print',async()=>{
 const brand=harness(),first=await brand(await fixture(),'EQ000000001PT')
 assert.equal(await brand(first,'EQ000000001PT'),first)
})

test('other products, document formats, rotations and unknown layouts are unchanged',async()=>{
 const brand=harness()
 for(const tracking of ['CE000000001PT','DD000000001PT','123456789','',undefined]){
  const original=await fixture();assert.equal(await brand(original,tracking),original)
 }
 for(const options of [{size:[595,842]},{size:[432,288]},{rotation:90},{creator:'Other carrier renderer'}]){
  const original=await fixture(options);assert.equal(await brand(original,'EQ000000001PT'),original)
 }
 assert.equal(await brand('^XA^FO20,20^FDfixture^FS^XZ','EQ000000001PT'),'^XA^FO20,20^FDfixture^FS^XZ')
 assert.equal(await brand('not-a-pdf','EQ000000001PT'),'not-a-pdf')
})

test('a missing logo or damaged PDF never prevents downloading the official label',async()=>{
 const original=await fixture()
 assert.equal(await harness({missingLogo:true})(original,'EQ000000001PT'),original)
 const damaged=Buffer.from('%PDF-damaged-fixture').toString('base64')
 assert.equal(await harness()(damaged,'EQ000000001PT'),damaged)
})

const logoFixture=require('./fixtures/ctt-eq-logo.json')
const logoDraw='q\n0.3547 0 0 0.3547 10.6404 20.2167 cm\nq\n88 0 0 131 0 0 cm\n/Im1 Do\nQ\nQ\n'
const formContent=doc=>Buffer.from(decodePDFRawStream(doc.getPage(0).node.Resources().lookup(PDFName.of('XObject')).lookup(PDFName.of('Form1'))).decode()).toString('latin1')
async function carrierFixture({legacy=false,unknownImage=false,unknownPosition=false,pages=1}={}){
 const doc=await PDFDocument.load(Buffer.from(await fixture({pages}),'base64'))
 for(const page of doc.getPages()){
  const pixels=Buffer.from(logoFixture.data,'base64')
  if(unknownImage)pixels[0]^=255
  const image=doc.context.register(doc.context.flateStream(pixels,{
   Type:'XObject',Subtype:'Image',Width:logoFixture.width,Height:logoFixture.height,
   BitsPerComponent:logoFixture.bitsPerComponent,ColorSpace:'DeviceGray',
  }))
  const content='q\n0 0 288 432 re\nW\nn\n'+(unknownPosition?logoDraw.replace('10.6404','11.6404'):logoDraw)+'0 0 0 rg\n100 200 20 30 re\nf\nQ\n'
  const form=doc.context.register(doc.context.flateStream(Buffer.from(content,'latin1'),{
   Type:'XObject',Subtype:'Form',BBox:[0,0,288,432],Resources:{XObject:{Im1:image}},
  }))
  page.node.Resources().lookup(PDFName.of('XObject')).set(PDFName.of('Form1'),form)
  page.pushOperators(require('pdf-lib').drawObject('Form1'))
 }
 if(legacy){
  const logo=await doc.embedPng(require('node:fs').readFileSync('public/linkelabel.png'))
  doc.getPage(0).drawImage(logo,{x:8,y:91,width:80,height:35})
  doc.catalog.set(PDFName.of('LinkeCttEqBranding'),PDFName.of('v1'))
 }
 return Buffer.from(await doc.save()).toString('base64')
}

test('only the verified CTT logo is removed on every EQ parcel; other form operators remain unchanged',async()=>{
 const original=await carrierFixture({pages:2}),before=await PDFDocument.load(Buffer.from(original,'base64'))
 const result=await harness()(original,'EQ000000001PT')
 const after=await PDFDocument.load(Buffer.from(result,'base64'))
 assert.equal(after.catalog.get(PDFName.of('LinkeCttEqBranding')).toString(),'/v2')
 for(let i=0;i<2;i++){
  const form=after.getPage(i).node.Resources().lookup(PDFName.of('XObject')).lookup(PDFName.of('Form1'))
  assert.equal(form.dict.lookup(PDFName.of('Resources')).lookup(PDFName.of('XObject')).has(PDFName.of('Im1')),false)
  assert.equal(Buffer.from(decodePDFRawStream(form).decode()).toString('latin1'),formContent(before).replace(logoDraw,''))
 }
 assert.equal(await harness()(result,'EQ000000001PT'),result)
})

test('previous Linke v1 labels lose CTT without adding a second Linke image or requiring the logo asset',async()=>{
 const original=await carrierFixture({legacy:true})
 const before=await PDFDocument.load(Buffer.from(original,'base64'))
 const result=await harness({missingLogo:true})(original,'EQ000000001PT')
 const after=await PDFDocument.load(Buffer.from(result,'base64'))
 assert.notEqual(result,original)
 assert.equal(after.catalog.get(PDFName.of('LinkeCttEqBranding')).toString(),'/v2')
 assert.equal(after.getPage(0).node.Resources().lookup(PDFName.of('XObject')).keys().length,before.getPage(0).node.Resources().lookup(PDFName.of('XObject')).keys().length)
 assert.equal(formContent(after),formContent(before).replace(logoDraw,''))
})

test('different images, logo positions and carrier products are never removed',async()=>{
 for(const options of [{unknownImage:true},{unknownPosition:true}]){
  const original=await carrierFixture(options)
  const result=await harness()(original,'EQ000000001PT')
  assert.equal(formContent(await PDFDocument.load(Buffer.from(result,'base64'))),formContent(await PDFDocument.load(Buffer.from(original,'base64'))))
 }
 const original=await carrierFixture()
 assert.equal(await harness()(original,'CE000000001PT'),original)
})
