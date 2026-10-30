import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { billingDay } from '@/lib/billing/statistics'
import { buildClientCodRows, codCents, reembolsoDay, type CodShipment, type CodSettlement, type ClientCodOverview } from './client-cod'

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const text = (value: unknown) => typeof value === 'string' ? value.slice(0, 160) : null
export function codSettlementFromItem(carrier: unknown, summary: Record<string, unknown>, item: Record<string, unknown>, shipment: CodShipment): CodSettlement {
  const carrierTracking = typeof item.carrierTracking === 'string' ? item.carrierTracking.trim().toUpperCase() : ''
  const carrierMatches = Boolean(carrierTracking && [shipment.carrier_tracking_number,shipment.tracking_number].some(value => value?.trim().toUpperCase() === carrierTracking))
  const processed = reembolsoDay(item.processingDate), created = billingDay(shipment.created_at), delivered = reembolsoDay(item.deliveryDate)
  const datesMatch = Boolean(created && processed && processed >= created && (!delivered || delivered >= created))
  return { carrier: typeof carrier === 'string' ? carrier : undefined, shipmentId: shipment.id, amountCents: codCents(item.amount), matched: item.reconcileStatus === 'matched' && carrierMatches && datesMatch,
    paid: summary.isPaid === true, paidAt: billingDay(summary.paidAt), processingDate: reembolsoDay(item.processingDate), paymentRef: text(summary.paymentRef) }
}

export async function loadClientCodOverview(db: SupabaseClient, tenantId: string, clientId: string): Promise<ClientCodOverview> {
  if (!tenantId || !clientId) throw new Error('Não foi possível verificar a conta.')
  const { data: owner, error: ownerError } = await db.from('clients').select('id').eq('tenant_id', tenantId).eq('id', clientId).maybeSingle()
  if (ownerError || !owner) throw new Error('Cliente não encontrado nesta empresa.')
  const shipments: CodShipment[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('shipments')
      .select('id,tenant_id,client_id,tracking_number,carrier_tracking_number,carrier_code,status,created_at')
      .eq('tenant_id', tenantId).eq('client_id', clientId).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 999)
    if (error || !data) throw new Error('Não foi possível carregar os envios com reembolso.')
    if (data.some(row => row.tenant_id !== tenantId || row.client_id !== clientId)) throw new Error('Dados não pertencem à conta selecionada.')
    shipments.push(...data as CodShipment[])
    if (data.length < 1000) break
  }
  // COD is stored in lightweight shipment snapshots; some deployments do not have a native COD column.
  for (let start = 0; start < shipments.length; start += 100) {
    const part = shipments.slice(start, start + 100), latest = new Set<string>()
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from('audit_log')
        .select('id,created_at,shipmentId:details->>id,clientId:details->>client_id,codValue:details->cod_value,codAmount:details->cod_amount,isCod:details->is_cod')
        .eq('tenant_id', tenantId).eq('action', 'shipment_data').in('details->>id', part.map(s => s.id))
        .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 999)
      if (error || !data) throw new Error('Não foi possível carregar os valores dos reembolsos.')
      for (const row of data) {
        if (typeof row.shipmentId !== 'string' || latest.has(row.shipmentId)) continue
        latest.add(row.shipmentId)
        if (row.clientId && row.clientId !== clientId) throw new Error('Não foi possível confirmar a associação do envio a esta conta.')
        const shipment = part.find(s => s.id === row.shipmentId)
        if (!shipment) continue
        const value = row.codValue ?? row.codAmount
        shipment.cod_value = row.isCod === false ? 0 : typeof value === 'number' || typeof value === 'string' ? value : null
        shipment.cod_enabled = row.isCod === true
      }
      if (data.length < 1000) break
    }
  }
  const owned = new Map(shipments.map(s => [s.id,s])), settlements: CodSettlement[] = []
  for (let offset = 0; ; offset += 1000) {
    // Never send batch documents or other customers' summaries to the portal.
    const { data, error } = await db.from('audit_log').select('id,created_at,carrier:details->>carrier,summaries:details->clientSummaries')
      .eq('tenant_id', tenantId).eq('action', 'reembolso_batch').contains('details', { clientSummaries: [{ clientId }] }).order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 999)
    if (error || !data) throw new Error('Não foi possível confirmar os extratos de reembolso.')
    for (const row of data) {
      if (!Array.isArray(row.summaries)) throw new Error('Extrato de reembolso incompleto. Contacte o suporte.')
      for (const value of row.summaries) {
        const summary = record(value)
        if (summary.clientId !== clientId) continue
        if (!Array.isArray(summary.items)) throw new Error('Extrato de reembolso incompleto. Contacte o suporte.')
        for (const value of summary.items) {
          const item = record(value)
          if (typeof item.shipmentId !== 'string' || !owned.has(item.shipmentId) || (item.clientId && item.clientId !== clientId)) continue
          const shipment = owned.get(item.shipmentId)!
          settlements.push(codSettlementFromItem(row.carrier,summary,item,shipment))
        }
      }
    }
    if (data.length < 1000) break
  }
  return { clientId, rows: buildClientCodRows(shipments, settlements), updatedAt: new Date().toISOString() }
}
