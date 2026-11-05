const test=require('node:test'),assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const credentials={environment:'test',solicitante:'fixture',codRte:'fixture',user:'fixture',pass:'fixture'}
const input={ref:'MOCK-ONLY-NO-SHIPMENT',producto:'93',bultos:1,kilos:1,portes:'P',remitente:{nombre:'Fixture',direccion:'Fixture',poblacion:'Porto',cpInternacional:'4000-001',paisISO:'PT'},destinatario:{nombre:'Fixture',direccion:'Fixture',poblacion:'Porto',cpInternacional:'4000-001',paisISO:'PT'}}
function harness(response){
 const requests=[]
 const {CorreosShipmentService}=createLoader({'./correos-rest-client':{CorreosRestClient:class{async request(endpoint,creds,payload){requests.push(payload);return response}}}})('lib/services/correos/correos-shipment.service.ts')
 return{requests,service:new CorreosShipmentService()}
}
for(const response of [{codigoRetorno:500,mensajeRetorno:'Producto no contratado'},{codigoRetorno:999,mensajeRetorno:'Error de producto'},{codigoRetorno:1,mensajeRetorno:'ERROR AL TASAR'}])test(`carrier rejection ${response.codigoRetorno}/${response.mensajeRetorno} never retries product 93 as PAQ24`,async()=>{
 const h=harness(response)
 const result=await h.service.createShipment(credentials,input)
 assert.equal(h.requests.length,1)
 assert.equal(h.requests[0].producto,'93')
 assert.deepEqual(result,response)
})
for(const producto of ['61','62','63','66','90','93'])test(`selected product ${producto} reaches the API unchanged on success`,async()=>{
 const response={codigoRetorno:0,datosResultado:'MOCK-TRACKING-ONLY'}
 const h=harness(response)
 assert.deepEqual(await h.service.createShipment(credentials,{...input,producto}),response)
 assert.equal(h.requests.length,1)
 assert.equal(h.requests[0].producto,producto)
})
test('product 90 refuses multiple parcels before contacting Correos and never switches to product 91',async()=>{
 const h=harness({codigoRetorno:0})
 await assert.rejects(()=>h.service.createShipment(credentials,{...input,producto:'90',bultos:3}),/90.*apenas um volume/)
 assert.equal(h.requests.length,0)
 await h.service.createShipment(credentials,{...input,producto:'91',bultos:3})
 assert.equal(h.requests[0].producto,'91');assert.equal(h.requests[0].numBultos,'3')
})
for(const country of ['LT','DE','FR']) test(`international ${country} COD is refused before any Correos call`,async()=>{
 const h=harness({codigoRetorno:0})
 await assert.rejects(()=>h.service.createShipment(credentials,{...input,producto:'90',reembolso:'50',
  destinatario:{...input.destinatario,paisISO:country,cpNacional:'',cpInternacional:'12345'}}),/COD.*destino/)
 assert.equal(h.requests.length,0)
})
for(const country of ['LT','DE']) test(`Correos 90 ${country}: TASAR is kept as a rejection and never retried under another product`,async()=>{
 const response={codigoRetorno:500,mensajeRetorno:'ERROR TASAR-1-0-ORA-0000: normal, successful completion'}
 const h=harness(response)
 const result=await h.service.createShipment(credentials,{...input,producto:'90',destinatario:{...input.destinatario,
  paisISO:country,cpNacional:'',cpInternacional:'12345'}})
 assert.equal(result.codigoRetorno,500)
 assert.equal(h.requests.length,1)
 assert.equal(h.requests[0].producto,'90')
 const {correosShipmentError}=createLoader({})('lib/services/correos/shipment-policy.ts')
 const message=correosShipmentError(result,'90',country)
 assert.ok(message.includes(`produto 90 e destino ${country}`))
 assert.match(message,/contrato Correos/)
})
