import 'server-only'
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export function financialId(kind: string, tenant: string, company: string, invoice: number) {
  const h = createHash('sha256').update(`${kind}:${tenant}:${company}:${invoice}`).digest('hex').slice(0, 32)
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
}
export async function claimInvoiceFinancialLock(db: SupabaseClient, tenant: string, company: string, invoice: number, operation: string) {
  const { error } = await db.from('audit_log').insert({ id: financialId('invoice-finance', tenant, company, invoice),
    tenant_id: tenant, action: 'invoice_financial_lock', details: { operation_id: operation, invoice_document_id: invoice } })
  if (error) throw new Error('Esta fatura tem uma operação financeira em curso ou por confirmar. Não repita a emissão.')
}
export async function releaseInvoiceFinancialLock(db: SupabaseClient, tenant: string, company: string, invoice: number, operation: string) {
  const { error } = await db.from('audit_log').delete().eq('tenant_id', tenant).eq('action', 'invoice_financial_lock')
    .eq('id', financialId('invoice-finance', tenant, company, invoice)).eq('details->>operation_id', operation)
  if (error) throw new Error('Documento confirmado; libertação da operação pendente.')
}
