const test = require('node:test')
const assert = require('node:assert/strict')
const { XMLParser } = require('fast-xml-parser')
const { createLoader } = require('./helpers/load-typescript.cjs')
const customsFixture = {items:[{description:'Cotton shirts',quantity:2,value:25.5,weightKg:0.5,harmonizedCode:'610910',originCountry:'PT'}],nonDeliveryCase:'GiveBack',sachetDocumentation:true,vatExportDeclaration:false,vatRate:false,commercialInvoice:'TEST/2026/123',invoiceDate:'2026-10-27'}

function harness() {
  const calls = []
  const serviceLoad = createLoader({
    './ctt-soap-client': { CTTSoapClient: class {
      static escapeXml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;') }
      async callSoap(input) {
        calls.push(input)
        // Reproduce the real destination-specific rejection reported by CTT.
        // XML schema validity alone does not prove this business rule is met.
        const parsed = new XMLParser({ removeNSPrefix: true, parseTagValue: false }).parse(input.soapBodyXml)
        const request = (parsed.CreateShipment || parsed.CompleteShipment)?.Input.DeliveryNote.ShipmentCTT.ShipmentCTT
        if (request?.ReceiverData.Country === 'BE' && request.ShipmentData.CustomsData !== undefined) {
          return { Status: 'Error', ErrorsList: { ErrorData: { Code: 1,
            Message: 'CustomsItemsData of CustomsData index 0 : Customs Data must not be included for shipments to selected Receiver Country' } } }
        }
        if (request?.ReceiverData.Country === 'IS' && !request.ShipmentData.CustomsData?.CustomsItemsData?.CustomsItemsData) {
          return {Status:'Error',ErrorsList:{ErrorData:{Code:1,Message:'CustomsItemsData of CustomsData index 0 : Customs Data is required for shipments to selected Receiver Country'}}}
        }
        return { Status: 'Success', ShipmentData: { ShipmentDataOutput: { FirstObject: 'MOCK-ONLY' } } }
      }
    } },
  })
  const load = createLoader({ '../ctt': {
    CTTShipmentService: serviceLoad('lib/services/ctt/ctt-shipment.service.ts').CTTShipmentService,
    CTTPickupService: class {}, CTTTrackingService: class {},
  } })
  const Provider = load('lib/services/carriers/ctt-provider.ts').CttProvider
  const provider = new Provider()
  return { provider, calls, async send(recipient = {}, extra = {}) {
    await provider.initialize({ auth_id: 'fixture', client_number: 'fixture', contract_number: 'fixture' })
    const result = await provider.createShipment({
      reference: 'NO-REAL-SHIPMENT', weightKg: 1, volumes: 1, autoClose: false,
      cttExportDetails: { exportType: 'Permanent', contentType: 'Goods', declaredValue: 25.5, customs:customsFixture },
      sender: { name: 'Fixture PT', address: 'Rua de teste', zip: '4800-019', city: 'Guimarães', country: 'PT', phone: '+351 910 000 001' },
      recipient: { name: 'Fixture ES', address: 'Calle de prueba', zip: '28013', city: 'Madrid', country: 'ES', phone: '+34 612 345 678', email: 'recipient@example.invalid', ...recipient },
      ...extra,
    })
    assert.equal(result.success, true, result.error)
    const xml = calls.at(-1).soapBodyXml
    const parsed = new XMLParser({ removeNSPrefix: true, parseTagValue: false }).parse(xml)
    const body = (parsed.CreateShipment || parsed.CompleteShipment).Input.DeliveryNote.ShipmentCTT.ShipmentCTT
    return { xml, receiver: body.ReceiverData, sender: body.SenderData, shipment: body.ShipmentData }
  } }
}

for (const country of ['IS','GB','US']) for (const autoClose of [false,true]) {
  test(`${country}: ${autoClose?'CompleteShipment':'CreateShipment'} sends an explicit full declaration with real items`,async()=>{
    const h=harness()
    const {shipment}=await h.send({country,zip:country==='IS'?'101':country==='GB'?'SW1A 1AA':'10001'}, {
      autoClose,weightKg:1.5,dimensionsCm:{length:13,width:11,height:7.5},
      cttExportDetails:{exportType:'Permanent',contentType:'Goods',declaredValue:25.5,customs:{...customsFixture,items:[
        {...customsFixture.items[0],description:'Shirts & <samples>',quantity:2,value:15,weightKg:0.4},
        {...customsFixture.items[0],description:'Cotton hat',quantity:1,value:10.5,weightKg:0.3},
      ]}},
    })
    const customs=shipment.CustomsData
    assert.equal(customs.CustomsTotalItems,'3')
    assert.equal(customs.CustomsTotalValue,'25.5')
    assert.equal(customs.CustomsTotalWeight,'700')
    assert.equal(customs.CustomsItemsData.CustomsItemsData[0].Detail,'Shirts & <samples>')
    assert.equal(customs.CustomsItemsData.CustomsItemsData[0].Weight,'400')
    assert.equal(customs.CustomsItemsData.CustomsItemsData[1].Value,'10.50')
    assert.equal(customs.NonDeliveryCase,'GiveBack')
    assert.equal(customs.SachetDocumentation,'true')
    assert.equal(customs.VATExportDeclaration,'false')
    assert.equal(customs.Height,'7.5')
    assert.equal(customs.ComercialInvoice,'TEST/2026/123')
    assert.equal(customs.InvoiceDate,'2026-10-27T00:00:00')
    assert.ok(Object.keys(customs).indexOf('Height') < Object.keys(customs).indexOf('InvoiceDate'))
    assert.ok(Object.keys(customs).indexOf('InvoiceDate') < Object.keys(customs).indexOf('Length'))
    assert.equal(shipment.Weight,'1500')
    assert.equal(h.calls.length,1)
    assert.deepEqual(Object.keys(shipment).slice(0,4),['ClientReference','CustomsData','DeclaredValue','ExportType'])
  })
}

test('Iceland without customs items is rejected locally before calling CTT',async()=>{
  const h=harness()
  await assert.rejects(()=>h.send({country:'IS',zip:'101'},{cttExportDetails:{exportType:'Permanent',contentType:'Goods',declaredValue:25.5}}),/declaração aduaneira/)
  assert.equal(h.calls.length,0)
})

test('Belgium strips a leftover declaration from a previous destination',async()=>{
  const {shipment}=await harness().send({country:'BE',zip:'1000'},{cttExportDetails:{exportType:'Permanent',contentType:'Goods',declaredValue:25.5,customs:{items:[]}}})
  assert.equal(shipment.CustomsData,undefined)
})

test('customs validation catches missing choices, inconsistent totals and invalid items',()=>{
  const {validateCttCustoms,requiresCttCustoms}=createLoader({})('lib/services/ctt/customs-declaration.ts')
  assert.equal(requiresCttCustoms('IS','101'),true)
  assert.equal(requiresCttCustoms('BE','1000'),false)
  assert.equal(requiresCttCustoms('ES','35001'),true)
  assert.equal(requiresCttCustoms('ES','28013'),false)
  for(const customs of [
    {...customsFixture,items:[]}, {...customsFixture,nonDeliveryCase:undefined},
    {...customsFixture,sachetDocumentation:undefined},
    {...customsFixture,items:[{...customsFixture.items[0],value:20}]},
    {...customsFixture,items:[{...customsFixture.items[0],weightKg:2}]},
    {...customsFixture,items:[{...customsFixture.items[0],harmonizedCode:'bad'}]},
  ]) assert.throws(()=>validateCttCustoms(customs,25.5,1.5))
})

test('Iceland form shows required customs fields while Belgium omits the declaration',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
  const Fields=createLoader({react:React,'react/jsx-runtime':require('react/jsx-runtime')})('components/shipments/CttExportFields.tsx').CttExportFields
  const markup=renderToStaticMarkup(React.createElement(Fields,{country:'IS',postalCode:'101'}))
  assert.match(markup, /Declaração aduaneira obrigatória — Islândia/)
  assert.match(markup, /<textarea[^>]*name="ctt_customs_description"[^>]*rows="3"/)
  assert.ok(markup.indexOf('name="ctt_customs_description"') < markup.indexOf('name="ctt_export_type"'))
  for(const name of ['description','quantity','value','weight','hs','origin','non_delivery','sachet','vat_export','vat_rate','invoice','invoice_date']){
    const field=markup.match(new RegExp(`<(?:input|select|textarea)\\b[^>]*name="ctt_customs_${name}"[^>]*>`))?.[0]
    assert.ok(field,name);assert.match(field,/\brequired=""/)
  }
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Fields,{country:'BE',postalCode:'1000'})),/name="ctt_customs_present"/)
})

test('customs form reads real lines and explicit false choices without turning blank amounts into zero',()=>{
  const {readCttExportForm}=createLoader({})('lib/services/ctt/export-details.ts')
  const form=new FormData()
  for(const [name,value] of Object.entries({ctt_export_type:'Permanent',ctt_content_type:'Goods',ctt_declared_value:'25.50',
    ctt_customs_present:'1',ctt_customs_description:'Cotton shirts',ctt_customs_quantity:'2',ctt_customs_value:'25.50',
    ctt_customs_weight:'0.5',ctt_customs_hs:'610910',ctt_customs_origin:'pt',ctt_customs_non_delivery:'GiveBack',
    ctt_customs_sachet:'true',ctt_customs_vat_export:'false',ctt_customs_vat_rate:'false',ctt_customs_invoice:'TEST/2026/123',ctt_customs_invoice_date:'2026-10-27'}))form.set(name,value)
  const result=readCttExportForm(form)
  assert.equal(result.customs.items[0].originCountry,'PT')
  assert.equal(result.customs.items[0].weightKg,0.5)
  assert.equal(result.customs.vatExportDeclaration,false)
  assert.equal(result.customs.commercialInvoice,'TEST/2026/123')
  assert.equal(result.customs.invoiceDate,'2026-10-27')
  form.set('ctt_declared_value','0');form.set('ctt_customs_value','')
  assert.throws(()=>readCttExportForm(form),/valor do artigo/)
})

for(const [invoice,date] of [['','2026-10-27'],['   ','2026-10-27'],['TEST/1',''],['TEST/1','2026-02-29'],['TEST/1','2026-04-31'],['TEST/1','27/10/2026'],['TEST/1','0000-01-01']]){
  test(`customs invoice ${JSON.stringify(invoice)}/${JSON.stringify(date)} is rejected before SOAP`,async()=>{
    const h=harness()
    await assert.rejects(()=>h.send({country:'IS',zip:'101'},{cttExportDetails:{exportType:'Permanent',contentType:'Goods',declaredValue:25.5,customs:{...customsFixture,commercialInvoice:invoice,invoiceDate:date}}}),/fatura/i)
    assert.equal(h.calls.length,0)
  })
}

test('a valid leap-day invoice is retained without timezone conversion',()=>{
  const {validateCttCustoms}=createLoader({})('lib/services/ctt/customs-declaration.ts')
  assert.equal(validateCttCustoms({...customsFixture,invoiceDate:'2024-02-29'},25.5,1).invoiceDate,'2024-02-29')
})

for (const autoClose of [false, true]) {
  test(`CTT ${autoClose ? 'CompleteShipment' : 'CreateShipment'} preserves Madrid's full foreign postcode and country`, async () => {
    const h = harness(), { receiver, sender } = await h.send({}, { autoClose })
    assert.equal(receiver.Country, 'ES')
    assert.equal(receiver.NonPTZipCode, '28013')
    assert.equal(receiver.NonPTZipCodeLocation, 'Madrid')
    assert.ok(!('PTZipCode3' in receiver)); assert.ok(!('PTZipCode4' in receiver))
    assert.equal(sender.Country, 'PT'); assert.equal(sender.PTZipCode4, '4800'); assert.equal(sender.PTZipCode3, '019')
    assert.ok(!('NonPTZipCode' in sender))
    const fieldOrder = ['Address', 'City', 'ContactName', 'Country', 'Email', 'MobilePhone', 'Name', 'NonPTZipCode', 'NonPTZipCodeLocation', 'Type']
    assert.deepEqual(Object.keys(receiver), fieldOrder)
  })
}

test('foreign postcode letters and leading zeros survive serialization, for either party', async () => {
  const h = harness()
  assert.equal((await h.send({ zip: '07001', city: 'Palma' })).receiver.NonPTZipCode, '07001')
  const result = await h.send({ country: ' gb ', zip: 'SW1A 1AA', city: 'London', phone: '+44 20 7946 0000' }, {
    sender: { name: 'Fixture FR', address: 'Rue de test', country: 'FR', zip: '06000', city: 'Nice', phone: '+33 4 00 00 00 01' },
  })
  assert.equal(result.receiver.Country, 'GB'); assert.equal(result.receiver.NonPTZipCode, 'SW1A 1AA')
  assert.equal(result.sender.NonPTZipCode, '06000'); assert.equal(result.sender.NonPTZipCodeLocation, 'Nice')
})

for (const [country, phone, field, expected] of [
  ['ES', '+34 612 345 678', 'MobilePhone', '612345678'],
  ['ES', '0034 712-345-678', 'MobilePhone', '712345678'],
  ['ES', '+34 (91) 234 56 78', 'Phone', '912345678'],
  ['PT', '+351 910-000-001', 'MobilePhone', '910000001'],
  ['PT', '00351 253 000 001', 'Phone', '253000001'],
  ['ES', '+351 910 000 001', 'MobilePhone', '+351910000001'],
  ['ES', '00351 910 000 001', 'MobilePhone', '+351910000001'],
  ['ES', '+33 6 12 34 56 78', 'MobilePhone', '+33612345678'],
  ['ES', '0033 7 34 56 78 90', 'MobilePhone', '+33734567890'],
  ['ES', '+44 7700 900123', 'MobilePhone', '+447700900123'],
  ['ES', '0044 7700 900123', 'MobilePhone', '+447700900123'],
  ['PT', '+34 612 345 678', 'MobilePhone', '+34612345678'],
  ['PT', '+33 6 12 34 56 78', 'MobilePhone', '+33612345678'],
  ['PT', '+44 7700 900123', 'MobilePhone', '+447700900123'],
  ['ES', '+351 253 000 001', 'Phone', '+351253000001'],
  ['ES', '+33 1 42 68 53 00', 'Phone', '+33142685300'],
  ['ES', '+44 20 7946 0000', 'Phone', '+442079460000'],
  ['ES', '+44 7000 000123', 'Phone', '+447000000123'],
  ['ES', '+44 7600 000123', 'Phone', '+447600000123'],
  ['ES', '+1 202 555 0100', 'Phone', '+12025550100'],
  ['FR', '06 12 34 56 78', 'MobilePhone', '0612345678'],
  ['GB', '07700 900123', 'MobilePhone', '07700900123'],
  ['BE', '+32 470 123 456', 'MobilePhone', '+32470123456'],
  ['BE', '0032 470 123 456', 'MobilePhone', '+32470123456'],
  ['BE', '32470123456', 'MobilePhone', '+32470123456'],
  ['BE', '0470 12 34 56', 'MobilePhone', '0470123456'],
  ['BE', '+32 2 279 22 11', 'Phone', '+3222792211'],
  ['BE', '+32 4 123 45 67', 'Phone', '+3241234567'],
  ['BE', '02 279 22 11', 'Phone', '022792211'],
  ['ES', '32470123456', 'MobilePhone', '+32470123456'],
  ['PT', '351910000001', 'MobilePhone', '910000001'],
  ['ES', '34612345678', 'MobilePhone', '612345678'],
  ['FR', '33612345678', 'MobilePhone', '+33612345678'],
  ['GB', '447700900123', 'MobilePhone', '+447700900123'],
]) {
  test(`CTT contact formatting respects ${country} and ${field} without a Portuguese-only assumption (${phone.slice(0, 5)})`, async () => {
    const { receiver } = await harness().send({ country, phone, zip: country === 'PT' ? '4800-019' : '28013',
      ...(field === 'MobilePhone' ? { email: undefined } : {}) })
    assert.equal(receiver[field], expected)
    assert.equal(receiver[field === 'MobilePhone' ? 'Phone' : 'MobilePhone'], undefined)
  })
}

test('empty optional contacts are omitted rather than invented', async () => {
  const { receiver } = await harness().send({ phone: '' })
  assert.equal(receiver.Phone, undefined); assert.equal(receiver.MobilePhone, undefined)
})

test('explicit mobile and telephone channels retain their own international prefixes independently', async () => {
  const { receiver } = await harness().send({ phone: '+34 912 345 678', mobilePhone: '+351 910 000 001' })
  assert.equal(receiver.Phone, '912345678')
  assert.equal(receiver.MobilePhone, '+351910000001')
})

for (const autoClose of [false, true]) {
 test(`Belgium ${autoClose ? 'CompleteShipment' : 'CreateShipment'} sends a mobile without requiring an invented telephone or email`, async () => {
  const {receiver}=await harness().send({country:'BE',city:'Bruxelles',zip:'1000',phone:'32470123456',email:undefined}, {subProduct:'ENCF008.02',autoClose})
  assert.equal(receiver.MobilePhone,'+32470123456')
  assert.equal(receiver.Phone,undefined)
  assert.equal(receiver.Email,undefined)
 })
}

test('a Belgian landline alone is rejected locally before SOAP; adding an email retains the real landline',async()=>{
 const h=harness()
 await h.provider.initialize({auth_id:'fixture',client_number:'fixture',contract_number:'fixture'})
 const input={reference:'NO-REAL-SHIPMENT',subProduct:'ENCF008.02',weightKg:1,volumes:1,autoClose:false,
  sender:{name:'Fixture PT',address:'Fixture street',zip:'4000-001',city:'Porto',country:'PT'},
  recipient:{name:'Fixture BE',address:'Fixture street',zip:'1000',city:'Bruxelles',country:'BE',phone:'+3222792211'},
  cttExportDetails:{exportType:'Permanent',contentType:'Goods',declaredValue:25}}
 const result=await h.provider.createShipment(input)
 assert.equal(result.success,false);assert.equal(result.confirmedRejection,true)
 assert.match(result.error,/e-mail ou telemóvel.*telefone fixo/)
 assert.equal(h.calls.length,0)
 const {receiver}=await h.send({...input.recipient,email:' recipient@example.invalid '},{subProduct:'ENCF008.02'})
 assert.equal(receiver.Phone,'+3222792211');assert.equal(receiver.MobilePhone,undefined)
 assert.equal(receiver.Email,'recipient@example.invalid')
})

for (const autoClose of [false, true]) {
  test(`international CTT ${autoClose ? 'CompleteShipment' : 'CreateShipment'} includes export and UPU enums in the documented XML order`, async () => {
    const { shipment } = await harness().send({}, { autoClose })
    assert.equal(shipment.ExportType, 'Permanent')
    assert.equal(shipment.UPUCode, 'Goods')
    assert.equal(shipment.DeclaredValue, '25.5')
    // SGEE V1.8, page 39: ShipmentData XSD sequence, including optional enums.
    assert.deepEqual(Object.keys(shipment), ['ClientReference', 'DeclaredValue', 'ExportType', 'IsDevolution', 'Quantity', 'UPUCode', 'Weight'])
  })
}

test('international content value is separate from COD, including zero-valued documents', async () => {
  const result = await harness().send({}, { codValue: 100 })
  assert.equal(result.shipment.DeclaredValue, '25.5')
  assert.match(result.xml, /<mod:SpecialServiceType>AgainstReimbursement<\/mod:SpecialServiceType>\s*<mod:Value>100<\/mod:Value>/)
  const docs = await harness().send({}, { cttExportDetails: { exportType: 'TemporaryExhibition', contentType: 'Documents', declaredValue: 0 } })
  assert.equal(docs.shipment.DeclaredValue, '0'); assert.equal(docs.shipment.UPUCode, 'Documents')
  assert.equal(docs.shipment.ExportType, 'TemporaryExhibition')
})

for(const autoClose of [false,true]) test(`Belgium CTT ${autoClose ? 'CompleteShipment' : 'CreateShipment'} sends dimensions without a prohibited CustomsData block`,async()=>{
 const {shipment,xml}=await harness().send({country:'BE',city:'Bruxelles',zip:'1000',phone:'32470123456',email:undefined},{
  subProduct:'ENCF008.02',autoClose,weightKg:1.5,dimensionsCm:{length:30.5,width:20,height:10.2},
 })
 assert.equal(shipment.Weight,'1500')
 assert.equal(shipment.Quantity,'1')
 assert.equal(shipment.CustomsData,undefined)
 assert.equal(shipment.Observations,'30.5x20x10.2cm')
 assert.equal(shipment.DeclaredValue,'25.5');assert.equal(shipment.ExportType,'Permanent');assert.equal(shipment.UPUCode,'Goods')
 assert.deepEqual(Object.keys(shipment),['ClientReference','DeclaredValue','ExportType','IsDevolution','Observations','Quantity','UPUCode','Weight'])
 assert.doesNotMatch(xml,/<mod:CustomsData>|<mod:CustomsItemsData>|<mod:NonDeliveryCase>|<mod:HarmonizedCode>/)
})

for(const [country,zip] of [['BE','1000'],['FR','75001'],['DE','10115'],['NL','1012 AB'],['FI','00100'],['ES','28013']]){
 for(const subProduct of ['ENCF008.02','EMSF001.02']) for(const autoClose of [false,true]){
  test(`${country} ${subProduct} ${autoClose?'Complete':'Create'} never generates a customs declaration just to carry dimensions`,async()=>{
   const h=harness(),{shipment,xml}=await h.send({country,zip},{subProduct,autoClose,weightKg:1.5,volumes:2,
    observations:'Entregar na receção',dimensionsCm:{length:30.5,width:20,height:10.2}})
   assert.equal(h.calls.length,1)
   assert.equal(shipment.Weight,'1500');assert.equal(shipment.Quantity,'2')
   assert.equal(shipment.CustomsData,undefined)
   assert.match(shipment.Observations,/Entregar na receção/)
   assert.match(shipment.Observations,/^30\.5x20x10\.2cm(?: \| |$)/)
   assert.ok(shipment.Observations.length<=50)
   assert.doesNotMatch(xml,/<mod:CustomsData>/)
  })
 }
}

test('legacy calls without dimensions do not create an empty customs declaration or substitute measurements',async()=>{
 const {shipment}=await harness().send({country:'BE',city:'Bruxelles',zip:'1000'},{weightKg:1.5})
 assert.equal(shipment.Weight,'1500')
 assert.equal(shipment.CustomsData,undefined)
})

test('domestic parcel dimensions do not introduce an international customs block',async()=>{
 const {shipment}=await harness().send({country:'PT',zip:'4800-019'},{dimensionsCm:{length:30.5,width:20,height:10},cttExportDetails:undefined})
 assert.equal(shipment.CustomsData,undefined)
 assert.equal(shipment.Observations,'30.5x20x10cm')
})

for(const subProduct of ['EMSF056.01','EMSF057.01','ENCF008.01']) for(const autoClose of [false,true]){
 test(`national CTT ${subProduct} ${autoClose?'Complete':'Create'} retains weight, decimals and dimensions in supported label observations`,async()=>{
  const {shipment}=await harness().send({country:'PT',zip:'4800-019'},{subProduct,autoClose,weightKg:1.5,volumes:2,
   observations:'Entregar na receção',dimensionsCm:{length:30.5,width:20,height:10.2},cttExportDetails:undefined})
  assert.equal(shipment.Weight,'1500');assert.equal(shipment.Quantity,'2')
  assert.match(shipment.Observations,/^30\.5x20x10\.2cm(?: \| |$)/)
  assert.match(shipment.Observations,/Entregar na receção/)
  assert.ok(shipment.Observations.length<=50)
  assert.equal(shipment.CustomsData,undefined);assert.equal(shipment.ExportType,undefined)
 })
}
test('long national CTT observations never truncate declared dimensions or exceed the carrier field limit',async()=>{
 const {shipment}=await harness().send({country:'PT',zip:'4800-019'},{observations:'Nota longa '.repeat(20),
  dimensionsCm:{length:30.5,width:20.25,height:10.2},cttExportDetails:undefined})
 assert.ok(shipment.Observations.length<=50)
 assert.match(shipment.Observations,/^30\.5x20\.25x10\.2cm(?: \| |$)/)
})

for(const country of ['PT','BE']) test(`${country}: all three dimensions precede notes and fit the reported label cutoff without the verbose prefix`,async()=>{
 const {shipment}=await harness().send({country,zip:country==='PT'?'4800-019':'1000'},
  {dimensionsCm:{length:13,width:11,height:7.5},observations:'Nota de entrega '.repeat(10)})
 assert.ok(shipment.Observations.startsWith('13x11x7.5cm | '))
 assert.ok(shipment.Observations.slice(0,15).includes('13x11x7.5cm'))
 assert.ok(shipment.Observations.length<=50)
 assert.doesNotMatch(shipment.Observations,/Dim\(cm\):/)
 assert.equal(shipment.CustomsData,undefined)
})

test('multiple parcels retain total shipment weight without inventing per-parcel or goods quantities',async()=>{
 const {shipment}=await harness().send({country:'BE',zip:'1000'},{weightKg:3.25,volumes:2,dimensionsCm:{length:35,width:25,height:15}})
 assert.equal(shipment.Weight,'3250');assert.equal(shipment.Quantity,'2')
 assert.equal(shipment.CustomsData,undefined)
 assert.equal(shipment.Observations,'35x25x15cm')
})

test('invalid supplied international dimensions are refused before requesting a carrier label',async()=>{
 for(const dimensions of [{length:NaN,width:20,height:10},{length:0,width:20,height:10},{length:30.5,width:20,height:Infinity}]){
  const h=harness()
  await h.provider.initialize({auth_id:'fixture',client_number:'fixture',contract_number:'fixture'})
  const result=await h.provider.createShipment({reference:'NO-REAL-SHIPMENT',weightKg:1.5,volumes:1,dimensionsCm:dimensions,
   sender:{name:'Fixture',address:'Fixture',country:'PT',city:'Porto',zip:'4000-001'},
   recipient:{name:'Fixture',address:'Fixture',country:'BE',city:'Bruxelles',zip:'1000',phone:'32470123456'},
   cttExportDetails:{exportType:'Permanent',contentType:'Goods',declaredValue:25}})
  assert.equal(result.success,false);assert.equal(result.confirmedRejection,true)
  assert.match(result.error,/comprimento, largura e altura/)
  assert.equal(h.calls.length,0)
 }
})

test('domestic CTT shipments need no export fields and retain their existing COD value', async () => {
  const result = await harness().send({ country: 'PT', zip: '4800-019' }, { cttExportDetails: undefined, codValue: 100 })
  assert.equal(result.shipment.ExportType, undefined); assert.equal(result.shipment.UPUCode, undefined)
  assert.equal(result.shipment.DeclaredValue, '100')
})

for (const details of [undefined, { exportType: 'forged', contentType: 'Goods', declaredValue: 1 },
  { exportType: 'Permanent', contentType: '11', declaredValue: 1 },
  { exportType: 'Permanent', contentType: 'Goods' },
  { exportType: 'Permanent', contentType: 'Goods', declaredValue: -1 },
]) {
  test(`incomplete or invalid international declarations stop before SOAP (${JSON.stringify(details)})`, async () => {
    const h = harness()
    await assert.rejects(() => h.send({}, { cttExportDetails: details }), /exportação|conteúdo|declarado/)
    assert.equal(h.calls.length, 0)
  })
}

test('international form fields require an explicit selection and read the content value without pricing assumptions', () => {
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
  const load = createLoader({ react: React, 'react/jsx-runtime': require('react/jsx-runtime') })
  const Fields = load('components/shipments/CttExportFields.tsx').CttExportFields
  const markup = renderToStaticMarkup(React.createElement(Fields,{country:"BE"}))
  for (const name of ['ctt_export_type', 'ctt_content_type', 'ctt_declared_value']) {
    const field = markup.match(new RegExp(`<(?:input|select)\\b[^>]*name="${name}"[^>]*>`))?.[0]
    assert.ok(field, `Missing field: ${name}`)
    assert.match(field, /\brequired=""/)
  }
  assert.equal((markup.match(/value=""[^>]*selected=""/g) || []).length, 2)
  assert.match(markup, /value="Documents"/)
  assert.match(markup, /value="TemporaryExhibition"/)
  const { readCttExportForm } = load('lib/services/ctt/export-details.ts')
  const form = new FormData()
  form.set('ctt_export_type', 'Permanent'); form.set('ctt_content_type', 'Goods')
  assert.throws(() => readCttExportForm(form), /declarado/)
  form.set('ctt_declared_value', '25.50')
  assert.deepEqual(readCttExportForm(form), { exportType: 'Permanent', contentType: 'Goods', declaredValue: 25.5 })
  form.set('ctt_declared_value', '0')
  assert.equal(readCttExportForm(form).declaredValue, 0)
})
