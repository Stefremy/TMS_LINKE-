'use client'

import { useState } from 'react'
import type { BillingViewSelection } from '@/lib/billing/view-filters'

export function BillingViewFilters({ initialSelection }: { initialSelection: BillingViewSelection }) {
  const [start, setStart] = useState(initialSelection.startDate)
  const [end, setEnd] = useState(initialSelection.endDate)
  return <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4">
    <h2 className="text-sm font-semibold text-[var(--text-primary)]">Filtros de Contas Correntes</h2>
    <p className="mt-1 text-xs text-[var(--text-secondary)]">Escolhe o período dos envios e o formato da fatura. Aplica-se à tua consulta, sem alterar a configuração das tuas colegas.</p>
    <form action="/ops/faturacao/contas-corrente" method="get" className="mt-3 flex flex-wrap items-end gap-3">
      <label className="text-xs text-[var(--text-secondary)]">Data Inicial
        <input type="date" name="from" value={start} max={end || undefined} onChange={e => setStart(e.target.value)} className="mt-1 block rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-primary)]" />
      </label>
      <label className="text-xs text-[var(--text-secondary)]">Data Final
        <input type="date" name="to" value={end} min={start || undefined} onChange={e => setEnd(e.target.value)} className="mt-1 block rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-primary)]" />
      </label>
      <label className="text-xs text-[var(--text-secondary)]">Formato da fatura
        <select name="grouping" defaultValue={initialSelection.grouping} className="mt-1 block rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-primary)]">
          <option value="grouped">Agrupada por serviço</option><option value="detailed">Detalhada por envio</option>
        </select>
      </label>
      <button type="submit" className="rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white">Aplicar e abrir Contas Correntes</button>
      <a href="/ops/faturacao/contas-corrente" className="py-2 text-xs font-medium text-[var(--text-secondary)] underline">Limpar filtros</a>
    </form>
  </section>
}
