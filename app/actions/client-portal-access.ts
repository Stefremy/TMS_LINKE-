'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/context'
import { createAdminClient } from '@/lib/supabase/server'
import { readPortalSuspension } from '@/lib/client-portal/suspension'

async function requireManagedClient(id: string) {
  const ctx = await requireAdmin()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Cliente inválido.')
  const db = createAdminClient()
  const { data, error } = await db.from('clients').select('id').eq('tenant_id', ctx.tenant_id).eq('id', id).maybeSingle()
  if (error || !data) throw new Error('Cliente não encontrado nesta empresa.')
  return { ctx, db }
}

export async function getClientPortalAccessAction(id: string) {
  const { ctx } = await requireManagedClient(id)
  return { blocked: await readPortalSuspension(ctx.tenant_id, id) }
}

export async function setClientPortalBlockedAction(id: string, blocked: boolean) {
  const { ctx, db } = await requireManagedClient(id)
  if (typeof blocked !== 'boolean') throw new Error('Estado de acesso inválido.')
  const { error } = await db.from('audit_log').insert({
    tenant_id: ctx.tenant_id, action: 'client_portal_access',
    details: { id, blocked, changed_by: ctx.user.id },
  })
  if (error) throw new Error('Não foi possível alterar o acesso do cliente. Tente novamente.')
  revalidatePath('/ops/entidades/clientes')
  revalidatePath('/app', 'layout')
  return { blocked }
}
