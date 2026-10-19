export interface BillingLog {
  id: string
  action: string
  created_at: string
  details: Record<string, unknown> | null
}
export interface BillingStatsClient { id: string; short_name?: string; legal_name?: string; nif?: string }
export interface BillingStatsCycle {
  invoice_document_id: number | string | null
  invoice_payload: { date?: string; expiration_date?: string } | null
}
export type InvoiceState = "paid" | "open" | "overdue"
export interface StatisticsInvoice {
  id: string; reference: string; clientKey: string; clientName: string; clientVat: string
  kind: "transport" | "custom"; issuedDate: string; dueDate: string | null
  amountCents: number | null; paid: boolean; state: InvoiceState; pdfUrl: string | null; receiptNeedsReview: boolean
}
export interface BillingStatisticsData {
  invoices: StatisticsInvoice[]; today: string; updatedAt: string
  coverage: { internal: number; duplicates: number; invalidDates: number; missingAmounts: number; registrationDates: number }
  cyclesUnavailable?: boolean
}
export interface BillingStatisticsFilters {
  start: string; end: string; client: string; state: "all" | InvoiceState
}
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
})
export function billingDay(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null
  }
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return null
  const parts = dayFormatter.formatToParts(parsed)
  const part = (name: string) => parts.find(p => p.type === name)!.value
  return `${part("year")}-${part("month")}-${part("day")}`
}
function cents(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim())) return null
  const amount = Number(value), result = Math.round(amount * 100)
  return Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(result) ? result : null
}
function text(value: unknown): string { return typeof value === "string" ? value.trim() : "" }
function fiscalId(value: unknown): string | null {
  const id = typeof value === "string" || typeof value === "number" ? Number(value) : NaN
  return Number.isSafeInteger(id) && id > 0 ? String(id) : null
}
function pdfUrl(value: unknown): string | null {
  try {
    const url = new URL(text(value))
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null
  } catch { return null }
}
function receiptMatchesInvoice(receipt: string, invoice: string, id: string): boolean {
  if (!receipt) return false
  if (receipt === invoice) return true
  try {
    const receiptUrl = new URL(receipt)
    return receiptUrl.hostname === "www.moloni.pt" || receiptUrl.hostname === "moloni.pt"
      ? fiscalId(receiptUrl.searchParams.get("d")) === id : false
  } catch { return false }
}
function netAmount(log: BillingLog): number | null {
  const details = log.details!
  // Transport statements store the pre-tax selling value. Custom invoices also store their gross total.
  if (log.action === "billing_statement") return cents(details.total_value)
  const net = cents(details.total_net)
  if (net !== null) return net
  const gross = cents(details.total_value), tax = cents(details.total_tax)
  return gross !== null && tax !== null && gross >= tax ? gross - tax : null
}

/** One row per confirmed fiscal invoice, using only the current company's stored records. */
export function normalizeBillingStatistics(logs: BillingLog[], clients: BillingStatsClient[], cycles: BillingStatsCycle[] = [], now = new Date()): BillingStatisticsData {
  const today = billingDay(now.toISOString())!
  const coverage = { internal: 0, duplicates: 0, invalidDates: 0, missingAmounts: 0, registrationDates: 0 }
  const byClient = new Map(clients.map(client => [client.id, client]))
  const byCycle = new Map(cycles.map(cycle => [fiscalId(cycle.invoice_document_id), cycle.invoice_payload]))
  const seenRecords = new Set<string>(), seenFiscal = new Set<string>()
  const invoices: StatisticsInvoice[] = []
  // Stable ordering also keeps the same authoritative row when the timestamps match.
  const ordered = [...logs].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
  for (const log of ordered) {
    const d = log.details
    if (!d || !["billing_statement", "custom_invoice"].includes(log.action)) continue
    const recordKey = `${log.action}:${text(d.id) || log.id}`
    if (seenRecords.has(recordKey)) { coverage.duplicates++; continue }
    seenRecords.add(recordKey)
    const id = fiscalId(d.moloni_document_id)
    if (!id) { coverage.internal++; continue }
    // Reserve the ID before filtering: an older active duplicate cannot revive a cancelled/pro-forma record.
    if (seenFiscal.has(id)) { coverage.duplicates++; continue }
    seenFiscal.add(id)
    const state = text(d.status).toLowerCase()
    if (d.is_pro_forma === true || d.is_pro_forma === "true" || ["cancelled", "canceled", "anulado", "anulada", "void"].includes(state)) {
      coverage.internal++; continue
    }
    const cycle = byCycle.get(id)
    const actualDate = billingDay(d.invoice_date) || billingDay(cycle?.date) || billingDay(d.moloni_invoiced_at)
    const issuedDate = actualDate || billingDay(d.created_at) || billingDay(log.created_at)
    if (!issuedDate) { coverage.invalidDates++; continue }
    if (!actualDate) coverage.registrationDates++
    const dueDate = billingDay(d.due_date) || billingDay(d.expiration_date) || billingDay(cycle?.expiration_date)
    const amountCents = netAmount(log)
    if (amountCents === null) coverage.missingAmounts++
    const clientId = text(d.client_id)
    const client = byClient.get(clientId)
    const vat = client?.nif || text(d.client_vat)
    const name = client?.short_name || client?.legal_name || text(d.client_name) || "Cliente não identificado"
    // Anonymous/consumer VAT identifiers are not safe identities for grouping different clients.
    const usableVat = /^\d{9}$/.test(vat) && !["999999990", "000000000"].includes(vat)
    const clientKey = clientId ? `client:${clientId}` : usableVat ? `vat:${vat}` : `unassigned:${id}`
    const receipt = text(d.moloni_receipt_pdf)
    const confirmedPaid = state === "paid" || Boolean(fiscalId(d.moloni_receipt_id))
    const receiptNeedsReview = !confirmedPaid && receiptMatchesInvoice(receipt, text(d.moloni_document_pdf), id)
    const paid = confirmedPaid || Boolean(receipt && !receiptNeedsReview)
    invoices.push({ id, reference: text(d.moloni_document_number) || text(d.invoice_number) || text(d.statement_number) || `Moloni #${id}`,
      clientKey, clientName: name, clientVat: vat, kind: log.action === "custom_invoice" ? "custom" : "transport",
      issuedDate, dueDate, amountCents, paid, state: paid ? "paid" : dueDate && dueDate < today ? "overdue" : "open",
      pdfUrl: pdfUrl(d.moloni_document_pdf), receiptNeedsReview })
  }
  return { invoices, today, updatedAt: now.toISOString(), coverage }
}

export function filterStatisticsInvoices(invoices: StatisticsInvoice[], filters: BillingStatisticsFilters): StatisticsInvoice[] {
  return invoices.filter(invoice => (!filters.start || invoice.issuedDate >= filters.start) && (!filters.end || invoice.issuedDate <= filters.end)
    && (!filters.client || invoice.clientKey === filters.client)
    && (filters.state === "all" || (filters.state === "open" ? !invoice.paid : invoice.state === filters.state)))
}

export function summarizeBillingStatistics(invoices: StatisticsInvoice[], today: string, start: string, end: string) {
  const totals = { billed: 0, paid: 0, open: 0, overdue: 0, count: invoices.length, missingAmounts: 0 }
  const aging = [
    { id: "not_due", label: "Por vencer / vence hoje", amount: 0, count: 0 },
    { id: "1_30", label: "1–30 dias", amount: 0, count: 0 },
    { id: "31_60", label: "31–60 dias", amount: 0, count: 0 },
    { id: "60_plus", label: "Mais de 60 dias", amount: 0, count: 0 },
    { id: "unknown", label: "Sem vencimento registado", amount: 0, count: 0 },
  ]
  const groups = new Map<string, { key: string; name: string; vat: string; count: number; billed: number; paid: number; open: number; overdue: number; missing: number }>()
  const months = new Map<string, { month: string; billed: number; paid: number; known: number; missing: number }>()
  const dates = invoices.map(invoice => invoice.issuedDate).sort()
  const firstMonth = (start || dates[0] || today).slice(0, 7), lastMonth = (end || dates.at(-1) || today).slice(0, 7)
  let cursor = `${firstMonth}-01`
  while (cursor.slice(0, 7) <= lastMonth) {
    months.set(cursor.slice(0, 7), { month: cursor.slice(0, 7), billed: 0, paid: 0, known: 0, missing: 0 })
    const date = new Date(`${cursor}T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1); cursor = date.toISOString().slice(0, 10)
  }
  for (const invoice of invoices) {
    let group = groups.get(invoice.clientKey)
    if (!group) { group = { key: invoice.clientKey, name: invoice.clientName, vat: invoice.clientVat, count: 0, billed: 0, paid: 0, open: 0, overdue: 0, missing: 0 }; groups.set(group.key, group) }
    group.count++
    const month = months.get(invoice.issuedDate.slice(0, 7))
    if (invoice.amountCents === null) { totals.missingAmounts++; group.missing++; if (month) month.missing++; continue }
    const amount = invoice.amountCents
    totals.billed += amount; group.billed += amount
    if (invoice.paid) { totals.paid += amount; group.paid += amount }
    else {
      totals.open += amount; group.open += amount
      if (invoice.state === "overdue") { totals.overdue += amount; group.overdue += amount }
      const days = invoice.dueDate ? Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${invoice.dueDate}T12:00:00Z`)) / 86400000) : null
      const bucket = aging[days === null ? 4 : days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : 3]
      bucket.amount += amount; bucket.count++
    }
    if (month) { month.billed += amount; month.known++; if (invoice.paid) month.paid += amount }
  }
  return { totals, aging, clients: [...groups.values()].sort((a, b) => b.open - a.open || b.billed - a.billed || a.name.localeCompare(b.name, "pt-PT")), months: [...months.values()] }
}

export function billingStatisticsCsv(invoices: StatisticsInvoice[]): string {
  const euro = (value: number | null) => value === null ? "Sem valor líquido registado" : (value / 100).toFixed(2).replace(".", ",")
  const rows = [["Fatura", "Cliente", "NIF", "Tipo", "Emissão / registo", "Vencimento", "Estado no TMS", "Valor sem IVA (EUR)", "Verificação do recibo"],
    ...invoices.map(i => [i.reference, i.clientName, i.clientVat, i.kind === "custom" ? "Avulsa" : "Transporte", i.issuedDate,
      i.dueDate || "Sem vencimento registado", i.state === "paid" ? "Liquidada" : i.state === "overdue" ? "Vencida" : "Por liquidar", euro(i.amountCents), i.receiptNeedsReview ? "O PDF do recibo coincide com a fatura; confirmar liquidação" : ""])]
  // Prevent spreadsheet formulas in user-authored client names and references.
  return "\uFEFF" + rows.map(row => row.map(value => {
    const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value
    return `"${safe.replace(/"/g, '""')}"`
  }).join(";")).join("\r\n")
}
