const test=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')

function harness(response){
 const requests=[]
 const transport={request(url,options,callback){
  const sent={url:String(url),options}
  return{
   on(){return this},setTimeout(){return this},
   write(body){sent.body=JSON.parse(body)},
   end(){requests.push(sent);const handlers={};callback({statusCode:200,on(name,handler){handlers[name]=handler;return this}});handlers.data(JSON.stringify(response));handlers.end()},
  }
 }}
 const {CorreosPickupService}=createLoader({https:transport})('lib/services/correos/correos-pickup.service.ts')
 return{requests,service:new CorreosPickupService()}
}

const creds={environment:'test',solicitante:'fixture',codRte:'555559999',user:'fixture',pass:'fixture'}
const input={date:'2026-11-28',startHour:'10:00',endHour:'13:00',volumes:2,weightKg:5,heaviestWeightKg:3,
 sender:{name:'Armazem Principal',address:'Rua X 1',country:'PT',zip:'4000123',city:'Porto',phone:'+351 910 000 001',email:'a@b.pt'}}

test('Correos pickup: documented grabarRecogida endpoint and field names',async()=>{
 const h=harness({resultado:'1',numRecogida:'8951021',codError:0,mensError:null})
 const result=await h.service.createPickup(creds,input)
 assert.equal(h.requests.length,1)
 const {url,body}=h.requests[0]
 assert.equal(url,'https://www.test.cexpr.es/wspsc/apiRestGrabacionRecogidaEnviok8s/json/grabarRecogida')
 assert.equal(body.fechaRecogida,'28112026')
 assert.equal(body.horaDesde1,'10:00');assert.equal(body.horaHasta1,'13:00')
 assert.equal(body.clienteRecogida,'555559999')
 assert.equal(body.cpRecog,'4000-123')
 assert.equal(body.tlfnoRecog,'351910000001')
 assert.equal(body.tipoPortes,'P');assert.equal(body.producto,'63')
 assert.match(body.refRecogida,/^LNK\d+$/)
 assert.equal(body.fecha,undefined,'old wrong field names are gone')
 assert.deepEqual({success:result.success,pickupNumber:result.pickupNumber},{success:true,pickupNumber:'8951021'})
})

test('Correos pickup: a KO answer is a failure with the Correos message, never a made-up number',async()=>{
 const h=harness({resultado:null,numRecogida:null,codError:117,mensError:'NO EXISTE EL CODIGO POSTAL: 4000-123'})
 const result=await h.service.createPickup(creds,input)
 assert.equal(result.success,false)
 assert.equal(result.pickupNumber,undefined)
 assert.equal(result.error,'Correos Express (117): NO EXISTE EL CODIGO POSTAL: 4000-123')
})

test('Correos cut-off: documented horaCorte endpoint and fields; a not-found answer is an error, not a time',async()=>{
 const ok=harness({horaCorte:'11:00',ultimaLlamada:'18:00',codError:0,mensError:null})
 assert.deepEqual(await ok.service.getCutoff(creds,'4505-515','pt'),{success:true,cutoff:'11:00',lastCall:'18:00'})
 assert.equal(ok.requests[0].url,'https://www.test.cexpr.es/wspsc/apiRestGrabacionRecogidaEnviok8s/json/horaCorte')
 assert.deepEqual(ok.requests[0].body,{strCP:'4505-515',strPais:'PT'})
 const ko=harness({horaCorte:null,ultimaLlamada:null,codError:1,mensError:'NO SE HA ENCONTRADO NINGUN REGISTRO PARA EL CÓDIGO POSTAL: '})
 const r=await ko.service.getCutoff(creds,'4505-515','PT')
 assert.equal(r.success,false);assert.match(r.error,/NO SE HA ENCONTRADO/)
})
