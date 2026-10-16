const test = require('node:test')
const assert = require('node:assert/strict')
const { XMLValidator } = require('fast-xml-parser')
const { createLoader } = require('./helpers/load-typescript.cjs')

test('CTT NewOfferPickUp serializes the input using the WSDL data-contract namespace and shape', async () => {
  let soapRequest
  const load = createLoader({
    './ctt-soap-client': {
      CTTSoapClient: class {
        static escapeXml(value) {
          if (value === undefined || value === null) return ''
          return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
        }
        async callSoap(options) {
          soapRequest = options
          return { NewOfferPickUpResponse: { NewOfferPickUpResult: { Status: 'Success', PickUpID: 'PICKUP-123' } } }
        }
      },
    },
  })
  const { CTTPickupService } = load('lib/services/ctt/ctt-pickup.service.ts')
  const service = new CTTPickupService()
  const result = await service.newOfferPickUp({
    auth_id: '11111111-1111-4111-8111-111111111111',
    client_number: '123456',
    contract_number: '654321',
    environment: 'production',
  }, {
    AuthenticationID: '11111111-1111-4111-8111-111111111111',
    ClientId: '123456',
    ContractId: '654321',
    DataRecolha: '2026-10-20',
    HoraInicio: '10:00',
    HoraFim: '13:00',
    Destination: 'PT',
    BiggestObjectDimensionsCm: { Length: 40, Width: 30, Height: 20 },
    QuantidadeVolumes: 2,
    PesoKg: 1.5,
    PesoObjetoMaisPesadoKg: 0.8,
    Expedidor: {
      Nome: 'Loja & Filhos',
      Contacto: 'Pessoa de contacto',
      Morada: 'Rua de Teste, 1',
      CP4: '4000',
      CP3: '001',
      Localidade: 'Porto',
      Telefone: '+351 910 000 000 / 912000000',
    },
  })

  assert.equal(result.Success, true)
  assert.equal(result.PickUpID, 'PICKUP-123')
  assert.equal(soapRequest.action, 'http://tempuri.org/IRecolhasWS/NewOfferPickUp')
  assert.equal(XMLValidator.validate(soapRequest.soapBodyXml), true)
  assert.match(soapRequest.soapBodyXml, /xmlns:pick="http:\/\/schemas\.datacontract\.org\/2004\/07\/CTTExpressoWS\.Models\.PickUp"/)
  assert.match(soapRequest.soapBodyXml, /<tem:Input>\s*<pick:AuthenticationID>11111111-1111-4111-8111-111111111111<\/pick:AuthenticationID>\s*<pick:PickUpData>/)
  assert.match(soapRequest.soapBodyXml, /<pick:ClientID>123456<\/pick:ClientID>/)
  assert.match(soapRequest.soapBodyXml, /<pick:Address>Rua de Teste, 1<\/pick:Address>/)
  assert.match(soapRequest.soapBodyXml, /<pick:PickUpData\.Destinations>PT<\/pick:PickUpData\.Destinations>/)
  assert.match(soapRequest.soapBodyXml, /<pick:BiggerObjectHeight>20<\/pick:BiggerObjectHeight>/)
  // CTT's live validation requires this API field to equal TotalWeight; the actual heaviest
  // parcel weight is kept in the TMS metadata separately.
  assert.match(soapRequest.soapBodyXml, /<pick:HeavierObjectWeight>1500<\/pick:HeavierObjectWeight>/)
  assert.match(soapRequest.soapBodyXml, /<pick:PickUpPeriod>10:00-13:00<\/pick:PickUpPeriod>/)
  assert.match(soapRequest.soapBodyXml, /<pick:TotalWeight>1500<\/pick:TotalWeight>/)
  assert.match(soapRequest.soapBodyXml, /<pick:Phone>910000000<\/pick:Phone>/)
  assert.match(soapRequest.soapBodyXml, /<pick:Name>Loja &amp; Filhos<\/pick:Name>/)
  assert.doesNotMatch(soapRequest.soapBodyXml, /<tem:AuthenticationID>|<tem:SenderData>|<tem:RequestID>/)
})

test('CTT pickup failures expose nested ErrorList.ErrorData messages', async () => {
  const load = createLoader({
    './ctt-soap-client': {
      CTTSoapClient: class {
        static escapeXml(value) { return String(value ?? '') }
        async callSoap() {
          return {
            NewOfferPickUpResponse: {
              NewOfferPickUpResult: {
                Status: 'Failure',
                ErrorList: { ErrorData: { ErrorCode: 'PICKUP_42', Message: 'Morada de recolha inválida.' } },
              },
            },
          }
        }
      },
    },
  })
  const { CTTPickupService } = load('lib/services/ctt/ctt-pickup.service.ts')
  const result = await new CTTPickupService().newOfferPickUp({
    auth_id: '11111111-1111-4111-8111-111111111111',
    client_number: '123456',
    contract_number: '654321',
    environment: 'production',
  }, {
    AuthenticationID: '11111111-1111-4111-8111-111111111111',
    ClientId: '123456',
    ContractId: '654321',
    DataRecolha: '2026-10-20',
    HoraInicio: '10:00',
    HoraFim: '13:00',
    Destination: 'PT',
    BiggestObjectDimensionsCm: { Length: 40, Width: 30, Height: 20 },
    QuantidadeVolumes: 1,
    PesoKg: 1,
    Expedidor: {
      Nome: 'Loja teste', Morada: 'Rua teste, 1', CP4: '4000', CP3: '001',
      Localidade: 'Porto', Telefone: '910000000',
    },
  })

  assert.equal(result.Success, false)
  assert.deepEqual(result.Errors, ['PICKUP_42: Morada de recolha inválida.'])
})

test('CTT pickup validation blocks missing dimensions and invalid contact numbers before network calls', async () => {
  let calls = 0
  let soapRequest
  const load = createLoader({
    './ctt-soap-client': {
      CTTSoapClient: class {
        static escapeXml(value) { return String(value ?? '') }
        async callSoap(options) {
          calls += 1
          soapRequest = options
          return { NewOfferPickUpResponse: { NewOfferPickUpResult: { Status: 'Success', PickUpID: 'PICKUP-123' } } }
        }
      },
    },
  })
  const { CTTPickupService } = load('lib/services/ctt/ctt-pickup.service.ts')
  const service = new CTTPickupService()
  const creds = {
    auth_id: '11111111-1111-4111-8111-111111111111',
    client_number: '123456',
    contract_number: '654321',
    environment: 'production',
  }
  const baseInput = {
    AuthenticationID: creds.auth_id,
    ClientId: creds.client_number,
    ContractId: creds.contract_number,
    DataRecolha: '2026-10-20',
    HoraInicio: '10:00',
    HoraFim: '13:00',
    Destination: 'PT',
    BiggestObjectDimensionsCm: { Length: 40, Width: 30, Height: 20 },
    QuantidadeVolumes: 1,
    PesoKg: 1,
    Expedidor: {
      Nome: 'Loja teste', Morada: 'Rua teste, 1', CP4: '4000', CP3: '001',
      Localidade: 'Porto', Telefone: '910000000',
    },
  }

  const missingDimensions = await service.newOfferPickUp(creds, { ...baseInput, BiggestObjectDimensionsCm: { Length: 0, Width: 30, Height: 20 } })
  const invalidPhones = await service.newOfferPickUp(creds, { ...baseInput, Expedidor: { ...baseInput.Expedidor, Telefone: '910000' } })
  const invalidPeriod = await service.newOfferPickUp(creds, { ...baseInput, HoraInicio: '09:00', HoraFim: '19:00' })
  const invalidHeaviestWeight = await service.newOfferPickUp(creds, { ...baseInput, PesoKg: 1, PesoObjetoMaisPesadoKg: 1.1 })
  const alternatePhoneOnly = await service.newOfferPickUp(creds, {
    ...baseInput,
    Expedidor: { ...baseInput.Expedidor, Telefone: '', Telemovel: '+351 912 345 678' },
  })
  assert.equal(missingDimensions.Success, false)
  assert.match(missingDimensions.Errors[0], /dimensões/i)
  assert.equal(invalidPhones.Success, false)
  assert.match(invalidPhones.Errors[0], /telefone/i)
  assert.equal(invalidPeriod.Success, false)
  assert.match(invalidPeriod.Errors[0], /janela horária CTT/i)
  assert.equal(invalidHeaviestWeight.Success, false)
  assert.match(invalidHeaviestWeight.Errors[0], /volume mais pesado/i)
  assert.equal(alternatePhoneOnly.Success, true)
  assert.match(soapRequest.soapBodyXml, /<pick:Phone>912345678<\/pick:Phone>/)
  assert.equal(calls, 1)
})
