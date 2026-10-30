'use server'

import { requireEmployee } from '@/lib/auth/context'
import { createAdminClient } from '@/lib/supabase/server'
import { readLegacyServiceHistory } from '@/lib/clients/service-history'

async function scopedClient(clientId: string) {
  const ctx = await requireEmployee()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) throw new Error('Cliente inválido.')
  const db = createAdminClient()
  const { data: client, error: clientError } = await db.from('clients').select('id')
    .eq('tenant_id', ctx.tenant_id).eq('id', clientId).maybeSingle()
  if (clientError || !client) throw new Error('Cliente não encontrado nesta empresa.')
  return {db,tenant:ctx.tenant_id}
}

async function readHistory(db:ReturnType<typeof createAdminClient>,tenant:string,clientId:string) {
  const { data, error } = await db.from('audit_log').select('details')
    .eq('tenant_id', tenant).eq('action', 'client_legacy_service_count').eq('details->>id', clientId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error('Não foi possível consultar o histórico de serviços.')
  if (!data) return null
  const history = readLegacyServiceHistory(data.details)
  if (!history) throw new Error('O histórico de serviços está incompleto. Verifique a importação.')
  return history
}

export async function getClientServiceHistoryAction(clientId:string) {
  const {db,tenant}=await scopedClient(clientId)
  return readHistory(db,tenant,clientId)
}

export async function getClientTotalServicesAction(clientId:string) {
  const {db,tenant}=await scopedClient(clientId)
  const [history,shipments]=await Promise.all([
    readHistory(db,tenant,clientId),
    db.from('shipments').select('id',{count:'exact',head:true}).eq('tenant_id',tenant).eq('client_id',clientId),
  ])
  const count=shipments.count
  if(shipments.error||typeof count!=='number'||!Number.isSafeInteger(count)||count<0) throw new Error('Não foi possível consultar o total de serviços.')
  const total=(history?.count||0)+count
  if(!Number.isSafeInteger(total)) throw new Error('O total de serviços é inválido.')
  return {total}
}
