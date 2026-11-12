'use server'

import { requireUser } from '@/lib/auth/context'
import { revalidatePath } from 'next/cache'
import { getCttAcceptanceCertificate } from '@/lib/services/ctt/acceptance-certificate'
import type { ManifestResult } from '@/lib/services/ctt/close-manifest'
import { createAdminClient } from '@/lib/supabase/server'

export async function generateCttAcceptanceCertificateAction(shipmentIds: string[]): Promise<ManifestResult> {
  const ctx = await requireUser('Emissão e Controlo de Guias CTT')
  if (!ctx.tenant_id || (ctx.role === 'client' && !ctx.client_id)) return { success: false, count: 0, error: 'Não foi possível identificar a conta desta sessão.' }
  try {
    const result = await getCttAcceptanceCertificate(ctx.tenant_id, shipmentIds, ctx.role === 'client' ? ctx.client_id! : undefined)
    if (result.success) {
      if (result.reused && result.shipmentIds?.length) {
        try {
          let update = createAdminClient().from('shipments').update({ ops_substatus: 'manifesto_fechado' })
            .eq('tenant_id', ctx.tenant_id).in('id', result.shipmentIds).eq('status', 'pendente').is('ops_substatus', null)
          if (ctx.role === 'client') update = update.eq('client_id', ctx.client_id!)
          const { error } = await update
          if (error) throw error
        } catch {
          result.warning = [result.warning, 'O certificado está disponível, mas não foi possível guardar a indicação de fecho. Avise a equipa Ops antes de repetir o fecho.'].filter(Boolean).join(' ')
        }
      }
      try {
        revalidatePath('/ops/envios')
        revalidatePath('/app/[storeSlug]/envios', 'page')
      } catch { /* A confirmed carrier result must survive cache refresh failures. */ }
    }
    return result
  } catch {
    return { success: false, count: 0, error: 'Não foi possível obter o certificado de aceitação CTT. Confirme o resultado com a equipa Ops antes de repetir.' }
  }
}

/** Reprint an existing certificate only; this action can never close a CTT batch. */
export async function downloadCttAcceptanceCertificateAction(shipmentId: string): Promise<ManifestResult> {
  const ctx = await requireUser('Emissão e Controlo de Guias CTT')
  if (!ctx.tenant_id || (ctx.role === 'client' && !ctx.client_id)) return { success: false, count: 0, error: 'Não foi possível identificar a conta desta sessão.' }
  try {
    return await getCttAcceptanceCertificate(ctx.tenant_id, [shipmentId], ctx.role === 'client' ? ctx.client_id! : undefined, { allowClose: false, expandBatch: true })
  } catch {
    return { success: false, count: 0, error: 'Não foi possível carregar o certificado guardado.' }
  }
}
