/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS migration. */
const fs=require('node:fs')
const {isDeepStrictEqual}=require('node:util')
const {createClient}=require('@supabase/supabase-js')
const {applyPaq24Tariffs}=require('../lib/services/correos/paq24-tariffs.ts')
const tenantId='11111111-1111-1111-1111-111111111111'
const ids=['26179d74-c276-4500-8df6-386f76c53503','srv_linke_cor_ecom']
async function main(){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
 const {data,error}=await db.from('audit_log').select('details').eq('tenant_id',tenantId).eq('action','servicos_linke_data').in('details->>id',ids).order('created_at',{ascending:false}).limit(100)
 if(error)throw error
 const old=ids.map(id=>data?.find(row=>row.details?.id===id)?.details)
 if(old.some((s,i)=>!s||s.webservice_service_code!==['63','93'][i]))throw Error('Expected existing canonical PAQ24/ePAQ24 tables')
 const records=old.map(s=>({...applyPaq24Tariffs(s),updated_at:new Date().toISOString()}))
 if(process.argv.includes('--apply')){
  const backup=`docs/config-backups/correos-paq24-${Date.now()}.json`
  fs.mkdirSync('docs/config-backups',{recursive:true});fs.writeFileSync(backup,JSON.stringify(old,null,2),{mode:0o600})
  const {error:writeError}=await db.from('audit_log').insert(records.map(details=>({tenant_id:tenantId,action:'servicos_linke_data',details})))
  if(writeError)throw writeError
  const {data:check,error:readError}=await db.from('audit_log').select('details').eq('tenant_id',tenantId).eq('action','servicos_linke_data').in('details->>id',ids).order('created_at',{ascending:false}).limit(2)
  if(readError)throw readError
  for(const record of records){const saved=check?.find(row=>row.details?.id===record.id)?.details;if(!isDeepStrictEqual(saved,record))throw Error(`Read-back mismatch: ${record.id}`)}
  console.log(`Saved and verified. Backup: ${backup}`)
 }
 for(const s of records)console.log(JSON.stringify({id:s.id,api:s.webservice_service_code,margin:s.global_markup_pct,zones:s.zones.map(z=>({code:z.zone_code,tiers:z.tiers.filter(t=>t.enabled!==false).sort((a,b)=>a.weight_max-b.weight_max).map(t=>({kg:t.weight_max,cost:t.cost_price,sell:t.sell_price}))}))}))
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1})
