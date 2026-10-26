const test = require('node:test')
const assert = require('node:assert/strict')
const { XMLParser } = require('fast-xml-parser')
const { createLoader } = require('./helpers/load-typescript.cjs')

function harness() {
  const calls = []
  const serviceLoad = createLoader({
    './ctt-soap-client': { CTTSoapClient: class {
      static escapeXml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;') }
      async callSoap(input) {
        calls.push(input)
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
      cttExportDetails: { exportType: 'Permanent', contentType: 'Goods', declaredValue: 25.5 },
      sender: { name: 'Fixture PT', address: 'Rua de teste', zip: '4800-019', city: 'Guimarães', country: 'PT', phone: '+351 910 000 001' },
      recipient: { name: 'Fixture ES', address: 'Calle de prueba', zip: '28013', city: 'Madrid', country: 'ES', phone: '+34 612 345 678', ...recipient },
      ...extra,
    })
    assert.equal(result.success, true, result.error)
    const xml = calls.at(-1).soapBodyXml
    const parsed = new XMLParser({ removeNSPrefix: true, parseTagValue: false }).parse(xml)
    const body = (parsed.CreateShipment || parsed.CompleteShipment).Input.DeliveryNote.ShipmentCTT.ShipmentCTT
    return { xml, receiver: body.ReceiverData, sender: body.SenderData, shipment: body.ShipmentData }
  } }
}

for (const autoClose of [false, true]) {
  test(`CTT ${autoClose ? 'CompleteShipment' : 'CreateShipment'} preserves Madrid's full foreign postcode and country`, async () => {
    const h = harness(), { receiver, sender } = await h.send({}, { autoClose })
    assert.equal(receiver.Country, 'ES')
    assert.equal(receiver.NonPTZipCode, '28013')
    assert.equal(receiver.NonPTZipCodeLocation, 'Madrid')
    assert.ok(!('PTZipCode3' in receiver)); assert.ok(!('PTZipCode4' in receiver))
    assert.equal(sender.Country, 'PT'); assert.equal(sender.PTZipCode4, '4800'); assert.equal(sender.PTZipCode3, '019')
    assert.ok(!('NonPTZipCode' in sender))
    const fieldOrder = ['Address', 'City', 'ContactName', 'Country', 'MobilePhone', 'Name', 'NonPTZipCode', 'NonPTZipCodeLocation', 'Type']
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
]) {
  test(`CTT contact formatting respects ${country} and ${field} without a Portuguese-only assumption (${phone.slice(0, 5)})`, async () => {
    const { receiver } = await harness().send({ country, phone, zip: country === 'PT' ? '4800-019' : '28013' })
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
  const markup = renderToStaticMarkup(React.createElement(Fields))
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
