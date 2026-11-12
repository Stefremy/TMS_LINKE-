'use client'

import * as React from 'react'
import type { ShipmentRecord } from '@/lib/services/shipments/types'
import { canSelectCttCertificate, hasCttClosure, isCttShipment, type CttCertificateFilter } from '@/lib/services/ctt/certificate-status'

/** Selection survives paging, is reconciled against refreshed rows and belongs to one store. */
export function useCttCertificateSelection(shipments: ShipmentRecord[], scope: string) {
  const [state, setState] = React.useState<{ scope: string; ids: string[] }>({ scope, ids: [] })
  const [filter, setFilter] = React.useState<CttCertificateFilter>('all')
  const eligible = new Set(shipments.filter(canSelectCttCertificate).map(s => s.id))
  const selectedIds = state.scope === scope ? state.ids.filter(id => eligible.has(id)) : []
  const update = (change: (ids: string[]) => string[]) => setState(previous => ({ scope, ids: change(previous.scope === scope ? previous.ids.filter(id => eligible.has(id)) : []) }))
  const toggle = (id: string) => {
    if (!eligible.has(id)) return
    update(ids => ids.includes(id) ? ids.filter(value => value !== id) : ids.length < 100 ? [...ids, id] : ids)
  }
  const clear = () => setState({ scope, ids: [] })
  const togglePage = (page: ShipmentRecord[]) => {
    const ids = page.filter(canSelectCttCertificate).map(s => s.id)
    update(selected => ids.every(id => selected.includes(id)) ? selected.filter(id => !ids.includes(id)) : [...new Set([...selected, ...ids])].slice(0, 100))
  }
  return { selectedIds, toggle, togglePage, clear, filter, setFilter, available: shipments.some(isCttShipment) }
}

type Selection = ReturnType<typeof useCttCertificateSelection>

export function CttCertificateToolbar({ selection, page, busy, onGenerate }: { selection: Selection; page: ShipmentRecord[]; busy: boolean; onGenerate: () => void }) {
  if (!selection.available) return null
  const eligible = page.filter(canSelectCttCertificate)
  const allSelected = eligible.length > 0 && eligible.every(s => selection.selectedIds.includes(s.id))
  return <div className="flex flex-wrap items-center gap-3">
    <label className="flex min-h-9 items-center gap-2 text-xs font-medium text-[var(--text-primary)]">
      <input type="checkbox" aria-label="Selecionar envios CTT desta página" checked={allSelected} disabled={busy || !eligible.length} onChange={() => selection.togglePage(page)} className="h-4 w-4 accent-[var(--accent)]" />
      Selecionar CTT desta página
    </label>
    <span className="text-xs text-[var(--text-secondary)]">{selection.selectedIds.length} selecionados · máximo 100</span>
    {selection.selectedIds.length > 0 && <button type="button" disabled={busy} onClick={selection.clear} className="text-xs font-semibold text-[var(--text-secondary)] hover:underline disabled:opacity-50">Limpar seleção</button>}
    <button type="button" onClick={onGenerate} disabled={busy || !selection.selectedIds.length} className="rounded-md bg-[var(--accent)] px-3.5 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
      {busy ? 'A obter certificado...' : `Gerar certificado CTT (${selection.selectedIds.length})`}
    </button>
    <select aria-label="Filtrar pelo fecho CTT" value={selection.filter} onChange={event => selection.setFilter(event.target.value as CttCertificateFilter)} className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] px-3 py-2 text-xs text-[var(--text-primary)]">
      <option value="all">Fecho CTT: todos</option>
      <option value="open">CTT por fechar</option>
      <option value="closed">CTT já fechados</option>
    </select>
  </div>
}

export function CttCertificateCheckbox({ shipment, selection, busy }: { shipment: ShipmentRecord; selection: Selection; busy: boolean }) {
  if (!canSelectCttCertificate(shipment)) return null
  return <label className="inline-flex min-h-9 min-w-9 items-center justify-center">
    <input type="checkbox" checked={selection.selectedIds.includes(shipment.id)} disabled={busy || (!selection.selectedIds.includes(shipment.id) && selection.selectedIds.length >= 100)} onChange={() => selection.toggle(shipment.id)} aria-label={`Selecionar envio CTT ${shipment.tracking_number || shipment.id}`} className="h-4 w-4 accent-[var(--accent)]" />
  </label>
}

export function CttCertificateStatus({ shipment, busy, onDownload, onGenerate }: { shipment: ShipmentRecord; busy: boolean; onDownload: (id: string) => void; onGenerate?: (id: string) => void }) {
  if (!isCttShipment(shipment)) return null
  return <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
    {hasCttClosure(shipment) ? <>
      <span className="rounded border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 font-semibold text-[var(--accent)]">Fechado nos CTT</span>
      <button type="button" disabled={busy} onClick={() => onDownload(shipment.id)} className="font-semibold text-[var(--accent)] underline underline-offset-2 disabled:opacity-50">Certificado do lote</button>
    </> : onGenerate && canSelectCttCertificate(shipment)
      ? <button type="button" disabled={busy} onClick={() => onGenerate(shipment.id)} aria-label={`Gerar certificado CTT do envio ${shipment.tracking_number || shipment.id}`} className="font-semibold text-[var(--accent)] underline underline-offset-2 disabled:opacity-50">Gerar certificado</button>
      : <span className="text-[var(--text-secondary)]">Sem fecho CTT registado</span>}
  </div>
}
