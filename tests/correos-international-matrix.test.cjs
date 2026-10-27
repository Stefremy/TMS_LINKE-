const test = require('node:test')
const assert = require('node:assert/strict')
const { createLoader } = require('./helpers/load-typescript.cjs')
const euDestinations = require('./fixtures/eu-public-destinations.json')

const load = createLoader({})
const { buildOfficialLinkeInternationalZones, resolveInternationalZone, OFFICIAL_EXPORT_TARIFF_ROWS } = load('lib/services/geo/international-zones.ts')
const { getServiceDestinationCountries, getServiceDestinationZone } = load('lib/services/service-destinations.ts')
const { assertShipmentDestinationAvailable } = load('lib/services/shipment-destination-policy.ts')
const { calculateShipmentPrice } = load('lib/pricing/calculate-shipment-price.ts')
const { resolveServiceCarrier } = load('lib/pricing/calculate-shipment-quote.ts')

const service = {
  id: 'srv_linke_cor_intl',
  code: 'LK-COR-INTL',
  name: 'Linke Internacional Expresso (Correos Express)',
  category: 'Internacional',
  preferred_carrier_id: 'forn_lk003',
  preferred_carrier_name: 'CORREOS.EXPRESS',
  webservice_connection_id: 'correos_express',
  webservice_service_code: '90',
  is_active: true,
  is_primordial: true,
  global_markup_pct: 22.0,
  fuel_surcharge_pct: 8.5,
  allowed_zones: ['EU 1', 'EU 2', 'EU 3', 'NA', 'SA', 'O1', 'O2', 'A', 'EU-Z1', 'EU-Z2', 'EU-Z3', 'INTL-AERO', 'INTL'],
  zones: buildOfficialLinkeInternationalZones(22),
}

const client = {
  id: 'fixture-client-correos',
  short_name: 'CLIENTE TESTE CORREOS INTL',
  default_linke_table_id: service.id,
  pricing: {},
}

const extraEuDestinations = [
  { country: 'BG', label: 'Bulgária', city: 'Sofia', address: 'ul. Dyakon Ignatiy 2', postal: '1000', place: 'National Archaeological Museum' },
  { country: 'HR', label: 'Croácia', city: 'Zagreb', address: 'Trg Nikole Šubića Zrinskog 19', postal: '10000', place: 'Archaeological Museum in Zagreb' },
  { country: 'CY', label: 'Chipre', city: 'Nicosia', address: 'Museum Street 1', postal: '1097', place: 'Cyprus Museum' },
  { country: 'RO', label: 'Roménia', city: 'București', address: 'Calea Victoriei 12', postal: '030026', place: 'National Museum of Romanian History' },
]

const allDestinations = [...euDestinations, ...extraEuDestinations]

const profiles = [
  { weightKg: 0.5, volumes: 1, dimensionsCm: { length: 13, width: 11, height: 7.5 } },
  { weightKg: 1.5, volumes: 2, dimensionsCm: { length: 30.5, width: 20, height: 10.2 } },
  { weightKg: 5.25, volumes: 3, dimensionsCm: { length: 40, width: 30, height: 20 } },
  { weightKg: 12.0, volumes: 2, dimensionsCm: { length: 50, width: 40, height: 30 } },
]

function correosHarness() {
  const requests = []
  const { CorreosShipmentService } = createLoader({
    './correos-rest-client': {
      CorreosRestClient: class {
        async request(endpoint, credentials, payload) {
          requests.push({ endpoint, credentials, payload })
          return {
            codigoRetorno: 0,
            mensajeRetorno: '',
            datosResultado: `323000999${String(requests.length).padStart(7, '0')}`,
            etiqueta: [{ etiqueta1: Buffer.from('%PDF-1.4\nCorreos Express Label Fixture').toString('base64') }],
          }
        }
      },
    },
  })('lib/services/correos/correos-shipment.service.ts')

  return {
    requests,
    service: new CorreosShipmentService(),
    creds: {
      environment: 'production',
      solicitante: 'IP49240001',
      codRte: 'P49240001',
      user: 'WS_GoLinke',
      pass: 'fixture-pass',
    },
  }
}

test('Correos Internacional service resolves carrier as correos and exposes all 25 non-Iberian EU countries under customs-free policy', () => {
  assert.equal(resolveServiceCarrier(service), 'correos')
  const selectable = getServiceDestinationCountries(service).map(c => c.code)
  assert.equal(selectable.length, 25)
  assert.equal(selectable.includes('PT'), false)
  assert.equal(selectable.includes('ES'), false)
  for (const dest of allDestinations) {
    assert.ok(selectable.includes(dest.country), `Expected ${dest.country} to be selectable in Correos Internacional`)
  }
})

for (const destination of allDestinations) {
  test(`Correos Internacional ${destination.country} (${destination.label}): zone mapping, policy and contract pricing — ${destination.city} ${destination.postal}`, () => {
    assert.doesNotThrow(() => assertShipmentDestinationAvailable(destination.country, destination.postal))
    const zone = getServiceDestinationZone(service, destination.country, destination.postal)
    const expectedZone = resolveInternationalZone(destination.country)
    assert.equal(zone, expectedZone)
    assert.ok(['EU 1', 'EU 2', 'EU 3', 'O2'].includes(zone), `Unexpected zone ${zone} for ${destination.country}`)

    for (const profile of profiles) {
      const quote = calculateShipmentPrice(
        profile.weightKg,
        client,
        [service],
        destination.country,
        destination.postal,
        { requireConfiguredTariff: true }
      )
      assert.notEqual(quote.isBlocked, true)
      assert.equal(quote.isFallback, false)

      if (profile.weightKg <= 10.5) {
        const officialRow = OFFICIAL_EXPORT_TARIFF_ROWS.find(r => r.weightMax >= profile.weightKg)
        assert.ok(officialRow)
        const expectedCost = officialRow.rates[zone]
        const expectedBaseSell = Number((expectedCost * 1.22).toFixed(2))
        const expectedFuel = Number((expectedBaseSell * 0.085).toFixed(2))
        assert.equal(quote.buyPrice, expectedCost)
        assert.equal(quote.basePrice, expectedBaseSell)
        assert.equal(quote.fuelSurchargeAmount, expectedFuel)
        assert.equal(quote.sellPrice, Number((expectedBaseSell + expectedFuel).toFixed(2)))
      } else {
        assert.ok(quote.buyPrice > 0)
        assert.ok(quote.sellPrice > quote.buyPrice)
      }
    }
  })

  for (const profile of profiles) {
    test(`Correos Internacional ${destination.country}: REST grabacionEnvio payload & PDF label (${profile.weightKg}kg / ${profile.volumes} vol) — ${destination.place}`, async () => {
      const h = correosHarness()
      const ref = `TEST-CEX-${destination.country}`
      const res = await h.service.createShipment(h.creds, {
        ref,
        fecha: '27102026',
        remitente: {
          nombre: 'GO Linke',
          direccion: 'Rua Rómulo De Carvalho',
          poblacion: 'Guimarães',
          cpNacional: '',
          cpInternacional: '4800-019',
          paisISO: 'PT',
          contacto: 'GO Linke',
          telefono: '+351928315080',
          email: 'geral@linke.pt',
        },
        destinatario: {
          nombre: `CLIENTE TESTE ${destination.country}`,
          direccion: destination.address,
          poblacion: destination.city,
          cpNacional: destination.country === 'ES' ? destination.postal : '',
          cpInternacional: destination.postal,
          paisISO: destination.country,
          contacto: `CLIENTE TESTE ${destination.country}`,
          telefono: '+351928315080',
          email: `test-${destination.country.toLowerCase()}@example.invalid`,
        },
        bultos: profile.volumes,
        kilos: profile.weightKg,
        dimensionsCm: profile.dimensionsCm,
        producto: service.webservice_service_code,
        portes: 'P',
        observaciones: 'TESTE CORREOS INTL — NÃO EXPEDIR',
        tipoEtiqueta: '1',
      })

      assert.equal(res.codigoRetorno, 0)
      assert.ok(res.datosResultado?.startsWith('323000999'))
      assert.ok(res.etiqueta?.[0]?.etiqueta1?.startsWith('JVBERi0'))
      assert.equal(h.requests.length, 1)

      const { endpoint, payload } = h.requests[0]
      assert.match(endpoint, /grabacionEnvio$/)
      assert.equal(payload.producto, '90')
      assert.equal(payload.portes, 'P')
      assert.equal(payload.paisISORte, 'PT')
      assert.equal(payload.codPosIntRte, '4800-019')
      assert.equal(payload.paisISODest, destination.country)
      assert.equal(payload.codPosIntDest, destination.postal)
      assert.equal(payload.pobDest, destination.city)
      assert.equal(payload.dirDest, destination.address)
      assert.equal(payload.numBultos, String(profile.volumes))
      assert.equal(payload.kilos, String(profile.weightKg))
      assert.equal(payload.listaBultos.length, profile.volumes)
      assert.equal(
        payload.listaBultos.reduce((sum, b) => sum + Math.round(Number(b.kilos) * 1000), 0),
        Math.round(profile.weightKg * 1000)
      )
      for (const bulto of payload.listaBultos) {
        assert.equal(bulto.largo, String(profile.dimensionsCm.length))
        assert.equal(bulto.ancho, String(profile.dimensionsCm.width))
        assert.equal(bulto.alto, String(profile.dimensionsCm.height))
      }
      assert.deepEqual(payload.listaInformacionAdicional, [
        { tipoEtiqueta: '1', etiquetaPDF: '', codificacionUnicaB64: '1' },
      ])
    })
  }
}
