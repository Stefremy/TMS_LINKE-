export const REPORT_PERIODS = [
  { id: "hoje", label: "Hoje" }, { id: "esta_semana", label: "Esta semana" },
  { id: "este_mes", label: "Este mês" }, { id: "ultimos_30", label: "Últimos 30 dias" },
] as const
export type ReportPeriod = typeof REPORT_PERIODS[number]["id"]
export interface ReportFilters { period: ReportPeriod; clientId?: string; carrier?: string; service?: string }
export interface ReportShipment {
  id: string; client_id?: string | null; created_at: string; status: string
  service_type?: string | null; carrier_code?: string | null; sell_price?: unknown; buy_price?: unknown
}
export interface ReportClient { id: string; short_name?: string; legal_name?: string; name?: string }
export interface ReportGroup {
  id: string; name: string; volume: number; previousVolume: number; delivered: number; incidents: number
  revenue: number; cost: number; margin: number; pricedCount: number; negativeMarginCount: number; lastShipmentAt: string | null
}
export interface ReportSuggestion {
  id: string; priority: "atenção" | "oportunidade"; title: string; detail: string; action: string; href: string
}
export interface OperationalReport {
  filters: ReportFilters; updatedAt: string
  range: { start: string; end: string; previousStart: string; previousEnd: string }
  totals: ReportGroup & { inTransit: number; pending: number; returned: number; other: number; missingCostCount: number; missingSellCount: number }
  excluded: { drafts: number; cancelled: number }
  carriers: ReportGroup[]; clients: ReportGroup[]; services: ReportGroup[]
  timeline: { date: string; volume: number; margin: number; pricedCount: number }[]
  options: { clients: { id: string; name: string }[]; carriers: string[]; services: string[] }
  suggestions: ReportSuggestion[]
}

const zone = "Europe/Lisbon"
const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })
export function reportDay(date: Date): string {
  const parts = dateFormatter.formatToParts(date)
  const part = (type: string) => parts.find(p => p.type === type)!.value
  return `${part("year")}-${part("month")}-${part("day")}`
}
function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
function lisbonMidnight(day: string): Date {
  const target = new Date(`${day}T00:00:00Z`).getTime()
  let instant = target
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  })
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(new Date(instant))
    const part = (type: string) => Number(parts.find(p => p.type === type)!.value)
    const displayed = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"))
    instant += target - displayed
  }
  return new Date(instant)
}
export function getReportRange(period: ReportPeriod, now = new Date()): OperationalReport["range"] {
  const today = reportDay(now)
  let startDay = today, previousDay = shiftDay(today, -1)
  if (period === "esta_semana") {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
    startDay = shiftDay(today, -((weekday + 6) % 7))
    previousDay = shiftDay(startDay, -7)
  } else if (period === "este_mes") {
    startDay = `${today.slice(0, 7)}-01`
    const previous = new Date(`${startDay}T12:00:00Z`)
    previous.setUTCMonth(previous.getUTCMonth() - 1)
    previousDay = previous.toISOString().slice(0, 10)
  } else if (period === "ultimos_30") {
    startDay = shiftDay(today, -29)
    previousDay = shiftDay(startDay, -30)
  }
  const start = lisbonMidnight(startDay), previousStart = lisbonMidnight(previousDay)
  // Compare the same elapsed duration, capped at the previous period's boundary.
  const previousEnd = new Date(Math.min(start.getTime(), previousStart.getTime() + now.getTime() - start.getTime()))
  return { start: start.toISOString(), end: now.toISOString(), previousStart: previousStart.toISOString(), previousEnd: previousEnd.toISOString() }
}
function moneyCents(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim())) return null
  const number = Number(value), cents = Math.round(number * 100)
  return Number.isFinite(number) && number >= 0 && Number.isSafeInteger(cents) ? cents : null
}
function carrierName(shipment: ReportShipment): string {
  const code = (shipment.carrier_code || "").toLowerCase()
  if (code.includes("correos")) return "Correos Express"
  if (code.includes("ctt")) return "CTT Expresso"
  if (code) return shipment.carrier_code!
  const service = (shipment.service_type || "").toLowerCase()
  if (service.includes("correos")) return "Correos Express"
  if (service.includes("ctt")) return "CTT Expresso"
  return "Não identificada"
}
function blankGroup(id: string, name: string): ReportGroup {
  return { id, name, volume: 0, previousVolume: 0, delivered: 0, incidents: 0, revenue: 0, cost: 0, margin: 0, pricedCount: 0, negativeMarginCount: 0, lastShipmentAt: null }
}
function addShipment(group: ReportGroup, shipment: ReportShipment) {
  group.volume++
  if (["entregue", "entregue_pudo"].includes(shipment.status)) group.delivered++
  if (["incidencia", "com_incidencia"].includes(shipment.status)) group.incidents++
  const sell = moneyCents(shipment.sell_price), cost = moneyCents(shipment.buy_price)
  if (sell !== null) group.revenue += sell
  if (cost !== null) group.cost += cost
  if (sell !== null && cost !== null) {
    group.pricedCount++; group.margin += sell - cost
    if (sell < cost) group.negativeMarginCount++
  }
  if (!group.lastShipmentAt || shipment.created_at > group.lastShipmentAt) group.lastShipmentAt = shipment.created_at
}
function finishGroup<T extends ReportGroup>(group: T): T {
  return { ...group, revenue: group.revenue / 100, cost: group.cost / 100, margin: group.margin / 100 }
}
export function buildOperationalReport(shipments: ReportShipment[], clients: ReportClient[], filters: ReportFilters, now = new Date()): OperationalReport {
  const range = getReportRange(filters.period, now)
  const names = new Map(clients.map(c => [c.id, c.short_name || c.legal_name || c.name || "Cliente sem nome"]))
  const clientLabel = (id: string) => names.get(id) || (id === "unassigned" ? "Sem cliente associado" : "Cliente sem ficha disponível")
  // One row per persisted shipment; future dates and records outside both windows are excluded.
  const unique = new Map<string, ReportShipment>()
  for (const shipment of shipments) {
    const at = new Date(shipment.created_at).getTime()
    if (Number.isFinite(at) && at >= Date.parse(range.previousStart) && at <= now.getTime()) unique.set(shipment.id, shipment)
  }
  const rows = [...unique.values()]
  const options = {
    clients: [...new Set(rows.map(s => s.client_id).filter((id): id is string => !!id))]
      .map(id => ({ id, name: clientLabel(id) })).sort((a, b) => a.name.localeCompare(b.name, "pt")),
    carriers: [...new Set(rows.map(carrierName))].sort(),
    services: [...new Set(rows.map(s => s.service_type || "Serviço não identificado"))].sort(),
  }
  const totals = { ...blankGroup("total", "Todos os envios"), inTransit: 0, pending: 0, returned: 0, other: 0, missingCostCount: 0, missingSellCount: 0 }
  const excluded = { drafts: 0, cancelled: 0 }
  const carrierGroups = new Map<string, ReportGroup>(), clientGroups = new Map<string, ReportGroup>(), serviceGroups = new Map<string, ReportGroup>()
  const timeline = new Map<string, { date: string; volume: number; margin: number; pricedCount: number }>()
  for (let day = reportDay(new Date(range.start)); day <= reportDay(now); day = shiftDay(day, 1)) timeline.set(day, { date: day, volume: 0, margin: 0, pricedCount: 0 })
  for (const shipment of rows) {
    const carrier = carrierName(shipment), service = shipment.service_type || "Serviço não identificado"
    if (filters.clientId && shipment.client_id !== filters.clientId) continue
    if (filters.carrier && carrier !== filters.carrier) continue
    if (filters.service && service !== filters.service) continue
    const at = Date.parse(shipment.created_at)
    const current = at >= Date.parse(range.start)
    const previous = at >= Date.parse(range.previousStart) && at < Date.parse(range.previousEnd)
    if (!current && !previous) continue
    if (shipment.status === "rascunho") { if (current) excluded.drafts++; continue }
    if (["anulado", "cancelado"].includes(shipment.status)) { if (current) excluded.cancelled++; continue }
    const clientId = shipment.client_id || "unassigned"
    const getGroup = (map: Map<string, ReportGroup>, id: string, name = id) => {
      if (!map.has(id)) map.set(id, blankGroup(id, name))
      return map.get(id)!
    }
    const groups = [totals, getGroup(carrierGroups, carrier), getGroup(clientGroups, clientId, clientLabel(clientId)), getGroup(serviceGroups, service)]
    if (previous) { for (const group of groups) group.previousVolume++; continue }
    for (const group of groups) addShipment(group, shipment)
    if (["entrada_rede", "em_transito", "recolhido", "em_distribuicao"].includes(shipment.status)) totals.inTransit++
    else if (["pendente", "emitido"].includes(shipment.status)) totals.pending++
    else if (shipment.status === "devolvido") totals.returned++
    else if (!["entregue", "entregue_pudo", "incidencia", "com_incidencia"].includes(shipment.status)) totals.other++
    if (moneyCents(shipment.buy_price) === null) totals.missingCostCount++
    if (moneyCents(shipment.sell_price) === null) totals.missingSellCount++
    const day = timeline.get(reportDay(new Date(shipment.created_at)))!
    day.volume++
    const sell = moneyCents(shipment.sell_price), cost = moneyCents(shipment.buy_price)
    if (sell !== null && cost !== null) { day.margin += sell - cost; day.pricedCount++ }
  }
  const sortedGroups = (groups: Map<string, ReportGroup>) => [...groups.values()].map(finishGroup).sort((a, b) => b.volume - a.volume || a.name.localeCompare(b.name, "pt"))
  const report: OperationalReport = {
    filters, updatedAt: now.toISOString(), range, totals: finishGroup(totals), excluded,
    carriers: sortedGroups(carrierGroups), clients: sortedGroups(clientGroups), services: sortedGroups(serviceGroups),
    timeline: [...timeline.values()].map(day => ({ ...day, margin: day.margin / 100 })), options, suggestions: [],
  }
  const suggestion = (item: ReportSuggestion) => report.suggestions.push(item)
  if (totals.missingCostCount || totals.missingSellCount) suggestion({
    id: "missing-prices", priority: "atenção", title: "Confirmar preços em falta",
    detail: `${totals.missingCostCount} envios sem custo válido e ${totals.missingSellCount} sem preço de venda válido. A margem cobre ${totals.pricedCount} de ${totals.volume} envios.`,
    action: "Consultar envios", href: "/ops/envios",
  })
  if (totals.negativeMarginCount) suggestion({
    id: "negative-margin", priority: "atenção", title: "Rever envios com margem negativa",
    detail: `${totals.negativeMarginCount} envios têm preço de venda inferior ao custo guardado. Confirma os custos e as tabelas aplicadas antes de alterar preços.`,
    action: "Consultar envios", href: "/ops/envios",
  })
  if (totals.incidents) suggestion({
    id: "incidents", priority: "atenção", title: "Acompanhar incidências abertas",
    detail: `${totals.incidents} envios criados neste período estão atualmente em incidência. Verifica os motivos e o acompanhamento necessário.`,
    action: "Ver incidências", href: "/ops/incidencias",
  })
  const drops = report.clients.filter(c => c.id !== "unassigned" && names.has(c.id) && c.previousVolume >= 5 && c.volume <= c.previousVolume * 0.7)
  if (drops.length) suggestion({
    id: "client-decline", priority: "oportunidade", title: "Acompanhar clientes com menos atividade",
    detail: `${drops.length} clientes reduziram os envios em pelo menos 30%, face ao período comparável, com pelo menos 5 envios anteriores. Exemplos: ${drops.slice(0, 3).map(c => c.name).join(", ")}. Uma descida não confirma perda do cliente.`,
    action: "Consultar clientes", href: "/ops/entidades/clientes",
  })
  const leaders = report.clients.filter(c => names.has(c.id) && c.volume >= 5 && c.pricedCount === c.volume && c.margin > 0).sort((a, b) => b.margin - a.margin)
  if (leaders.length) suggestion({
    id: "client-opportunity", priority: "oportunidade", title: "Preparar acompanhamento comercial",
    detail: `${leaders[0].name} tem ${leaders[0].volume} envios e ${leaders[0].margin.toFixed(2)} € de margem estimada neste período. Pode ser um candidato para uma conversa sobre necessidades e novos serviços.`,
    action: "Consultar clientes", href: "/ops/entidades/clientes",
  })
  return report
}
