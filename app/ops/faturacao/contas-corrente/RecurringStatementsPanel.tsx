'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Mail, RefreshCw, ChevronDown } from 'lucide-react'
import type { RecurringPreview } from '@/lib/billing/recurring-statements'
import { periodLabel } from '@/lib/billing/recurring-periods'
import { configureRecurringStatementsAction, previewRecurringStatementsAction, sendRecurringTestEmailAction } from '@/app/actions/recurring-statements'
import { AnimatedDisclosure } from './AnimatedDisclosure'

export function RecurringStatementsPanel({ initialPreview, canManage }: { initialPreview: RecurringPreview; canManage: boolean }) {
  const router = useRouter()
  const [preview, setPreview] = useState(initialPreview)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(initialPreview.previewDate)
  const [testEmail, setTestEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState(false)
  async function perform(key: string, action: () => Promise<void>) {
    if (busy) return
    setBusy(key); setFeedback(''); setError(false)
    try { await action() }
    catch (reason) { setError(true); setFeedback(reason instanceof Error ? reason.message : 'Não foi possível concluir.') }
    finally { setBusy(null) }
  }
  return <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-2xs">
    <button type="button" aria-expanded={open} aria-controls="recurring-statements-settings" onClick={() => setOpen(!open)}
      className="w-full flex items-center gap-3 p-4 text-left rounded-xl hover:bg-[var(--surface-muted)] transition-colors">
      <span className="p-2 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><CalendarClock className="w-5 h-5" /></span>
      <span className="flex-1 min-w-0"><span className="block text-sm font-bold text-[var(--text-primary)]">Faturação automática por período</span>
        <span className="block text-xs text-[var(--text-secondary)] mt-0.5">Conta Corrente · {preview.enabled ? 'Ativos' : 'Por ativar'} · {preview.clients.length} clientes</span></span>
      <ChevronDown className={`w-4 h-4 text-[var(--text-secondary)] transition-transform motion-reduce:transition-none ${open ? '' : '-rotate-90'}`} />
    </button>
    <AnimatedDisclosure open={open} id="recurring-statements-settings">
      <div className="border-t border-[var(--border-subtle)] p-4 sm:p-5 space-y-4">
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">No fecho de cada período, é emitida a fatura Moloni e enviada por email com o extrato detalhado. A fatura fica pendente de pagamento, com a opção Emitir Recibo. Os envios anteriores à ativação continuam na faturação manual.</p>
        {!preview.ready && <p role="alert" className="text-sm text-[var(--status-warning)]">{preview.error}</p>}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">Simular fecho em
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="block mt-1 px-3 py-2 border border-[var(--border-subtle)] rounded-lg bg-[var(--surface-muted)] text-[var(--text-primary)]" />
          </label>
          <button disabled={!!busy || !date} type="button" onClick={() => perform('preview', async () => setPreview(await previewRecurringStatementsAction(date)))} className="inline-flex items-center gap-2 border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${busy === 'preview' ? 'animate-spin' : ''}`} />Pré-visualizar</button>
          <p className="text-[11px] text-[var(--text-tertiary)]">A simulação usa os envios já existentes e não envia emails.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {preview.clients.map(client => <div key={client.id} className="rounded-lg border border-[var(--border-subtle)] p-3 bg-[var(--surface-muted)]">
            <p className="text-xs font-bold text-[var(--text-primary)]">{client.name}</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1">{client.terms}{client.days === 1 ? ' · Extrato diário' : ''}</p>
            <p className="text-xs text-[var(--text-primary)] mt-2">{client.start && client.end ? periodLabel(client.start, client.end) : 'Condição por definir'}</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1">{client.shipmentCount} envios · {client.total.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
            <p className="text-[11px] text-[var(--text-secondary)] break-all mt-2">{client.recipient || 'Email de faturação em falta'}</p>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1">{client.error || (client.end ? `Fecho em ${client.end.split('-').reverse().join('/')} · ${client.due ? 'Período fechado na simulação' : 'Período em curso'}` : '')}</p>
          </div>)}
        </div>
        <p className="text-[11px] text-[var(--text-secondary)]">Verificação de hora a hora; envio entre as 09h e as 19h de Lisboa. Sem envios no período, não é enviado email. Os clientes Pay as You Go ficam excluídos.</p>
        {canManage && <div className="flex flex-col gap-4 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={!!busy || !preview.ready || (!preview.enabled && (!preview.emailConfigured || !preview.cronConfigured))}
              onClick={() => perform('configure', async () => {
                const result = await configureRecurringStatementsAction(!preview.enabled, preview.anchorDate)
                if (!result.success) throw new Error(result.error)
                setPreview(await previewRecurringStatementsAction(date))
                setFeedback(preview.enabled ? 'Envios automáticos suspensos.' : 'Automação ativada. As primeiras faturas e extratos serão enviados após o fecho de cada período.')
                router.refresh()
              })} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-bold disabled:opacity-50">
              {busy === 'configure' ? 'A guardar...' : preview.enabled ? 'Suspender envios automáticos' : 'Ativar ciclos a partir de hoje'}
            </button>
            <span className="text-[11px] text-[var(--text-secondary)]">Início dos ciclos: {preview.anchorDate.split('-').reverse().join('/')}</span>
          </div>
          {(!preview.emailConfigured || !preview.cronConfigured) && <p className="text-xs text-[var(--status-warning)]">{!preview.emailConfigured ? 'Serviço de email por configurar. ' : ''}{!preview.cronConfigured ? 'Agendamento por configurar. ' : ''}</p>}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">Email para teste
              <input type="email" autoComplete="email" placeholder="O teu email" value={testEmail} onChange={e => setTestEmail(e.target.value)} className="block mt-1 w-full sm:w-72 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)]" />
            </label>
            <button type="button" disabled={!!busy || !testEmail || !preview.emailConfigured} onClick={() => perform('test', async () => {
              const result = await sendRecurringTestEmailAction(testEmail)
              if (!result.success) throw new Error('error' in result ? result.error : 'Falha no teste.')
              setFeedback('message' in result ? result.message : 'Email de teste aceite.')
            })} className="inline-flex items-center gap-2 border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50"><Mail className="w-3.5 h-3.5" />{busy === 'test' ? 'A enviar...' : 'Enviar teste com PDF'}</button>
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)]">O teste contém dados fictícios, testa apenas a entrega do extrato e não emite faturas fiscais. É enviado apenas para o endereço indicado.</p>
        </div>}
        {feedback && <p role={error ? 'alert' : 'status'} className={`text-xs ${error ? 'text-[var(--status-warning)]' : 'text-[var(--accent)]'}`}>{feedback}</p>}
      </div>
    </AnimatedDisclosure>
  </section>
}
