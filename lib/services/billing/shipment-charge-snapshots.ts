import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { chargeCents, shipmentChargeBreakdown, type InvoiceShipment } from '@/lib/billing/shipment-invoice-lines'

/** Only enrich verified shipments; never replace their owner, total or identity from JSON. */
export async function hydrateShipmentCharges<T extends InvoiceShipment>(db: SupabaseClient, tenantId: string, clientId: string, shipments: T[]): Promise<T[]> {
  if (!tenantId || !clientId || shipments.some(s => !s.id || s.tenant_id && s.tenant_id !== tenantId || s.client_id && s.client_id !== clientId)) throw new Error('Envios fora do âmbito da faturação.')
  const missing = shipments.filter(s => s.base_price == null || s.fuel_tax_amount == null || s.special_fees_amount == null ||
    Number(s.special_fees_amount) > 0 && s.special_fees_description == null || Number(s.fuel_tax_amount) > 0 && s.fuel_rate_pct == null)
  const snapshots = new Map<string, InvoiceShipment>()
  for (let start = 0; start < missing.length; start += 100) {
    const ids = missing.slice(start, start + 100).map(s => s.id)
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from('audit_log')
        .select('id:details->>id,client_id:details->>client_id,sell_price:details->sell_price,base_price:details->base_price,fuel_tax_amount:details->fuel_tax_amount,fuel_rate_pct:details->fuel_rate_pct,special_fees_amount:details->special_fees_amount,special_fees_description:details->>special_fees_description')
        .eq('tenant_id', tenantId).eq('action', 'shipment_data').eq('details->>client_id', clientId)
        .in('details->>id', ids).order('created_at', { ascending: false }).order('id').range(offset, offset + 999)
      if (error) throw new Error('Não foi possível confirmar a discriminação histórica dos envios.')
      for (const row of (data || []) as InvoiceShipment[]) if (row.id && row.client_id === clientId && !snapshots.has(row.id)) snapshots.set(row.id, row)
      if (!data || data.length < 1000) break
    }
  }
  return shipments.map(s => {
    const row = snapshots.get(s.id)
    const merged = { ...s }
    // A price edited after creation must not inherit an obsolete split.
    if (row && row.sell_price != null && chargeCents(row.sell_price) === chargeCents(s.sell_price)) {
      for (const key of ['base_price', 'fuel_tax_amount', 'fuel_rate_pct', 'special_fees_amount', 'special_fees_description'] as const) {
        if (merged[key] == null && row[key] != null) Object.assign(merged, { [key]: row[key] })
      }
    }
    shipmentChargeBreakdown(merged)
    return merged
  })
}
