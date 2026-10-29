'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Info, Send, X } from 'lucide-react'
import type { ClientAnnouncement } from '@/lib/client-messages/announcements'

export function AnnouncementsComposer({ clients }: { clients: { id: string; name: string }[] }) {
  const [target, setTarget] = useState('all')
  const [level, setLevel] = useState<'info' | 'warning'>('warning')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [expires, setExpires] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [notices, setNotices] = useState<ClientAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const inFlight = useRef(false)
  const requestId = useRef<string | null>(null)
  const edited = () => { requestId.current = null; setError(''); setSuccess('') }
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/client-announcements?manage=1', { cache: 'no-store', signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os comunicados.')
      if (!signal?.aborted) setNotices(data.notices || [])
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Erro ao carregar comunicados.') }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [])
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => { void load(controller.signal) }, 0); return () => { clearTimeout(timer); controller.abort() } }, [load])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  async function publish(event: React.FormEvent) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError(''); setSuccess('')
    requestId.current ||= crypto.randomUUID()
    try {
      const expiry = expires ? new Date(expires).toISOString() : null
      const response = await fetch('/api/client-announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', requestId: requestId.current, title, body, level,
          target: target === 'all' ? 'all' : 'client', clientId: target === 'all' ? undefined : target, expiresAt: expiry }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível publicar o comunicado.')
      setSuccess(target === 'all' ? 'Comunicado publicado para todas as contas.' : 'Comunicado publicado para a loja selecionada.')
      setTitle(''); setBody(''); setExpires(''); requestId.current = null
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível publicar.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  async function withdraw(id: string) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError(''); setSuccess('')
    try {
      const response = await fetch('/api/client-announcements', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'withdraw', id }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível retirar a faixa.')
      setNotices(previous => previous.map(notice => notice.id === id ? { ...notice, active: false } : notice))
      setSuccess('Faixa retirada da Área do Cliente.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível retirar a faixa.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  const field = 'mt-1.5 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] px-3 py-2 text-sm text-[var(--text-primary)] disabled:opacity-60'
  return <section className="space-y-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 sm:p-6">
    <div><h2 className="text-sm font-semibold text-[var(--text-primary)]">Faixa no topo da Área do Cliente</h2>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">Publique um aviso ou informação com texto deslizante, visível em todas as páginas das contas escolhidas. Mantém-se até à data de fim ou até retirar a faixa.</p></div>
    <form onSubmit={publish} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Destinatários<select aria-label="Destinatários do comunicado" value={target} disabled={busy} onChange={e => { setTarget(e.target.value); edited() }} className={field}>
          <option value="all">Todas as contas</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select></label>
        <label className="text-xs font-medium text-[var(--text-secondary)]">Tipo<select aria-label="Tipo de comunicado" value={level} disabled={busy} onChange={e => { setLevel(e.target.value as 'info' | 'warning'); edited() }} className={field}>
          <option value="warning">Aviso</option><option value="info">Informação</option>
        </select></label>
      </div>
      <label className="block text-xs font-medium text-[var(--text-secondary)]">Título<input required maxLength={160} value={title} disabled={busy} onChange={e => { setTitle(e.target.value); edited() }} className={field} /></label>
      <label className="block text-xs font-medium text-[var(--text-secondary)]">Texto da faixa<textarea required maxLength={4000} rows={3} value={body} disabled={busy} onChange={e => { setBody(e.target.value); edited() }} className={field} /></label>
      <label className="block text-xs font-medium text-[var(--text-secondary)]">Data e hora de fim (opcional, hora local)<input type="datetime-local" value={expires} disabled={busy} onChange={e => { setExpires(e.target.value); edited() }} className={`${field} sm:max-w-xs`} /></label>
      {(title.trim() || body.trim()) && <div className={`flex gap-2 rounded-lg border p-3 text-sm ${level === 'warning' ? 'border-[#dfd0af] bg-[#faf6ec] text-[#725a35]' : 'border-[#d8e6db] bg-[#f3f8f4] text-[#3e5845]'}`}>
        {level === 'warning' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}<p className="break-words"><strong>{title}</strong>{title && body ? ' — ' : ''}{body}</p>
      </div>}
      <button type="submit" disabled={busy || !title.trim() || !body.trim()} className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" />{busy ? 'A processar…' : 'Publicar comunicado'}</button>
    </form>
    {error && <p role="alert" className="text-sm text-[var(--status-critical)]">{error}</p>}
    {success && <p role="status" className="text-sm text-[var(--status-success)]">{success}</p>}
    <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
      <h3 className="text-xs font-semibold text-[var(--text-primary)]">Comunicados publicados</h3>
      {loading ? <p className="text-xs text-[var(--text-secondary)]">A carregar…</p> : !notices.length && <p className="text-xs text-[var(--text-secondary)]">Ainda não existem comunicados.</p>}
      {notices.map(notice => <div key={notice.id} className="flex items-start justify-between gap-3 rounded-md border border-[var(--border-subtle)] p-3">
        <div className="min-w-0"><p className="break-words text-xs font-semibold">{notice.level === 'warning' ? 'Aviso' : 'Informação'} · {notice.title}</p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{notice.target === 'all' ? 'Todas as contas' : clients.find(c => c.id === notice.clientId)?.name || 'Loja'} · {!notice.active ? 'Retirado' : notice.expiresAt && Date.parse(notice.expiresAt) <= now ? 'Expirado' : 'Ativo'}{notice.expiresAt ? ` · Até ${new Date(notice.expiresAt).toLocaleString('pt-PT')}` : ''}</p>
          <details className="mt-1 text-xs text-[var(--text-secondary)]"><summary className="cursor-pointer">Ver texto</summary><p className="mt-1 whitespace-pre-wrap break-words">{notice.body}</p></details></div>
        {notice.active && <button type="button" disabled={busy} onClick={() => withdraw(notice.id)} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-1 text-xs disabled:opacity-50"><X className="h-3 w-3" />Retirar faixa</button>}
      </div>)}
    </div>
  </section>
}
