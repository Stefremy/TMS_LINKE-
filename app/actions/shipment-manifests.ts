'use server'

import { requireUser } from '@/lib/auth/context'
import { revalidatePath } from 'next/cache'
import { getCttAcceptanceCertificate } from '@/lib/services/ctt/acceptance-certificate'
import type { ManifestResult } from '@/lib/services/ctt/close-manifest'
import { createAdminClient } from '@/lib/supabase/server'
import { loadShipmentParcelSummaries } from '@/lib/services/shipments/shipment-parcel-summaries'
import { stampCertificateObjectList, type CertificateObjectRow } from '@/lib/services/ctt/certificate-object-list'

/** CTT's certificate body is blank: add the object codes of the batch to the copy handed to the user. */
async function withObjectList(result: ManifestResult, tenantId: string, clientId?: string): Promise<ManifestResult> {
  if (!result.success || !result.manifestPdfBase64 || !result.shipmentIds?.length) return result
  try {
    const db = createAdminClient()
    let query = db.from('shipments')
      .select('id, carrier_code, service_type, carrier_tracking_number, tracking_number, recipient_name, recipient_address, recipient_zip4, recipient_zip3')
      .eq('tenant_id', tenantId).in('id', result.shipmentIds)
    if (clientId) query = query.eq('client_id', clientId)
    const { data, error } = await query
    if (error || !data?.length) return result
    const parcels = await loadShipmentParcelSummaries(db, tenantId, data).catch(() => new Map())
    const order = new Map(result.shipmentIds.map((id, index) => [id, index]))
    const rows: CertificateObjectRow[] = [...data].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(row => {
      const objectCode = [row.carrier_tracking_number, row.tracking_number].map(v => String(v || '').trim().toUpperCase()).find(v => /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(v)) || ''
      const guia = typeof row.tracking_number === 'string' && row.tracking_number.startsWith('LTK') ? row.tracking_number : null
      const postal = row.recipient_zip4 ? `${row.recipient_zip4}${row.recipient_zip3 ? `-${row.recipient_zip3}` : ''}` : ''
      const parcel = parcels.get(row.id)
      return { objectCode, guia, recipient: row.recipient_name, destination: [postal, row.recipient_address].filter(Boolean).join(' '), volumes: parcel?.volumeCount, weightKg: parcel?.declaredWeightKg }
    })
    // CTT returns the original and the duplicate as identical files: stamp each distinct file once.
    const cache = new Map<string, Promise<string>>()
    const stamp = (file: string) => { if (!cache.has(file)) cache.set(file, stampCertificateObjectList(file, rows)); return cache.get(file)! }
    const documents = result.documents ? await Promise.all(result.documents.map(async doc => ({ ...doc, File: await stamp(doc.File) }))) : undefined
    return { ...result, manifestPdfBase64: await stamp(result.manifestPdfBase64), documents }
  } catch {
    return result
  }
}

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
    return await withObjectList(result, ctx.tenant_id, ctx.role === 'client' ? ctx.client_id! : undefined)
  } catch {
    return { success: false, count: 0, error: 'Não foi possível obter o certificado de aceitação CTT. Confirme o resultado com a equipa Ops antes de repetir.' }
  }
}

/** Reprint an existing certificate only; this action can never close a CTT batch. */
export async function downloadCttAcceptanceCertificateAction(shipmentId: string): Promise<ManifestResult> {
  const ctx = await requireUser('Emissão e Controlo de Guias CTT')
  if (!ctx.tenant_id || (ctx.role === 'client' && !ctx.client_id)) return { success: false, count: 0, error: 'Não foi possível identificar a conta desta sessão.' }
  try {
    const clientId = ctx.role === 'client' ? ctx.client_id! : undefined
    return await withObjectList(await getCttAcceptanceCertificate(ctx.tenant_id, [shipmentId], clientId, { allowClose: false, expandBatch: true }), ctx.tenant_id, clientId)
  } catch {
    return { success: false, count: 0, error: 'Não foi possível carregar o certificado guardado.' }
  }
}

const correosListErrors: Record<string, string> = {
  "1": "Algum envio não pertence a esta conta Correos Express.",
  "-1": "A Correos já recebeu pelo menos um volume. A lista só pode ser gerada antes da recolha.",
}

/** Correos Express equivalent of the CTT acceptance certificate: the "Lista de Envíos" PDF for the driver. Closes nothing. */
export async function generateCorreosShipmentListAction(shipmentIds: string[]): Promise<ManifestResult> {
  const ctx = await requireUser('Emissão e Controlo de Guias CTT')
  const fail = (error: string): ManifestResult => ({ success: false, count: 0, error })
  if (!ctx.tenant_id || (ctx.role === 'client' && !ctx.client_id)) return fail('Não foi possível identificar a conta desta sessão.')
  const ids = [...new Set(Array.isArray(shipmentIds) ? shipmentIds : [])]
  if (!ids.length || ids.length > 100 || ids.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return fail('Selecione entre 1 e 100 envios Correos Express.')
  try {
    let query = createAdminClient().from('shipments').select('id, carrier_code, service_type, carrier_tracking_number, created_at').eq('tenant_id', ctx.tenant_id).in('id', ids)
    if (ctx.role === 'client') query = query.eq('client_id', ctx.client_id!)
    const { data, error } = await query
    if (error || !data || data.length !== ids.length) return fail('Não foi possível encontrar todos os envios selecionados.')
    const isCorreos = (row: { carrier_code?: string | null; service_type?: string | null }) => row.carrier_code === 'correos' || row.carrier_code === 'correos_express' || !!row.service_type?.toLowerCase().includes('correos')
    if (!data.every(isCorreos)) return fail('A lista de envios só está disponível para envios Correos Express.')
    const numbers = data.map(row => row.carrier_tracking_number).filter((value): value is string => !!value)
    if (numbers.length !== data.length) return fail('Há envios sem número Correos Express. Contacte a equipa Linke.')
    const day = (value: string) => new Date(value).toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' })
    if (new Set(data.map(row => day(row.created_at))).size > 1) return fail('Selecione envios Correos Express do mesmo dia.')
    const { resolveCorreosCredentials } = await import('@/lib/services/carriers/credentials')
    const { CorreosReportService } = await import('@/lib/services/correos/correos-report.service')
    const report = await new CorreosReportService().generateShipmentList(await resolveCorreosCredentials(), { date: new Date(data[0].created_at), shipmentNumbers: numbers })
    const code = String(report.codErr)
    if (code !== '0' || !report.result) {
      return fail(correosListErrors[code] || `Correos Express não devolveu a lista de envios${report.desErr ? `: ${report.desErr}` : '.'}`)
    }
    return { success: true, count: numbers.length, shipmentIds: ids, manifestPdfBase64: report.result }
  } catch {
    return fail('Não foi possível obter a lista de envios da Correos Express. Tente novamente.')
  }
}
