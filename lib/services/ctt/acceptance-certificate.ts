import { createAdminClient } from '@/lib/supabase/server'
import { closeCttManifest, type ManifestResult } from './close-manifest'
import type { CTTDocumentData } from './ctt-types'

const validPdf = (doc: CTTDocumentData) => typeof doc?.File === 'string' && Buffer.from(doc.File, 'base64').subarray(0, 5).toString() === '%PDF-'
const resultFor = (documents: CTTDocumentData[], shipmentIds: string[], manifestReference?: string): ManifestResult => ({ success: true, count: shipmentIds.length, shipmentIds, reused: true, manifestReference, documents, manifestPdfBase64: documents[0].File })

/** Return original CTT documents. Never recreate certificates or close a saved batch again. */
export async function getCttAcceptanceCertificate(tenantId: string, shipmentIds?: string[], clientId?: string, options: { allowClose?: boolean; expandBatch?: boolean } = {}): Promise<ManifestResult> {
  const fail = (error: string): ManifestResult => ({ success: false, count: 0, error })
  if (!tenantId || !Array.isArray(shipmentIds) || !shipmentIds.length || shipmentIds.length > 100 || shipmentIds.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return fail('Selecione entre 1 e 100 envios CTT para obter o certificado de aceitação.')
  const ids = [...new Set(shipmentIds)], db = createAdminClient()
  let query = db.from('shipments').select('id, status, carrier_code, ops_substatus').eq('tenant_id', tenantId).in('id', ids)
  if (clientId) query = query.eq('client_id', clientId)
  const { data: rows, error } = await query
  if (error || !rows || rows.length !== ids.length) return fail('Não foi possível consultar todos os envios nesta conta.')
  if (rows.some(row => !['ctt', 'ctt_expresso'].includes(String(row.carrier_code || '').toLowerCase()))) return fail('O certificado de aceitação está disponível apenas para envios CTT. Retire os envios Correos da seleção.')
  if (rows.some(row => ['rascunho', 'aguarda_correcao', 'cancelado'].includes(row.status))) return fail('A seleção contém envios sem emissão válida ou cancelados.')

  // Exact-batch coverage prevents exposing a certificate containing other stores' objects.
  const { data: archives, error: archiveError } = await db.from('audit_log').select('details')
    .eq('tenant_id', tenantId).eq('action', 'manifest_closed').contains('details', { shipment_ids: ids })
    .order('created_at', { ascending: false }).limit(50)
  if (archiveError) return fail('Não foi possível consultar os certificados guardados. Nenhum fecho foi enviado aos CTT.')
  let previouslyClosed = false
  for (const archive of archives || []) {
    const saved = archive.details
    const batch: unknown = saved?.shipment_ids
    if (!Array.isArray(batch) || !['ctt', 'ctt_expresso'].includes(saved.carrier)) continue
    previouslyClosed = true
    let authorizedBatch = ids
    if (batch.length !== ids.length || !batch.every(id => ids.includes(id))) {
      if (!options.expandBatch || batch.length > 100 || !batch.every(id => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id))) continue
      let batchQuery = db.from('shipments').select('id, carrier_code').eq('tenant_id', tenantId).in('id', batch)
      if (clientId) batchQuery = batchQuery.eq('client_id', clientId)
      const { data: batchRows, error: batchError } = await batchQuery
      if (batchError || !batchRows || batchRows.length !== batch.length || batchRows.some(row => !['ctt', 'ctt_expresso'].includes(String(row.carrier_code || '').toLowerCase()))) continue
      authorizedBatch = batch as string[]
    }
    const docs = (Array.isArray(saved.carrier_documents) ? saved.carrier_documents : []).filter(validPdf) as CTTDocumentData[]
    if (!docs.length && typeof saved.manifest_pdf_base64 === 'string') {
      const doc = { FileName: 'Certificado_Aceitacao_CTT.pdf', File: saved.manifest_pdf_base64 }
      if (validPdf(doc)) docs.push(doc)
    }
    if (docs.length) return resultFor(docs, authorizedBatch, saved.manifest_reference)
    return fail('Este lote já foi fechado nos CTT, mas o certificado não ficou guardado. Peça à equipa Ops para recuperar o original junto dos CTT. Não repita o fecho.')
  }
  if (previouslyClosed) return fail('Os envios já pertencem a um lote CTT fechado. Peça à equipa Ops o certificado desse lote completo; não repita o fecho.')

  // Older CompleteShipment emissions may already include the acceptance certificate.
  // Only explicit certificate filenames are accepted, never arbitrary PDFs or labels.
  const byShipment = new Map<string, CTTDocumentData[]>()
  for (let offset = 0; byShipment.size < ids.length; offset += 1000) {
    const { data: snapshots, error: snapshotError } = await db.from('audit_log')
      .select('shipmentId:details->>id,documents:details->ctt_documents').eq('tenant_id', tenantId)
      .eq('action', 'shipment_data').in('details->>id', ids).order('created_at', { ascending: false }).order('id').range(offset, offset + 999)
    if (snapshotError) return fail('Não foi possível consultar os documentos de emissão. Nenhum fecho foi enviado aos CTT.')
    for (const snapshot of (snapshots || []) as unknown as { shipmentId: string; documents?: CTTDocumentData[] }[]) {
      if (!byShipment.has(snapshot.shipmentId)) byShipment.set(snapshot.shipmentId, (Array.isArray(snapshot.documents) ? snapshot.documents : []).filter(doc => doc && /cert(?:ificado)?[ _-]*(?:de[ _-]*)?aceit|acceptance/i.test((doc.FileName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')) && validPdf(doc)))
    }
    if (!snapshots || snapshots.length < 1000) break
  }
  const savedIds = ids.filter(id => byShipment.get(id)?.length)
  if (savedIds.length === ids.length) {
    const docs = [...new Map(ids.flatMap(id => byShipment.get(id)!).map(doc => [doc.File, doc])).values()]
    return resultFor(docs, ids)
  }
  if (savedIds.length || rows.some(row => ['manifesto_fechado', 'expedido'].includes(row.ops_substatus || ''))) return fail('A seleção inclui envios já fechados sem um certificado comum guardado. Peça à equipa Ops para recuperar os certificados originais; não repita o fecho destes envios.')
  if (options.allowClose === false) return fail('O certificado deste envio não está guardado. Peça à equipa Ops para recuperar o original junto dos CTT.')
  const closed = await closeCttManifest(tenantId, ids, clientId)
  if (!closed.success && /not found or already closed/i.test(closed.error || '')) return fail('Os CTT indicam que um objeto não foi encontrado ou já foi fechado. Não foi obtido um certificado oficial. A equipa Ops deve confirmar a ligação de emissão e recuperar o certificado no portal CTT se o lote já estiver fechado.' + (closed.error ? ` Resposta CTT: ${closed.error.replace(/\. Verifique os envios[\s\S]*$/, '').slice(0, 400)}` : ''))
  return { ...closed, shipmentIds: closed.success ? ids : undefined }
}
