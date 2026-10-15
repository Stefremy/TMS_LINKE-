import { createAdminClient } from '@/lib/supabase/server'
import { resolveCttCredentials } from '@/lib/services/carriers/credentials'
import { CTTShipmentService } from './ctt-shipment.service'
import type { CTTDocumentData, CTTShipment2Close } from './ctt-types'

interface ManifestResult {
  success: boolean
  error?: string
  count: number
  manifestReference?: string
  manifestPdfBase64?: string
  documents?: CTTDocumentData[]
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
  volumes_count?: number
  service_type?: string
}

interface CloseMetadata extends CTTShipment2Close {
  shipmentId: string
  connectionId?: string
}

const productByPrefix: Record<string, string> = { EQ: 'ENCF008.01', DD: 'EMSF056.01', DB: 'EMSF057.01' }

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

  const { data: metadataRows, error: metadataError } = await supabase.from('audit_log')
    .select('details->ctt_close_data').eq('tenant_id', tenantId).eq('action', 'shipment_data')
    .in('details->>id', ids).order('created_at', { ascending: false }).limit(100)
  if (metadataError) return fail('Não foi possível consultar os dados de emissão CTT. Nenhum fecho foi enviado.')
  const metadata = new Map<string, CloseMetadata>()
  for (const row of (metadataRows || []) as { ctt_close_data?: CloseMetadata }[]) {
    if (row.ctt_close_data && !metadata.has(row.ctt_close_data.shipmentId)) metadata.set(row.ctt_close_data.shipmentId, row.ctt_close_data)
  }
  const connectionIds = [...new Set([...metadata.values()].map(m => m.connectionId).filter(Boolean))]
  if (connectionIds.length > 1) return fail('Selecione envios da mesma ligação CTT para fechar o manifesto.')
  const items: CTTShipment2Close[] = []
  for (let i = 0; i < shipments.length; i++) {
    const shipment = shipments[i]
    const stored = metadata.get(shipment.id)
    const first = trackingNumbers[i]!
    const last = stored?.LastObjectCode || ((shipment.volumes_count || 1) === 1 ? first : '')
    const product = stored?.SubProductCode || shipment.service_type?.match(/^(?:EMS|ENC)F\d{3}\.\d{2}$/)?.[0] || productByPrefix[first.slice(0, 2)]
    if (!product || !/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(last)) return fail('Faltam os dados de produto ou de volumes da emissão CTT. Confirme a etiqueta antes de fechar.')
    if (stored && stored.FirstObjectCode !== first) return fail('O código CTT não corresponde ao registo de emissão. Confirme a etiqueta antes de fechar.')
    items.push({ FirstObjectCode: first, LastObjectCode: last, SubProductCode: product })
  }

  let credentials
  try {
    credentials = await resolveCttCredentials(connectionIds[0])
    if (!credentials.auth_id || !credentials.client_number || !credentials.contract_number) {
      return fail('A ligação CTT está incompleta. Configure a autenticação, o cliente e o contrato em Configuração → Webservices.')
    }
  } catch {
    return fail('Não foi possível carregar uma ligação CTT ativa. Verifique Configuração → Webservices.')
  }

  let response
  try {
    response = await new CTTShipmentService().closeShipment(credentials, { shipments: items })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const kind = /SOAP Fault/i.test(message) ? 'SOAP_FAULT' : /Tempo limite|timeout/i.test(message) ? 'TIMEOUT'
      : /HTTP\s+\d+/i.test(message) ? 'HTTP_ERROR' : /XML/i.test(message) ? 'INVALID_XML' : 'CONNECTION_ERROR'
    const reference = crypto.randomUUID()
    const description = { SOAP_FAULT: 'resposta de erro dos CTT', TIMEOUT: 'tempo de resposta excedido',
      HTTP_ERROR: 'serviço CTT indisponível', INVALID_XML: 'resposta CTT inválida', CONNECTION_ERROR: 'falha na ligação' }[kind]
    const networkCode = message.match(/\b(?:ECONNRESET|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EHOSTUNREACH)\b/)?.[0]
    // Record diagnostics without credentials, addresses, barcodes or raw SOAP bodies.
    console.error('[CTT_MANIFEST_CLOSE]', { reference, kind, networkCode, environment: credentials.environment || 'production' })
    // A network failure may happen after the carrier received the request: do not silently retry.
    return fail(`Não foi possível confirmar o fecho com os CTT: ${description}. Referência: ${reference}. O estado dos envios foi mantido. Confirme o resultado junto dos CTT antes de repetir.`)
  }
  if (response.Status !== 1 || response.ErrorsList?.length) {
    const codes = response.ErrorsList?.map(e => e.Code).filter(code => code !== undefined).join(', ')
    return fail(`Os CTT não confirmaram o fecho${codes ? ` (código ${codes})` : ''}. Verifique os envios e a ligação CTT. O estado dos envios foi mantido.`)
  }
  // CloseShipmentOutput has Status/DocumentsList/ErrorsList, not DeliveryNoteId.
  // This is a Linke archive reference, never presented as an official CTT number.
  const manifestReference = `LINKE-${crypto.randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`
  const documents = response.DocumentsList?.filter(d =>
    Buffer.from(d.File || '', 'base64').subarray(0, 5).toString() === '%PDF-') || []
  const manifestPdfBase64 = documents[0]?.File || ''
  const warnings: string[] = []
  if (!manifestPdfBase64) warnings.push('Os CTT confirmaram o fecho, mas não devolveram um PDF válido. Obtenha o certificado junto dos CTT; não repita o fecho.')
  try {
    const { data: saved, error: saveError } = await supabase.from('shipments').update({
      ctt_manifest_pdf: manifestPdfBase64 || null,
      ops_substatus: 'manifesto_fechado',
      updated_at: new Date().toISOString(),
    }).eq('tenant_id', tenantId).in('id', ids).select('id')
    if (saveError || saved?.length !== ids.length) throw new Error('Manifest archive failed')
  } catch {
    warnings.push('O fecho foi confirmado pelos CTT, mas não foi possível guardar o manifesto nos envios. Guarde a referência e os PDF; não repita o fecho.')
  }
  try {
    const { error: archiveError } = await supabase.from('audit_log').insert({
      tenant_id: tenantId, action: 'manifest_closed', details: {
        manifest_reference: manifestReference, shipment_ids: ids, shipments_count: ids.length,
        carrier: 'ctt_expresso', manifest_pdf_base64: manifestPdfBase64, carrier_documents: documents, created_at: new Date().toISOString(),
      },
    })
    if (archiveError) throw new Error('Audit archive failed')
  } catch {
    warnings.push('Não foi possível guardar o registo histórico do manifesto. O fecho CTT já foi confirmado.')
  }
  return { success: true, count: ids.length, manifestReference, manifestPdfBase64, documents, warning: warnings.join(' ') || undefined }
}
