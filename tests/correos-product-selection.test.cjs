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
