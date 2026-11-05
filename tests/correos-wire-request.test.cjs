const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')

function harness(response){
 const requests=[]
 const transport={request(url,options,callback){
  const sent={url,options}
  return{
   on(){return this},setTimeout(){return this},
   write(body){sent.body=JSON.parse(body)},
   end(){requests.push(sent);const handlers={};callback({statusCode:200,on(name,handler){handlers[name]=handler;return this}});handlers.data(JSON.stringify(response));handlers.end()},
  }
 }}
 const {CorreosShipmentService}=createLoader({https:transport})('lib/services/correos/correos-shipment.service.ts')
 return{requests,service:new CorreosShipmentService()}
}

for(const [product,country,postal,sentPostal] of [['90','LT','LT-09601','09601'],['90','DE','10115','10115'],['91','FR','75001','75001']]) {
 test(`Correos ${product} ${country}: actual HTTP body preserves one parcel, normalizes the postcode and converts 5 cm to 0.05 m`,async()=>{
  const rejection={codigoRetorno:500,mensajeRetorno:'ERROR TASAR-1-0-ORA-0000: normal, successful completion'}
  const h=harness(rejection)
  const result=await h.service.createShipment({environment:'production',solicitante:'fixture',codRte:'fixture',user:'fixture',pass:'fixture'},{
   ref:'FIXTURE-NO-REAL-SHIPMENT',fecha:'05112026',producto:product,portes:'P',bultos:1,kilos:1,
   dimensionsCm:{length:5,width:5,height:5},tipoEtiqueta:'1',
   remitente:{nombre:'Fixture',direccion:'Fixture',poblacion:'Fixture',paisISO:'PT',cpInternacional:'4000-001',telefono:'910000001'},
   destinatario:{nombre:'Fixture',direccion:'Fixture',poblacion:'Fixture',paisISO:country,cpInternacional:postal,telefono:'910000002'},
  })
  assert.equal(h.requests.length,1,'a rejection never causes an automatic retry or product change')
  const {body}=h.requests[0]
  assert.equal(body.producto,product)
  assert.equal(body.paisISODest,country)
  assert.equal(body.codPosIntDest,sentPostal)
  assert.equal(body.numBultos,'1');assert.equal(body.kilos,'1')
  assert.equal(body.reembolso,'')
  assert.deepEqual(body.listaBultos,[{orden:'1',kilos:'1.000',alto:'0.05',largo:'0.05',ancho:'0.05',volumen:'0'}])
  assert.equal(h.requests[0].options.rejectUnauthorized,true)
  assert.deepEqual(result,rejection)
 })
}
