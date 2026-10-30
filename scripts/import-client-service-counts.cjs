/* eslint-disable @typescript-eslint/no-require-imports -- Standalone import. */
const fs = require('node:fs')
const crypto = require('node:crypto')
const { createClient } = require('@supabase/supabase-js')
const { parseLegacyServiceCounts, normalizeLegacyClientName } = require('../lib/clients/service-history.ts')
const folder = 'docs/imports/client-services-2026-10-30'
const source = 'public/patches/lojas_servicos.csv'
const manifest = JSON.parse(fs.readFileSync('docs/imports/clientes-2026-10-29/manifest.json'))
const tenant = manifest.tenant
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}})
async function readAll(table, action) {
  const rows=[]
  for (let offset=0;;offset+=1000) {
    let q=db.from(table).select('*').eq('tenant_id',tenant).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999)
    if(action) q=q.eq('action',action)
    const {data,error}=await q
    if(error) throw error
    rows.push(...data)
    if(data.length<1000)return rows
  }
}
async function main() {
  fs.mkdirSync(folder,{recursive:true})
  const raw=fs.readFileSync(source,'utf8'),rows=parseLegacyServiceCounts(raw)
  const sourceHash=crypto.createHash('sha256').update(raw).digest('hex')
  const [clients,previous]=await Promise.all([readAll('clients'),readAll('audit_log','client_legacy_service_count')])
  const registry=new Set(clients.map(c=>c.id)),latest=new Map()
  for(const r of previous)if(!latest.has(r.details.id))latest.set(r.details.id,r)
  const confirmedFile=`${folder}/confirmed-duplicates.json`
  const confirmed=fs.existsSync(confirmedFile)?JSON.parse(fs.readFileSync(confirmedFile)):{}
  const groups=new Map(),unresolved=[]
  for(const row of rows){
    const key=normalizeLegacyClientName(row.name)
    const candidates=manifest.entries.filter(e=>normalizeLegacyClientName(e.name)===key||normalizeLegacyClientName(e.source['Designação Social']||'')===key)
    let entry=candidates.length===1?candidates[0]:candidates.find(e=>e.sourceCode===confirmed[String(row.row)])
    if(!entry||entry.status==='Não importado') {unresolved.push({...row,reason:candidates.length>1?'Nome duplicado — confirmar ficha':'Ficha genérica não importada',candidates:candidates.map(e=>e.sourceCode)});continue}
    let id=entry.id
    if(entry.status==='Rever'){
      if(entry.existing?.length!==1)throw Error(`Correspondência ambígua: ${row.name}`)
      id=entry.existing[0].id
    }
    if(!registry.has(id))throw Error(`Ficha não encontrada nesta empresa: ${row.name}`)
    const group=groups.get(id)||{id,rows:[]}
    group.rows.push({...row,source_code:entry.sourceCode})
    groups.set(id,group)
  }
  const importedAt=new Date().toISOString()
  const plan=[...groups.values()].map(group=>({...group,count:group.rows.reduce((sum,r)=>sum+r.count,0),imported_at:importedAt,source:'lojas_servicos.csv',source_hash:sourceHash}))
  const matchedTotal=plan.reduce((s,p)=>s+p.count,0),unmatchedTotal=unresolved.reduce((s,p)=>s+p.count,0),sourceTotal=rows.reduce((s,r)=>s+r.count,0)
  if(matchedTotal+unmatchedTotal!==sourceTotal)throw Error('Totais não reconciliados')
  const writes=plan.filter(p=>{const old=latest.get(p.id)?.details;return !old||old.source_hash!==p.source_hash||old.count!==p.count||JSON.stringify(old.rows)!==JSON.stringify(p.rows)})
  const report={at:importedAt,sourceHash,sourceRows:rows.length,sourceTotal,matchedRows:plan.reduce((s,p)=>s+p.rows.length,0),matchedClients:plan.length,matchedTotal,unresolved,unmatchedTotal,writes:writes.length,applied:false}
  fs.writeFileSync(`${folder}/plan.json`,JSON.stringify({report,plan},null,2),{mode:0o600})
  if(process.argv.includes('--apply')){
    fs.writeFileSync(`${folder}/backup-${Date.now()}.json`,JSON.stringify(previous,null,2),{mode:0o600})
    if(writes.length){const {error}=await db.from('audit_log').insert(writes.map(p=>({tenant_id:tenant,action:'client_legacy_service_count',details:{...p,changed_by:'bulk_user_request'}})));if(error)throw error}
    const after=new Map()
    for(const r of await readAll('audit_log','client_legacy_service_count'))if(!after.has(r.details.id))after.set(r.details.id,r.details)
    for(const p of plan){const actual=after.get(p.id);if(actual?.count!==p.count||actual?.source_hash!==sourceHash||JSON.stringify(actual.rows)!==JSON.stringify(p.rows))throw Error(`Contagem não confirmada: ${p.id}`)}
    report.applied=true;report.verified=true
    fs.writeFileSync(`${folder}/result.json`,JSON.stringify(report,null,2),{mode:0o600})
  }
  console.log(JSON.stringify(report,null,2))
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
