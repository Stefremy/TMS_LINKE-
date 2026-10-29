import { createAdminClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth/context"
import { SHIPMENT_LIST_COLUMNS } from "./shipment-fetcher"
import { isCorreosShipment, formatOrGenerateCttObjectId } from "./shipment-utils"
import { loadShipmentPickupDates } from "./shipment-pickup-dates"
import { loadShipmentParcelSummaries } from "./shipment-parcel-summaries"
import { buildShipmentFilterFacets, EMPTY_SHIPMENT_FILTERS, matchesShipmentListFilters, shipmentFiltersError, type FilterableShipment, type ShipmentListFilters } from "./shipment-list-filters"

type ListRow = FilterableShipment & { id: string; tenant_id: string; client_id?: string; carrier_object_id?: string }
type Metadata = Pick<FilterableShipment, "recipient_country" | "recipient_postal" | "is_return" | "isReturn" | "driver_id" | "driver_name">
type MetadataRow = Metadata & { shipment_id?: string; details?: Metadata & { id?: string } }
const METADATA_COLUMNS = "shipment_id:details->>id,recipient_country:details->>recipient_country,recipient_postal:details->>recipient_postal,is_return:details->is_return,isReturn:details->isReturn,driver_id:details->>driver_id,driver_name:details->>driver_name"

/** Filter before pagination; read native scalar columns and projected metadata, never label blobs. */
export async function loadFilteredShipmentPage(options: { page?: number; pageSize?: number; filters?: ShipmentListFilters; search?: string; status?: string } = {}) {
  const ctx = await requireUser()
  if (!ctx.tenant_id || (ctx.role === "client" && !ctx.client_id)) throw new Error("Conta não identificada.")
  const db = createAdminClient()
  const filters = options.filters || EMPTY_SHIPMENT_FILTERS
  const rows: ListRow[] = []
  for (let offset = 0; ; offset += 1000) {
    let query = db.from("shipments").select(SHIPMENT_LIST_COLUMNS).eq("tenant_id", ctx.tenant_id)
    if (ctx.role === "client") query = query.eq("client_id", ctx.client_id)
    const { data, error } = await query.order("created_at", { ascending: false }).order("id").range(offset, offset + 999)
    if (error) throw new Error("Não foi possível carregar os envios para aplicar os filtros.")
    rows.push(...(data || []) as ListRow[])
    if (!data || data.length < 1000) break
  }
  // Latest authorized snapshot per shipment; JSON projection excludes PDFs/ZPL and credentials.
  for (let start = 0; start < rows.length; start += 200) {
    const ids = rows.slice(start, start + 200).map(row => row.id)
    const allowed = new Set(ids), snapshots = new Map<string, Metadata>()
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await db.from("audit_log").select(METADATA_COLUMNS)
        .eq("tenant_id", ctx.tenant_id).eq("action", "shipment_data").in("details->>id", ids)
        .order("created_at", { ascending: false }).order("id").range(offset, offset + 999)
      if (error) throw new Error("Não foi possível carregar os dados de destino e tipo dos envios.")
      for (const item of (data || []) as MetadataRow[]) {
        const id = item.shipment_id || item.details?.id
        if (!id || !allowed.has(id) || snapshots.has(id)) continue
        const source = item.details || item
        snapshots.set(id, { recipient_country: source.recipient_country, recipient_postal: source.recipient_postal,
          is_return: source.is_return, isReturn: source.isReturn, driver_id: source.driver_id, driver_name: source.driver_name })
      }
      if (!data || data.length < 1000) break
    }
    for (const row of rows.slice(start, start + 200)) Object.assign(row,
      Object.fromEntries(Object.entries(snapshots.get(row.id) || {}).filter(([, value]) => value !== undefined && value !== null)))
  }
  const facets = buildShipmentFilterFacets(rows)
  let candidates = rows.filter(row => matchesShipmentListFilters(row, { ...filters, dateFrom: "", dateTo: "" }, options.search, options.status))
  const pickupDates = new Map<string, string>()
  const needsPickupDates = filters.dateField === "pickup" && !!(filters.dateFrom || filters.dateTo)
  if (needsPickupDates) {
    for (let start = 0; start < candidates.length; start += 200) {
      const dates = await loadShipmentPickupDates(db, ctx.tenant_id, candidates.slice(start, start + 200).map(row => row.id))
      for (const [id, timestamp] of dates) pickupDates.set(id, timestamp)
    }
    candidates = candidates.map(row => ({ ...row, picked_up_at: pickupDates.get(row.id) || null }))
  }
  const filtered = candidates.filter(row => matchesShipmentListFilters(row, filters, options.search, options.status))
  const pageSize = Number.isSafeInteger(options.pageSize) && options.pageSize! > 0 ? Math.min(200, options.pageSize!) : 50
  const total = filtered.length, totalPages = Math.ceil(total / pageSize)
  const requestedPage = Number.isSafeInteger(options.page) && options.page! > 0 ? options.page! : 1
  const page = Math.min(requestedPage, Math.max(1, totalPages))
  const selected = filtered.slice((page - 1) * pageSize, page * pageSize)
  const [pickup, parcels] = await Promise.allSettled([
    needsPickupDates ? Promise.resolve(pickupDates) : loadShipmentPickupDates(db, ctx.tenant_id, selected.map(row => row.id)),
    loadShipmentParcelSummaries(db, ctx.tenant_id, selected),
  ])
  const data = selected.map(s => {
    const correos = isCorreosShipment(s)
    return { ...s, picked_up_at: pickup.status === "fulfilled" ? pickup.value.get(s.id) || null : null,
      parcel_summary: parcels.status === "fulfilled" ? parcels.value.get(s.id) || null : null,
      status: ["entrada_rede", "recolhido"].includes(s.status || "") ? "em_transito" : s.status,
      reference: s.tracking_number?.startsWith("LTK") ? s.tracking_number : s.reference || null,
      carrier_code: correos ? "correos" : s.carrier_code || "ctt", carrier_name: correos ? "Correos Express" : s.carrier_name || "CTT Expresso",
      carrier_tracking_number: s.carrier_tracking_number || (correos ? s.carrier_object_id : null),
      ctt_object_id: correos ? null : formatOrGenerateCttObjectId(s), has_label: true }
  })
  return { data, total, page, pageSize, totalPages, facets, filterError: shipmentFiltersError(filters) }
}
