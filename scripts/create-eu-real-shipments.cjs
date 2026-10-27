const fs = require('node:fs')
const path = require('node:path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { XMLParser } = require('fast-xml-parser')
const destinations = require('../tests/fixtures/eu-public-destinations.json')
const { createLoader } = require('../tests/helpers/load-typescript.cjs')

const root = path.resolve(__dirname, '..')
const mocks = {
  'fast-xml-parser': require('fast-xml-parser'),
  http: require('node:http'),
  https: require('node:https'),
  crypto: require('node:crypto'),
  'node:http': require('node:http'),
  'node:https': require('node:https'),
  'node:crypto': require('node:crypto'),
}
const load = createLoader(mocks)
const { CTTSoapClient } = load('lib/services/ctt/ctt-soap-client.ts')
const { CTTShipmentService } = load('lib/services/ctt/ctt-shipment.service.ts')
const { CttProvider } = createLoader({
  ...mocks,
  '../ctt': {
    CTTShipmentService,
    CTTPickupService: class {},
    CTTTrackingService: class {},
  }
})('lib/services/carriers/ctt-provider.ts')
const { getCttShipmentLabel } = load('lib/services/ctt/shipment-label.ts')

const TENANT_ID = '11111111-1111-1111-1111-111111111111'
const CLIENT_NAME = 'TESTES EUROPA — NÃO EXPEDIR'
const SERVICE_CODE = 'ENCF008.02'
const SERVICE_ID = 'srv_linke_ce_std'
const SENDER = {
  name: 'GO Linke',
  address: 'Rua Rómulo De Carvalho',
  city: 'Guimarães',
  zip: '4800-019',
  country: 'PT',
  phone: '+351928315080',
  email: 'geral@linke.pt',
}

const PARCEL_PROFILE = {
  weightKg: 0.5,
  volumes: 1,
  dimensionsCm: { length: 13, width: 11, height: 7.5 },
  cttExportDetails: {
    exportType: 'Permanent',
    contentType: 'Goods',
    declaredValue: 25.5,
  },
  observations: 'TESTES EUROPA — NÃO EXPEDIR',
}

async function getOrCreateTestClient(supabase) {
  const { data: existing } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', TENANT_ID)
    .eq('name', CLIENT_NAME)
    .maybeSingle()

  if (existing) return existing

  const newId = crypto.randomUUID()
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

  // Also record in audit_log for client pricing context
  await supabase.from('audit_log').insert({
    tenant_id: TENANT_ID,
    action: 'client_data',
    created_at: new Date().toISOString(),
    details: {
      id: newId,
      name: CLIENT_NAME,
      short_name: CLIENT_NAME,
      default_linke_table_id: SERVICE_ID,
      pricing: {},
    },
  })

  return created
}

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const isPilot = args.includes('--pilot')
  const recipientEmailArg = args.find(a => a.startsWith('--email='))?.split('=')[1] || 'geral@linke.pt'

  console.log('====================================================')
  console.log('CRIAÇÃO DE GUIAS CE REAIS — CTT EXPRESSO PRODUÇÃO')
  console.log(`Modo: ${isDryRun ? 'DRY-RUN (Simulação)' : isPilot ? 'PILOTO (Apenas 1 país: Alemanha)' : 'LOTE COMPLETO (21 países)'}`)
  console.log(`Email de notificação destinatário: ${recipientEmailArg}`)
  console.log('====================================================\n')

  const creds = {
    contract_number: process.env.CTT_CONTRACT_ID || '',
    client_number: process.env.CTT_CLIENT_ID || '',
    auth_id: process.env.CTT_AUTHENTICATION_ID || '',
    user_id: process.env.CTT_USER_ID || undefined,
    distribution_channel: Number(process.env.CTT_DISTRIBUTION_CHANNEL) || 99,
    environment: 'production',
    default_subproduct: SERVICE_CODE,
  }

  if (!creds.auth_id || !creds.client_number || !creds.contract_number) {
    throw new Error('Credenciais CTT incompletas em .env.local')
  }

  console.log(`Credenciais CTT Produção: Cliente ${creds.client_number}, Contrato ${creds.contract_number}`)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  let testClient = null
  if (!isDryRun) {
    testClient = await getOrCreateTestClient(supabase)
    console.log(`Cliente de teste na BD: ${testClient.name} (${testClient.id})`)
  }

  const provider = new CttProvider()
  await provider.initialize(creds)

  const targetDestinations = isPilot ? [destinations[0]] : destinations
  const results = []

  const planFile = path.resolve(root, 'docs/EU_REAL_SHIPMENT_PLAN_2026-10-27.md')
  const existingCreated = new Map()
  if (fs.existsSync(planFile)) {
    const content = fs.readFileSync(planFile, 'utf8')
    for (const line of content.split('\n')) {
      const parts = line.split('|').map(s => s.trim())
      if (parts.length >= 8) {
        const label = parts[1]
        const trackingMatch = parts[6]?.match(/`(CE\w+)`/)
        const labelMatch = parts[8]?.match(/labels\/eu-2026-10-27\/([^)]+)/)
        if (trackingMatch) {
          const dest = destinations.find(d => d.label === label)
          if (dest) {
            existingCreated.set(dest.country, {
              country: dest.country,
              city: dest.city,
              postal: dest.postal,
              status: 'created',
              trackingNumber: trackingMatch[1],
              labelFile: labelMatch ? labelMatch[1] : `${trackingMatch[1]}.pdf`,
            })
          }
        }
      }
    }
  }

  const labelsDir = path.resolve(root, 'docs/labels/eu-2026-10-27')
  if (!fs.existsSync(labelsDir) && !isDryRun) {
    fs.mkdirSync(labelsDir, { recursive: true })
  }

  for (let i = 0; i < targetDestinations.length; i++) {
    const dest = targetDestinations[i]

    if (existingCreated.has(dest.country)) {
      console.log(`[${i + 1}/${targetDestinations.length}] ${dest.country} (${dest.label}) já emitido anteriormente com tracking ${existingCreated.get(dest.country).trackingNumber}. A ignorar.`)
      results.push(existingCreated.get(dest.country))
      continue
    }

    const recipient = {
      name: `CLIENTE TESTE ${dest.country}`,
      address: dest.address,
      city: dest.city,
      zip: dest.postal,
      country: dest.country,
      phone: '',
      email: recipientEmailArg,
    }

    const ref = `TEST-CE-${dest.country}-${Date.now().toString().slice(-6)}`
    console.log(`[${i + 1}/${targetDestinations.length}] A processar ${dest.country} (${dest.label} — ${dest.city} ${dest.postal})...`)

    if (isDryRun) {
      console.log(`  -> DRY RUN: payload preparado para ${dest.country}, ref ${ref}`)
      results.push({
        country: dest.country,
        city: dest.city,
        postal: dest.postal,
        status: 'dry_run_ok',
        reference: ref,
      })
      continue
    }

    try {
      const result = await provider.createShipment({
        reference: ref,
        sender: SENDER,
        recipient,
        weightKg: PARCEL_PROFILE.weightKg,
        volumes: PARCEL_PROFILE.volumes,
        dimensionsCm: PARCEL_PROFILE.dimensionsCm,
        subProduct: SERVICE_CODE,
        autoClose: false, // Sem fecho de manifesto
        observations: PARCEL_PROFILE.observations,
        cttExportDetails: PARCEL_PROFILE.cttExportDetails,
      })

      if (!result.success) {
        console.error(`  ❌ Falha CTT (${dest.country}): ${result.error}`)
        results.push({
          country: dest.country,
          city: dest.city,
          postal: dest.postal,
          status: 'error',
          error: result.error,
        })
        continue
      }

      const trackingNumber = result.trackingNumber
      console.log(`  ✔ Sucesso CTT (${dest.country}): Tracking ${trackingNumber}`)

      // Guardar etiqueta em disco se existir
      let labelFilename = null
      if (result.labelBase64) {
        const ext = result.labelFormat === 'pdf' ? 'pdf' : 'zpl'
        labelFilename = `${trackingNumber}.${ext}`
        fs.writeFileSync(path.join(labelsDir, labelFilename), Buffer.from(result.labelBase64, 'base64'))
        console.log(`  📄 Etiqueta guardada: docs/labels/eu-2026-10-27/${labelFilename}`)
      }

      // Inserir na BD (shipments, packages, audit_log)
      const shipmentId = crypto.randomUUID()
      const now = new Date().toISOString()
      const isZona3 = ['DK', 'EE', 'FI', 'LV', 'MT', 'PL', 'SE'].includes(dest.country)
      const sellPrice = isZona3 ? 17.28 : 16.22
      const buyPrice = isZona3 ? 13.85 : 13.00

      await supabase.from('shipments').insert({
        id: shipmentId,
        tenant_id: TENANT_ID,
        client_id: testClient.id,
        tracking_number: ref,
        carrier_tracking_number: trackingNumber,
        carrier_code: 'ctt',
        status: 'pendente',
        service_type: 'Guia CE (Linke Europa Terrestre Económico)',
        sender_name: SENDER.name,
        sender_address: SENDER.address,
        sender_zip4: '4800',
        sender_zip3: '019',
        sender_phone: SENDER.phone,
        recipient_name: recipient.name,
        recipient_address: recipient.address,
        recipient_email: recipient.email,
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
          tracking_number: ref,
          carrier_tracking_number: trackingNumber,
          carrier_code: 'ctt',
          status: 'pendente',
          subProduct: SERVICE_CODE,
          recipient,
          sender: SENDER,
          weight_kg: 0.5,
          dimensions: PARCEL_PROFILE.dimensionsCm,
          rawResponse: result.rawResponse,
        },
      })

      results.push({
        country: dest.country,
        city: dest.city,
        postal: dest.postal,
        status: 'created',
        trackingNumber,
        shipmentId,
        reference: ref,
        labelFile: labelFilename,
      })

      // Intervalo ligeiro entre pedidos SOAP para gentileza com o WS
      await new Promise(r => setTimeout(r, 800))
    } catch (err) {
      console.error(`  ❌ Exceção (${dest.country}):`, err.message)
      results.push({
        country: dest.country,
        city: dest.city,
        postal: dest.postal,
        status: 'error',
        error: err.message,
      })
    }
  }

  // Se não foi dry-run, atualizar o ficheiro do plano
  if (!isDryRun && results.some(r => r.status === 'created')) {
    const planFile = path.resolve(root, 'docs/EU_REAL_SHIPMENT_PLAN_2026-10-27.md')
    const createdCount = results.filter(r => r.status === 'created').length
    const nowIso = new Date().toISOString()

    let md = `# Lote executado — ${createdCount} guias CE reais\n\n`
    md += `**Estado: Executado em produção CTT a ${nowIso}.**\n\n`
    md += `Ambiente CTT: **Produção**. Cliente: **${CLIENT_NAME}** (\`${testClient.id}\`). Serviço: **Guia CE / ${SERVICE_CODE}**.\n\n`
    md += `Por envio: 1 volume, 0,5 kg, 13 × 11 × 7,5 cm. Sem fecho de manifesto ou pedido de recolha.\n\n`
    md += `Total calculado na tabela de venda atual: **348.04 € sem IVA**.\n\n`
    md += `| País | Cidade | CP | Zona | Preço sem IVA | Tracking CTT | Estado | Etiqueta |\n`
    md += `|---|---|---|---|---|---|---|---|\n`

    for (const dest of destinations) {
      const match = results.find(r => r.country === dest.country)
      const zone = ['DK', 'EE', 'FI', 'LV', 'MT', 'PL', 'SE'].includes(dest.country) ? 'Zona 3' : 'Zona 2'
      const price = zone === 'Zona 3' ? '17.28 €' : '16.22 €'
      const tracking = match?.trackingNumber ? `\`${match.trackingNumber}\`` : '—'
      const status = match?.status === 'created' ? '✔ Criada' : match?.error ? `❌ Erro: ${match.error}` : 'Pendente'
      const labelLink = match?.labelFile ? `[PDF](labels/eu-2026-10-27/${match.labelFile})` : '—'
      md += `| ${dest.label} | ${dest.city} | ${dest.postal} | ${zone} | ${price} | ${tracking} | ${status} | ${labelLink} |\n`
    }

    fs.writeFileSync(planFile, md, 'utf8')
    console.log(`\n📄 Documento do plano atualizado: docs/EU_REAL_SHIPMENT_PLAN_2026-10-27.md`)
  }

  console.log('\n====================================================')
  console.log('RESUMO DA EXECUÇÃO:')
  console.log(JSON.stringify(results, null, 2))
  console.log('====================================================')

  return results
}

main().catch(err => {
  console.error('Erro fatal:', err)
  process.exit(1)
})
