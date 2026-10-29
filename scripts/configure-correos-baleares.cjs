/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS migration. */
const fs=require('node:fs')
const {createClient}=require('@supabase/supabase-js')
const {plan}=require('./configure-correos-contract.cjs')
const tenantId='11111111-1111-1111-1111-111111111111'
async function main(){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
 const {data,error}=await db.from('audit_log').select('details').eq('tenant_id',tenantId).eq('action','servicos_linke_data').eq('details->>id','srv_linke_cor_islas_express').order('created_at',{ascending:false}).limit(1)
 if(error)throw error
 const old=data?.[0]?.details
 if(!old||old.webservice_service_code!=='26')throw Error('Expected existing Ilhas Express product 26')
 const record=plan([old]).find(s=>s.id===old.id)
 // Exact contract conversion: cubic metres × 167 kg/m³ for air transport.
 record.volumetric_rule={divisor:1_000_000/167}
 if(process.argv.includes('--apply')){
  const backup=`docs/config-backups/correos-baleares-${Date.now()}.json`
  fs.mkdirSync('docs/config-backups',{recursive:true});fs.writeFileSync(backup,JSON.stringify(old,null,2),{mode:0o600})
  const {error:writeError}=await db.from('audit_log').insert({tenant_id:tenantId,action:'servicos_linke_data',details:record})
  if(writeError)throw writeError
  const {data:check,error:readError}=await db.from('audit_log').select('details').eq('tenant_id',tenantId).eq('action','servicos_linke_data').eq('details->>id',record.id).order('created_at',{ascending:false}).limit(1)
  if(readError)throw readError
  if(JSON.stringify(check?.[0]?.details?.zones)!==JSON.stringify(record.zones)){
   // JSONB key ordering can differ; compare every numeric rate and zone explicitly.
   const saved=check?.[0]?.details
   if(saved?.zones?.length!==2||saved.allowed_zones?.length!==2||saved.volumetric_rule?.divisor!==record.volumetric_rule.divisor)throw Error('Read-back mismatch')
   for(const z of record.zones){const stored=saved.zones.find(x=>x.zone_code===z.zone_code);if(stored?.tiers?.length!==8)throw Error('Tier count mismatch');for(let i=0;i<8;i++)for(const key of ['weight_max','cost_price','sell_price','margin_pct'])if(stored.tiers[i][key]!==z.tiers[i][key])throw Error('Rate mismatch')}
  }
  console.log(`Saved and verified. Backup: ${backup}`)
 }
 console.log(JSON.stringify({api:record.webservice_service_code,active:record.is_active,allowed:record.allowed_zones,zones:record.zones.map(z=>({zone:z.zone_name,tiers:z.tiers.map(t=>({kg:t.weight_max,cost:t.cost_price,sell:t.sell_price}))})),volumetric_rule:record.volumetric_rule}))
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1})
