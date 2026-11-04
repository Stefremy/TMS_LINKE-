import type { SupabaseClient } from '@supabase/supabase-js'

type ShipmentAuditRecord = { id: string; details: Record<string, unknown> }

/** Read only matching snapshots; never download every shipment's label to update one. */
export async function findShipmentAuditRecords(db: SupabaseClient, tenantId: string, identifier: string): Promise<ShipmentAuditRecord[]> {
  if (!tenantId || !identifier) return []
  const results = await Promise.all(['id', 'tracking_number'].map(field => db.from('audit_log')
    .select('id, details').eq('tenant_id', tenantId).eq('action', 'shipment_data')
    .eq(`details->>${field}`, identifier)))
  if (results.some(result => result.error)) throw new Error('Não foi possível consultar o registo deste envio.')
  const unique = new Map<string, ShipmentAuditRecord>()
  for (const { data } of results) for (const row of data || []) unique.set(row.id, row)
  return [...unique.values()]
}
