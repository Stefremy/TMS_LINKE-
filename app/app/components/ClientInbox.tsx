"use client"

import * as React from "react"
import Link from "next/link"
import { 
  Inbox, 
  FileText, 
  CreditCard, 
  AlertTriangle, 
  Scale, 
  Info, 
  CheckCheck, 
  ExternalLink, 
  MailCheck,
  CheckCircle2,
  Clock
} from "lucide-react"
import type { ClientMessage, MessageKind, MessageSection } from "@/lib/client-messages/types"
import { RefreshIcon } from "@/components/ui/refresh-icon"
import { useClientMessageCounter } from "./ClientMessages"
import type { MessageCursor, MessagePage } from "@/lib/client-messages/types"
import { useClientScope } from "./ClientScope"

type Props = {
  initialMessages?: ClientMessage[]
  initialUnreadCount?: number
  initialNext?: MessageCursor | null
  initialError?: string
}

const KIND_CONFIG: Record<MessageKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  invoice: {
    label: "Faturação",
    icon: FileText,
  },
  payment: {
    label: "Pagamento",
    icon: CreditCard,
  },
  incident: {
    label: "Incidência",
    icon: AlertTriangle,
  },
  weight: {
    label: "Ajuste de Peso",
    icon: Scale,
  },
  info: {
    label: "Aviso",
    icon: Info,
  },
}

export function ClientInbox({ initialMessages = [], initialUnreadCount = 0, initialNext = null, initialError = "" }: Props) {
  const { client, basePath, isEmployee } = useClientScope()
  const counter = useClientMessageCounter()
  const [messages, setMessages] = React.useState<ClientMessage[]>(initialMessages)
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount)
  const [filter, setFilter] = React.useState<"all" | "unread" | "invoice" | "incident" | "payment" | "weight">("all")
  const [loading, setLoading] = React.useState(false)
  const [markingAll, setMarkingAll] = React.useState(false)
  const [next, setNext] = React.useState<MessageCursor | null>(initialNext)
  const [error, setError] = React.useState(initialError)
  const generation = React.useRef(0)

  const readPage = React.useCallback(async (cursor: MessageCursor | null, signal?: AbortSignal) => {
    const params = new URLSearchParams({ clientId: client.id })
    if (filter === "unread") params.set('unread', '1')
    else if (filter !== "all") params.set('kind', filter)
    if (cursor) { params.set('before', cursor.at); params.set('beforeId', cursor.id) }
    const response = await fetch(`/api/client-messages?${params}`, { cache: 'no-store', signal })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as mensagens.')
    return data as MessagePage
  }, [client.id, filter])

  const fetchMessages = React.useCallback(async () => {
    const request = ++generation.current
    setLoading(true)
    try {
      const data = await readPage(null)
      if (request !== generation.current) return
      setMessages(data.messages); setUnreadCount(data.unreadCount); setNext(data.next); setError('')
    } catch (cause) { if (request === generation.current) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as mensagens.') }
    finally { if (request === generation.current) setLoading(false) }
  }, [readPage])

  // Store-keyed layout remounts the inbox when changing stores. Filters are fetched on the server.
  const first = React.useRef(true)
  const invalidate = React.useCallback(() => { generation.current++ }, [])
  React.useEffect(() => {
    if (first.current) { first.current = false; return invalidate }
    void fetchMessages()
    return invalidate
  }, [fetchMessages, invalidate])

  async function more() {
    if (!next || loading) return
    const request = generation.current
    setLoading(true)
    try {
      const data = await readPage(next)
      if (request !== generation.current) return
      setMessages(previous => [...new Map([...previous, ...data.messages].map(m => [m.id, m])).values()])
      setUnreadCount(data.unreadCount); setNext(data.next); setError('')
    } catch (cause) { if (request === generation.current) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as mensagens.') }
    finally { if (request === generation.current) setLoading(false) }
  }

  const handleMarkAsRead = async (ids: string[]) => {
    if (!ids.length || markingAll) return
    const request = generation.current
    setMarkingAll(true)
    try {
      const response = await fetch('/api/client-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'read', clientId: client.id, ids }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível guardar a leitura.')
      if (request === generation.current) {
        const newlyRead = messages.filter(m => ids.includes(m.id) && !m.read_at).length
        setMessages(previous => previous.map(m => ids.includes(m.id) ? { ...m, read_at: m.read_at || new Date().toISOString() } : m))
        setUnreadCount(previous => Math.max(0, previous - newlyRead)); setError('')
      } else void fetchMessages()
      void counter?.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível guardar a leitura.') }
    finally { setMarkingAll(false) }
  }
  const handleMarkAllRead = () => handleMarkAsRead(messages.filter(m => !m.read_at).slice(0, 50).map(m => m.id))

  const filteredMessages = React.useMemo(() => {
    return messages.filter(m => {
      if (filter === "unread") return !m.read_at
      if (filter === "invoice") return m.kind === "invoice"
      if (filter === "incident") return m.kind === "incident"
      if (filter === "payment") return m.kind === "payment"
      if (filter === "weight") return m.kind === "weight"
      return true
    })
  }, [messages, filter])

  const getSectionUrl = (section: MessageSection, reference: string | null) => {
    if (!section) return null
    if (section === "faturas") return `${basePath}/faturas`
    if (section === "carregamentos") return `${basePath}/carregamentos`
    if (section === "envios") return `${basePath}/envios${reference ? `?search=${encodeURIComponent(reference)}` : ""}`
    return null
  }

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' })

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto font-sans">
      {/* Header Banner */}
      <div className="bg-[var(--surface-bg)] rounded-lg border border-[var(--border-subtle)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent)] shrink-0">
              <Inbox className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                  Caixa de Entrada
                </h1>
                {unreadCount > 0 && (
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-[var(--accent)] text-white">
                    {unreadCount} nova{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Comunicações operacionais, atualizações de faturas, carregamentos e alertas de pesagem.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll || loading}
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[rgba(0,0,0,0.05)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>{markingAll ? "A marcar..." : "Marcar estas como lidas"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchMessages}
            disabled={loading}
            className="p-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(0,0,0,0.05)] transition-all cursor-pointer disabled:opacity-50"
            title="Atualizar mensagens"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {isEmployee && <p className="text-xs text-[var(--text-secondary)]">Está a consultar esta loja. As suas leituras não alteram o estado de leitura do cliente.</p>}
      {error && <p role="alert" className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 text-sm text-[var(--status-critical)]">{error}</p>}
      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            filter === "all"
              ? "bg-[var(--accent)] text-white font-semibold shadow-2xs"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Todas
        </button>

        <button
          type="button"
          onClick={() => setFilter("unread")}
          className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
            filter === "unread"
              ? "bg-[var(--accent)] text-white font-semibold shadow-2xs"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <span>Não lidas</span>
          {unreadCount > 0 && (
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${filter === "unread" ? "bg-white text-[var(--accent)]" : "bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)]"}`}>
              {unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setFilter("invoice")}
          className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            filter === "invoice"
              ? "bg-[var(--accent)] text-white font-semibold shadow-2xs"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Faturas
        </button>

        <button
          type="button"
          onClick={() => setFilter("payment")}
          className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            filter === "payment"
              ? "bg-[var(--accent)] text-white font-semibold shadow-2xs"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Pagamentos
        </button>

        <button
          type="button"
          onClick={() => setFilter("incident")}
          className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            filter === "incident"
              ? "bg-[var(--accent)] text-white font-semibold shadow-2xs"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Incidências
        </button>

        <button
          type="button"
          onClick={() => setFilter("weight")}
          className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            filter === "weight"
              ? "bg-[var(--accent)] text-white font-semibold shadow-2xs"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Ajustes de Peso
        </button>
      </div>

      {/* Messages List or Empty State */}
      {filteredMessages.length === 0 ? (
        <div className="bg-[var(--surface-bg)] rounded-lg border border-[var(--border-subtle)] p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-md bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-tertiary)]">
            <MailCheck className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {filter === "unread" ? "Tudo em dia!" : "Caixa de entrada limpa"}
            </h3>
            <p className="text-xs text-[var(--text-tertiary)] max-w-sm">
              {filter === "unread" 
                ? "Não tem mensagens por ler. As notificações de faturas, pesagens e carregamentos aparecerão aqui."
                : "Ainda não existem avisos ou notificações nesta pasta."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredMessages.map((msg) => {
            const config = KIND_CONFIG[msg.kind] || KIND_CONFIG.info
            const Icon = config.icon
            const isUnread = !msg.read_at
            const actionUrl = getSectionUrl(msg.section, msg.reference)

            return (
              <div
                key={msg.id}
                onClick={() => isUnread && handleMarkAsRead([msg.id])}
                className={`group bg-[var(--surface-bg)] rounded-lg border p-4 sm:p-5 transition-all relative ${
                  isUnread
                    ? "border-l-4 border-l-[var(--accent)] border-[var(--border-strong)] shadow-2xs"
                    : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Category Icon */}
                  <div className="w-8 h-8 rounded-md bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-primary)] mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                          {config.label}
                        </span>
                        <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                          {msg.title}
                        </h4>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" title="Mensagem não lida" />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-tertiary)] shrink-0">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(msg.created_at)}</span>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-line break-words">
                      {msg.body}
                    </p>

                    {/* Footer / Actions */}
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {msg.reference ? (
                        <span className="text-[11px] font-mono text-[var(--text-tertiary)] bg-[var(--surface-muted)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
                          Ref: {msg.reference}
                        </span>
                      ) : <span />}

                      <div className="flex items-center gap-3">
                        {actionUrl && (
                          <Link
                            href={actionUrl}
                            className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
                          >
                            <span>Ver detalhe</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}

                        {isUnread ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMarkAsRead([msg.id])
                            }}
                            className="text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                          >
                            Marcar como lida
                          </button>
                        ) : (
                          <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-[var(--text-tertiary)]" />
                            <span>Lida</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {next && <div className="text-center"><button type="button" disabled={loading} onClick={() => void more()} className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-4 py-2 text-xs font-medium text-[var(--text-primary)] disabled:opacity-50">{loading ? 'A carregar…' : 'Ver mensagens anteriores'}</button></div>}
    </div>
  )
}
