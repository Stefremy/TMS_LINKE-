export const PICKUP_REQUEST_ACTION = "client_pickup_request"
export const PICKUP_REQUEST_PERMISSION = "Pedidos de Recolha & Distribuição"
export const PICKUP_REQUESTS_CHANGED_EVENT = "linke:pickup-requests-changed"
export const OPERATIONAL_NOTIFICATIONS_CHANGED_EVENT = "linke:operational-notifications-changed"

/** "23/11/2026, 14:05" em hora de Lisboa. */
export function formatPickupTimestamp(iso?: string) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return ""
  return new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}

/** Dia e período em que a recolha vai acontecer: o agendado na transportadora, ou o pedido pelo cliente. */
export function pickupWhen(request: { pickup: { date: string; period: string }; scheduled_date?: string; scheduled_period?: string }) {
  const date = request.scheduled_date || request.pickup.date, period = request.scheduled_period || request.pickup.period
  return { date, period, label: `${date.split("-").reverse().join("/")} · ${period.replace("-", " - ")}` }
}
