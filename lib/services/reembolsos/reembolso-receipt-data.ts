import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadClientCodOverview } from './client-cod-data'
import { readCodPayoutBox } from './client-cod-payout'
import { clientCodReceivable } from './client-cod'
import { loadScopedClientProfiles } from '@/lib/services/clients/scoped-client-profiles'
import type { CodReceiptData } from './reembolso-receipt-pdf'

/** Read-only; request ownership and every shipment are resolved server-side, never from browser amounts. */
export async function loadCodReceiptData(db:SupabaseClient,tenant:string,clientId:string,requestId:string):Promise<CodReceiptData> {
  const overview=await loadClientCodOverview(db,tenant,clientId),box=await readCodPayoutBox(db,tenant,clientId)
  const request=box?.requests.find(item=>item.id===requestId)
  if(!request) throw new Error('Pedido de reembolso não encontrado nesta conta.')
  const rows=new Map(overview.rows.map(row=>[row.id,row]))
  if(request.shipmentIds.some(id=>!rows.has(id))) throw new Error('Não foi possível confirmar as guias deste pedido nesta conta.')
  const items=request.items||request.shipmentIds.map(id=>{
    const row=rows.get(id)!
    if(row.requestedCents===null) throw new Error('O valor original da cobrança não está disponível.')
    return {shipmentId:id,tracking:row.tracking,amountCents:row.requestedCents,date:row.date}
  })
  if(items.reduce((sum,item)=>sum+item.amountCents,0)!==request.amountCents) throw new Error('O detalhe das cobranças não coincide com o total do pedido.')
  const profile=(await loadScopedClientProfiles(db,tenant,[clientId])).get(clientId)
  if(!profile) throw new Error('Cliente não encontrado nesta empresa.')
  const {data,error}=await db.from('audit_log').select('id,details').eq('tenant_id',tenant).eq('action','client_data').eq('details->>id',clientId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(1).maybeSingle()
  if(error) throw new Error('Não foi possível carregar os dados do cliente.')
  const details=(data?.details||{}) as Record<string,unknown>
  const text=(key:string,limit=256)=>typeof details[key]==='string'?(details[key] as string).trim().slice(0,limit):''
  const history=clientCodReceivable(overview,box).history.find(item=>item.id===requestId)!
  return {requestId:request.id,requestedAt:request.createdAt,generatedAt:new Date().toISOString(),state:history.state,paidAt:request.paidAt||undefined,paymentRef:request.paymentRef||undefined,
    client:{name:profile.legal_name||profile.short_name||profile.name||'Cliente',code:text('code'),nif:text('nif'),address:text('billing_address')||text('address'),city:[text('billing_postal_code')||text('postal_code'),text('billing_city')||text('city')].filter(Boolean).join(' '),email:profile.billing_email||profile.email},amountCents:request.amountCents,items}
}
