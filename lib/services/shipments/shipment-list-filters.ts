import { getShipmentStatusConfig } from "@/lib/status-helpers"

export type ShipmentListFilters = {
  dateField: "pickup" | "created" | "updated"
  dateFrom: string
  dateTo: string
  service: string
  carrier: string
  carrierOp: "eq" | "neq"
  context: string
  type: string
  driver: string
}
export const EMPTY_SHIPMENT_FILTERS: ShipmentListFilters = {
  dateField: "pickup", dateFrom: "", dateTo: "", service: "", carrier: "", carrierOp: "eq", context: "", type: "", driver: "",
}
export type FilterableShipment = {
  id?: string; created_at?: string; updated_at?: string; picked_up_at?: string | null
  service_type?: string; carrier_code?: string; carrier_name?: string; carrier_tracking_number?: string
  tracking_number?: string; reference?: string; sender_name?: string; recipient_name?: string
  recipient_address?: string; recipient_country?: string; recipient_postal?: string
  recipient_zip4?: string; recipient_zip3?: string; status?: string; sell_price?: number | string
  is_return?: boolean | string; isReturn?: boolean | string; driver_id?: string; driver_name?: string
}
export type ShipmentFilterFacets = { services: string[]; carriers: { value: string; label: string }[]; drivers: { value: string; label: string }[] }
export const normalizeFilterText = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()

export function readShipmentListFilters(params: Record<string, string | string[] | undefined>): ShipmentListFilters {
  const string = (key: string) => typeof params[key] === "string" ? params[key] as string : ""
  return { dateField: ["created", "updated"].includes(string("dateField")) ? string("dateField") as "created" | "updated" : "pickup",
    dateFrom: string("dateFrom"), dateTo: string("dateTo"), service: string("service"), carrier: string("carrier"),
    carrierOp: string("carrierOp") === "neq" ? "neq" : "eq", context: string("context"), type: string("type"), driver: string("driver") }
}
export function shipmentFiltersError(filters: ShipmentListFilters): string | null {
  for (const date of [filters.dateFrom, filters.dateTo]) if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date)) return "Indique datas válidas."
  return filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo ? "A data inicial não pode ser posterior à data final." : null
}
export function lisbonCalendarDate(value?: string | null): string {
  if (!value) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  if (!Number.isFinite(Date.parse(value))) return ""
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value))
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type)?.value).join("-")
}
export function shipmentCarrier(row: FilterableShipment): string {
  const code = normalizeFilterText(row.carrier_code)
  return code.includes("correos") || normalizeFilterText(row.service_type).includes("correos") ||
    /^\d{16}$/.test((row.carrier_tracking_number || "").trim()) || /^\d{16}$/.test((row.tracking_number || "").trim()) ? "correos" : code || "ctt"
}
export function shipmentContext(row: FilterableShipment): string {
  const country = row.recipient_country?.trim().toUpperCase() || (/^\d{4}$/.test(row.recipient_zip4 || "") && /^\d{3}$/.test(row.recipient_zip3 || "") ? "PT" : "")
  const postal = row.recipient_postal || row.recipient_zip4 || ""
  if (country === "PT") return /^9/.test(postal.trim()) ? "islands" : postal.trim() ? "mainland" : "unknown"
  return country === "ES" ? "spain" : country ? "international" : "unknown"
}
export function matchesShipmentListFilters(row: FilterableShipment, filters: ShipmentListFilters, search = "", status = "Todos"): boolean {
  if (shipmentFiltersError(filters)) return false
  if (filters.service && row.service_type !== filters.service) return false
  if (filters.carrier && ((shipmentCarrier(row) === filters.carrier) !== (filters.carrierOp === "eq"))) return false
  if (filters.context && shipmentContext(row) !== filters.context) return false
  const isReturn = row.is_return === true || row.is_return === "true" || row.isReturn === true || row.isReturn === "true"
  if (filters.type && (isReturn ? "return" : "shipment") !== filters.type) return false
  if (filters.driver && (row.driver_id || row.driver_name || "__none__") !== filters.driver) return false
  if (filters.dateFrom || filters.dateTo) {
    const date = lisbonCalendarDate(filters.dateField === "pickup" ? row.picked_up_at : filters.dateField === "created" ? row.created_at : row.updated_at)
    if (!date || (filters.dateFrom && date < filters.dateFrom) || (filters.dateTo && date > filters.dateTo)) return false
  }
  const rawStatus = ["entrada_rede", "recolhido"].includes(row.status || "") ? "em_transito" : row.status
  const label = getShipmentStatusConfig(rawStatus).label
  const statusKey = normalizeFilterText(status).replace(/[_-]+/g, " ")
  if (statusKey && statusKey !== "todos") {
    const target = ["pendente", "pendentes"].includes(statusKey) ? "aguarda entrada" : statusKey === "incidencias" ? "incidencia" : statusKey
    const current = rawStatus === "rascunho" ? "aguarda entrada" : normalizeFilterText(label)
    if (current !== target) return false
  }
  const query = normalizeFilterText(search)
  return !query || [row.tracking_number, row.carrier_tracking_number, row.reference, row.sender_name, row.recipient_name, row.recipient_address, row.recipient_postal, row.service_type, label, row.sell_price]
    .some(value => normalizeFilterText(value).includes(query))
}
export function buildShipmentFilterFacets(rows: FilterableShipment[]): ShipmentFilterFacets {
  const carriers = new Map<string, string>(), drivers = new Map<string, string>()
  for (const row of rows) {
    const carrier = shipmentCarrier(row)
    carriers.set(carrier, carrier === "ctt" ? "CTT Expresso" : carrier === "correos" ? "Correos Express" : row.carrier_name || carrier)
    if (row.driver_id || row.driver_name) drivers.set(row.driver_id || row.driver_name!, row.driver_name || row.driver_id!)
  }
  return { services: [...new Set(rows.map(row => row.service_type).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, "pt")),
    carriers: [...carriers].map(([value, label]) => ({ value, label })), drivers: [...drivers].map(([value, label]) => ({ value, label })) }
}
export function shipmentListQuery(filters: ShipmentListFilters, search: string, status: string): string {
  const params = new URLSearchParams()
  for (const key of Object.keys(EMPTY_SHIPMENT_FILTERS) as (keyof ShipmentListFilters)[]) {
    if (filters[key] && filters[key] !== EMPTY_SHIPMENT_FILTERS[key]) params.set(key, filters[key])
  }
  if (search.trim()) params.set("search", search.trim())
  if (status && status !== "Todos") params.set("status", status)
  return params.toString()
}
