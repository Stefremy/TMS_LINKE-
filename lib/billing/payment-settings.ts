import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_BILLING_CONFIG } from '@/app/actions/billing-config-types'
import { paymentDueDays } from './payment-terms'

export async function defaultClientPaymentDays(db: SupabaseClient, tenantId: string) {
  const { data, error } = await db.from('audit_log').select('details').eq('tenant_id', tenantId)
    .eq('action', 'moloni_billing_settings').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error('Não foi possível carregar o prazo de pagamento da empresa.')
  return paymentDueDays(data?.details?.defaultPaymentDays, DEFAULT_BILLING_CONFIG.defaultPaymentDays)
}
