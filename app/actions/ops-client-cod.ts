'use server'

import { requirePermission } from '@/lib/auth/context'
import { createAdminClient } from '@/lib/supabase/server'
import { isDateKey } from '@/lib/billing/recurring-periods'
import { loadOpsCodClients } from '@/lib/services/reembolsos/ops-cod-data'
import { loadClientCodOverview } from '@/lib/services/reembolsos/client-cod-data'
import { filterClientCodRows } from '@/lib/services/reembolsos/client-cod'

export async function getOpsCodClientsAction() {
  const ctx=await requirePermission('Faturação & Contas Correntes')
  return loadOpsCodClients(createAdminClient(),ctx.tenant_id)
}
export async function getOpsClientCodCollectionsAction(clientId:string,from:string,to:string) {
  const ctx=await requirePermission('Faturação & Contas Correntes')
  if(typeof clientId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) throw new Error('Selecione um cliente válido.')
  if(typeof from!=='string'||typeof to!=='string'||!isDateKey(from)||!isDateKey(to)||from>to) throw new Error('Escolha um intervalo de datas válido.')
  const overview=await loadClientCodOverview(createAdminClient(),ctx.tenant_id,clientId)
  return {...overview,from,to,rows:filterClientCodRows(overview.rows,{state:'all',search:'',from,to})}
}
