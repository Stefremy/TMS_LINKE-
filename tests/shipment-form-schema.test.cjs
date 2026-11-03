const {test}=require('node:test')
const assert=require('node:assert/strict')
const {createLoader}=require('./helpers/load-typescript.cjs')
const {shipmentFormSchema,shipmentDefaults,stepForField}=createLoader({zod:require('zod')})('components/shipments/form/schema.ts')
const valid=()=>({...shipmentDefaults({short_name:'Loja',address:'Rua da Loja 1',city:'Porto',postal_code:'4000-001',phone:'912345678'}),
 recipientName:'Destinatário',recipientAddress:'Rua de Destino 2',recipientCity:'Lisboa',recipientPostal:'1000-001',recipientPhone:'923456789',serviceId:'configured-service',lengthCm:30,widthCm:20,heightCm:10})
test('shared schema accepts complete PT and ES addresses without inventing contacts or service identities',()=>{
 assert.equal(shipmentFormSchema.safeParse(valid()).success,true)
 assert.equal(shipmentDefaults({}).senderPhone,'')
 for(const [field,value] of [['senderPhone',''],['senderName',''],['serviceId',''],['recipientPostal','1000'],['weightKg',NaN],['lengthCm',0],['volumesCount',1.5]]){
  const result=shipmentFormSchema.safeParse({...valid(),[field]:value})
  assert.equal(result.success,false,field);assert.ok(result.error.issues.some(issue=>issue.path[0]===field),field)
 }
 assert.equal(shipmentFormSchema.safeParse({...valid(),recipientCountry:'ES',recipientPostal:'28013'}).success,true)
})
test('COD and per-parcel totals fail at named fields and never accept a manual price',()=>{
 for(const patch of [{selectedSpecialServices:['cod'],codValue:0},{volumesCount:2,parcelWeightsKg:[0.2,0.2]},{manualPrice:0.01}]) assert.equal(shipmentFormSchema.safeParse({...valid(),...patch}).success,false)
 assert.equal(shipmentFormSchema.safeParse({...valid(),volumesCount:2,parcelWeightsKg:[0.4,0.6],selectedSpecialServices:['cod'],codValue:50}).success,true)
 assert.equal(stepForField('parcelWeightsKg.1'),0);assert.equal(stepForField('serviceId'),0)
})
test('schema preserves optional export fields across steps and validates email separately',()=>{
 const data={...valid(),recipientPhone:'',recipientEmail:'destino@example.pt',exportFields:{ctt_export_type:'Permanent',ctt_content_type:'Goods',ctt_declared_value:'50'}}
 assert.deepEqual(shipmentFormSchema.parse(data).exportFields,data.exportFields)
 assert.equal(shipmentFormSchema.safeParse({...data,recipientEmail:'invalid'}).success,false)
})
