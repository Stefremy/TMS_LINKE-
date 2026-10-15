import { createAdminClient } from '@/lib/supabase/server'
import { resolveCttCredentials } from '@/lib/services/carriers/credentials'
import { CTTShipmentService } from './ctt-shipment.service'

interface ManifestResult {
  success: boolean
  error?: string
  count: number
  deliveryNoteId?: string
  manifestPdfBase64?: string
  warning?: string
}

interface ManifestShipment {
  id: string
  status: string
  carrier_code?: string
  carrier_tracking_number?: string
  ctt_object_id?: string
  tracking_number?: string
  ctt_manifest_pdf?: string
  ops_substatus?: string
}

/** Closing the carrier's paperwork never confirms physical collection. */
export async function closeCttManifest(tenantId: string, shipmentIds?: string[], clientId?: string): Promise<ManifestResult> {
  const fail = (error: string): ManifestResult => ({ success: false, error, count: 0 })
  if (!tenantId) return fail('Não foi possível identificar a empresa desta sessão.')
  if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) return fail('Selecione os envios CTT que pretende incluir no manifesto.')
  if (shipmentIds.length > 100 || shipmentIds.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    return fail('A seleção de envios é inválida. Atualize a página e selecione novamente.')
  }
  const ids = [...new Set(shipmentIds)]
  const supabase = createAdminClient()
  let query = supabase.from('shipments').select('*').eq('tenant_id', tenantId).in('id', ids)
  if (clientId) query = query.eq('client_id', clientId)
  const { data: rows, error } = await query
  const shipments = rows as ManifestShipment[] | null
  if (error) return fail('Não foi possível consultar os envios. Nenhum fecho foi enviado aos CTT.')
  if (!shipments || shipments.length !== ids.length) return fail('Um dos envios selecionados não está disponível nesta empresa. Nenhum envio foi fechado.')
  if (shipments.some(s => !['ctt', 'ctt_expresso'].includes(String(s.carrier_code || '').toLowerCase()))) {
    return fail('Selecione apenas envios CTT. O manifesto CTT não inclui outras transportadoras.')
  }
  if (shipments.some(s => ['rascunho', 'aguarda_correcao', 'cancelado', 'entregue', 'devolvido'].includes(s.status))) {
    return fail('A seleção contém envios em estados que não permitem o fecho de manifesto.')
  }
  if (shipments.some(s => s.ctt_manifest_pdf || ['manifesto_fechado', 'expedido'].includes(s.ops_substatus || ''))) {
    return fail('A seleção contém envios com manifesto já fechado. Retire-os da seleção para evitar repetir o fecho.')
  }
  const trackingNumbers = shipments.map(s => [s.carrier_tracking_number, s.ctt_object_id, s.tracking_number]
    .map(value => String(value || '').trim().toUpperCase()).find(value => /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(value)))
  if (trackingNumbers.some(value => !value) || new Set(trackingNumbers).size !== trackingNumbers.length) {
    return fail('Todos os envios devem ter um código CTT válido e distinto. Confirme primeiro a emissão das etiquetas.')
  }

  let credentials
  try {
    credentials = await resolveCttCredentials()
    if (!credentials.auth_id || !credentials.client_number || !credentials.contract_number) {
      return fail('A ligação CTT está incompleta. Configure a autenticação, o cliente e o contrato em Configuração → Webservices.')
    }
  } catch {
    return fail('Não foi possível carregar uma ligação CTT ativa. Verifique Configuração → Webservices.')
  }

  let response
  try {
    response = await new CTTShipmentService().closeShipment(credentials, { shipmentIds: trackingNumbers as string[] })
  } catch {
    // A network failure may happen after the carrier received the request: do not silently retry.
    return fail('Não foi possível confirmar o fecho com os CTT. O estado dos envios foi mantido. Confirme o resultado junto dos CTT antes de repetir.')
  }
  if (response.Status !== 1 || response.ErrorsList?.length) {
    const codes = response.ErrorsList?.map(e => e.Code).filter(code => code !== undefined).join(', ')
    return fail(`Os CTT não confirmaram o fecho${codes ? ` (código ${codes})` : ''}. Verifique os envios e a ligação CTT. O estado dos envios foi mantido.`)
  }
  const deliveryNoteId = response.DeliveryNoteId?.trim()
  if (!deliveryNoteId) return fail('A resposta dos CTT não contém o número do manifesto. Confirme o fecho junto dos CTT antes de repetir.')

  const manifestPdfBase64 = response.DocumentsList?.map(d => d.File || '').find(data =>
    Buffer.from(data, 'base64').subarray(0, 5).toString() === '%PDF-') || ''
  const warnings: string[] = []
  if (!manifestPdfBase64) warnings.push('Os CTT confirmaram o fecho, mas não devolveram um PDF válido. Obtenha o certificado junto dos CTT; não repita o fecho.')
  try {
    const { data: saved, error: saveError } = await supabase.from('shipments').update({
      ctt_delivery_note_id: deliveryNoteId,
      ctt_manifest_pdf: manifestPdfBase64 || null,
      ops_substatus: 'manifesto_fechado',
      updated_at: new Date().toISOString(),
    }).eq('tenant_id', tenantId).in('id', ids).select('id')
    if (saveError || saved?.length !== ids.length) throw new Error('Manifest archive failed')
  } catch {
    warnings.push('O fecho foi confirmado pelos CTT, mas não foi possível guardar o manifesto nos envios. Guarde o número e o PDF; não repita o fecho.')
  }
  try {
    const { error: archiveError } = await supabase.from('audit_log').insert({
      tenant_id: tenantId, action: 'manifest_closed', details: {
        delivery_note_id: deliveryNoteId, shipment_ids: ids, shipments_count: ids.length,
        carrier: 'ctt_expresso', manifest_pdf_base64: manifestPdfBase64, created_at: new Date().toISOString(),
      },
    })
    if (archiveError) throw new Error('Audit archive failed')
  } catch {
    warnings.push('Não foi possível guardar o registo histórico do manifesto. O fecho CTT já foi confirmado.')
  }
  return { success: true, count: ids.length, deliveryNoteId, manifestPdfBase64, warning: warnings.join(' ') || undefined }
}
