/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS import. */
const fs=require('node:fs')
const {isDeepStrictEqual}=require('node:util')
const {billingFieldsFromLegacyRow}=require('../lib/client-addresses.ts')
const path=require('node:path')
const crypto=require('node:crypto')
const XLSX=require('xlsx')
const {createClient}=require('@supabase/supabase-js')
const TENANT='11111111-1111-1111-1111-111111111111'
const SOURCE='public/patches/Listagem de Clientes (3).xls'
const OUT='docs/imports/clientes-2026-10-29'
const str=v=>String(v??'').replace(/\u00a0/g,' ').trim()
const norm=v=>str(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const tax=v=>str(v).toUpperCase().replace(/[^A-Z0-9]/g,'')
const email=v=>str(v).toLowerCase()
function stableId(code){const b=crypto.createHash('sha1').update(Buffer.from(TENANT.replace(/-/g,''),'hex')).update(`legacy-client:${str(code).toUpperCase()}`).digest().subarray(0,16);b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`}
function validPtNif(value){const s=tax(value);if(!/^\d{9}$/.test(s)||s==='999999990')return false;const sum=[...s.slice(0,8)].reduce((sum,n,i)=>sum+Number(n)*(9-i),0);const digit=11-sum%11;return (digit>=10?0:digit)===Number(s[8])}
function paymentDays(value){const v=norm(value);if(v==='apronto'||v==='prontopagamento')return 0;const m=/^a(\d+)dias$/.exec(v);return m&&Number(m[1])<=365?Number(m[1]):undefined}
function issuesFor(row,rows){
 const issues=[]
 for(const [key,label] of [['Morada','Morada de recolha'],['Código Postal','Código postal de recolha'],['Localidade','Localidade de recolha'],['País','País de recolha'],['E-mail','E-mail principal'],['Email Faturação','E-mail de faturação'],['Pessoa Contacto','Pessoa de contacto'],['Método de Pagamento','Método de pagamento']])if(!str(row[key]))issues.push(label)
 if(!str(row.Telefone)&&!str(row['Telemóvel']))issues.push('Telefone/telemóvel')
 if(!str(row['Morada Faturação'])||!str(row['Código Postal Faturação'])||!str(row['Localidade Faturação']))issues.push('Morada de faturação incompleta')
 if(tax(row.NIF)==='999999990')issues.push('NIF genérico — confirmar contribuinte')
 else if(str(row['País Faturação']).toUpperCase()==='PT'&&!validPtNif(row.NIF))issues.push('Rever formato/dígito de controlo do NIF')
 const t=tax(row.NIF);if(t&&t!=='999999990'&&rows.filter(r=>tax(r.NIF)===t).length>1)issues.push('NIF partilhado por várias fichas da origem — confirmar contas separadas')
 const cp=str(row['Código Postal']);if(str(row.País).toUpperCase()==='PT'&&cp&&!/^\d{4}-\d{3}$/.test(cp))issues.push('Rever formato do código postal')
 if(paymentDays(row['Forma de Pagamento'])===undefined)issues.push('Prazo de pagamento')
 if(norm(row.Morada)!==norm(row['Morada Faturação'])||str(row['Código Postal'])!==str(row['Código Postal Faturação'])||norm(row.País)!==norm(row['País Faturação']))issues.push('Morada fiscal diferente — preservada nas observações')
 return issues
}
function matchExisting(row,current){
 const sourceName=norm(row.Nome),sourceLegal=norm(row['Designação Social']),sourceTax=tax(row.NIF)
 return current.filter(c=>{
  if(norm(c.code)===norm(row['Código'])||norm(c.short_name||c.name)===sourceName||norm(c.legal_name)===sourceLegal)return true
  if(sourceTax&&sourceTax!=='999999990'&&tax(c.nif)===sourceTax)return true
  if([c.email,c.billing_email].some(e=>str(e)&&[row['E-mail'],row['Email Faturação']].some(v=>str(v)&&email(e)===email(v))))return true
  const existingName=norm(c.short_name||c.name)
  return sourceName.length>=5&&existingName.startsWith(sourceName)
 })
}
function planImport(rows,current,now=new Date().toISOString()){
 const seen=new Set()
 return rows.map((row,i)=>{
  const code=str(row['Código']).toUpperCase(),name=str(row.Nome),id=stableId(code)
  const entry={row:row.__sourceRow||i+2,sourceCode:code,name,id,source:row,issues:issuesFor(row,rows),commonMissing:['Tabelas e preços personalizados','Serviços e transportadoras autorizados','Modelo de pagamento TMS e frequência de faturação','IBAN','Crédito e saldo da plataforma antiga (não exportados)'],status:'A importar'}
  if(!code||!name||seen.has(code)){entry.status='Rever';entry.reason='Código/nome em falta ou código repetido';return entry}seen.add(code)
  if(code==='CFINAL'||norm(name)==='clienteindiferenciado'){entry.status='Não importado';entry.reason='Ficha genérica de consumidor final, sem conta individual';return entry}
  const previous=current.find(c=>c.id===id&&c.legacy_import?.source_code===code)
  if(previous){entry.status='Já importado';entry.existing=[{id:previous.id,name:previous.short_name}];return entry}
  // A failed earlier run can leave only our deterministic registry entry. Resume it.
  const matches=matchExisting(row,current.filter(c=>!(c.id===id&&c.registryOnly)))
  if(matches.length){entry.status='Rever';entry.reason='Possível ficha já existente — não duplicada nem alterada';entry.existing=matches.map(c=>({id:c.id,name:c.short_name||c.name,code:c.code}));return entry}
  const fiscal=[str(row['Morada Faturação']),str(row['Código Postal Faturação']),str(row['Localidade Faturação']),str(row['País Faturação']).toUpperCase()].filter(Boolean).join(', ')
  const notes=[`Importado da plataforma anterior — código ${code}. Preçário e condições TMS por completar.`,
   `Morada de faturação na origem: ${fiscal||'Por preencher'}.`,
   `Condições na origem: método ${str(row['Método de Pagamento'])||'não indicado'}; prazo ${str(row['Forma de Pagamento'])||'não indicado'}; tabela ${str(row['Tabela Preços'])||'não indicada'}.`,
   `Categoria na origem: ${str(row.Categoria)}. Agência: ${str(row.Agência)}.`,
   entry.issues.length?`A rever: ${entry.issues.join('; ')}.`:'',str(row['Observações'])].filter(Boolean).join('\n')
  const registered=str(row.Registo)
  entry.record={id,code,portal_slug:str(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'loja',short_name:name,legal_name:str(row['Designação Social'])||name,nif:str(row.NIF),color:'#246B45',logo_url:'',category:'Cliente Conta Corrente',billing_type:'conta_corrente',
   ...billingFieldsFromLegacyRow(row),
   address:str(row.Morada),postal_code:str(row['Código Postal']),city:str(row.Localidade),country_code:str(row.País).toUpperCase(),email:str(row['E-mail']),billing_email:str(row['Email Faturação']),phone:str(row.Telefone),mobile_phone:str(row['Telemóvel']),manager_name:str(row['Pessoa Contacto']),billing_agency:'A01 - Sede Guimarães',payment_terms:'Por definir',...(paymentDays(row['Forma de Pagamento'])!==undefined?{payment_due_days:paymentDays(row['Forma de Pagamento'])}:{}),iban:'',credit_limit:0,credit_limit_enabled:false,balance:'0,00€',assigned_seller:str(row.Comercial),observations:notes,is_active:true,created_at:/^\d{4}-\d{2}-\d{2}$/.test(registered)?`${registered}T00:00:00.000Z`:now,
   default_linke_table_id:'',assigned_linke_service_ids:[],assigned_linke_profile:'',volume_discount_pct:0,custom_tier_overrides:{},pricing:{table_name:'Por configurar — importação',services_pricing:[],special_services_fees:[]},allowed_webservices:[],legacy_import:{source_file:path.basename(SOURCE),source_code:code,source_row:entry.row,imported_at:now,source:row}}
  return entry
 })
}
function verifyImportedProfile(saved,record) {
  // The RPC adds server-owned metadata such as recurring_since. Verify every
  // supplied field exactly while allowing those additional server fields.
  return !!saved && Object.keys(record).every(key=>isDeepStrictEqual(saved[key],record[key]))
}
async function loadCurrent(db){
 const registry=[],logs=[]
 for(let offset=0;;offset+=1000){const {data,error}=await db.from('clients').select('id,name').eq('tenant_id',TENANT).range(offset,offset+999);if(error)throw error;registry.push(...data);if(data.length<1000)break}
 for(let offset=0;;offset+=1000){const {data,error}=await db.from('audit_log').select('action,details').eq('tenant_id',TENANT).in('action',['client_data','deleted_client']).order('created_at',{ascending:false}).order('id').range(offset,offset+999);if(error)throw error;logs.push(...data);if(data.length<1000)break}
 const map=new Map(registry.map(r=>[r.id,{...r,short_name:r.name,registryOnly:true}]))
 const seen=new Set();for(const log of logs){if(log.action!=='client_data'||!log.details?.id||seen.has(log.details.id))continue;seen.add(log.details.id);map.set(log.details.id,log.details)}
 return [...map.values()]
}
function writeManifest(plan){fs.mkdirSync(OUT,{recursive:true});const file=path.join(OUT,'manifest.json');fs.writeFileSync(`${file}.tmp`,JSON.stringify({source:SOURCE,tenant:TENANT,at:new Date().toISOString(),entries:plan},null,2),{mode:0o600});fs.renameSync(`${file}.tmp`,file)}
async function main(){
 const workbook=XLSX.readFile(SOURCE,{cellDates:true})
 const source=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:'',raw:false}).map(row=>({...row,__sourceRow:row.__rowNum__+1}))
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
 const current=await loadCurrent(db),plan=planImport(source,current)
 fs.mkdirSync(OUT,{recursive:true});fs.copyFileSync(SOURCE,path.join(OUT,path.basename(SOURCE)));writeManifest(plan)
 const todo=plan.filter(e=>e.status==='A importar')
 if(process.argv.includes('--apply')){
  fs.writeFileSync(path.join(OUT,`existing-before-${Date.now()}.json`),JSON.stringify(current,null,2),{mode:0o600})
  async function save(entry){
   try{
    const {data:registered,error:lookupError}=await db.from('clients').select('id,tenant_id').eq('id',entry.id).maybeSingle();if(lookupError)throw lookupError
    if(registered&&registered.tenant_id!==TENANT)throw Error('Identificador pertence a outra empresa')
    if(!registered){const {error}=await db.from('clients').insert({id:entry.id,tenant_id:TENANT,name:entry.record.short_name});if(error)throw error}
    const {error}=await db.rpc('save_client_financial_profile',{p_tenant:TENANT,p_client:entry.id,p_details:entry.record,p_expected_credit:null});if(error)throw error
    entry.status='Importado'
    const done=plan.filter(e=>e.status==='Importado').length
    if(done===1||done%40===0)console.log(`Perfis gravados: ${done}/${todo.length}`)
   }catch(error){entry.status='Erro';entry.reason=error.message}
   writeManifest(plan)
  }
  if(todo.length){await save(todo[0]);if(todo[0].status==='Erro')throw Error(`Importação suspensa no primeiro registo: ${todo[0].reason}`)}
  let cursor=1
  await Promise.all(Array.from({length:4},async()=>{for(;;){const index=cursor++;if(index>=todo.length)return;await save(todo[index])}}))
  const after=await loadCurrent(db),byId=new Map(after.map(c=>[c.id,c]))
  for(const entry of todo){const saved=byId.get(entry.id);if(verifyImportedProfile(saved,entry.record)){entry.status='Importado';delete entry.reason}else if(entry.status==='Importado'){entry.status='Erro';entry.reason='Confirmação por leitura falhou'}}
  // The import must leave all existing profiles untouched, including negotiated prices.
  for(const before of current.filter(c=>!c.registryOnly)){if(!isDeepStrictEqual(byId.get(before.id),before))throw Error(`Ficha existente alterada durante a importação: ${before.id}`)}
  writeManifest(plan)
 }
 const counts={};for(const e of plan)counts[e.status]=(counts[e.status]||0)+1
 const missing={};for(const e of plan)for(const issue of e.issues)missing[issue]=(missing[issue]||0)+1
 if(counts.Erro)process.exitCode=1
 console.log(JSON.stringify({sourceRows:plan.length,counts,missing,manifest:path.join(OUT,'manifest.json'),review:plan.filter(e=>e.status==='Rever').map(e=>({code:e.sourceCode,name:e.name,existing:e.existing}))},null,2))
}
module.exports={planImport,stableId,validPtNif,paymentDays,matchExisting,verifyImportedProfile}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1})
