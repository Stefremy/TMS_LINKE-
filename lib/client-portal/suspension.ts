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

/** Current decisions for the operations list, including clients beyond the first audit page. */
export async function readPortalAccessStatuses(tenantId: string): Promise<Map<string, ClientPortalAccessStatus>> {
  if (!tenantId) throw new Error('Não foi possível verificar o acesso dos clientes.')
  const db = createAdminClient()
  const statuses = new Map<string, ClientPortalAccessStatus>()
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('audit_log').select('details')
      .eq('tenant_id', tenantId).eq('action', 'client_portal_access')
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + 999)
    if (error || !data) throw new Error('Não foi possível verificar o acesso dos clientes. Tente novamente.')
    for (const { details } of data) {
      if (typeof details?.id !== 'string' || statuses.has(details.id)) continue
      statuses.set(details.id, details.blocked === true ? 'blocked' : details.suspended === true ? 'suspended' : 'active')
    }
    if (data.length < 1000) return statuses
  }
}
