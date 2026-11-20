"use client"

import { useCallback, useRef, useState } from "react"
import { FileText, X } from "lucide-react"
import { addCalendarDays, lisbonDate } from "@/lib/billing/recurring-periods"

export type IssueInvoiceRequest = {
  clientName: string
  /** Prefilled from the client record (or the company default); editable before issuing. */
  paymentDays: number
  details: { label: string; value: string }[]
}

const QUICK_DAYS = [0, 3, 15, 30, 60]
const dateLabel = (date: string) => date.split("-").reverse().join("/")

/** Promise-based confirmation: `await ask(request)` resolves to the chosen days, or null when cancelled. */
export function useIssueInvoiceDialog() {
  const [request, setRequest] = useState<IssueInvoiceRequest | null>(null)
  const [days, setDays] = useState("")
  const resolver = useRef<((days: number | null) => void) | null>(null)

  const ask = useCallback((next: IssueInvoiceRequest) => new Promise<number | null>(resolve => {
    resolver.current?.(null)
    resolver.current = resolve
    setDays(String(next.paymentDays))
    setRequest(next)
  }), [])

  const close = (value: number | null) => {
    resolver.current?.(value)
    resolver.current = null
    setRequest(null)
  }

  const parsed = Number(days)
  const valid = days.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= 365
  const today = lisbonDate()
  const changed = request !== null && valid && parsed !== request.paymentDays

  const dialog = request && (
    <div className="tms-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onKeyDown={e => { if (e.key === "Escape") close(null) }}>
      <form role="dialog" aria-modal="true" aria-labelledby="issue-invoice-title"
        onSubmit={e => { e.preventDefault(); if (valid) close(parsed) }}
        className="tms-modal-scroll w-full max-w-md rounded-2xl bg-[var(--surface-bg)] border border-[var(--border-subtle)]" style={{ boxShadow: "var(--shadow-layer)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-center shrink-0">
              <FileText aria-hidden="true" strokeWidth={1.75} className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 id="issue-invoice-title" className="font-semibold text-sm text-[var(--text-primary)]">Emitir Fatura Moloni</h3>
              <p className="text-xs text-[var(--text-tertiary)] truncate">{request.clientName}</p>
            </div>
          </div>
          <button type="button" aria-label="Fechar" onClick={() => close(null)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
            <X aria-hidden="true" strokeWidth={1.75} className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <dl className="rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)]">
            {request.details.map(row => <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
              <dt className="text-[var(--text-secondary)]">{row.label}</dt>
              <dd className="font-semibold text-[var(--text-primary)] text-right tabular-nums">{row.value}</dd>
            </div>)}
          </dl>

          <div>
            <label htmlFor="issue-invoice-days" className="block text-xs font-semibold mb-1.5 text-[var(--text-primary)]">Prazo para pagar (dias)</label>
            <div className="flex items-center gap-2">
              <input id="issue-invoice-days" type="number" inputMode="numeric" min={0} max={365} step={1} autoFocus
                value={days} onChange={e => setDays(e.target.value)} aria-invalid={!valid} aria-describedby="issue-invoice-due"
                className="w-24 rounded-xl px-3 py-2.5 text-sm font-semibold tabular-nums outline-none bg-[var(--surface-muted)] border border-[var(--border-strong)] text-[var(--text-primary)]" />
              <div className="flex flex-wrap gap-1">
                {QUICK_DAYS.map(d => <button key={d} type="button" onClick={() => setDays(String(d))} aria-pressed={valid && parsed === d}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${valid && parsed === d
                    ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[rgba(18,138,71,0.25)]"
                    : "text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--surface-muted)]"}`}>
                  {d === 0 ? "Pronto" : `${d}d`}
                </button>)}
              </div>
            </div>
            <p id="issue-invoice-due" className="text-[11px] mt-1.5 text-[var(--text-secondary)]">
              {valid
                ? <>Vence a <strong className="text-[var(--text-primary)]">{dateLabel(addCalendarDays(today, parsed))}</strong>
                  {changed ? <> · ficha do cliente: {request.paymentDays} dias (não é alterada)</> : <> · prazo da ficha do cliente</>}</>
                : <span className="text-[var(--status-warning)]">Indique um número inteiro de 0 a 365 dias.</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 pb-5 pt-4 border-t border-[var(--border-subtle)]">
          <button type="button" onClick={() => close(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">Cancelar</button>
          <button type="submit" disabled={!valid} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white disabled:opacity-40">Emitir Fatura</button>
        </div>
      </form>
    </div>
  )

  return { ask, dialog }
}
