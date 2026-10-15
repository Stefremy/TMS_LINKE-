const test = require('node:test')
const assert = require('node:assert/strict')
const { XMLParser } = require('fast-xml-parser')
const { createLoader } = require('./helpers/load-typescript.cjs')
const contract = require('./fixtures/ctt-close-contract.json')

// Public CTT XSD snapshot. No production credentials and no outgoing network calls.
function protocolHarness(resultXml) {
  const sent = []
  const transport = { request(options, callback) {
    const parts = []
    return {
      on() { return this },
      destroy() {},
      write(part) { parts.push(part) },
      end() {
        sent.push({ options, envelope: parts.join('') })
        const handlers = {}
        callback({ statusCode: 200, setEncoding() {}, on(event, handler) { handlers[event] = handler } })
        queueMicrotask(() => {
          handlers.data(`<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><CloseShipmentResponse xmlns="http://tempuri.org/"><CloseShipmentResult xmlns:a="${contract.namespace}">${resultXml}</CloseShipmentResult></CloseShipmentResponse></s:Body></s:Envelope>`)
          handlers.end()
        })
      },
    }
  } }
  const service = createLoader({ http: transport, https: transport, 'fast-xml-parser': { XMLParser } })('lib/services/ctt/ctt-shipment.service.ts').CTTShipmentService
  return { service: new service(), sent }
}

test('the real SOAP request matches CTT field order, namespaces, object ranges and product codes', async () => {
  const h = protocolHarness('<a:Status>Success</a:Status><a:DocumentsList><a:DocumentData><a:File>JVBERi0xLjQK</a:File><a:FileName>certificado.pdf</a:FileName></a:DocumentData></a:DocumentsList>')
  const result = await h.service.closeShipment({ auth_id: '11111111-1111-1111-1111-111111111111', client_number: 'client&amp;', contract_number: 'contract<fixture>', user_id: '22222222-2222-2222-2222-222222222222', environment: 'production', distribution_channel: 99 }, {
    shipments: [
      { FirstObjectCode: 'EQ123456789PT', LastObjectCode: 'EQ123456789PT', SubProductCode: 'ENCF008.01' },
      { FirstObjectCode: 'DD123456789PT', LastObjectCode: 'DD123456790PT', SubProductCode: 'EMSF056.01' },
    ],
  })
  assert.equal(h.sent.length, 1)
  const envelope = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(h.sent[0].envelope)['soapenv:Envelope']
  assert.equal(envelope['@_xmlns:ws'], contract.namespace)
  const input = envelope['soapenv:Body']['tem:CloseShipment']['tem:Input']
  assert.deepEqual(Object.keys(input), contract.inputFields.map(f => `ws:${f}`))
  assert.equal(input['ws:ClientId'], 'client&amp;')
  assert.equal(input['ws:ContractId'], 'contract<fixture>')
  assert.equal(input['ws:DistributionChannel'], '99')
  assert.match(input['ws:RequestID'], /^[0-9a-f-]{36}$/)
  const shipments = input['ws:ListOfShipmentToClose']['ws:Shipment2Close']
  assert.equal(shipments.length, 2)
  for (const shipment of shipments) assert.deepEqual(Object.keys(shipment), contract.shipmentFields.map(f => `ws:${f}`))
  assert.equal(shipments[0]['ws:SubProductCode'], 'ENCF008.01')
  assert.equal(shipments[1]['ws:LastObjectCode'], 'DD123456790PT')
  assert.equal(h.sent[0].options.headers.SOAPAction, 'http://tempuri.org/ICTTShipmentProviderWS/CloseShipment')
  assert.doesNotMatch(h.sent[0].envelope, /ShipmentIdList|DeliveryNoteId|mod:string/)
  assert.equal(result.Status, 1)
  assert.deepEqual(result.DocumentsList, [{ FileName: 'certificado.pdf', File: 'JVBERi0xLjQK' }])
  assert.equal('DeliveryNoteId' in result, false)
})

test('optional UserID is omitted and every CTT product certificate is preserved', async () => {
  const h = protocolHarness('<a:Status>Success</a:Status><a:DocumentsList><a:DocumentData><a:File>JVBERi0xLjQK</a:File><a:FileName>economico.pdf</a:FileName></a:DocumentData><a:DocumentData><a:File>JVBERi0xLjUK</a:File><a:FileName>amanha.pdf</a:FileName></a:DocumentData></a:DocumentsList>')
  const r = await h.service.closeShipment({ auth_id: 'fixture', client_number: 'fixture', contract_number: 'fixture' }, {
    shipments: [{ FirstObjectCode: 'DD123456789PT', LastObjectCode: 'DD123456789PT', SubProductCode: 'EMSF056.01' }],
  })
  assert.doesNotMatch(h.sent[0].envelope, /ws:UserID/)
  assert.equal(r.DocumentsList.length, 2)
})

test('CTT structured failures are parsed without treating them as success', async () => {
  const h = protocolHarness('<a:Status>Failure</a:Status><a:ErrorsList><a:ErrorData><a:Code>12</a:Code><a:Message>Produto inválido</a:Message></a:ErrorData></a:ErrorsList>')
  const r = await h.service.closeShipment({ auth_id: 'fixture', client_number: 'fixture', contract_number: 'fixture' }, {
    shipments: [{ FirstObjectCode: 'DD123456789PT', LastObjectCode: 'DD123456789PT', SubProductCode: 'EMSF056.01' }],
  })
  assert.equal(r.Status, 0)
  assert.equal(r.ErrorsList[0].Message, 'Produto inválido')
})
