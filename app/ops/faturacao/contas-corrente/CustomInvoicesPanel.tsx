'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Download, ExternalLink, FileText, Loader2, ReceiptText, X } from 'lucide-react'
import { notify } from '@/lib/notify'
import { lisbonDate } from '@/lib/billing/recurring-periods'
import { AnimatedDisclosure } from './AnimatedDisclosure'
import { CreditNoteButton } from '../notas-credito/components/CreditNoteButton'

export interface CustomInvoiceRow {
  audit_id?: string
  id: string
  client_id?: string | null
  invoice_number: string
  client_name: string
  client_vat?: string
  invoice_date: string
  due_date?: string
  total_value: number
  items: { title: string }[]
  items_count: number
  moloni_document_id?: number | null
  moloni_receipt_id?: number | string | null
  moloni_receipt_pdf?: string | null
  status?: string | null
  pdf_url: string
  credit_pending?: boolean
  credited_total?: number
  outstanding_value?: number
  credit_notes?: { id: string; number?: string; total?: number }[]
}

type Filter = 'open' | 'paid' | 'all'
type PaymentMethod = { payment_method_id: number; name: string }

const money = (value: number) => value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
const dateLabel = (date?: string) => date ? date.split('-').reverse().join('/') : '—'
const isPaid = (inv: CustomInvoiceRow) => inv.status === 'paid' || Boolean(inv.moloni_receipt_id || inv.moloni_receipt_pdf)
const outstanding = (inv: CustomInvoiceRow) => isPaid(inv) ? 0 : Number(inv.outstanding_value ?? inv.total_value ?? 0)
const credited = (inv: CustomInvoiceRow) => Number(inv.credited_total || 0) > 0
/** Fully credited: nothing left to receive, so it is closed without a receipt. */
const fullyCredited = (inv: CustomInvoiceRow) => !isPaid(inv) && credited(inv) && outstanding(inv) <= 0.005
const closed = (inv: CustomInvoiceRow) => isPaid(inv) || fullyCredited(inv)

/** Extra-service invoices (websites, consulting…) settled from the same conta corrente as logistics. */
export function CustomInvoicesPanel({ invoices, moloniConnected }: { invoices: CustomInvoiceRow[]; moloniConnected: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [filter, setFilter] = useState<Filter>('open')
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<CustomInvoiceRow | null>(null)
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [method, setMethod] = useState<number>(0)
  const [busy, setBusy] = useState<string | null>(null)

  const today = lisbonDate()
  const openInvoices = invoices.filter(inv => inv.moloni_document_id && !isPaid(inv) && outstanding(inv) > 0)
  const openTotal = openInvoices.reduce((sum, inv) => sum + outstanding(inv), 0)
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return invoices.filter(inv => filter === 'all' || (filter === 'paid' ? closed(inv) : !closed(inv)))
      .filter(inv => !term || [inv.invoice_number, inv.client_name, inv.client_vat, ...inv.items.map(i => i.title)]
        .some(value => String(value || '').toLowerCase().includes(term)))
  }, [invoices, filter, search])

  const startReceipt = async (inv: CustomInvoiceRow) => {
    if (!moloniConnected) { notify.error('Ligue o Moloni antes de emitir recibos.'); return }
    setBusy(inv.id)
    try {
      let value = outstanding(inv)
      if (Number(inv.credited_total || 0) > 0) {
        const { previewCreditAdjustedReceiptAction } = await import('@/app/actions/credit-notes')
        const preview = await previewCreditAdjustedReceiptAction({ id: inv.audit_id || inv.id, kind: 'custom_invoice' })
        if (!preview.success) { notify.error(preview.error); return }
        value = preview.data.remainingTotal
      }
      const { getMoloniPaymentMethodsAction } = await import('@/app/actions/moloni')
      const res = await getMoloniPaymentMethodsAction()
      const list = res.success ? res.methods : []
      setMethods(list)
      setMethod((list.find(m => /transfer[eê]ncia/i.test(m.name)) || list[0])?.payment_method_id || 0)
      setAmount(value); setDate(today); setNotes(''); setTarget(inv)
    } catch {
      notify.error('Não foi possível confirmar o valor por liquidar no Moloni. Tente novamente.')
    } finally { setBusy(null) }
  }

  const confirmReceipt = async () => {
    if (!target || busy) return
    setBusy(target.id)
    try {
      const { emitCustomInvoiceReceiptAction } = await import('@/app/actions/moloni')
      const res = await emitCustomInvoiceReceiptAction(target.audit_id || target.id,
        { date, paymentMethodId: method || undefined, notes: notes.trim() || undefined })
      if (!res.success) { notify.error(`Erro ao emitir recibo: ${res.error}`); return }
      notify.success(`Recibo emitido para ${target.invoice_number}.`)
      if (res.moloniReceiptPdf) window.open(res.moloniReceiptPdf, '_blank', 'noopener')
      setTarget(null)
      router.refresh()
    } finally { setBusy(null) }
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'open', label: 'Por liquidar', count: invoices.filter(inv => !closed(inv)).length },
    { key: 'paid', label: 'Liquidadas / creditadas', count: invoices.filter(closed).length },
    { key: 'all', label: 'Todas', count: invoices.length },
  ]

  return <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-2xs" aria-label="Faturas personalizadas">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="custom-invoices-content"
      className="w-full flex flex-wrap items-center gap-3 p-4 text-left">
      <span className="w-9 h-9 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-center shrink-0">
        <FileText aria-hidden="true" strokeWidth={1.75} className="w-4 h-4" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-[var(--text-primary)]">Faturas Personalizadas</span>
        <span className="block text-xs text-[var(--text-secondary)] mt-0.5">Serviços extra (websites, consultoria…), incluindo clientes fora da logística</span>
      </span>
      {openInvoices.length > 0 && <span className="text-xs font-semibold text-[var(--status-warning)] tabular-nums">
        {openInvoices.length} a aguardar recibo · {money(openTotal)}
      </span>}
      <ChevronDown aria-hidden="true" className={`w-4 h-4 text-[var(--text-secondary)] transition-transform motion-reduce:transition-none ${open ? '' : '-rotate-90'}`} />
    </button>

    <AnimatedDisclosure open={open} id="custom-invoices-content">
      <div className="px-4 pb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="flex flex-wrap gap-1">
            {filters.map(f => <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${filter === f.key
                ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[rgba(18,138,71,0.25)]'
                : 'text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--surface-muted)]'}`}>
              {f.label} <span className="tabular-nums opacity-70">{f.count}</span>
            </button>)}
          </div>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar cliente, NIF ou serviço"
            aria-label="Procurar faturas personalizadas"
            className="flex-1 min-w-[180px] rounded-md px-3 py-1.5 text-xs bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none" />
          <Link href="/ops/faturacao/personalizada" className="text-xs font-semibold text-[var(--accent)] hover:underline whitespace-nowrap">+ Nova fatura personalizada</Link>
        </div>

        {visible.length === 0 ? <p className="py-6 text-center text-xs text-[var(--text-tertiary)]">
          {invoices.length === 0 ? 'Ainda não há faturas personalizadas.' : 'Nenhuma fatura neste filtro.'}
        </p> : <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
          {visible.map(inv => {
            const paid = isPaid(inv), official = Boolean(inv.moloni_document_id)
            const overdue = !paid && official && inv.due_date && inv.due_date < today
            const due = outstanding(inv)
            return <li key={inv.audit_id || inv.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]">Personalizada</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-[var(--border-subtle)] bg-[var(--surface-muted)] ${inv.client_id ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                    {inv.client_id ? 'Cliente Linke' : 'Externo'}
                  </span>
                  {credited(inv) && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--status-warning)]"
                    title={(inv.credit_notes || []).map(n => `${n.number || 'NC'} · ${money(Number(n.total || 0))}`).join('\n')}>
                    {fullyCredited(inv) ? 'Creditada' : 'Crédito parcial'}
                  </span>}
                  <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{inv.client_name}</span>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] mt-1 truncate">
                  <span className="font-mono">{inv.invoice_number}</span>
                  {inv.client_vat && <> · NIF {inv.client_vat}</>}
                  {inv.items[0] && <> · {inv.items[0].title}{inv.items_count > 1 && ` (+${inv.items_count - 1})`}</>}
                </p>
                <p className="text-[11px] mt-0.5 text-[var(--text-tertiary)]">
                  Emitida {dateLabel(inv.invoice_date)} · Vence {dateLabel(inv.due_date)}
                  {' · '}
                  {paid ? <span className="font-semibold text-[var(--status-success)]">Paga</span>
                    : fullyCredited(inv) ? <span className="font-semibold text-[var(--text-secondary)]">Anulada por nota de crédito · sem recibo</span>
                    : !official ? <span className="font-semibold text-[var(--status-warning)]">Sem fatura Moloni</span>
                    : inv.credit_pending ? <span className="font-semibold text-[var(--status-warning)]">Nota de crédito por confirmar</span>
                    : overdue ? <span className="font-semibold text-[var(--status-danger,#9F433B)]">Em atraso</span>
                    : <span className="font-semibold text-[var(--status-warning)]">Aguardando recibo</span>}
                </p>
                {credited(inv) && <p className="text-[11px] mt-0.5 text-[var(--text-secondary)]">
                  Notas de crédito: {(inv.credit_notes || []).map(n => n.number || 'NC').join(', ') || '—'} · −{money(Number(inv.credited_total || 0))}
                </p>}
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums text-[var(--text-primary)]">{money(Number(inv.total_value || 0))}</div>
                  {!closed(inv) && official && Math.abs(due - Number(inv.total_value || 0)) > 0.005 &&
                    <div className="text-[10px] tabular-nums text-[var(--text-tertiary)]">por liquidar {money(due)}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {!paid && official && !inv.credit_pending && due > 0 && <button type="button" disabled={busy !== null} onClick={() => startReceipt(inv)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-[var(--accent)] text-white disabled:opacity-50">
                    {busy === inv.id ? <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" /> : <ReceiptText aria-hidden="true" strokeWidth={1.75} className="w-3.5 h-3.5" />}
                    Emitir Recibo
                  </button>}
                  {!closed(inv) && official && inv.client_id && <CreditNoteButton source={{ id: inv.audit_id || inv.id, kind: 'custom_invoice' }} />}
                  {inv.moloni_receipt_pdf && <a href={inv.moloni_receipt_pdf} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-[var(--border-subtle)] text-[var(--status-success)] hover:bg-[var(--surface-muted)]">
                    <Download aria-hidden="true" strokeWidth={1.75} className="w-3.5 h-3.5" /> Recibo
                  </a>}
                  <a href={`${inv.pdf_url}?inline=1`} target="_blank" rel="noopener noreferrer" title="Ver fatura"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">
                    <FileText aria-hidden="true" strokeWidth={1.75} className="w-3.5 h-3.5" /> Fatura <ExternalLink aria-hidden="true" className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </li>
          })}
        </ul>}
      </div>
    </AnimatedDisclosure>

    {target && <div className="tms-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="custom-receipt-title" className="tms-modal-scroll w-full max-w-md rounded-2xl bg-[var(--surface-bg)] border border-[var(--border-subtle)]" style={{ boxShadow: 'var(--shadow-layer)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <div>
            <h3 id="custom-receipt-title" className="font-semibold text-sm text-[var(--text-primary)]">Emitir Recibo</h3>
            <p className="text-xs text-[var(--text-tertiary)]">{target.invoice_number} · {target.client_name}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={() => setTarget(null)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
            <X aria-hidden="true" strokeWidth={1.75} className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-xl px-4 py-3 flex items-center justify-between bg-[var(--accent-soft)] border border-[rgba(18,138,71,0.15)]">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Valor a receber</span>
            <span className="text-base font-bold text-[var(--accent)]">{money(amount)}</span>
          </div>
          <label className="block">
            <span className="block text-xs font-semibold mb-1.5 text-[var(--text-primary)]">Data de Emissão</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none bg-[var(--surface-muted)] border border-[var(--border-strong)] text-[var(--text-primary)]" />
          </label>
          {methods.length > 0 && <label className="block">
            <span className="block text-xs font-semibold mb-1.5 text-[var(--text-primary)]">Método de Pagamento</span>
            <select value={method} onChange={e => setMethod(Number(e.target.value))}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none cursor-pointer bg-[var(--surface-muted)] border border-[var(--border-strong)] text-[var(--text-primary)]">
              {methods.map(m => <option key={m.payment_method_id} value={m.payment_method_id}>{m.name}</option>)}
            </select>
          </label>}
          <label className="block">
            <span className="block text-xs font-semibold mb-1.5 text-[var(--text-primary)]">Notas <span className="font-normal text-[var(--text-tertiary)]">(opcional)</span></span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none bg-[var(--surface-muted)] border border-[var(--border-strong)] text-[var(--text-primary)]" />
          </label>
        </div>
        <div className="flex items-center gap-3 px-6 pb-5 pt-4 border-t border-[var(--border-subtle)]">
          <button type="button" onClick={() => setTarget(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">Cancelar</button>
          <button type="button" onClick={confirmReceipt} disabled={busy !== null || !date}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[var(--accent)] text-white disabled:opacity-40">
            {busy ? 'A emitir…' : 'Emitir Recibo'}
          </button>
        </div>
      </div>
    </div>}
  </section>
}
