'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, ChevronDown, RefreshCw } from 'lucide-react'
import { AnimatedDisclosure } from './AnimatedDisclosure'
import type { BillingStatisticsData } from '@/lib/billing/statistics'
import type { RecurringPreview } from '@/lib/billing/recurring-statements'
import { lisbonDate } from '@/lib/billing/recurring-periods'
import { buildBillingPlanning, countdownLabel, filterBillingPlanning } from '@/lib/billing/planning'

export function BillingPlanningPanel({ statistics, statisticsError, recurring }: {
  statistics: BillingStatisticsData | null; statisticsError?: string; recurring: RecurringPreview
}) {
  const router = useRouter()
  const [today, setToday] = useState(statistics?.today || recurring.previewDate)
  const [horizon, setHorizon] = useState(7)
  const [filter, setFilter] = useState('priority')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const update = () => setToday(lisbonDate())
    update()
    const timer = setInterval(update, 60000)
    return () => clearInterval(timer)
  }, [])
  const rows = useMemo(() => buildBillingPlanning(statistics, recurring, today, horizon), [statistics, recurring, today, horizon])
  const filtered = useMemo(() => filterBillingPlanning(rows, filter, search), [rows, filter, search])
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10)), current = Math.min(page, pageCount)
  const visible = filtered.slice((current - 1) * 10, current * 10)
  const dateLabel = (date: string) => date.split('-').reverse().join('/')
  const money = (amount: number | null) => amount === null ? 'Sem valor registado' : (amount / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
  const cards = [
    { key: 'overdue', label: 'Faturas em atraso', count: rows.filter(r => r.bucket === 'overdue').length, color: '#9F433B' },
    { key: 'payment_soon', label: `Pagamentos: próximos ${horizon} dias`, count: rows.filter(r => r.bucket === 'payment_soon').length, color: '#936A32' },
    { key: 'billing', label: 'Faturação a preparar', count: rows.filter(r => r.bucket === 'billing_due' || r.bucket === 'billing_soon').length, color: '#315F48' },
    { key: 'invoice_unknown', label: 'Faturas sem vencimento', count: rows.filter(r => r.bucket === 'invoice_unknown').length, color: '#596575' },
  ]
  return <section className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]" aria-label="Agenda de faturação e pagamentos">
    <div className="flex items-center gap-2 px-3 py-2">
      <button type="button" aria-expanded={open} aria-controls="billing-planning-details" onClick={() => setOpen(!open)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-[var(--text-primary)]">
        <CalendarClock aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" />
        <h2 className="text-xs font-semibold">Agenda de faturação e pagamentos</h2>
        <span className="ml-auto hidden text-[10px] text-[var(--text-tertiary)] sm:block">{open ? 'Recolher' : 'Ver detalhes'}</span>
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)] transition-transform motion-reduce:transition-none ${open ? '' : '-rotate-90'}`} />
      </button>
      <button type="button" aria-label="Atualizar dados da agenda" title="Atualizar dados" onClick={() => router.refresh()}
        className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"><RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /></button>
    </div>
    <div className="grid grid-cols-2 divide-x divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] sm:grid-cols-4">
      {cards.map(card => <button key={card.key} type="button" aria-pressed={open && filter === card.key} onClick={() => { setFilter(card.key); setPage(1); setOpen(true) }}
        className="flex min-w-0 items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--surface-muted)]">
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-[var(--text-secondary)]"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: card.color }} /><span className="truncate">{card.label}</span></span>
        <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">{!statistics && card.key !== 'billing' || !recurring.ready && card.key === 'billing' ? '—' : card.count}</span>
      </button>)}
    </div>
    {statisticsError && <p role="alert" className="px-3 py-2 text-[11px] text-[#9F433B]">{statisticsError}</p>}
    {!recurring.ready && <p role="alert" className="px-3 py-2 text-[11px] text-[#936A32]">Não foi possível calcular os próximos dias de faturação. {recurring.error}</p>}
    <AnimatedDisclosure open={open} id="billing-planning-details">
    <div className="space-y-3 border-t border-[var(--border-subtle)] p-3">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <label>Mostrar <select value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }} className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5">
        <option value="priority">Prioridades</option><option value="overdue">Faturas em atraso</option><option value="payment_soon">Pagamentos próximos / hoje</option>
        <option value="billing">Faturação próxima / por emitir</option><option value="invoice_unknown">Faturas sem vencimento</option><option value="cycle_unknown">Clientes com ciclo por definir</option><option value="all">Todos os registos</option>
      </select></label>
      <label>Antecedência <select value={horizon} onChange={e => { setHorizon(Number(e.target.value)); setPage(1) }} className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2 py-1.5">
        {[3,7,15,30].map(days => <option key={days} value={days}>{days} dias</option>)}
      </select></label>
      <input aria-label="Pesquisar cliente ou fatura na agenda" placeholder="Cliente ou fatura…" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-1.5" />
    </div>
    <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="border-b border-[var(--border-subtle)] text-[var(--text-secondary)]"><tr>
      <th className="px-2 py-1.5">Cliente</th><th className="px-2 py-1.5">Fatura / Período</th><th className="px-2 py-1.5">Data</th><th className="px-2 py-1.5">Contagem</th><th className="px-2 py-1.5 text-right">Valor sem IVA</th><th className="px-2 py-1.5">Consultar</th>
    </tr></thead><tbody className="divide-y divide-[var(--border-subtle)]">
      {visible.map(row => <tr key={row.id} className="align-top"><td className="px-2 py-1.5 font-semibold">{row.clientName}</td><td className="px-2 py-1.5"><span className="block font-medium">{row.reference}</span><span className="mt-1 block text-[10px] text-[var(--text-secondary)]">{row.kind === 'invoice' ? 'Pagamento de fatura' : 'Faturação de envios'}{row.note ? ` · ${row.note}` : ''}</span></td>
        <td className="px-2 py-1.5 whitespace-nowrap">{row.date ? dateLabel(row.date) : 'Por definir'}</td>
        <td className="px-2 py-1.5 whitespace-nowrap"><span className="font-semibold" style={{ color: row.bucket === 'overdue' ? '#9F433B' : row.bucket === 'billing_due' ? '#936A32' : undefined }}>{countdownLabel(row.days)}</span>{row.bucket === 'billing_due' && <span className="mt-1 block text-[10px]">Período fechado — emitir manualmente</span>}</td>
        <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">{money(row.amountCents)}</td>
        <td className="px-2 py-1.5">{row.pdfUrl ? <a href={row.pdfUrl} target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] underline">Ver fatura</a> : row.kind === 'billing' && row.date ? <a href="#billing-pending" className="font-semibold text-[var(--accent)] underline">Ver contas correntes</a> : '—'}</td>
      </tr>)}
      {visible.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-[var(--text-secondary)]">Sem registos para este filtro.</td></tr>}
    </tbody></table></div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]"><p>{filtered.length} registos · Página {current} de {pageCount} · {dateLabel(today)} (Lisboa)</p><div className="flex gap-2">
      <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} className="rounded border border-[var(--border-subtle)] px-2 py-1 disabled:opacity-40">Anterior</button>
      <button type="button" disabled={current === pageCount} onClick={() => setPage(current + 1)} className="rounded border border-[var(--border-subtle)] px-2 py-1 disabled:opacity-40">Próxima</button>
    </div></div>
    <p className="text-[10px] text-[var(--text-tertiary)]">Vencimento: pagar faturas · Fecho do período: preparar faturação · Valores sem IVA e estados do TMS. Esta consulta não emite documentos nem envia emails.</p>
    </div>
    </AnimatedDisclosure>
  </section>
}
