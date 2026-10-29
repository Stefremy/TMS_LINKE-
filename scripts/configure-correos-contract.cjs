/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS migration. */
// Explicit, idempotent tenant migration. Dry run unless --apply; no carrier calls.
const fs = require('node:fs')
const path = require('node:path')
const { createClient } = require('@supabase/supabase-js')
const products = require('../lib/services/correos/product-catalog.json')
const { buildBalearesExpressZones } = require('../lib/services/correos/baleares-tariffs.ts')
const tenantId = '11111111-1111-1111-1111-111111111111'
function plan(existing, now = new Date().toISOString()) {
  const remaining = [...existing]
  const records = products.map(product => {
    const index = remaining.findIndex(s => s.id === product.id || s.webservice_service_code === product.api)
    const old = index >= 0 ? remaining.splice(index, 1)[0] : null
    // Preserve identifiers, order and prices of existing tiers (client overrides use indexes).
    const zones = product.api === '26'
      ? buildBalearesExpressZones(old?.global_markup_pct ?? 25).map(zone =>
          old?.zones?.find(z => z.zone_code === zone.zone_code && z.tiers?.length) || zone)
      : old?.zones ? structuredClone(old.zones) : []
    const coverage = product.api === '26' ? product.coverage
      : [...new Set([...(old?.allowed_zones || []), ...product.coverage])]
    for (const code of product.coverage) {
      if (!zones.some(z => z.zone_code === code)) zones.push({zone_code:code, zone_name:code, tiers:[]})
    }
    return {
      ...old, id:old?.id || product.id, code:product.code,
      name:`Linke ${product.title} (Correos Express)`, description:product.description,
      category:product.category, color:old?.color || '#526653',
      is_active:product.active, is_primordial:true, carrier_group:'correos',
      pricing_profile:old?.pricing_profile || 'Standard / Geral',
      target_client_name:old?.target_client_name || 'Clientes Gerais',
      preferred_carrier_id:old?.preferred_carrier_id || 'forn_lk003', preferred_carrier_name:'CORREOS.EXPRESS',
      webservice_connection_id:old?.webservice_connection_id || 'correos_express',
      webservice_service_code:product.api, transit_time_label:product.transit,
      global_markup_pct:old?.global_markup_pct ?? 25,
      allowed_zones:coverage, zones,
      created_at:old?.created_at || now, updated_at:now,
    }
  })
  // Preserve custom variants and negotiated prices, disable unselected products only.
  records.push(...remaining.map(s => ({...s,is_active:['63','93','26'].includes(s.webservice_service_code) && s.is_active,updated_at:now})))
  return records
}
async function main() {
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
  const {data:native,error:nativeError}=await db.from('servicos_linke').select('*').eq('tenant_id',tenantId)
  if (!nativeError && native?.length) throw Error('Native catalogue exists: migrate through the native schema before applying.')
  if (nativeError && nativeError.code !== 'PGRST205') throw nativeError
  const {data,error}=await db.from('audit_log').select('action,details').eq('tenant_id',tenantId).in('action',['servicos_linke_data','deleted_servico_linke']).order('created_at',{ascending:false}).limit(5000)
  if(error)throw error
  const seen=new Set(),existing=[],deleted=new Set()
  for(const row of data){const s=typeof row.details==='string'?JSON.parse(row.details):row.details;if(!s?.id)continue;if(row.action==='deleted_servico_linke'){deleted.add(s.id);continue}if(seen.has(s.id))continue;seen.add(s.id);if(/correos/i.test([s.preferred_carrier_name,s.webservice_connection_id,s.carrier_group].join(' ')))existing.push(s)}
  const records=plan(existing.filter(s=>!deleted.has(s.id))).filter(s=>!deleted.has(s.id))
  if(process.argv.includes('--apply')){
    const backup=path.join('docs/config-backups',`correos-${Date.now()}.json`)
    fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,JSON.stringify({tenantId,existing},null,2),{mode:0o600})
    const {error:writeError}=await db.from('audit_log').insert(records.map(details=>({tenant_id:tenantId,action:'servicos_linke_data',details})))
    if(writeError)throw writeError
    console.log(`Saved ${records.length} services. Backup: ${backup}`)
    const {data:verified,error:verifyError}=await db.from('audit_log').select('details').eq('tenant_id',tenantId).eq('action','servicos_linke_data').in('details->>id',records.map(s=>s.id)).order('created_at',{ascending:false}).limit(records.length)
    if(verifyError)throw verifyError
    if(verified.length!==records.length)throw Error('Read-back count mismatch')
    for(const record of records){const saved=verified.find(row=>row.details.id===record.id)?.details;if(!saved || saved.webservice_service_code!==record.webservice_service_code || saved.is_active!==record.is_active)throw Error(`Read-back mismatch: ${record.id}`)}
    console.log('Read-back verified.')
  }
  for(const s of records)console.log(JSON.stringify({api:s.webservice_service_code,name:s.name,active:s.is_active,zones:s.zones.map(z=>({code:z.zone_code,tiers:z.tiers.length}))}))
}
module.exports={plan}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1})
