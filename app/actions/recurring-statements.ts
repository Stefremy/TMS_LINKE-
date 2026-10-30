'use server'

import { requirePermission, requireAdmin } from '@/lib/auth/context'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isDateKey, lisbonDate } from '@/lib/billing/recurring-periods'
import { recurringPreview, loadPeriodStatements, sendRecurringStatementTest } from '@/lib/billing/recurring-statements'
import { SHIPMENT_LIST_COLUMNS } from '@/lib/services/shipments/shipment-fetcher'

const permission = 'Faturação & Contas Correntes'

export async function previewRecurringStatementsAction(asOf?: string) {
  const ctx = await requirePermission(permission)
  if (asOf && !isDateKey(asOf)) throw new Error('Data de simulação inválida.')
  return recurringPreview(ctx.tenant_id, asOf || lisbonDate())
}

export async function getPeriodStatementsAction() {
  const ctx = await requirePermission(permission)
  return loadPeriodStatements(ctx.tenant_id)
}

export async function getPeriodShipmentsForBillingAction(id: string) {
  const ctx = await requirePermission(permission)
  const db = createAdminClient()
  const { data: record, error } = await db.from('audit_log').select('details').eq('tenant_id', ctx.tenant_id)
    .eq('action', 'period_statement').eq('id', id).single()
  if (error || !record?.details) throw new Error('Extrato não encontrado.')
  const statement = record.details
  const { data: shipments, error: shipmentError } = await db.from('shipments').select(SHIPMENT_LIST_COLUMNS)
    .eq('tenant_id', ctx.tenant_id).eq('client_id', statement.client_id).in('id', statement.shipment_ids)
  const { data: invoices, error: invoiceError } = await db.from('audit_log').select('details')
    .eq('tenant_id', ctx.tenant_id).eq('action', 'billing_statement').eq('details->>client_id', statement.client_id)
  if (shipmentError || invoiceError) throw new Error('Não foi possível validar a faturação deste período.')
  const billed = new Set<string>()
  for (const { details } of invoices || []) {
    if ((details.moloni_document_id || details.moloni_document_pdf) && !details.is_pro_forma) {
      (details.shipment_ids || []).forEach((shipmentId: string) => billed.add(shipmentId))
    }
  }
  const rows = (shipments || []) as (Record<string, unknown> & { id: string; status: string })[]
  return rows.filter(s => !billed.has(s.id) && !['anulado', 'cancelado', 'rascunho'].includes(s.status))
    .map(s => { const copy = { ...s }; delete copy.ctt_label_base64; delete copy.carrier_label_base64; return copy })
}

export async function configureRecurringStatementsAction(enabled: boolean, anchor: string) {
  const ctx = await requireAdmin()
  if (typeof enabled !== 'boolean' || !isDateKey(anchor)) return { success: false, error: 'Configuração inválida.' }
  if (enabled) {
    const preview = await recurringPreview(ctx.tenant_id)
    if (!preview.ready) return { success: false, error: preview.error }
    if (!preview.emailConfigured || !preview.cronConfigured) {
      return { success: false, error: 'Configure o serviço de email e o segredo do agendamento antes de ativar.' }
    }
  }
  const db = createAdminClient()
  const { error } = await db.rpc('configure_recurring_statements', { p_tenant: ctx.tenant_id, p_enabled: enabled, p_anchor: anchor })
  if (error) return { success: false, error: 'Não foi possível guardar. A data inicial fica fixa após a primeira ativação.' }
  revalidatePath('/ops/faturacao/contas-corrente')
  revalidatePath('/ops/configuracao/faturacao')
  return { success: true }
}

export async function sendRecurringTestEmailAction(recipient: string) {
  const ctx = await requireAdmin()
  try { return await sendRecurringStatementTest(ctx.tenant_id, recipient) }
  catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Falha no email de teste.' } }
}
