const test = require('node:test')
const assert = require('node:assert/strict')
const {XMLParser} = require('fast-xml-parser')
const {createLoader} = require('./helpers/load-typescript.cjs')
const destinations = require('./fixtures/eu-public-destinations.json')
const load = createLoader({})
const {buildOfficialCeTruckZones} = load('lib/services/geo/international-zones.ts')
const {getServiceDestinationCountries,getServiceDestinationZone} = load('lib/services/service-destinations.ts')
const {assertShipmentDestinationAvailable} = load('lib/services/shipment-destination-policy.ts')
const {calculateShipmentPrice} = load('lib/pricing/calculate-shipment-price.ts')
const service = {id:'fixture-ce',name:'CTT Europa Terrestre — TESTE',preferred_carrier_name:'CTT Expresso',
  webservice_service_code:'ENCF008.02',is_active:true,allowed_zones:['Zona 2','Zona 3'],zones:buildOfficialCeTruckZones()}
const client = {id:'fixture-client',short_name:'CLIENTE FICTÍCIO — NÃO EXPEDIR',default_linke_table_id:service.id,pricing:{}}
const profiles = [
  {weightKg:0.5,volumes:1,dimensionsCm:{length:13,width:11,height:7.5}},
  {weightKg:1.5,volumes:2,dimensionsCm:{length:30.5,width:20,height:10.2}},
  {weightKg:5.25,volumes:3,dimensionsCm:{length:40,width:30,height:20}},
]

function harness() {
  const calls=[]
  const serviceLoad=createLoader({'./ctt-soap-client':{CTTSoapClient:class{
    static escapeXml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}
    async callSoap(input){calls.push(input);return{Status:'Success',ShipmentData:{ShipmentDataOutput:{FirstObject:'OFFLINE-FIXTURE'}}}}
  }}})
  const Provider=createLoader({'../ctt':{CTTShipmentService:serviceLoad('lib/services/ctt/ctt-shipment.service.ts').CTTShipmentService,
    CTTPickupService:class{},CTTTrackingService:class{}}})('lib/services/carriers/ctt-provider.ts').CttProvider
  return{calls,provider:new Provider()}
}

test('matrix exactly covers the 21 distinct countries in the supplied selector',()=>{
  assert.equal(destinations.length,21)
  assert.deepEqual(destinations.map(d=>d.country).sort(),['DE','AT','BE','CZ','DK','SK','SI','EE','FI','FR','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','SE'].sort())
  assert.equal(new Set(destinations.map(d=>d.country)).size,21)
})

for(const destination of destinations){
  test(`${destination.country}: selection, policy and CE contract pricing — ${destination.city} ${destination.postal}`,()=>{
    assert.ok(getServiceDestinationCountries(service).some(country=>country.code===destination.country))
    assert.doesNotThrow(()=>assertShipmentDestinationAvailable(destination.country,destination.postal))
    const zone=getServiceDestinationZone(service,destination.country,destination.postal)
    assert.ok(['Zona 2','Zona 3'].includes(zone))
    for(const profile of profiles){
      const quote=calculateShipmentPrice(profile.weightKg,client,[service],destination.country,destination.postal,{requireConfiguredTariff:true})
      const tier=service.zones.find(z=>z.zone_code===zone).tiers.find(t=>t.enabled&&t.weight_max>=profile.weightKg)
      assert.ok(tier)
      assert.notEqual(quote.isBlocked,true)
      assert.equal(quote.isFallback,false)
      assert.equal(quote.basePrice,tier.sell_price)
      assert.ok(Number.isFinite(quote.fuelSurchargeAmount) && quote.fuelSurchargeAmount>=0)
      assert.equal(quote.sellPrice,Number((tier.sell_price+quote.fuelSurchargeAmount).toFixed(2)))
      assert.equal(quote.buyPrice,tier.cost_price)
    }
  })

  for(const autoClose of [false,true])for(const profile of profiles){
    test(`${destination.country}: ${autoClose?'CompleteShipment':'CreateShipment'} ${profile.weightKg}kg/${profile.volumes} volumes — ${destination.place}`,async()=>{
      const h=harness()
      await h.provider.initialize({auth_id:'offline-fixture',client_number:'offline-fixture',contract_number:'offline-fixture'})
      const recipient={name:`CLIENTE TESTE ${destination.country}`,country:destination.country,city:destination.city,
        address:destination.address,zip:destination.postal,phone:'',email:`test-${destination.country.toLowerCase()}@example.invalid`}
      const result=await h.provider.createShipment({reference:`TEST-NO-SEND-${destination.country}`,sender:{name:'REMETENTE FICTÍCIO',
        address:'Rua Rómulo de Carvalho',zip:'4800-019',city:'Guimarães',country:'PT',phone:'',email:'sender@example.invalid'},
        recipient,...profile,autoClose,subProduct:service.webservice_service_code,observations:'TESTE — NÃO EXPEDIR',
        cttExportDetails:{exportType:'Permanent',contentType:'Goods',declaredValue:25.5}})
      assert.equal(result.success,true,result.error)
      assert.equal(h.calls.length,1)
      const parsed=new XMLParser({removeNSPrefix:true,parseTagValue:false}).parse(h.calls[0].soapBodyXml)
      const request=parsed[autoClose?'CompleteShipment':'CreateShipment'].Input.DeliveryNote
      const {ReceiverData:receiver,ShipmentData:shipment}=request.ShipmentCTT.ShipmentCTT
      assert.equal(request.SubProductId,service.webservice_service_code)
      assert.equal(receiver.Name,recipient.name)
      assert.equal(receiver.Country,destination.country)
      assert.equal(receiver.City,destination.city)
      assert.equal(receiver.Address,destination.address)
      assert.equal(receiver.NonPTZipCode,destination.postal)
      assert.equal(receiver.NonPTZipCodeLocation,destination.city)
      assert.equal(receiver.Email,recipient.email)
      assert.equal(receiver.PTZipCode3,undefined);assert.equal(receiver.PTZipCode4,undefined)
      assert.equal(shipment.Weight,String(Math.round(profile.weightKg*1000)))
      assert.equal(shipment.Quantity,String(profile.volumes))
      const {length,width,height}=profile.dimensionsCm
      assert.ok(shipment.Observations.startsWith(`${length}x${width}x${height}cm`))
      assert.ok(shipment.Observations.length<=50)
      assert.equal(shipment.CustomsData,undefined)
      assert.equal(shipment.DeclaredValue,'25.5')
      assert.equal(shipment.ExportType,'Permanent');assert.equal(shipment.UPUCode,'Goods')
    })
  }

  test(`${destination.country}: absent real contact stops before SOAP`,async()=>{
    const h=harness()
    await h.provider.initialize({auth_id:'offline-fixture',client_number:'offline-fixture',contract_number:'offline-fixture'})
    const result=await h.provider.createShipment({reference:'NO-SEND',weightKg:1,volumes:1,
      sender:{name:'TEST',address:'Rua Rómulo de Carvalho',zip:'4800-019',city:'Guimarães',country:'PT',phone:''},
      recipient:{name:'TEST',address:destination.address,city:destination.city,zip:destination.postal,country:destination.country,phone:'',email:''},
      cttExportDetails:{exportType:'Permanent',contentType:'Goods',declaredValue:25.5}})
    assert.equal(result.success,false)
    assert.equal(result.confirmedRejection,true)
    assert.match(result.error,/e-mail|telemóvel/)
    assert.equal(h.calls.length,0)
  })
}
