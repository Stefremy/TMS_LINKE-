'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Send, CheckCircle2, Clock, ExternalLink, Inbox } from 'lucide-react'
import { AnnouncementsComposer } from './AnnouncementsComposer'
import { Button } from '@/components/ui/button'
import type { ClientMessage, MessagePage } from '@/lib/client-messages/types'

function generateRequestUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function MessagesComposer({
  clients,
}: {
  clients: { id: string; name: string; portalSlug?: string | null }[]
}) {
  const [client, setClient] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  const [history, setHistory] = useState<ClientMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const request = useRef<string | null>(null)

  function edited() {
    request.current = null
    setSent('')
    setError('')
  }

  const loadHistory = useCallback(async (targetClientId: string, signal?: AbortSignal) => {
    if (!targetClientId) {
      setHistory([])
      return
    }
    setLoadingHistory(true)
    try {
      const response = await fetch(`/api/client-messages?clientId=${encodeURIComponent(targetClientId)}`, {
        cache: 'no-store',
        signal,
      })
      if (!response.ok) return
      const data: MessagePage = await response.json()
      if (!signal?.aborted) {
        setHistory(data.messages || [])
      }
    } catch {
      // Keep composer usable even if history fetch is interrupted.
    } finally {
      if (!signal?.aborted) setLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadHistory(client, controller.signal)
    return () => controller.abort()
  }, [client, loadHistory])

  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setSent('')
    request.current ||= generateRequestUuid()
    try {
      const response = await fetch('/api/client-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          clientId: client,
          title,
          body,
          requestId: request.current,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível enviar o aviso.')
      const selected = clients.find((c) => c.id === client)
      setSent(selected?.name || 'cliente')
      setTitle('')
      setBody('')
      request.current = null
      await loadHistory(client)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o aviso.')
    } finally {
      setBusy(false)
    }
  }

  const selectedClient = clients.find((c) => c.id === client)
  const field =
    'mt-1.5 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] focus:outline-2 focus:outline-[var(--accent)] disabled:opacity-60'

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-6">
      <header className="border-b border-[var(--border-subtle)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          Mensagens aos clientes
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Envie um aviso diretamente para o painel e caixa de mensagens da Área do Cliente.
        </p>
      </header>

      <AnnouncementsComposer clients={clients} />

      <form
        onSubmit={send}
        className="space-y-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 sm:p-6"
      >
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Novo aviso</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            A mensagem ficará no histórico da loja, aparecerá em destaque no Dashboard da Área do Cliente e no sino de notificações.
          </p>
        </div>

        <label className="block text-xs font-medium text-[var(--text-secondary)]">
          Cliente
          <select
            required
            disabled={busy}
            value={client}
            onChange={(e) => {
              edited()
              setClient(e.target.value)
            }}
            className={field}
          >
            <option value="">Selecionar cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-[var(--text-secondary)]">
          Assunto
          <input
            required
            maxLength={160}
            disabled={busy}
            value={title}
            onChange={(e) => {
              edited()
              setTitle(e.target.value)
            }}
            className={field}
            placeholder="Ex.: Alteração do horário de recolhas"
          />
        </label>

        <label className="block text-xs font-medium text-[var(--text-secondary)]">
          Mensagem
          <textarea
            required
            maxLength={4000}
            rows={7}
            disabled={busy}
            value={body}
            onChange={(e) => {
              edited()
              setBody(e.target.value)
            }}
            className={field}
            placeholder="Escreva o aviso para o cliente…"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
          <span className="text-xs text-[var(--text-tertiary)]">
            {body.length} / 4000 caracteres · Aviso dentro do portal
          </span>
          <Button type="submit" disabled={busy || !client || !title.trim() || !body.trim()}>
            <Send aria-hidden="true" className="mr-2 h-4 w-4" />
            {busy ? 'A enviar…' : 'Enviar aviso'}
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-sm text-[var(--status-critical)]">
            {error}
          </p>
        )}

        {sent && (
          <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-[var(--status-success)]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Aviso enviado para {sent}.</span>
          </p>
        )}
      </form>

      {client && (
        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Inbox className="h-4 w-4 text-[var(--accent)]" />
                <span>Histórico na Área do Cliente · {selectedClient?.name}</span>
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Mensagens atualmente disponíveis na caixa de entrada desta loja.
              </p>
            </div>
            {selectedClient?.portalSlug && (
              <Link
                href={`/app/${encodeURIComponent(selectedClient.portalSlug)}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                <span>Abrir Área do Cliente</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {loadingHistory ? (
            <p className="text-xs text-[var(--text-tertiary)]">A carregar mensagens da loja…</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)]">
              Ainda não existem avisos enviados para esta loja.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] rounded-md border border-[var(--border-subtle)]">
              {history.slice(0, 10).map((msg) => (
                <div key={msg.id} className="p-3.5 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{msg.title}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--text-tertiary)]">
                      <Clock className="h-3 w-3" />
                      {new Date(msg.created_at).toLocaleString('pt-PT', {
                        timeZone: 'Europe/Lisbon',
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] whitespace-pre-line break-words">
                    {msg.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
