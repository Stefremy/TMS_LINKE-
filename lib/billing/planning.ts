import { billingDay, invoiceOutstandingCents, type BillingStatisticsData } from './statistics'
import { periodLabel } from './recurring-periods'
import type { RecurringPreview } from './recurring-statements'

export type PlanningBucket = 'overdue' | 'payment_soon' | 'billing_due' | 'billing_soon' | 'invoice_unknown' | 'cycle_unknown' | 'later'
export interface BillingPlanningRow {
  id: string; kind: 'invoice' | 'billing'; clientName: string; reference: string
  date: string | null; days: number | null; amountCents: number | null; bucket: PlanningBucket
  pdfUrl?: string | null; note?: string
}
export function calendarDaysUntil(date: string, today: string): number {
  if (billingDay(date) !== date || billingDay(today) !== today) throw new Error('Data de planeamento inválida.')
  return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000)
}
export function countdownLabel(days: number | null): string {
  return days === null ? 'Sem data registada' : days < 0 ? `Há ${-days} dia${days === -1 ? '' : 's'}`
    : days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `Daqui a ${days} dias`
}

/** Read-only planning: invoice maturity and billing-cycle closure are separate events, even with automation off. */
export function buildBillingPlanning(statistics: BillingStatisticsData | null, preview: RecurringPreview, today: string, horizon = 7): BillingPlanningRow[] {
  if (billingDay(today) !== today || ![3,7,15,30].includes(horizon)) throw new Error('Intervalo de planeamento inválido.')
  const rows: BillingPlanningRow[] = []
  for (const invoice of statistics?.invoices || []) {
    if (invoice.paid || invoice.state === 'credited') continue
    const amountCents = invoiceOutstandingCents(invoice)
    if (amountCents === 0) continue
    const date = billingDay(invoice.dueDate), days = date ? calendarDaysUntil(date, today) : null
    rows.push({ id: `invoice:${invoice.id}`, kind: 'invoice', clientName: invoice.clientName, reference: invoice.reference,
      date, days, amountCents, pdfUrl: invoice.pdfUrl,
      bucket: days === null ? 'invoice_unknown' : days < 0 ? 'overdue' : days <= horizon ? 'payment_soon' : 'later',
      note: invoice.receiptNeedsReview ? 'Recibo por confirmar' : undefined })
  }
  if (preview.ready) for (const client of preview.clients) {
    if (client.error || !client.start || !client.end) {
      rows.push({ id: `billing:${client.id}`, kind: 'billing', clientName: client.name, reference: 'Ciclo de faturação por definir',
        date: null, days: null, amountCents: null, bucket: 'cycle_unknown', note: client.error || 'Configure a frequência de faturação na ficha do cliente.' })
      continue
    }
    // Without shipments there is nothing to invoice; do not manufacture a pending task.
    if (client.shipmentCount === 0) continue
    const date = billingDay(client.end)
    if (!date) continue
    const days = calendarDaysUntil(date, today)
    rows.push({ id: `billing:${client.id}`, kind: 'billing', clientName: client.name, reference: periodLabel(client.start, client.end),
      date, days, amountCents: Number.isFinite(client.total) ? Math.round(client.total * 100) : null,
      bucket: days <= 0 ? 'billing_due' : days <= horizon ? 'billing_soon' : 'later',
      note: `Fecho do período · ${client.shipmentCount} envio${client.shipmentCount === 1 ? '' : 's'} por faturar` })
  }
  return rows.sort((a, b) => (a.date === null ? 1 : 0) - (b.date === null ? 1 : 0)
    || (a.date || '').localeCompare(b.date || '') || a.clientName.localeCompare(b.clientName, 'pt') || a.id.localeCompare(b.id))
}

export function filterBillingPlanning(rows: BillingPlanningRow[], filter: string, search = ''): BillingPlanningRow[] {
  const query = search.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-PT').trim()
  return rows.filter(row => {
    const matches = filter === 'all' || (filter === 'priority' ? ['overdue','payment_soon','billing_due','billing_soon'].includes(row.bucket)
      : filter === 'billing' ? ['billing_due','billing_soon'].includes(row.bucket) : row.bucket === filter)
    return matches && (!query || `${row.clientName} ${row.reference}`.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-PT').includes(query))
  })
}
