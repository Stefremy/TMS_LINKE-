import 'server-only'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'

/** Always read the current decision; never cache authorization across requests. */
export async function readPortalSuspension(tenantId: string, clientId: string): Promise<boolean> {
  if (!tenantId || !clientId) throw new Error('Não foi possível verificar o acesso do cliente.')
  const { data, error } = await createAdminClient().from('audit_log').select('details')
    .eq('tenant_id', tenantId).eq('action', 'client_portal_access').eq('details->>id', clientId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error('Não foi possível verificar o acesso do cliente. Tente novamente.')
  return data?.details?.blocked === true
}

export async function enforcePortalSuspension(tenantId: string, clientId: string) {
  if (await readPortalSuspension(tenantId, clientId)) redirect('/conta-suspensa')
}
