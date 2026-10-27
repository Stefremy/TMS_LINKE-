const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')

function harness(){
 const requests=[]
 const {CorreosShipmentService}=createLoader({'./correos-rest-client':{CorreosRestClient:class{
  async request(endpoint,credentials,payload){requests.push(payload);return{codigoRetorno:0,datosResultado:'MOCK-ONLY'}}
 }}})('lib/services/correos/correos-shipment.service.ts')
 const service=new CorreosShipmentService()
 const input={ref:'NO-REAL-SHIPMENT',bultos:1,kilos:1.5,producto:'63',portes:'P',
  dimensionsCm:{length:30.5,width:20,height:10.2},
  remitente:{nombre:'Fixture',direccion:'Fixture',poblacion:'Porto',cpInternacional:'4000-001',paisISO:'PT'},
  destinatario:{nombre:'Fixture',direccion:'Fixture',poblacion:'Fixture',cpInternacional:'1000',paisISO:'BE'}}
 return{requests,async send(patch={}){await service.createShipment({environment:'test',solicitante:'fixture',codRte:'fixture',user:'fixture',pass:'fixture'},{...input,...patch});return requests.at(-1)}}
}
for(const country of ['PT','ES','BE']) test(`Correos ${country}: actual parcel dimensions and 1.5 kg reach the carrier without zero substitution`,async()=>{
 const h=harness()
 const payload=await h.send({destinatario:{nombre:'Fixture',direccion:'Fixture',poblacion:'Fixture',cpInternacional:'4000-001',paisISO:country}})
 assert.equal(payload.kilos,'1.5');assert.equal(payload.numBultos,'1')
 assert.deepEqual(payload.listaBultos,[{orden:'1',kilos:'1.500',alto:'10.2',largo:'30.5',ancho:'20'}])
 assert.equal(payload.paisISODest,country)
})
test('Correos multi-parcel rounding preserves the exact total and the declared common dimensions on every label',async()=>{
 const payload=await harness().send({bultos:7,kilos:1.5})
 assert.equal(payload.listaBultos.length,7)
 assert.equal(payload.listaBultos.reduce((sum,p)=>sum+Math.round(Number(p.kilos)*1000),0),1500)
 assert.ok(payload.listaBultos.every(p=>p.alto==='10.2'&&p.largo==='30.5'&&p.ancho==='20'))
})
test('explicit parcel weights and different sizes are retained without mutation or blanket replacement',async()=>{
 const parcels=[{orden:'1',kilos:'0.500',alto:'10',largo:'20',ancho:'15'},{orden:'2',kilos:'1.000',alto:'15',largo:'40.5',ancho:'20'}]
 const before=structuredClone(parcels)
 const payload=await harness().send({bultos:2,listaBultos:parcels})
 assert.deepEqual(payload.listaBultos,before);assert.deepEqual(parcels,before)
})
test('unknown legacy dimensions are omitted instead of being reported as real zero measurements',async()=>{
 const payload=await harness().send({dimensionsCm:undefined})
 for(const key of ['alto','largo','ancho'])assert.equal(key in payload.listaBultos[0],false)
})
for(const patch of [{kilos:0},{kilos:NaN},{bultos:0},{bultos:1.5},{dimensionsCm:{length:0,width:20,height:10}},{dimensionsCm:{length:30,width:Infinity,height:10}}]){
 test(`invalid Correos measurements stop before any carrier request (${JSON.stringify(patch)})`,async()=>{
  const h=harness();await assert.rejects(()=>h.send(patch),/peso|volumes|comprimento/);assert.equal(h.requests.length,0)
 })
}
