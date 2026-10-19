const test = require('node:test')
const assert = require('node:assert/strict')
const { XMLValidator } = require('fast-xml-parser')
const { createLoader } = require('./helpers/load-typescript.cjs')

test('NewOfferPickUp omits the period for 09:00–19:00 and uses SAP codes for timed services', async () => {
  const requests = []
  const load = createLoader({
    './ctt-soap-client': {
      CTTSoapClient: class {
        static escapeXml(value) { return String(value ?? '') }
        async callSoap(options) {
          requests.push(options)
          return { NewOfferPickUpResponse: { NewOfferPickUpResult: { Status: 'Success', PickUpID: 'MOCK-ONLY' } } }
        }
      },
    },
  })
  const { CTTPickupService } = load('lib/services/ctt/ctt-pickup.service.ts')
  const service = new CTTPickupService()
  const creds = { auth_id: '11111111-1111-4111-8111-111111111111', client_number: '123456', contract_number: '654321', environment: 'production' }
  const input = {
    AuthenticationID: creds.auth_id, ClientId: creds.client_number, ContractId: creds.contract_number,
    DataRecolha: '2026-10-20', HoraInicio: '10:00', HoraFim: '13:00', Destination: 'PT',
    BiggestObjectDimensionsCm: { Length: 40, Width: 30, Height: 20 }, QuantidadeVolumes: 1, PesoKg: 1,
    Expedidor: { Nome: 'Teste', Morada: 'Rua Teste', CP4: '1000', CP3: '001', Localidade: 'Lisboa', Telefone: '253123456' },
  }
  // Contract examples from SGEE V1.8, page 54, independent of the implementation.
  const expected = [
    ['08:00', '10:00', 'EMSE036.01.60'],
    ['10:00', '13:00', 'EMSE037.01.60'],
    ['13:00', '16:00', 'EMSE038.01.60'],
    ['16:00', '19:00', 'EMSE039.01.60'],
    ['19:00', '22:00', 'EMSE040.01.60'],
  ]
  const { XMLParser } = require('fast-xml-parser')
  for (const [HoraInicio, HoraFim, code] of expected) {
    const result = await service.newOfferPickUp(creds, { ...input, HoraInicio, HoraFim })
    assert.equal(result.Success, true)
    const xml = requests.at(-1).soapBodyXml
    const parsed = new XMLParser({ removeNSPrefix: true, parseTagValue: false }).parse(xml)
    assert.equal(parsed.NewOfferPickUp.Input.PickUpData.PickUpPeriod, code)
    assert.doesNotMatch(xml, /<pick:PickUpPeriod>\d{2}:\d{2}-/)
  }
  const allDay = await service.newOfferPickUp(creds, { ...input, HoraInicio: '09:00', HoraFim: '19:00' })
  assert.equal(allDay.Success, true)
  const allDayXml = requests.at(-1).soapBodyXml
  assert.doesNotMatch(allDayXml, /PickUpPeriod/)
  const allDayData = new XMLParser({ removeNSPrefix: true, parseTagValue: false }).parse(allDayXml).NewOfferPickUp.Input.PickUpData
  assert.equal(Object.hasOwn(allDayData, 'PickUpPeriod'), false)
  const invalid = await service.newOfferPickUp(creds, { ...input, HoraInicio: '10:00', HoraFim: '12:00' })
  assert.equal(invalid.Success, false)
  assert.equal(requests.length, 6, 'invalid windows must be blocked before calling CTT')
})

test('requester defaults and manual overrides stay separate from pickup location contacts', async () => {
  let soapRequest
  const loadService = createLoader({
    './ctt-soap-client': {
      CTTSoapClient: class {
        static escapeXml(value) { return String(value ?? '') }
        async callSoap(options) {
          soapRequest = options
          return { NewOfferPickUpResponse: { NewOfferPickUpResult: {
            Status: 'Failure', ErrorList: { ErrorData: { ErrorCode: 'EW0074', Message: 'ClientData: Phone Number is not valid.' } },
          } } }
        }
      },
    },
  })
  const { CTTPickupService } = loadService('lib/services/ctt/ctt-pickup.service.ts')
  const loadProvider = createLoader({
    '../ctt': { CTTPickupService, CTTShipmentService: class {}, CTTTrackingService: class {} },
  })
  const { readPickupContact, readPickupRequester } = loadProvider('lib/pickup-contact.ts')
  const { CttProvider } = loadProvider('lib/services/carriers/ctt-provider.ts')
  // These are the submitted input values; no React state or dummy landline is used.
  const formData = new FormData()
  formData.set('pickupPhone', '')
  formData.set('pickupMobilePhone', '+351 916 234 567')
  const contact = readPickupContact(formData)
  assert.equal(contact.phone, '+351 916 234 567')
  const provider = new CttProvider()
  const credentials = { auth_id: '11111111-1111-4111-8111-111111111111', client_number: '123456', contract_number: '654321', environment: 'production' }
  await provider.initialize(credentials)
  const pickupInput = {
    date: '2026-10-20', startHour: '10:00', endHour: '13:00', volumes: 1, weightKg: 1,
    pickupDestination: 'PT', biggestParcelDimensionsCm: { length: 40, width: 30, height: 20 },
    sender: { name: 'Teste', address: 'Rua Teste', zip: '4000-001', city: 'Porto', country: 'PT', ...contact },
  }
  const result = await provider.createPickup(pickupInput)
  assert.equal(result.success, false)
  assert.match(result.error, /recusaram o telemóvel no contacto obrigatório do solicitante/)
  const { XMLParser } = require('fast-xml-parser')
  const data = new XMLParser({ removeNSPrefix: true, parseTagValue: false }).parse(soapRequest.soapBodyXml).NewOfferPickUp.Input.PickUpData
  assert.equal(data.ClientData.Phone, '916234567')
  assert.equal(data.PickupAddress.Phone, '')
  assert.equal(data.PickupAddress.MobilePhone, '916234567')

  await provider.initialize({ ...credentials, pickup_requester: { name: 'Linke — solicitante', mobilePhone: '912345678' } })
  for (const locationMobile of ['916234567', '934567890']) {
    const configuredResult = await provider.createPickup({
      ...pickupInput, sender: { ...pickupInput.sender, phone: '', mobilePhone: locationMobile },
    })
    assert.equal(configuredResult.success, false)
    assert.match(configuredResult.error, /Os CTT recusaram o contacto enviado/)
    const configured = new XMLParser({ removeNSPrefix: true, parseTagValue: false }).parse(soapRequest.soapBodyXml).NewOfferPickUp.Input.PickUpData
    assert.equal(configured.ClientData.Phone, '255000000')
    assert.equal(configured.ClientData.ContactName, 'Linke — solicitante')
    assert.equal(configured.ClientData.RequestedBy, 'Linke — solicitante')
    assert.equal(configured.PickupAddress.Contact, 'Teste')
    assert.equal(configured.PickupAddress.MobilePhone, locationMobile)
    assert.equal(configured.PickupAddress.Phone, '')
  }

  formData.set('requesterName', 'Contacto manual')
  formData.set('requesterPhone', '253123456')
  formData.set('requesterMobile', '912345678')
  formData.set('requesterEmail', 'contacto@example.com')
  const manualRequester = readPickupRequester(formData)
  await provider.createPickup({ ...pickupInput, requester: manualRequester })
  const manual = new XMLParser({ removeNSPrefix: true, parseTagValue: false }).parse(soapRequest.soapBodyXml).NewOfferPickUp.Input.PickUpData
  assert.equal(manual.ClientData.ContactName, 'Contacto manual')
  assert.equal(manual.ClientData.Phone, '253123456')
  assert.equal(manual.ClientData.Email, 'contacto@example.com')
  assert.equal(manual.ClientData.ClientID, credentials.client_number)
  assert.equal(manual.ClientData.ContractID, credentials.contract_number)
  assert.equal(manual.PickupAddress.MobilePhone, '916234567')
  assert.equal(manual.PickupAddress.Contact, 'Teste')

  formData.set('requesterPhone', '   ')
  const defaultRequester = readPickupRequester(formData)
  assert.equal(defaultRequester.phone, '255000000')
  await provider.createPickup({ ...pickupInput, requester: defaultRequester })
  const defaulted = new XMLParser({ removeNSPrefix: true, parseTagValue: false }).parse(soapRequest.soapBodyXml).NewOfferPickUp.Input.PickUpData
  assert.equal(defaulted.ClientData.Phone, '255000000')
  assert.equal(defaulted.ClientData.ContactName, 'Contacto manual')
  assert.equal(defaulted.PickupAddress.MobilePhone, '916234567')
  assert.equal(defaulted.PickupAddress.Phone, '')

  const previousSoapRequest = soapRequest
  formData.set('requesterName', '')
  formData.set('requesterPhone', '')
  formData.set('requesterMobile', '')
  const emptyManual = await provider.createPickup({ ...pickupInput, requester: readPickupRequester(formData) })
  assert.equal(emptyManual.success, false)
  assert.match(emptyManual.error, /Confirme os dados do cliente CTT/)
  assert.equal(soapRequest, previousSoapRequest, 'empty manual fields must not silently send the configured requester')

  formData.set('pickupMobilePhone', '')
  assert.deepEqual(readPickupContact(formData), { phone: '', mobilePhone: undefined })
})

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
  assert.match(soapRequest.soapBodyXml, /<pick:PickUpPeriod>EMSE037\.01\.60<\/pick:PickUpPeriod>/)
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

test('CTT phone rejection preserves the upstream error instead of reporting an empty form', async () => {
  const load = createLoader({
    './ctt-soap-client': {
      CTTSoapClient: class {
        static escapeXml(value) { return String(value ?? '') }
        async callSoap() {
          return {
            NewOfferPickUpResponse: {
              NewOfferPickUpResult: {
                Status: 'Failure',
                ErrorList: { ErrorData: { ErrorCode: 'EW0074', Message: 'ClientData: Phone Number is not valid.' } },
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
  assert.match(result.Errors[0], /Os CTT recusaram o telemóvel no contacto obrigatório do solicitante/)
  assert.match(result.Errors[0], /EW0074: ClientData: Phone Number is not valid/)
  assert.doesNotMatch(result.Errors[0], /não recebeu|Indique um número|910000000/)
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
  const invalidPhones = await service.newOfferPickUp(creds, { ...baseInput, Expedidor: { ...baseInput.Expedidor, Telefone: '91234567890123456' } })
  const invalidPeriod = await service.newOfferPickUp(creds, { ...baseInput, HoraInicio: '09:00', HoraFim: '18:00' })
  const invalidHeaviestWeight = await service.newOfferPickUp(creds, { ...baseInput, PesoKg: 1, PesoObjetoMaisPesadoKg: 1.1 })
  const alternatePhoneOnly = await service.newOfferPickUp(creds, {
    ...baseInput,
    Expedidor: { ...baseInput.Expedidor, Telefone: '', Telemovel: '00351 912 345 678' },
  })
  const mobileOnlyEightDigits = await service.newOfferPickUp(creds, {
    ...baseInput,
    Expedidor: { ...baseInput.Expedidor, Telefone: '', Telemovel: '91234567' },
  })
  assert.match(soapRequest.soapBodyXml, /<pick:Phone>91234567<\/pick:Phone>/)
  const mobileWithSlashFormatting = await service.newOfferPickUp(creds, {
    ...baseInput,
    Expedidor: { ...baseInput.Expedidor, Telefone: '', Telemovel: '00351 912/345/678' },
  })
  assert.equal(mobileWithSlashFormatting.Success, true)
  assert.match(soapRequest.soapBodyXml, /<pick:Phone>912345678<\/pick:Phone>/)
  const formattedPhone = await service.newOfferPickUp(creds, {
    ...baseInput,
    Expedidor: { ...baseInput.Expedidor, Telefone: '00351 (0) 912-345-678' },
  })
  assert.equal(formattedPhone.Success, true)
  assert.match(soapRequest.soapBodyXml, /<pick:Phone>912345678<\/pick:Phone>/)
  const secondCandidatePhone = await service.newOfferPickUp(creds, {
    ...baseInput,
    Expedidor: { ...baseInput.Expedidor, Telefone: 'sem telefone / +351 934 567 890' },
  })
  assert.equal(missingDimensions.Success, false)
  assert.match(missingDimensions.Errors[0], /dimensões/i)
  assert.equal(invalidPhones.Success, false)
  assert.match(invalidPhones.Errors[0], /pedido ainda não foi enviado aos CTT/i)
  assert.equal(invalidPeriod.Success, false)
  assert.match(invalidPeriod.Errors[0], /janela horária CTT/i)
  assert.equal(invalidHeaviestWeight.Success, false)
  assert.match(invalidHeaviestWeight.Errors[0], /volume mais pesado/i)
  assert.equal(alternatePhoneOnly.Success, true)
  assert.equal(mobileOnlyEightDigits.Success, true)
  assert.equal(secondCandidatePhone.Success, true)
  assert.match(soapRequest.soapBodyXml, /<pick:Phone>934567890<\/pick:Phone>/)
  assert.equal(calls, 5)
})
