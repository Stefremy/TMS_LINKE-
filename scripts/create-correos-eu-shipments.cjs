const fs = require('node:fs')
const path = require('node:path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { createClient } = require('@supabase/supabase-js')
const destinations = require('../tests/fixtures/eu-public-destinations.json')
const { createLoader } = require('../tests/helpers/load-typescript.cjs')

const root = path.resolve(__dirname, '..')
const mocks = {
  http: require('node:http'),
  https: require('node:https'),
  crypto: require('node:crypto'),
  'node:http': require('node:http'),
  'node:https': require('node:https'),
  'node:crypto': require('node:crypto'),
}
const load = createLoader(mocks)
const { CorreosShipmentService } = load('lib/services/correos/correos-shipment.service.ts')
const { resolveInternationalZone, OFFICIAL_EXPORT_TARIFF_ROWS } = load('lib/services/geo/international-zones.ts')

const TENANT_ID = '11111111-1111-1111-1111-111111111111'
const CLIENT_NAME = 'TESTES EUROPA — NÃO EXPEDIR'
const SERVICE_CODE = '90'
const SERVICE_ID = 'srv_linke_cor_intl'
const SENDER = {
  nombre: 'GO Linke',
  direccion: 'Rua Romulo De Carvalho',
  poblacion: 'Guimaraes',
  cpNacional: '',
  cpInternacional: '4800-019',
  paisISO: 'PT',
  contacto: 'GO Linke',
  telefono: '928315080',
  email: 'geral@linke.pt',
}

const PARCEL_PROFILE = {
  weightKg: 1,
  volumes: 1,
  dimensionsCm: { length: 13, width: 11, height: 8 },
  observations: 'TESTE CORREOS NAO EXPEDIR',
}

async function resolveCorreosCredsFromDb(supabase) {
  try {
    const { data: conn } = await supabase
      .from('carrier_connections')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('carrier_code', 'correos_express')
      .maybeSingle()

    if (conn) {
      return {
        solicitante: conn.client_id,
        codRte: conn.contract_number,
        user: conn.auth_id,
        pass: conn.user_id || '',
        environment: conn.environment === 'qa' ? 'test' : conn.environment || 'production',
      }
    }
  } catch {}

  try {
    const { data: logs } = await supabase
      .from('audit_log')
      .select('details')
      .eq('action', 'carrier_connection_config')
      .order('created_at', { ascending: false })
      .limit(20)

    const connLog = (logs || []).find(l => l.details?.carrier_code === 'correos_express')
    if (connLog?.details) {
      const d = connLog.details
      return {
        solicitante: d.client_id,
        codRte: d.contract_number,
        user: d.auth_id,
        pass: d.user_id || '',
        environment: d.environment === 'qa' ? 'test' : d.environment || 'production',
      }
    }
  } catch {}

  return {
    solicitante: process.env.CORREOS_SOLICITANTE || '',
    codRte: process.env.CORREOS_COD_RTE || '',
    user: process.env.CORREOS_USER || '',
    pass: process.env.CORREOS_PASSWORD || '',
    environment: process.env.CORREOS_ENVIRONMENT || 'production',
  }
}

async function getOrCreateTestClient(supabase) {
  const { data: existing } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('name', CLIENT_NAME)
    .maybeSingle()

  if (existing) return existing

  const newId = require('node:crypto').randomUUID()
  const { data: created, error } = await supabase
    .from('clients')
    .insert({
      id: newId,
      tenant_id: TENANT_ID,
      name: CLIENT_NAME,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Erro ao criar cliente '${CLIENT_NAME}' na BD: ${error.message}`)
  }
  return created
}

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const isPilot = args.includes('--pilot')
  const recipientEmailArg = args.find(a => a.startsWith('--email='))?.split('=')[1] || 'geral@linke.pt'

  console.log('====================================================')
  console.log('TESTE DE GUIAS CORREOS EXPRESS INTERNACIONAL (PROD 90)')
  console.log(`Modo: ${isDryRun ? 'DRY-RUN (Simulação)' : isPilot ? 'PILOTO (Apenas 1 país: Alemanha)' : 'LOTE COMPLETO (21 países)'}`)
  console.log('====================================================\n')

  const targetDestinations = isPilot ? [destinations[0]] : destinations
  const service = new CorreosShipmentService()
  const results = []

  let supabase = null
  let creds = {
    solicitante: 'DRY-RUN-SOLICITANTE',
    codRte: 'DRY-RUN-CODRTE',
    user: 'DRY-RUN-USER',
    pass: 'DRY-RUN-PASS',
    environment: 'production',
  }
  let testClient = null

  if (!isDryRun) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    creds = await resolveCorreosCredsFromDb(supabase)
    if (!creds.solicitante || !creds.codRte || !creds.user || !creds.pass) {
      throw new Error('Credenciais Correos Express incompletas na BD / .env.local')
    }
    console.log(`Credenciais Correos (${creds.environment}): Solicitante ${creds.solicitante}, Contrato ${creds.codRte}, User ${creds.user}`)
    testClient = await getOrCreateTestClient(supabase)
    console.log(`Cliente de teste na BD: ${testClient.name} (${testClient.id})\n`)
  }

  const labelsDir = path.resolve(root, 'docs/labels/correos-eu-2026-10-27')
  if (!fs.existsSync(labelsDir) && !isDryRun) {
    fs.mkdirSync(labelsDir, { recursive: true })
  }

  for (let i = 0; i < targetDestinations.length; i++) {
    const dest = targetDestinations[i]
    const zone = resolveInternationalZone(dest.country)
    const row05 = OFFICIAL_EXPORT_TARIFF_ROWS[0]
    const buyPrice = row05.rates[zone]
    const baseSell = Number((buyPrice * 1.22).toFixed(2))
    const fuel = Number((baseSell * 0.085).toFixed(2))
    const sellPrice = Number((baseSell + fuel).toFixed(2))

    const ref = `LTK${Date.now().toString().slice(-7)}`
    console.log(`[${i + 1}/${targetDestinations.length}] ${dest.country} (${dest.label} — ${dest.city} ${dest.postal}) | Zona: ${zone} | Compra: ${buyPrice}€ | Venda: ${sellPrice}€`)

    if (isDryRun) {
      results.push({
        country: dest.country,
        city: dest.city,
        postal: dest.postal,
        zone,
        buyPrice,
        sellPrice,
        status: 'dry_run_ok',
        reference: ref,
      })
      continue
    }

    try {
      // First get server Date header to avoid clock skew in VALIDA_FORMATO_DATOS_GE
      const serverDateStr = await new Promise((resolve) => {
        const req = require('node:https').request('https://www.cexpr.es', { method: 'HEAD' }, (res) => {
          const d = res.headers.date ? new Date(res.headers.date) : new Date()
          const dd = String(d.getUTCDate()).padStart(2, '0')
          const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
          const yyyy = d.getUTCFullYear()
          resolve(`${dd}${mm}${yyyy}`)
        })
        req.on('error', () => resolve(''))
        req.end()
      })
      console.log(`  [Info] Data servidor Correos: ${serverDateStr || '(vazio)'}`)

      const baseInput = {
        ref,
        fecha: serverDateStr,
        remitente: SENDER,
        destinatario: {
          nombre: `CLIENTE TESTE ${dest.country}`,
          direccion: dest.address,
          poblacion: dest.city,
          cpNacional: '',
          cpInternacional: dest.postal,
          paisISO: dest.country,
          contacto: `CLIENTE TESTE ${dest.country}`,
          telefono: '928315080',
          email: recipientEmailArg,
        },
        bultos: PARCEL_PROFILE.volumes,
        kilos: PARCEL_PROFILE.weightKg,
        dimensionsCm: PARCEL_PROFILE.dimensionsCm,
        producto: SERVICE_CODE,
        portes: 'P',
        observaciones: PARCEL_PROFILE.observations,
        tipoEtiqueta: '1',
      }

      let response = await service.createShipment(creds, baseInput)

      if (isPilot && response.codigoRetorno === 999) {
        // Test candidate variations if VALIDA_FORMATO_DATOS_GE still rejects
        const candidates = [
          {
            label: 'codPosIntRte 4800-019 + fecha + volumen=0 + alto/largo/ancho=0',
            patch: {
              fecha: serverDateStr,
              codPosIntRte: '4800-019',
              producto: '90',
              listaBultos: [{ orden: '1', kilos: '1.000', volumen: '0', alto: '0', largo: '0', ancho: '0' }],
            },
          },
          {
            label: 'codPosIntRte 4800019 + fecha + volumen=0 + alto/largo/ancho=0 (prod 90)',
            patch: {
              fecha: serverDateStr,
              codPosIntRte: '4800019',
              producto: '90',
              listaBultos: [{ orden: '1', kilos: '1.000', volumen: '0', alto: '0', largo: '0', ancho: '0' }],
            },
          },
          {
            label: 'codPosIntRte 4800019 + fecha + prod 91 (Internacional Terrestre)',
            patch: {
              fecha: serverDateStr,
              codPosIntRte: '4800019',
              producto: '91',
              listaBultos: [{ orden: '1', kilos: '1.000', volumen: '0', alto: '0', largo: '0', ancho: '0' }],
            },
          },
        ]
        for (const cand of candidates) {
          console.log(`  [Retry Pilot] A testar variante: ${cand.label}...`)
          const endpoint = creds.environment === 'production'
            ? 'https://www.cexpr.es/wspsc/apiRestGrabacionEnviok8s/json/grabacionEnvio'
            : 'https://www.test.cexpr.es/wspsc/apiRestGrabacionEnviok8s/json/grabacionEnvio'
          const rawClient = new (load('lib/services/correos/correos-rest-client.ts').CorreosRestClient)()
          response = await rawClient.request(endpoint, creds, {
            solicitante: creds.solicitante,
            codRte: creds.codRte,
            ref,
            refCliente: '',
            fecha: cand.patch.fecha,
            nomRte: SENDER.nombre,
            nifRte: '',
            dirRte: SENDER.direccion,
            pobRte: SENDER.poblacion,
            codPosNacRte: '',
            paisISORte: 'PT',
            codPosIntRte: cand.patch.codPosIntRte,
            contacRte: SENDER.contacto,
            telefRte: SENDER.telefono,
            emailRte: SENDER.email,
            nomDest: `CLIENTE TESTE ${dest.country}`,
            nifDest: '',
            dirDest: dest.address,
            pobDest: dest.city,
            codPosNacDest: '',
            paisISODest: dest.country,
            codPosIntDest: dest.postal,
            contacDest: `CLIENTE TESTE ${dest.country}`,
            telefDest: '928315080',
            emailDest: recipientEmailArg,
            observac: PARCEL_PROFILE.observations,
            numBultos: '1',
            kilos: '1',
            volumen: '0',
            producto: cand.patch.producto,
            portes: 'P',
            reembolso: '',
            entrSabado: '',
            seguro: '',
            listaBultos: cand.patch.listaBultos,
            listaInformacionAdicional: [{ tipoEtiqueta: '1', etiquetaPDF: '', codificacionUnicaB64: '1' }],
          })
          console.log(`  -> Resultado variante (${cand.label}): [${response.codigoRetorno}] ${response.mensajeRetorno}`)
          if (response.codigoRetorno === 0) break
        }
      }

      if (response.codigoRetorno !== 0 && !(response.codigoRetorno === 404 && response.datosResultado)) {
        console.error(`  ❌ Falha Correos (${dest.country}): [${response.codigoRetorno}] ${response.mensajeRetorno}`)
        results.push({
          country: dest.country,
          city: dest.city,
          postal: dest.postal,
          zone,
          status: 'error',
          code: response.codigoRetorno,
          error: response.mensajeRetorno,
        })
        continue
      }

      const trackingNumber = response.datosResultado || response.envios?.[0]?.numEnvio || ref
      let labelBase64 = response.etiqueta?.[0]?.etiqueta1 || (response.etiqueta?.[0] ? Object.values(response.etiqueta[0])[0] : '') || response.listaInformacionAdicional?.[0]?.etiquetaPDF || ''

      let labelFile = null
      if (labelBase64) {
        labelFile = `${trackingNumber}.pdf`
        fs.writeFileSync(path.join(labelsDir, labelFile), Buffer.from(labelBase64, 'base64'))
        console.log(`  ✔ Sucesso Correos (${dest.country}): Tracking ${trackingNumber} | Etiqueta: docs/labels/correos-eu-2026-10-27/${labelFile}`)
      } else {
        console.log(`  ✔ Sucesso Correos (${dest.country}): Tracking ${trackingNumber} (sem PDF devolvido pelo endpoint)`)
      }

      const shipmentId = require('node:crypto').randomUUID()
      const now = new Date().toISOString()

      await supabase.from('shipments').insert({
        id: shipmentId,
        tenant_id: TENANT_ID,
        client_id: testClient.id,
        tracking_number: ref,
        carrier_tracking_number: trackingNumber,
        carrier_code: 'correos',
        status: 'pendente',
        service_type: 'Linke Internacional Expresso (Correos Express)',
        sender_name: SENDER.nombre,
        sender_address: SENDER.direccion,
        sender_zip4: '4800',
        sender_zip3: '019',
        sender_phone: SENDER.telefono,
        recipient_name: `CLIENTE TESTE ${dest.country}`,
        recipient_address: dest.address,
        recipient_email: recipientEmailArg,
        buy_price: buyPrice,
        sell_price: sellPrice,
        created_at: now,
        updated_at: now,
      })

      await supabase.from('packages').insert({
        tenant_id: TENANT_ID,
        shipment_id: shipmentId,
        weight_g: 500,
        dimensions: { length_cm: 13, width_cm: 11, height_cm: 7.5, unit: 'cm' },
      })

      await supabase.from('audit_log').insert({
        tenant_id: TENANT_ID,
        action: 'shipment_data',
        created_at: now,
        details: {
          id: shipmentId,
          client_id: testClient.id,
          tracking_number: ref,
          carrier_tracking_number: trackingNumber,
          carrier_object_id: trackingNumber,
          carrier_code: 'correos',
          carrier_name: 'Correos Express',
          status: 'pendente',
          subProduct: SERVICE_CODE,
          recipient_country: dest.country,
          recipient_city: dest.city,
          recipient_postal: dest.postal,
          weight_kg: 0.5,
          dimensions: PARCEL_PROFILE.dimensionsCm,
          ctt_label_base64: labelBase64 || null,
          carrier_label_base64: labelBase64 || null,
          rawResponse: response,
        },
      })

      results.push({
        country: dest.country,
        city: dest.city,
        postal: dest.postal,
        zone,
        buyPrice,
        sellPrice,
        status: 'created',
        trackingNumber,
        shipmentId,
        labelFile,
      })
    } catch (err) {
      console.error(`  ❌ Exceção (${dest.country}):`, err.message)
      results.push({
        country: dest.country,
        city: dest.city,
        postal: dest.postal,
        zone,
        status: 'error',
        error: err.message,
      })
    }
  }

  console.log('\n====================================================')
  console.log(`RESUMO (${results.length} destinos):`)
  console.log(JSON.stringify(results, null, 2))
  console.log('====================================================')
}

main().catch(err => {
  console.error('Erro fatal:', err)
  process.exit(1)
})

