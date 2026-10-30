'use server'

import { revalidatePath } from 'next/cache'
import { loadOpsCodWorkflow } from '@/lib/services/reembolsos/ops-cod-workflow'
import { requestClientCodPayout, recordCodRequestPayment, setCodDispute } from '@/lib/services/reembolsos/client-cod-payout'
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

export async function getOpsCodWorkflowAction() {
  const ctx=await requirePermission('Faturação & Contas Correntes')
  return loadOpsCodWorkflow(createAdminClient(),ctx.tenant_id)
}

function validateClientId(clientId:string) {
  if(typeof clientId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) throw new Error('Cliente inválido.')
}
function refreshCodPages() {
  revalidatePath('/ops/tesouraria/reembolsos')
  revalidatePath('/app/[storeSlug]/reembolsos','page')
}
export async function prepareOpsCodPaymentAction(clientId:string) {
  const ctx=await requirePermission('Faturação & Contas Correntes');validateClientId(clientId)
  const result=await requestClientCodPayout(createAdminClient(),ctx,clientId)
  refreshCodPages();return result
}
export async function recordOpsCodPaymentAction(clientId:string,requestId:string,paymentRef:string) {
  const ctx=await requirePermission('Faturação & Contas Correntes');validateClientId(clientId)
  const result=await recordCodRequestPayment(createAdminClient(),ctx,clientId,requestId,paymentRef)
  refreshCodPages();return result
}
export async function setOpsCodDisputeAction(clientId:string,shipmentId:string,reason:string|null) {
  const ctx=await requirePermission('Faturação & Contas Correntes');validateClientId(clientId)
  const result=await setCodDispute(createAdminClient(),ctx,clientId,shipmentId,reason)
  refreshCodPages();return result
}
