'use server'

import { requireEmployee } from '@/lib/auth/context'
import { createAdminClient } from '@/lib/supabase/server'
import { readLegacyServiceHistory } from '@/lib/clients/service-history'

export async function getClientServiceHistoryAction(clientId: string) {
  const ctx = await requireEmployee()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) throw new Error('Cliente inválido.')
  const db = createAdminClient()
  const { data: client, error: clientError } = await db.from('clients').select('id')
    .eq('tenant_id', ctx.tenant_id).eq('id', clientId).maybeSingle()
  if (clientError || !client) throw new Error('Cliente não encontrado nesta empresa.')
  const { data, error } = await db.from('audit_log').select('details')
    .eq('tenant_id', ctx.tenant_id).eq('action', 'client_legacy_service_count').eq('details->>id', clientId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error('Não foi possível consultar o histórico de serviços.')
  if (!data) return null
  const history = readLegacyServiceHistory(data.details)
  if (!history) throw new Error('O histórico de serviços está incompleto. Verifique a importação.')
  return history
}
