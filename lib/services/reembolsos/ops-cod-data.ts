import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface OpsCodClient { id:string; name:string; code:string }
/** Only registered customers of this company, never seeded/demo records or name-based matches. */
export async function loadOpsCodClients(db:SupabaseClient,tenant:string):Promise<OpsCodClient[]> {
  const clients=new Map<string,OpsCodClient>()
  for(let offset=0;;offset+=1000) {
    const {data,error}=await db.from('clients').select('id,name').eq('tenant_id',tenant).order('id').range(offset,offset+999)
    if(error || !data) throw new Error('Não foi possível carregar os clientes.')
    for(const row of data) clients.set(row.id,{id:row.id,name:row.name || 'Cliente',code:''})
    if(data.length<1000) break
  }
  const seen=new Set<string>(),deleted=new Set<string>()
  for(let offset=0;;offset+=1000) {
    const {data,error}=await db.from('audit_log').select('id,action,clientId:details->>id,shortName:details->>short_name,legalName:details->>legal_name,code:details->>code')
      .eq('tenant_id',tenant).in('action',['client_data','deleted_client']).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999)
    if(error || !data) throw new Error('Não foi possível confirmar as fichas dos clientes.')
    for(const row of data) {
      if(typeof row.clientId!=='string') continue
      if(row.action==='deleted_client') {deleted.add(row.clientId);continue}
      if(seen.has(row.clientId) || !clients.has(row.clientId)) continue
      seen.add(row.clientId)
      const old=clients.get(row.clientId)!
      clients.set(old.id,{id:old.id,name:row.shortName || row.legalName || old.name,code:row.code || ''})
    }
    if(data.length<1000) break
  }
  return [...clients.values()].filter(c=>!deleted.has(c.id)).sort((a,b)=>a.name.localeCompare(b.name,'pt') || a.id.localeCompare(b.id))
}
