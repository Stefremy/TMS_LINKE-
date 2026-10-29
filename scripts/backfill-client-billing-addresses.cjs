/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS migration. */
const fs=require('node:fs'),{isDeepStrictEqual}=require('node:util')
const {createClient}=require('@supabase/supabase-js')
const {billingFieldsFromLegacyRow}=require('../lib/client-addresses.ts')
const manifestFile='docs/imports/clientes-2026-10-29/manifest.json'
async function main(){
 const manifest=JSON.parse(fs.readFileSync(manifestFile)),tenant=manifest.tenant
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
 const entries=manifest.entries.filter(e=>e.status==='Importado')
 const {data,error}=await db.from('audit_log').select('details').eq('tenant_id',tenant).eq('action','client_data').in('details->>id',entries.map(e=>e.id)).order('created_at',{ascending:false})
 if(error)throw error
 const map=new Map();for(const row of data||[])if(!map.has(row.details.id))map.set(row.details.id,row.details)
 const plan=[]
 for(const entry of entries){const old=map.get(entry.id);if(!old)throw Error('Imported profile missing')
  // Do not replace any fiscal configuration already entered by a person.
  if(typeof old.billing_same_as_pickup==='boolean'||['billing_address','billing_postal_code','billing_city','billing_country_code'].some(k=>old[k]))continue
  const source={...entry.source,Morada:old.address,'Código Postal':old.postal_code,Localidade:old.city,País:old.country_code}
  plan.push({old,record:{...old,...billingFieldsFromLegacyRow(source)}})
 }
 const report={total:plan.length,separate:plan.filter(x=>!x.record.billing_same_as_pickup).length,same:plan.filter(x=>x.record.billing_same_as_pickup).length,errors:[]}
 if(process.argv.includes('--apply')){
  const file=`docs/config-backups/client-billing-addresses-${Date.now()}.json`;fs.mkdirSync('docs/config-backups',{recursive:true});fs.writeFileSync(file,JSON.stringify(plan.map(x=>x.old),null,2),{mode:0o600})
  let cursor=0;await Promise.all(Array.from({length:4},async()=>{for(;;){const i=cursor++;if(i>=plan.length)return;const {old,record}=plan[i];const {error}=await db.rpc('save_client_financial_profile',{p_tenant:tenant,p_client:old.id,p_details:record,p_expected_credit:old.credit_limit??null});if(error)report.errors.push({id:old.id,error:error.message})}}))
  const {data:check,error:readError}=await db.from('audit_log').select('details').eq('tenant_id',tenant).eq('action','client_data').in('details->>id',plan.map(x=>x.record.id));if(readError)throw readError
  for(const {record} of plan){if(!check.some(row=>isDeepStrictEqual(row.details,record)))report.errors.push({id:record.id,error:'Read-back mismatch'})}
  report.backup=file;report.verified=report.errors.length===0
  fs.writeFileSync('docs/imports/clientes-2026-10-29/billing-addresses-result.json',JSON.stringify(report,null,2),{mode:0o600})
 }
 console.log(JSON.stringify(report,null,2));if(report.errors.length)process.exitCode=1
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1})
