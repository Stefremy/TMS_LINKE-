import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthContext } from '@/lib/auth/context'
import { clientCodReceivable, type ClientCodOverview, type CodPayoutBox } from './client-cod'
import { loadClientCodOverview } from './client-cod-data'

export const payoutBoxId = (tenant: string, client: string) => {
  const hash = createHash('sha256').update(`client-cod-payout:${tenant}:${client}`).digest('hex').slice(0,32)
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20)}`
}
export async function readCodPayoutBox(db: SupabaseClient, tenant: string, client: string): Promise<CodPayoutBox | null> {
  const {data,error} = await db.from('audit_log').select('details').eq('tenant_id',tenant).eq('action','client_cod_payout_requests').eq('id',payoutBoxId(tenant,client)).maybeSingle()
  if(error) throw new Error('Não foi possível consultar os pedidos de reembolso.')
  if(!data) return null
  const box = data.details as unknown as CodPayoutBox
  if(box.clientId !== client || typeof box.revision !== 'string' || !Array.isArray(box.requests) || box.requests.some(r => !r.id || typeof r.createdAt !== 'string' || !Number.isFinite(Date.parse(r.createdAt)) || !Array.isArray(r.shipmentIds) || !r.shipmentIds.length || !Number.isSafeInteger(r.amountCents) || r.amountCents <= 0)) throw new Error('Pedido de reembolso inválido. Contacte a Linke.')
  return box
}
export type ClientCodPageData = ClientCodOverview & { payout: ReturnType<typeof clientCodReceivable> }
export async function loadClientCodPage(db: SupabaseClient, tenant: string, client: string): Promise<ClientCodPageData> {
  const overview = await loadClientCodOverview(db,tenant,client)
  const box = await readCodPayoutBox(db,tenant,client)
  return { ...overview, payout: clientCodReceivable(overview,box) }
}
/** One compare-and-swap mailbox per company/client serializes requests; this never performs a bank transfer. */
export async function requestClientCodPayout(db: SupabaseClient, ctx: AuthContext, client: string) {
  if (ctx.role === 'client' ? ctx.client_id !== client : ctx.role !== 'admin' && !(ctx.role === 'employee' && ctx.permissions.some(p => ['Faturação & Contas Correntes','Acesso Total (Super-Admin)'].includes(p)))) throw new Error('Acesso negado ao pedido desta conta.')
  const overview = await loadClientCodOverview(db,ctx.tenant_id,client)
  const old = await readCodPayoutBox(db,ctx.tenant_id,client)
  const current = clientCodReceivable(overview,old)
  if(current.pending) return { success:true as const, alreadyRequested:true, requestId:current.history.find(r=>r.state!=='paid')!.id }
  if(current.availableCents <= 0) throw new Error('Ainda não existem valores CTT conciliados disponíveis para solicitar.')
  const request = { id:randomUUID(),createdAt:new Date().toISOString(),amountCents:current.availableCents,shipmentIds:current.eligible.map(row=>row.id).sort(),requestedBy:ctx.user.id }
  const next: CodPayoutBox = { clientId:client,revision:randomUUID(),requests:[...(old?.requests || []),request] }
  const id = payoutBoxId(ctx.tenant_id,client)
  if(old) {
    const {data,error} = await db.from('audit_log').update({details:next}).eq('tenant_id',ctx.tenant_id).eq('action','client_cod_payout_requests').eq('id',id).eq('details->>revision',old.revision).select('id').maybeSingle()
    if(error || !data) throw new Error('O pedido mudou durante a operação. Atualize os dados antes de tentar novamente.')
  } else {
    const {error} = await db.from('audit_log').insert({id,tenant_id:ctx.tenant_id,action:'client_cod_payout_requests',details:next})
    if(error) {
      if(error.code==='23505') {
        const saved = await readCodPayoutBox(db,ctx.tenant_id,client)
        if(saved?.requests.length) return {success:true as const,alreadyRequested:true,requestId:saved.requests.at(-1)!.id}
      }
      throw new Error('Não foi possível confirmar o pedido. Atualize os dados antes de repetir.')
    }
  }
  return {success:true as const,alreadyRequested:false,requestId:request.id}
}

export interface CodPayoutInboxRow {
  id:string; clientId:string; clientName:string; createdAt:string; amountCents:number; tracking:string[]; state:'requested'|'paid'|'review'
}
export async function loadCodPayoutInbox(db:SupabaseClient,tenant:string):Promise<CodPayoutInboxRow[]> {
  const boxes:{id:string;details:unknown}[]=[]
  for(let offset=0;;offset+=1000) {
    const {data,error}=await db.from('audit_log').select('id,details').eq('tenant_id',tenant).eq('action','client_cod_payout_requests').order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999)
    if(error || !data) throw new Error('Não foi possível carregar os pedidos de reembolso.')
    boxes.push(...data)
    if(data.length<1000) break
  }
  const result:CodPayoutInboxRow[]=[]
  for(const row of boxes) {
    const candidate=row.details as CodPayoutBox
    if(!candidate?.clientId || row.id!==payoutBoxId(tenant,candidate.clientId)) throw new Error('Pedido de reembolso com associação inválida.')
    const {data:client,error}=await db.from('clients').select('name').eq('tenant_id',tenant).eq('id',candidate.clientId).maybeSingle()
    if(error || !client) throw new Error('Não foi possível confirmar a conta do pedido.')
    const overview=await loadClientCodOverview(db,tenant,candidate.clientId)
    const box=await readCodPayoutBox(db,tenant,candidate.clientId)
    for(const request of clientCodReceivable(overview,box).history) result.push({id:request.id,clientId:candidate.clientId,clientName:client.name || 'Cliente',createdAt:request.createdAt,amountCents:request.amountCents,state:request.state,tracking:request.shipmentIds.map(id=>overview.rows.find(r=>r.id===id)?.tracking || id)})
  }
  return result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
}
