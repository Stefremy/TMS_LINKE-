import type { SupabaseClient } from '@supabase/supabase-js'
import { positiveMeasurement } from '../tracking/carrier-measurements'
import { carrierWeightSummary, type ParcelSummary } from './parcel-summary'

type Shipment = { id: string; carrier_code?: string | null; service_type?: string | null; carrier_tracking_number?: string | null }
const action = 'shipment_carrier_measurements'

/** Only receives already-authorized shipment rows. Compact projections exclude
 * labels and contacts; queries are batched, never one request per table row. */
export async function loadShipmentParcelSummaries(db: SupabaseClient, tenant: string, shipments: Shipment[]) {
  const summaries = new Map<string, ParcelSummary>()
  if (!tenant || !shipments.length) return summaries
  const unique = [...new Map(shipments.map(row => [row.id, row])).values()]
  const chunks: Shipment[][] = []
  for (let start = 0; start < unique.length; start += 100) chunks.push(unique.slice(start, start + 100))
  await Promise.all(chunks.map(async rows => {
    const ids = rows.map(row => row.id)
    async function read(table: string, projection: string, field: string, auditAction?: string) {
      const result: Record<string, unknown>[] = []
      for (let offset = 0; ; offset += 1000) {
        let query = db.from(table).select(projection).eq('tenant_id', tenant).in(field, ids)
        if (auditAction) query = query.eq('action', auditAction)
        const { data, error } = await query.order('created_at', { ascending: false }).order('id').range(offset, offset + 999)
        if (error) return []
        result.push(...((data || []) as unknown as Record<string, unknown>[]))
        if (!data || data.length < 1000) return result
      }
    }
    const [packages, declarations, measurements] = await Promise.all([
      read('packages', 'shipment_id,weight_g', 'shipment_id'),
      read('audit_log', 'shipmentId:details->>id,weightKg:details->weight_kg,volumeCount:details->package_count', 'details->>id', 'shipment_data'),
      read('audit_log', 'shipmentId:details->>shipment_id,carrier:details->>carrier,measurements:details->measurements,retrievedAt:details->>retrieved_at', 'details->>shipment_id', action),
    ])
    const declarationsById = new Map<string, Record<string, unknown>>()
    const measurementsById = new Map<string, Record<string, unknown>>()
    for (const entry of declarations) if (typeof entry.shipmentId === 'string' && !declarationsById.has(entry.shipmentId)) declarationsById.set(entry.shipmentId, entry)
    for (const entry of measurements) if (typeof entry.shipmentId === 'string' && !measurementsById.has(entry.shipmentId)) measurementsById.set(entry.shipmentId, entry)
    for (const row of rows) {
      const declaration = declarationsById.get(row.id)
      const parcelRows = packages.filter(pkg => pkg.shipment_id === row.id)
      const weights = parcelRows.map(pkg => positiveMeasurement(pkg.weight_g))
      const grams = weights.length && weights.every(weight => weight !== null) ? weights.reduce<number>((sum, weight) => sum + weight!, 0) : null
      const count = positiveMeasurement(declaration?.volumeCount)
      const measurement = measurementsById.get(row.id)
      const carrier = row.carrier_code === 'correos' || row.carrier_code === 'correos_express' ||
        row.service_type?.toLowerCase().includes('correos') || /^\d{16}$/.test(row.carrier_tracking_number || '') ? 'correos' : 'ctt'
      summaries.set(row.id, {
        declaredWeightKg: positiveMeasurement(declaration?.weightKg) ?? (grams !== null ? grams / 1000 : null),
        volumeCount: count && Number.isSafeInteger(count) ? count : parcelRows.length || null,
        carrierWeight: measurement?.carrier === carrier ? carrierWeightSummary(carrier, measurement.measurements, measurement.retrievedAt) : null,
      })
    }
  }))
  return summaries
}
