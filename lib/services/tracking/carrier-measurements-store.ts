import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NormalizedTrackingEvent } from './types'
import { latestCarrierReadings, type SavedCarrierMeasurements } from './carrier-measurements'

export const CARRIER_MEASUREMENTS_ACTION = 'shipment_carrier_measurements'

function measurementKey(value: SavedCarrierMeasurements['measurements']) {
  // PostgreSQL jsonb reorders object keys; compare values, not serialization order.
  return JSON.stringify([value.source, ...(['weight', 'volumetricWeight', 'volume', 'length', 'width', 'height'] as const)
    .map(key => value[key] ? [value[key]!.value, value[key]!.unit] : null)])
}

export async function saveCarrierMeasurements(
  db: SupabaseClient,
  shipment: { id: string; tenant_id: string },
  events: NormalizedTrackingEvent[],
) {
  const measured = events.filter(event => event.measurements)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  if (!measured.length || !shipment.id || !shipment.tenant_id) return
  const carrier = measured[0].carrierCode
  const { data: previous, error } = await db.from('audit_log').select('id,details')
    .eq('tenant_id', shipment.tenant_id).eq('action', CARRIER_MEASUREMENTS_ACTION)
    .eq('details->>shipment_id', shipment.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error('Não foi possível ler as medições guardadas.')
  const now = new Date().toISOString()
  const incoming: SavedCarrierMeasurements[] = measured.filter(event => event.carrierCode === carrier).map(event => ({
    shipment_id: shipment.id, carrier, measurements: event.measurements!, event_code: event.eventCode,
    event_timestamp: event.timestamp, retrieved_at: now,
  }))
  // Fill only absent fields from the previous response, never from declared data.
  const measurements = latestCarrierReadings([...incoming, ...(previous?.details?.carrier === carrier ? [previous.details] : [])])!
  const details: SavedCarrierMeasurements = { ...incoming[0], measurements }
  if (previous?.details?.carrier === carrier && measurementKey(previous.details.measurements) === measurementKey(measurements)) return

  // Existing audit JSON storage avoids requiring a new production column. A
  // deterministic key makes identical concurrent refreshes idempotent.
  const hash = createHash('sha256').update(JSON.stringify([shipment.tenant_id, shipment.id, carrier, previous?.id, measurementKey(measurements)])).digest('hex')
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
  const { error: insertError } = await db.from('audit_log').upsert({
    id, tenant_id: shipment.tenant_id, action: CARRIER_MEASUREMENTS_ACTION, details, created_at: now,
  }, { onConflict: 'id', ignoreDuplicates: true })
  if (insertError) throw new Error('Não foi possível guardar as medições da transportadora.')
}
