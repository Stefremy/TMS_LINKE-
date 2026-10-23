'use client'
import { useRef, useState } from 'react'
import { Send, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
export function MessagesComposer({ clients }: { clients: { id: string; name: string }[] }) {
  const [client, setClient] = useState(''), [title, setTitle] = useState(''), [body, setBody] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState('')
  const request = useRef<string | null>(null)
  function edited() { request.current = null; setSent(''); setError('') }
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setSent(''); request.current ||= crypto.randomUUID()
    try {
      const response = await fetch('/api/client-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', clientId: client, title, body, requestId: request.current }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Não foi possível enviar o aviso.')
      setSent(clients.find(c => c.id === client)?.name || 'cliente'); setTitle(''); setBody(''); request.current = null
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o aviso.') }
    finally { setBusy(false) }
  }
  const field = 'mt-1.5 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-2 focus:outline-[var(--accent)] disabled:opacity-60'
  return <div className="mx-auto flex max-w-[1000px] flex-col gap-6">
    <header className="border-b border-[var(--border-subtle)] pb-5"><h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">Mensagens aos clientes</h1><p className="mt-1 text-sm text-[var(--text-secondary)]">Envie um aviso para a caixa de mensagens de uma loja.</p></header>
    <form onSubmit={send} className="space-y-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 sm:p-6">
      <div><h2 className="text-sm font-semibold text-[var(--text-primary)]">Novo aviso</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">A mensagem ficará no histórico da loja e aparecerá no sino da Área do Cliente.</p></div>
      <label className="block text-xs font-medium text-[var(--text-secondary)]">Cliente<select required disabled={busy} value={client} onChange={e => { edited(); setClient(e.target.value) }} className={field}><option value="">Selecionar cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="block text-xs font-medium text-[var(--text-secondary)]">Assunto<input required maxLength={160} disabled={busy} value={title} onChange={e => { edited(); setTitle(e.target.value) }} className={field} placeholder="Ex.: Alteração do horário de recolhas" /></label>
      <label className="block text-xs font-medium text-[var(--text-secondary)]">Mensagem<textarea required maxLength={4000} rows={7} disabled={busy} value={body} onChange={e => { edited(); setBody(e.target.value) }} className={field} placeholder="Escreva o aviso para o cliente…" /></label>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4"><span className="text-xs text-[var(--text-tertiary)]">{body.length} / 4000 caracteres · Aviso dentro do portal</span><Button type="submit" disabled={busy || !client || !title.trim() || !body.trim()}><Send aria-hidden="true" className="mr-2 h-4 w-4" />{busy ? 'A enviar…' : 'Enviar aviso'}</Button></div>
      {error && <p role="alert" className="text-sm text-[var(--status-critical)]">{error}</p>}{sent && <p role="status" className="flex items-center gap-2 text-sm text-[var(--status-success)]"><CheckCircle2 className="h-4 w-4" />Aviso enviado para {sent}.</p>}
    </form>
  </div>
}
