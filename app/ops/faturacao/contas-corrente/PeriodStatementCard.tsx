'use client'

import { useState } from 'react'
import { CalendarDays, ChevronDown, FileText } from 'lucide-react'
import { periodLabel, lisbonDate } from '@/lib/billing/recurring-periods'
import type { PeriodStatement } from '@/lib/billing/recurring-statements'
import { AnimatedDisclosure } from './AnimatedDisclosure'

const emailLabels: Record<string, string> = { sent: 'Email aceite', pending: 'Email pendente', failed: 'Entrega pendente', processing: 'A processar email', blocked: 'Email por configurar', review_required: 'Entrega por confirmar' }

export function PeriodStatementCard({ statement, invoicedIds, onSelect }: {
  statement: PeriodStatement; invoicedIds: Set<string>; onSelect: (statement: PeriodStatement) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [error, setError] = useState('')
  const fullyInvoiced = statement.shipment_ids.length > 0 && statement.shipment_ids.every(id => invoicedIds.has(id))
  return <article className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)]">
    <button type="button" aria-expanded={open} aria-controls={`period-${statement.id}`} onClick={() => setOpen(!open)} className="w-full p-4 flex items-start gap-3 text-left">
      <span className="rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 p-2 shrink-0"><CalendarDays className="w-4 h-4" /></span>
      <span className="flex-1 min-w-0"><span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] block">Extrato do período</span>
        <span className="text-xs font-bold text-[var(--text-primary)] block mt-1">{periodLabel(statement.period_start, statement.period_end)}</span>
        <span className="text-[11px] text-[var(--text-secondary)] block mt-1">{statement.shipments_count} envios · {statement.total_value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
        <span className="text-[10px] text-[var(--text-tertiary)] block mt-1">{emailLabels[statement.email_status] || 'Email pendente'} · {fullyInvoiced ? 'Envios faturados' : 'Faturação manual disponível'}</span>
      </span><ChevronDown className={`w-4 h-4 shrink-0 text-[var(--text-secondary)] transition-transform motion-reduce:transition-none ${open ? '' : '-rotate-90'}`} />
    </button>
    <AnimatedDisclosure open={open} id={`period-${statement.id}`}>
      <div className="px-4 pb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <a href={`/api/period-statements/${encodeURIComponent(statement.id)}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] border border-[var(--border-subtle)] rounded-lg px-3 py-2"><FileText className="w-3.5 h-3.5" />Ver Extrato TMS Interno</a>
          {!fullyInvoiced && <button type="button" disabled={selecting} onClick={async () => {
            if (selecting) return
            setSelecting(true); setError('')
            try { await onSelect(statement) } catch { setError('Não foi possível selecionar os envios deste período.') } finally { setSelecting(false) }
          }} className="text-xs font-semibold rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[var(--text-primary)] disabled:opacity-50">{selecting ? 'A selecionar...' : 'Selecionar envios para faturar'}</button>}
        </div>
        {error && <p role="alert" className="text-xs text-[var(--status-warning)]">{error}</p>}
        {statement.email_error && <p className="text-xs text-[var(--status-warning)]">{statement.email_error}</p>}
        <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
          {statement.shipments.map(shipment => <li key={shipment.id} className="py-2 flex flex-wrap gap-2 justify-between text-[11px] text-[var(--text-secondary)]">
            <span><strong className="font-mono text-[var(--text-primary)]">{shipment.tracking_number || shipment.id.slice(0, 8)}</strong><span className="ml-2">{lisbonDate(shipment.created_at).split('-').reverse().join('/')}</span><span className="block mt-0.5">{shipment.recipient_name || 'Destinatário'}</span></span>
            <span className="font-mono">{Number(shipment.sell_price).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</span>
          </li>)}
        </ul>
        <p className="text-[10px] text-[var(--text-tertiary)] font-mono break-all">{statement.statement_number}</p>
      </div>
    </AnimatedDisclosure>
  </article>
}
