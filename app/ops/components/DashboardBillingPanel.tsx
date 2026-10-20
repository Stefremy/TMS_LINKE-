import Link from "next/link"
import { CheckCircle2, Clock, FileText, AlertTriangle } from "lucide-react"
import type { StatisticsInvoice } from "@/lib/billing/statistics"

type BillingGroup = "billed" | "paid" | "open" | "overdue"
type BillingTotals = {
  billed: number
  paid: number
  open: number
  overdue: number
  count: number
  missingAmounts: number
}
type Props = {
  totals: BillingTotals | null
  recent: Record<BillingGroup, StatisticsInvoice[]>
}
const money = (cents: number) => (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })
const dateLabel = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("pt-PT", { timeZone: "UTC" })

export function DashboardBillingPanel({ totals, recent }: Props) {
  const metrics = [
    { id: "billed", label: "Faturado", note: totals ? totals.count + " fatura(s) registada(s)" : "Não foi possível carregar a faturação", color: "#155EEF", Icon: FileText },
    { id: "paid", label: "Liquidado no TMS", note: "Recibo ou estado pago registado", color: "#008A4B", Icon: CheckCircle2 },
    { id: "open", label: "Por liquidar", note: "Sem liquidação registada", color: "#007F8B", Icon: Clock },
    { id: "overdue", label: "Vencido", note: "Prazo registado anterior a hoje", color: "#C2413B", Icon: AlertTriangle },
  ] as const
  const noKnownAmounts = Boolean(totals && totals.count > 0 && totals.missingAmounts === totals.count)

  return (
    <section aria-label="Resumo da faturação" className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
      <div className="grid flex-1 grid-cols-1 divide-y divide-[var(--border-subtle)]">
        {metrics.map(metric => {
          const value = !totals ? "Indisponível" : noKnownAmounts ? "Sem dados" : money(totals[metric.id])
          return (
            <section key={metric.id} aria-label={metric.label} className="min-w-0 border-l-4 px-3 py-1.5" style={{ borderLeftColor: metric.color }}>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[var(--text-secondary)]"><metric.Icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} /></span>
                  <div className="flex min-w-0 items-center gap-1.5" title={metric.note}>
                    <h3 className="truncate text-[11px] font-semibold text-[var(--text-secondary)]">{metric.label}</h3>
                    {metric.id === "billed" && totals && <span className="shrink-0 text-[10px] text-[var(--text-tertiary)]">({totals.count})</span>}
                    <span className="sr-only">{metric.note}</span>
                  </div>
                </div>
                <p className="shrink-0 text-right text-sm font-bold tabular-nums text-[var(--text-primary)]">{value}</p>
              </div>
              {totals && (
                <div className="mt-1 border-t border-dashed border-[var(--border-subtle)]">
                  {recent[metric.id].length ? (
                    <ul aria-label={"Últimas três faturas: " + metric.label} className="divide-y divide-[var(--border-subtle)]">
                      {recent[metric.id].slice(0, 3).map(invoice => (
                        <li key={invoice.id}>
                          <a
                            href={invoice.pdfUrl || "/ops/faturacao/estatistica"}
                            target={invoice.pdfUrl ? "_blank" : undefined}
                            rel={invoice.pdfUrl ? "noopener noreferrer" : undefined}
                            title={invoice.reference + " · " + invoice.clientName + " · " + dateLabel(invoice.issuedDate)}
                            aria-label={(invoice.pdfUrl ? "Abrir fatura " : "Consultar fatura ") + invoice.reference + " de " + invoice.clientName + ", emitida em " + dateLabel(invoice.issuedDate)}
                            className="flex min-w-0 items-center justify-between gap-2 rounded-sm py-0.5 leading-4 transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155EEF]"
                          >
                            <div className="flex min-w-0 items-baseline gap-1.5">
                              <span className="max-w-[65%] truncate text-[11px] font-semibold text-[#155EEF]">{invoice.reference}</span>
                              <span className="truncate text-[10px] text-[var(--text-tertiary)]">{invoice.clientName}</span>
                            </div>
                            <span className="shrink-0 text-[11px] font-medium tabular-nums text-[var(--text-primary)]">{invoice.amountCents === null ? "Sem dados" : money(invoice.amountCents)}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="py-0.5 text-[10px] text-[var(--text-tertiary)]">Sem faturas neste estado e período.</p>}
                </div>
              )}
            </section>
          )
        })}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 px-3 py-1.5">
        <p className="text-[9px] text-[var(--text-tertiary)]">Até 3 mais recentes por estado · Sem IVA</p>
        <Link href="/ops/faturacao/estatistica" className="shrink-0 text-[10px] font-medium text-[#155EEF] hover:underline">Ver todas</Link>
      </div>
    </section>
  )
}
