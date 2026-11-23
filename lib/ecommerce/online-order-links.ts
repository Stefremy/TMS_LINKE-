import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * A shipment created from an imported web-store order. Written when the shipment is emitted
 * (client_ecommerce_fulfillment_sync), whether or not the store accepted the tracking update,
 * so it is the authoritative "this order already has a guia" record.
 */
export type OnlineOrderLink = {
  shipment_id: string
  tracking_code: string
  client_id: string
  store_id: string
  store_name: string
  order_id: string
  order_number: string
}

/** Small marker shown next to a shipment in lists. */
export type OnlineOrderBadge = { order_number: string; store_name: string }

const PAGE = 1000
const CHUNK = 150

type Row = { details?: Partial<OnlineOrderLink> | null }

function toLink(details: Row["details"]): OnlineOrderLink | null {
  if (!details?.shipment_id || !details.store_id || !details.order_id) return null
  return {
    shipment_id: String(details.shipment_id),
    tracking_code: String(details.tracking_code || ""),
    client_id: String(details.client_id || ""),
    store_id: String(details.store_id),
    store_name: String(details.store_name || "Loja online"),
    order_id: String(details.order_id),
    order_number: String(details.order_number || details.order_id),
  }
}

/** Links for one client, or for the given shipment ids / tracking codes (both are accepted as keys). */
export async function loadOnlineOrderLinks(db: SupabaseClient, tenantId: string,
  scope: { clientId?: string; shipmentKeys?: string[] }): Promise<OnlineOrderLink[]> {
  const base = () => {
    let query = db.from("audit_log").select("details").eq("tenant_id", tenantId).eq("action", "client_ecommerce_fulfillment_sync")
    if (scope.clientId) query = query.eq("details->>client_id", scope.clientId)
    return query
  }
  const rows: Row[] = []
  if (scope.shipmentKeys) {
    const keys = [...new Set(scope.shipmentKeys.filter(Boolean))]
    for (let i = 0; i < keys.length; i += CHUNK) {
      const chunk = keys.slice(i, i + CHUNK)
      const [byId, byTracking] = await Promise.all([
        base().in("details->>shipment_id", chunk).limit(PAGE),
        base().in("details->>tracking_code", chunk).limit(PAGE),
      ])
      if (byId.error || byTracking.error) throw new Error("Não foi possível ler as encomendas online associadas.")
      rows.push(...(byId.data || []), ...(byTracking.data || []))
    }
  } else {
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await base().order("created_at", { ascending: false }).range(offset, offset + PAGE - 1)
      if (error) throw new Error("Não foi possível ler as encomendas online associadas.")
      rows.push(...(data || []))
      if (!data || data.length < PAGE) break
    }
  }
  const unique = new Map<string, OnlineOrderLink>()
  for (const row of rows) {
    const link = toLink(row.details)
    if (link) unique.set(`${link.shipment_id}|${link.store_id}|${link.order_id}`, link)
  }
  return [...unique.values()]
}

/** Badge per shipment, keyed by shipment id and by tracking code. */
export function onlineOrderBadges(links: OnlineOrderLink[]): Record<string, OnlineOrderBadge> {
  const badges: Record<string, OnlineOrderBadge> = {}
  for (const link of links) {
    const badge = { order_number: link.order_number, store_name: link.store_name }
    badges[link.shipment_id] = badge
    if (link.tracking_code) badges[link.tracking_code] = badge
  }
  return badges
}
