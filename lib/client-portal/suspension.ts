import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'

export type ClientPortalAccessStatus = 'active' | 'suspended' | 'blocked'

export interface PortalAccessDecision {
  status: ClientPortalAccessStatus
  blocked: boolean
  suspended: boolean
}

/** Always read the current decision; never cache authorization across requests. */
export async function readPortalAccess(tenantId: string, clientId: string): Promise<PortalAccessDecision> {
  if (!tenantId || !clientId) throw new Error('Não foi possível verificar o acesso do cliente.')
  const { data, error } = await createAdminClient().from('audit_log').select('details')
    .eq('tenant_id', tenantId).eq('action', 'client_portal_access').eq('details->>id', clientId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error('Não foi possível verificar o acesso do cliente. Tente novamente.')

  const details = data?.details
  const blocked = details?.blocked === true
  const suspended = !blocked && details?.suspended === true
  const status: ClientPortalAccessStatus = blocked ? 'blocked' : (suspended ? 'suspended' : 'active')

  return { status, blocked, suspended }
}

/** Always read the current decision; never cache authorization across requests. */
export async function readPortalSuspension(tenantId: string, clientId: string): Promise<boolean> {
  const access = await readPortalAccess(tenantId, clientId)
  return access.blocked
}

export async function enforcePortalSuspension(tenantId: string, clientId: string) {
  if (await readPortalSuspension(tenantId, clientId)) {
    const { redirect } = await import('next/navigation')
    redirect('/conta-suspensa')
  }
}
