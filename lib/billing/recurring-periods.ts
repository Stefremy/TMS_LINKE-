export const BILLING_TIMEZONE = "Europe/Lisbon"
export const BILLING_CYCLE_DAYS = [1, 7, 15, 30, 45, 60, 90] as const

export interface RecurringClient {
  id: string
  tenant_id?: string
  short_name?: string
  legal_name?: string
  billing_type?: string
  payment_terms?: string
  billing_email?: string
  email?: string
  nif?: string
  address?: string
  city?: string
  created_at?: string
  is_active?: boolean
}

export interface PeriodShipment {
  id: string
  client_id: string
  tenant_id?: string
  created_at: string
  status: string
  sell_price: string | number | null
  tracking_number?: string
  service_type?: string
  recipient_name?: string
  recipient_address?: string
  billing_statement_id?: string | null
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

export function lisbonDate(value: Date | string = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BILLING_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value))
  const part = (type: string) => parts.find(p => p.type === type)?.value
  return `${part("year")}-${part("month")}-${part("day")}`
}

export function addCalendarDays(date: string, days: number): string {
  if (!isDateKey(date) || !Number.isInteger(days)) throw new Error("Data de período inválida.")
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

/** Explicitly configured terms only. Pronto Pagamento closes daily. */
export function cycleDaysForTerms(terms?: string): number | null {
  const normalized = (terms || "").trim().toLocaleLowerCase("pt-PT")
  if (normalized === "pronto pagamento") return 1
  const match = normalized.match(/^a\s+(7|15|30|45|60|90)\s+dias$/)
  return match ? Number(match[1]) : null
}

export function eligibleRecurringClient(client: RecurringClient) {
  return client.billing_type === "conta_corrente" && client.is_active !== false
}

export function billingRecipient(client: RecurringClient): string | null {
  const candidate = (client.billing_email || client.email || "").trim()
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(candidate) ? candidate : null
}

export function periodLabel(start: string, endExclusive: string): string {
  const format = (date: string) => date.split("-").reverse().join("/")
  return `${format(start)} a ${format(addCalendarDays(endExclusive, -1))}`
}

export function periodForClient(client: RecurringClient, activationDate: string, lastEnd?: string | null) {
  const days = cycleDaysForTerms(client.payment_terms)
  if (!days || !isDateKey(activationDate)) return null
  const created = client.created_at ? lisbonDate(client.created_at) : activationDate
  const start = lastEnd || (created > activationDate ? created : activationDate)
  return { start, end: addCalendarDays(start, days), days }
}

export function selectPeriodShipments(
  clientId: string, tenantId: string, start: string, end: string,
  shipments: PeriodShipment[], invoicedIds: Set<string>,
) {
  return shipments.filter(s => s.client_id === clientId && (!s.tenant_id || s.tenant_id === tenantId)
    && !["rascunho", "anulado", "cancelado", "cancelled", "canceled", "draft"].includes(s.status)
    && !s.billing_statement_id && !invoicedIds.has(s.id)
    && lisbonDate(s.created_at) >= start && lisbonDate(s.created_at) < end)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

export function shipmentTotal(shipments: Pick<PeriodShipment, "sell_price">[]) {
  return shipments.reduce((cents, shipment) => {
    const amount = shipment.sell_price === null ? NaN : Number(shipment.sell_price)
    if (!Number.isFinite(amount) || amount < 0) throw new Error("Há envios sem preço válido. Confirme os valores antes de fechar o período.")
    return cents + Math.round(amount * 100)
  }, 0) / 100
}

export function isBillingDeliveryHour(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: BILLING_TIMEZONE, hour: "2-digit", hourCycle: "h23" }).format(now))
  return hour >= 9 && hour < 19
}
