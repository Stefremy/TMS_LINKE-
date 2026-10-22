import type { SupabaseClient } from '@supabase/supabase-js'

type PickupEvent = { shipment_id: string; event_code?: string | null; description?: string | null; timestamp?: string | null }

/** A created label, closed manifest or arrival at the customer's node is not collection. */
export function confirmedPickupTimestamp(event: PickupEvent): string | null {
  const timestamp = event.timestamp ? Date.parse(event.timestamp) : NaN
  if (!Number.isFinite(timestamp)) return null
  const description = (event.description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  const confirmed = event.event_code?.trim().toUpperCase() === 'EMP' ||
    /^(?:recolha (?:efetuada|efectuada|realizada)|(?:envio )?recolhid[oa]s?|(?:envio )?recogidos?|recogida (?:efectuada|realizada)|collected|picked up)\b/.test(description)
  return confirmed ? new Date(timestamp).toISOString() : null
}

/** One batched read for the authorized page; no carrier requests or per-shipment lookups. */
export async function loadShipmentPickupDates(db: SupabaseClient, tenant: string, shipmentIds: string[]) {
  const dates = new Map<string, string>()
  if (!tenant || !shipmentIds.length) return dates
  const allowed = new Set(shipmentIds)
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('tracking_events').select('shipment_id,event_code,description,timestamp')
      .eq('tenant_id', tenant).in('shipment_id', shipmentIds)
      .order('timestamp', { ascending: true }).order('id').range(offset, offset + 999)
    if (error) throw new Error('Não foi possível consultar as datas de recolha.')
    for (const event of (data || []) as PickupEvent[]) {
      if (!allowed.has(event.shipment_id)) continue
      const timestamp = confirmedPickupTimestamp(event)
      const previous = dates.get(event.shipment_id)
      if (timestamp && (!previous || timestamp < previous)) dates.set(event.shipment_id, timestamp)
    }
    if (!data || data.length < 1000) return dates
  }
}

export function pickupDateDisplay(timestamp?: string | null) {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return null
  const date = new Date(timestamp)
  return {
    date: new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Lisbon' }).format(date),
    time: new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' }).format(date),
  }
}
