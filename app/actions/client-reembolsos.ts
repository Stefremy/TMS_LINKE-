'use server'

import { requireClientAccess } from '@/lib/auth/context'
import { createAdminClient } from '@/lib/supabase/server'
import { loadClientCodPage, requestClientCodPayout } from '@/lib/services/reembolsos/client-cod-payout'
import { revalidatePath } from 'next/cache'

export async function getClientReembolsosAction(clientId: string) {
  const ctx = await requireClientAccess(clientId)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) throw new Error('Cliente inválido.')
  return loadClientCodPage(createAdminClient(), ctx.tenant_id, clientId)
}

export async function solicitarReembolsoAction(clientId: string) {
  const ctx = await requireClientAccess(clientId)
  if (!/^[0-9a-f-]{36}$/i.test(clientId)) throw new Error('Cliente inválido.')
  const result = await requestClientCodPayout(createAdminClient(),ctx,clientId)
  revalidatePath('/ops/tesouraria/reembolsos')
  revalidatePath('/app/[storeSlug]/reembolsos','page')
  return result
}
