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
  RefreshCw, 
  ExternalLink, 
  MailCheck,
  CheckCircle2,
  Clock
} from "lucide-react"
import type { ClientMessage, MessageKind, MessageSection } from "@/lib/client-messages/types"
import { useClientScope } from "./ClientScope"

type Props = {
  initialMessages?: ClientMessage[]
  initialUnreadCount?: number
}

const KIND_CONFIG: Record<MessageKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  invoice: {
    label: "Faturação",
    icon: FileText,
  },
  payment: {
    label: "Carregamento",
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

export function ClientInbox({ initialMessages = [], initialUnreadCount = 0 }: Props) {
  const { client, basePath } = useClientScope()
  const [messages, setMessages] = React.useState<ClientMessage[]>(initialMessages)
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount)
  const [filter, setFilter] = React.useState<"all" | "unread" | "invoice" | "incident" | "payment" | "weight">("all")
  const [loading, setLoading] = React.useState(false)
  const [markingAll, setMarkingAll] = React.useState(false)

  const fetchMessages = React.useCallback(async () => {
    if (!client?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/client-messages?clientId=${encodeURIComponent(client.id)}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.messages)) {
          setMessages(data.messages)
          setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0)
        }
      }
    } catch (err) {
      console.warn("Failed to refresh messages:", err)
    } finally {
      setLoading(false)
    }
  }, [client?.id])

  const handleMarkAsRead = async (ids: string[]) => {
    if (!client?.id || !ids.length) return
    setMessages(prev => prev.map(m => ids.includes(m.id) ? { ...m, read_at: m.read_at || new Date().toISOString() } : m))
    setUnreadCount(prev => Math.max(0, prev - ids.length))

    try {
      await fetch("/api/client-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", clientId: client.id, ids }),
      })
    } catch (err) {
      console.warn("Failed to mark messages as read:", err)
    }
  }

  const handleMarkAllRead = async () => {
    const unreadIds = messages.filter(m => !m.read_at).map(m => m.id)
    if (!unreadIds.length) return
    setMarkingAll(true)
    try {
      await handleMarkAsRead(unreadIds)
    } finally {
      setMarkingAll(false)
    }
  }

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

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      const now = new Date()
      const isToday = d.toDateString() === now.toDateString()
      if (isToday) {
        return `Hoje às ${d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`
      }
      return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    } catch {
      return dateStr
    }
  }

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
              disabled={markingAll}
              className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[rgba(0,0,0,0.05)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <CheckCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>{markingAll ? "A marcar..." : "Marcar todas como lidas"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchMessages}
            disabled={loading}
            className="p-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(0,0,0,0.05)] transition-all cursor-pointer disabled:opacity-50"
            title="Atualizar mensagens"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            filter === "all"
              ? "bg-[var(--accent)] text-white font-semibold shadow-2xs"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Todas ({messages.length})
        </button>

        <button
          type="button"
          onClick={() => setFilter("unread")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
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
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
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
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
            filter === "payment"
              ? "bg-[var(--accent)] text-white font-semibold shadow-2xs"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          Carregamentos
        </button>

        <button
          type="button"
          onClick={() => setFilter("incident")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
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
          className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
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

                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
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
    </div>
  )
}
