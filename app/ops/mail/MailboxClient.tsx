"use client"

import * as React from "react"
import {
  Archive,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  CornerUpLeft,
  CornerUpRight,
  Download,
  ExternalLink,
  FileEdit,
  FileText,
  Filter,
  Forward,
  Inbox,
  Mail,
  MailOpen,
  MoreVertical,
  Paperclip,
  PenSquare,
  Plus,
  RefreshCw,
  Reply,
  ReplyAll,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  Trash2,
  User,
  VolumeX,
  X,
} from "lucide-react"
import {
  MAIL_ACCOUNTS,
  MAIL_LABELS,
  type MailAccountId,
  type MailFolder,
  type MailLabelId,
  type MailListResponse,
  type MailMessage,
} from "@/lib/ops-mailbox"
import { formatFileSize, type ChatAttachmentItem } from "@/lib/team-chat-media"

interface ContactSuggestion {
  name: string
  email: string
  category?: string
}

interface MailboxClientProps {
  initialData: MailListResponse
  contacts: ContactSuggestion[]
  viewerName: string
  viewerEmail: string
}

const FOLDER_CONFIG: {
  id: MailFolder
  label: string
  icon: React.ElementType
}[] = [
  { id: "inbox", label: "Caixa de Entrada", icon: Inbox },
  { id: "drafts", label: "Rascunhos", icon: FileEdit },
  { id: "sent", label: "Enviados", icon: Send },
  { id: "starred", label: "Com Estrela", icon: Star },
  { id: "archive", label: "Arquivo", icon: Archive },
  { id: "trash", label: "Lixo", icon: Trash2 },
]

function getInitials(name: string): string {
  const parts = (name || "Linke")
    .replace(/[()[\]]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return "LK"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  const sameDay =
    date.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" }) ===
    now.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" })

  if (sameDay) {
    if (diffMin >= 0 && diffMin < 2) return "Agora mesmo"
    if (diffMin >= 2 && diffMin < 60) return `há ${diffMin} min`
    return new Intl.DateTimeFormat("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Lisbon",
    }).format(date)
  }

  if (diffHours >= 0 && diffHours < 48) {
    return "Ontem"
  }

  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Lisbon",
  }).format(date)
}

function formatFullDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Lisbon",
  }).format(date)
}

export function MailboxClient({
  initialData,
  contacts,
  viewerName,
  viewerEmail,
}: MailboxClientProps) {
  const [account, setAccount] = React.useState<MailAccountId>(initialData.account || "geral@linke.pt")
  const [messages, setMessages] = React.useState<MailMessage[]>(initialData.messages)
  const [activeFolder, setActiveFolder] = React.useState<MailFolder>("inbox")
  const [activeLabel, setActiveLabel] = React.useState<MailLabelId | null>(null)
  const [readFilter, setReadFilter] = React.useState<"all" | "unread">("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedId, setSelectedId] = React.useState<string | null>(
    () => initialData.messages.find((m) => m.account === "geral@linke.pt" && m.folder === "inbox")?.id || initialData.messages[0]?.id || null
  )
  const [mobileShowReader, setMobileShowReader] = React.useState(false)

  // Quick reply state in the bottom of the right pane
  const [replyText, setReplyText] = React.useState("")
  const [replyAllMode, setReplyAllMode] = React.useState(false)
  const [muteThread, setMuteThread] = React.useState(false)
  const [sendingReply, setSendingReply] = React.useState(false)

  // Sync / status
  const [refreshing, setRefreshing] = React.useState(false)
  const [toastMessage, setToastMessage] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [showConnectionModal, setShowConnectionModal] = React.useState(false)
  const [copiedWebhook, setCopiedWebhook] = React.useState(false)

  // Label dropdown in toolbar
  const [showLabelMenu, setShowLabelMenu] = React.useState(false)
  const [showMoreMenu, setShowMoreMenu] = React.useState(false)

  // Compose Modal state
  const [showComposeModal, setShowComposeModal] = React.useState(false)
  const [composeDraftId, setComposeDraftId] = React.useState<string | undefined>(undefined)
  const [composeToEmail, setComposeToEmail] = React.useState("")
  const [composeToName, setComposeToName] = React.useState("")
  const [composeCc, setComposeCc] = React.useState("")
  const [composeBcc, setComposeBcc] = React.useState("")
  const [showCcBcc, setShowCcBcc] = React.useState(false)
  const [composeSubject, setComposeSubject] = React.useState("")
  const [composeBody, setComposeBody] = React.useState("")
  const [composeLabels, setComposeLabels] = React.useState<MailLabelId[]>(["clientes"])
  const [composeAttachments, setComposeAttachments] = React.useState<ChatAttachmentItem[]>([])
  const [uploadingAttachment, setUploadingAttachment] = React.useState(false)
  const [sendingCompose, setSendingCompose] = React.useState(false)

  const composeDialogRef = React.useRef<HTMLDialogElement>(null)
  const connectionDialogRef = React.useRef<HTMLDialogElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const showToast = React.useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr))
    }, 4200)
  }, [])

  // Sync native <dialog> for Compose modal
  React.useEffect(() => {
    const dialog = composeDialogRef.current
    if (!dialog) return
    if (showComposeModal) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [showComposeModal])

  // Sync native <dialog> for Connection Info modal
  React.useEffect(() => {
    const dialog = connectionDialogRef.current
    if (!dialog) return
    if (showConnectionModal) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [showConnectionModal])

  // Messages scoped to the active company email account
  const accountMessages = React.useMemo(
    () => messages.filter((m) => m.account === account),
    [messages, account]
  )

  // Folder counts for the left sidebar
  const folderCounts = React.useMemo(() => {
    const counts: Record<MailFolder, { total: number; unread: number }> = {
      inbox: { total: 0, unread: 0 },
      drafts: { total: 0, unread: 0 },
      sent: { total: 0, unread: 0 },
      starred: { total: 0, unread: 0 },
      archive: { total: 0, unread: 0 },
      trash: { total: 0, unread: 0 },
      junk: { total: 0, unread: 0 },
    }
    for (const msg of accountMessages) {
      if (counts[msg.folder]) {
        counts[msg.folder].total += 1
        if (!msg.read) counts[msg.folder].unread += 1
      }
      if (msg.starred && msg.folder !== "trash") {
        counts.starred.total += 1
        if (!msg.read) counts.starred.unread += 1
      }
    }
    return counts
  }, [accountMessages])

  // Label counts
  const labelCounts = React.useMemo(() => {
    const map: Record<string, number> = {}
    for (const lbl of MAIL_LABELS) map[lbl.id] = 0
    for (const msg of accountMessages) {
      if (msg.folder === "trash") continue
      for (const l of msg.labels) {
        map[l] = (map[l] || 0) + 1
      }
    }
    return map
  }, [accountMessages])

  // Filtered messages for the middle pane
  const filteredMessages = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return accountMessages.filter((msg) => {
      if (activeFolder === "starred") {
        if (!msg.starred || msg.folder === "trash") return false
      } else if (msg.folder !== activeFolder) {
        return false
      }

      if (activeLabel && !msg.labels.includes(activeLabel)) {
        return false
      }

      if (readFilter === "unread" && msg.read) {
        return false
      }

      if (q) {
        const hay = `${msg.fromName} ${msg.fromEmail} ${msg.toName} ${msg.toEmail} ${msg.subject} ${msg.bodyText}`.toLowerCase()
        if (!hay.includes(q)) return false
      }

      return true
    })
  }, [accountMessages, activeFolder, activeLabel, readFilter, searchQuery])

  const selectedMessage = React.useMemo(
    () => accountMessages.find((m) => m.id === selectedId) || filteredMessages[0] || null,
    [accountMessages, filteredMessages, selectedId]
  )

  React.useEffect(() => {
    if (selectedMessage) {
      setMuteThread(Boolean(selectedMessage.muted))
    }
  }, [selectedMessage])

  const refreshMailbox = React.useCallback(
    async (silent = false) => {
      setRefreshing(true)
      if (!silent) setErrorMessage(null)
      try {
        if (account === "geral@linke.pt") {
          try {
            const syncRes = await fetch("/api/ops/mail", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind: "sync_imap" }),
            })
            const syncData = await syncRes.json()
            if (syncRes.ok && syncData.ok) {
              setMessages(syncData.messages || [])
              const syncInfo = syncData.sync
              if (syncInfo?.connected) {
                if (syncInfo.synced > 0) {
                  showToast(`Sincronizados ${syncInfo.synced} novos emails do Gmail (${account})`)
                } else if (!silent) {
                  showToast(`Caixa ${account} sincronizada com o Gmail (sem novos emails)`)
                }
              } else if (syncInfo?.errors?.length && !silent) {
                showToast(`Aviso de sincronização: ${syncInfo.errors[0]}`)
              } else if (!silent) {
                showToast(`Caixa ${account} sincronizada`)
              }
              return
            }
          } catch {
            // Fallback to GET if sync fails
          }
        }

        const response = await fetch(`/api/ops/mail?account=${encodeURIComponent(account)}`, {
          cache: "no-store",
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Não foi possível sincronizar a caixa de correio.")
        setMessages(data.messages || [])
        if (!silent) showToast(`Caixa ${account} sincronizada`)
      } catch (err) {
        if (!silent) {
          setErrorMessage(err instanceof Error ? err.message : "Erro ao sincronizar emails.")
        }
      } finally {
        setRefreshing(false)
      }
    },
    [account, showToast]
  )

  // Auto-sync with Gmail on initial mount
  React.useEffect(() => {
    void refreshMailbox(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runMutation = React.useCallback(
    async (
      action:
        | "mark_read"
        | "mark_unread"
        | "toggle_star"
        | "move_folder"
        | "toggle_label"
        | "toggle_mute"
        | "delete_permanent",
      ids: string[],
      extra?: { folder?: Exclude<MailFolder, "starred">; label?: MailLabelId }
    ) => {
      if (ids.length === 0) return

      // Optimistic UI update
      setMessages((prev) => {
        if (action === "delete_permanent") {
          return prev.filter((m) => !ids.includes(m.id))
        }
        return prev.map((m) => {
          if (!ids.includes(m.id)) return m
          if (action === "mark_read") return { ...m, read: true }
          if (action === "mark_unread") return { ...m, read: false }
          if (action === "toggle_star") return { ...m, starred: !m.starred }
          if (action === "toggle_mute") return { ...m, muted: !m.muted }
          if (action === "move_folder" && extra?.folder) return { ...m, folder: extra.folder }
          if (action === "toggle_label" && extra?.label) {
            const has = m.labels.includes(extra.label)
            return {
              ...m,
              labels: has ? m.labels.filter((l) => l !== extra.label!) : [...m.labels, extra.label!],
            }
          }
          return m
        })
      })

      try {
        await fetch("/api/ops/mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "mutate",
            action,
            ids,
            ...extra,
          }),
        })
      } catch {
        // Ignore transient network errors after optimistic update
      }
    },
    []
  )

  const handleSelectMessage = React.useCallback(
    (msg: MailMessage) => {
      setSelectedId(msg.id)
      setMobileShowReader(true)
      setShowLabelMenu(false)
      setShowMoreMenu(false)
      if (!msg.read) {
        void runMutation("mark_read", [msg.id])
      }
    },
    [runMutation]
  )

  const openComposeModal = React.useCallback(
    (prefill?: {
      id?: string
      toEmail?: string
      toName?: string
      cc?: string
      subject?: string
      bodyText?: string
      labels?: MailLabelId[]
    }) => {
      setComposeDraftId(prefill?.id)
      setComposeToEmail(prefill?.toEmail || "")
      setComposeToName(prefill?.toName || "")
      setComposeCc(prefill?.cc || "")
      setComposeBcc("")
      setShowCcBcc(Boolean(prefill?.cc))
      setComposeSubject(prefill?.subject || "")
      setComposeBody(prefill?.bodyText || "")
      setComposeLabels(prefill?.labels || ["clientes"])
      setComposeAttachments([])
      setErrorMessage(null)
      setShowComposeModal(true)
    },
    []
  )

  const handleUploadAttachment = React.useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadingAttachment(true)
    setErrorMessage(null)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append("file", file)
        const res = await fetch("/api/ops/chat/attachments", {
          method: "POST",
          body: formData,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Não foi possível anexar o ficheiro.")
        if (data.attachment) {
          setComposeAttachments((prev) => [...prev, data.attachment])
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao anexar ficheiro.")
    } finally {
      setUploadingAttachment(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }, [])

  const handleSendOrDraftCompose = React.useCallback(
    async (isDraft: boolean) => {
      if (sendingCompose) return
      setSendingCompose(true)
      setErrorMessage(null)
      try {
        const response = await fetch("/api/ops/mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: composeDraftId,
            account,
            toEmail: composeToEmail,
            toName: composeToName,
            cc: composeCc,
            bcc: composeBcc,
            subject: composeSubject,
            bodyText: composeBody,
            labels: composeLabels,
            attachments: composeAttachments,
            isDraft,
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Não foi possível enviar o email.")

        if (data.message) {
          const created: MailMessage = data.message
          setMessages((prev) => [created, ...prev.filter((m) => m.id !== created.id)])
          setSelectedId(created.id)
          setActiveFolder(isDraft ? "drafts" : "sent")
        }
        setShowComposeModal(false)
        showToast(
          isDraft
            ? "Rascunho guardado em Rascunhos"
            : `Email enviado através de ${account}`
        )
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Erro ao enviar email.")
      } finally {
        setSendingCompose(false)
      }
    },
    [
      account,
      composeAttachments,
      composeBcc,
      composeBody,
      composeCc,
      composeDraftId,
      composeLabels,
      composeSubject,
      composeToEmail,
      composeToName,
      sendingCompose,
      showToast,
    ]
  )

  const handleQuickReply = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!selectedMessage || !replyText.trim() || sendingReply) return
      setSendingReply(true)
      setErrorMessage(null)

      const targetEmail =
        selectedMessage.fromEmail.toLowerCase() === account.toLowerCase()
          ? selectedMessage.toEmail
          : selectedMessage.fromEmail
      const targetName =
        selectedMessage.fromEmail.toLowerCase() === account.toLowerCase()
          ? selectedMessage.toName
          : selectedMessage.fromName
      const replySubject = selectedMessage.subject.toLowerCase().startsWith("re:")
        ? selectedMessage.subject
        : `Re: ${selectedMessage.subject}`

      try {
        const response = await fetch("/api/ops/mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account,
            toEmail: targetEmail,
            toName: targetName,
            cc: replyAllMode && selectedMessage.cc?.length ? selectedMessage.cc.join(", ") : "",
            subject: replySubject,
            bodyText: replyText.trim(),
            labels: selectedMessage.labels,
            inReplyToId: selectedMessage.threadId || selectedMessage.id,
            isDraft: false,
          }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Não foi possível enviar a resposta.")

        if (data.message) {
          const sentMsg: MailMessage = data.message
          setMessages((prev) => [sentMsg, ...prev])
        }
        setReplyText("")
        showToast(`Resposta enviada para ${targetEmail} via ${account}`)
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Erro ao enviar resposta.")
      } finally {
        setSendingReply(false)
      }
    },
    [account, replyAllMode, replyText, selectedMessage, sendingReply, showToast]
  )

  const activeAccountMeta =
    MAIL_ACCOUNTS.find((a) => a.id === account) || MAIL_ACCOUNTS[0]

  return (
    <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-3">
      {/* Top Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Caixa de Correio
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {account}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Gestão centralizada de emails operacionais, clientes, faturação e recolhas da Linke.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowConnectionModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
            Estado da Ligação ({initialData.resendConnected ? "Resend + Google MX" : "Local"})
          </button>

          <button
            type="button"
            onClick={() => void refreshMailbox()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            Sincronizar
          </button>

          <button
            type="button"
            onClick={() => openComposeModal()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[var(--accent-hover)] transition-colors"
          >
            <PenSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Novo Email
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-800"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {toastMessage}
          </span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Fechar aviso"
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-800"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            aria-label="Fechar erro"
            className="text-rose-700 hover:text-rose-900"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* 3-Pane Split View Mail Container (modeled after shadcn/admincn /apps/mail) */}
      <div className="grid h-[calc(100dvh-185px)] min-h-[560px] max-h-[1040px] grid-cols-1 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-xs lg:grid-cols-[240px_380px_minmax(0,1fr)] xl:grid-cols-[256px_410px_minmax(0,1fr)]">
        {/* ─── LEFT PANE: Account Switcher, Compose, Folders & Labels ─── */}
        <aside className="hidden flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-muted)]/45 lg:flex">
          {/* Account Switcher */}
          <div className="border-b border-[var(--border-subtle)] p-3">
            <label htmlFor="mailbox-account-select" className="sr-only">
              Selecionar conta de email
            </label>
            <div className="relative">
              <select
                id="mailbox-account-select"
                value={account}
                onChange={(e) => {
                  const nextAcc = e.target.value as MailAccountId
                  setAccount(nextAcc)
                  const first = messages.find((m) => m.account === nextAcc && m.folder === activeFolder)
                  setSelectedId(first?.id || null)
                }}
                className="w-full appearance-none rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] py-2 pr-8 pl-9 text-xs font-semibold text-[var(--text-primary)] shadow-2xs focus:border-[var(--accent)] focus:outline-none"
              >
                {MAIL_ACCOUNTS.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.label} ({acc.email})
                  </option>
                ))}
              </select>
              <Mail
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--accent)]"
                aria-hidden="true"
              />
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]"
                aria-hidden="true"
              />
            </div>
            <p className="mt-1.5 truncate px-1 text-[11px] text-[var(--text-secondary)]">
              {activeAccountMeta.roleLabel}
            </p>
          </div>

          {/* Primary Compose Button */}
          <div className="p-3 pb-2">
            <button
              type="button"
              onClick={() => openComposeModal()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Escrever Email
            </button>
          </div>

          {/* Folders List */}
          <nav aria-label="Pastas de email" className="flex-1 space-y-5 overflow-y-auto px-2.5 py-2">
            <div className="space-y-0.5">
              {FOLDER_CONFIG.map((item) => {
                const Icon = item.icon
                const isSelected = activeFolder === item.id && activeLabel === null
                const countInfo = folderCounts[item.id]
                const badgeCount =
                  item.id === "inbox" || item.id === "starred"
                    ? countInfo?.unread || countInfo?.total || 0
                    : countInfo?.total || 0

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveFolder(item.id)
                      setActiveLabel(null)
                      setMobileShowReader(false)
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[var(--accent)] text-white font-semibold shadow-2xs"
                        : "text-[var(--text-primary)] hover:bg-[var(--surface-bg)]"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          isSelected ? "text-white" : "text-[var(--text-secondary)]"
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {badgeCount > 0 && (
                      <span
                        className={`ml-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                          isSelected
                            ? "bg-white/20 text-white"
                            : item.id === "inbox" && countInfo.unread > 0
                            ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                            : "bg-[var(--surface-bg)] text-[var(--text-secondary)]"
                        }`}
                      >
                        {badgeCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Categories / Labels */}
            <div className="border-t border-[var(--border-subtle)] pt-4">
              <div className="mb-2 flex items-center justify-between px-2.5">
                <span className="text-[10px] font-bold tracking-wider text-[var(--text-tertiary)] uppercase">
                  Etiquetas Linke
                </span>
                {activeLabel && (
                  <button
                    type="button"
                    onClick={() => setActiveLabel(null)}
                    className="text-[10px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <div className="space-y-0.5">
                {MAIL_LABELS.map((lbl) => {
                  const isSelected = activeLabel === lbl.id
                  const count = labelCounts[lbl.id] || 0
                  return (
                    <button
                      key={lbl.id}
                      type="button"
                      onClick={() => {
                        setActiveLabel((prev) => (prev === lbl.id ? null : lbl.id))
                        setMobileShowReader(false)
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[var(--surface-bg)] font-semibold text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface-bg)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: lbl.color }}
                          aria-hidden="true"
                        />
                        <span className="truncate">{lbl.name}</span>
                      </span>
                      {count > 0 && (
                        <span className="text-[11px] font-medium text-[var(--text-tertiary)]">
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </nav>

          {/* Operator Footer */}
          <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-bg)]/60 p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/15 text-xs font-bold text-[var(--accent)]">
                {getInitials(viewerName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
                  {viewerName}
                </p>
                <p className="truncate text-[10px] text-[var(--text-secondary)]">
                  Ligado a {account}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* ─── MIDDLE PANE: Thread List, Tabs & Search ─── */}
        <section
          aria-label="Lista de mensagens"
          className={`flex flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-bg)] min-h-0 ${
            mobileShowReader ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Middle Pane Header (Folder Title + All/Unread Segmented Tabs) */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                {FOLDER_CONFIG.find((f) => f.id === activeFolder)?.label || "Caixa de Entrada"}
              </h2>
              {activeLabel && (
                <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                  #{MAIL_LABELS.find((l) => l.id === activeLabel)?.name}
                </span>
              )}
            </div>

            <div
              role="tablist"
              aria-label="Filtro de leitura"
              className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={readFilter === "all"}
                onClick={() => setReadFilter("all")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                  readFilter === "all"
                    ? "bg-[var(--surface-bg)] text-[var(--text-primary)] shadow-2xs"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={readFilter === "unread"}
                onClick={() => setReadFilter("unread")}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                  readFilter === "unread"
                    ? "bg-[var(--surface-bg)] text-[var(--text-primary)] shadow-2xs"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Não lidos
              </button>
            </div>
          </div>

          {/* Mobile Folder Switcher */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border-subtle)] px-3 py-2 lg:hidden">
            {FOLDER_CONFIG.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFolder(f.id)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  activeFolder === f.id
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <search className="border-b border-[var(--border-subtle)] p-3">
            <div className="relative flex items-center">
              <Search
                className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-[var(--text-tertiary)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar remetente, assunto, cliente ou guia…"
                aria-label="Pesquisar emails"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)]/60 py-1.5 pr-8 pl-8.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:bg-[var(--surface-bg)] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Limpar pesquisa"
                  className="absolute right-2.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </search>

          {/* Scrollable Message Cards List */}
          <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
            {filteredMessages.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center p-6 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--text-tertiary)]">
                  <Inbox className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  Nenhum email encontrado
                </p>
                <p className="mt-1 max-w-[220px] text-[11px] text-[var(--text-secondary)]">
                  Não existem mensagens nesta vista ou com os filtros aplicados.
                </p>
              </div>
            ) : (
              filteredMessages.map((msg) => {
                const isSelected = selectedMessage?.id === msg.id
                const displayParty =
                  msg.folder === "sent" || msg.folder === "drafts"
                    ? `Para: ${msg.toName || msg.toEmail}`
                    : msg.fromName || msg.fromEmail

                return (
                  <div
                    key={msg.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectMessage(msg)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        handleSelectMessage(msg)
                      }
                    }}
                    className={`group relative flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-[var(--accent)]/40 bg-[var(--accent)]/[0.06] shadow-2xs"
                        : "border-[var(--border-subtle)] bg-[var(--surface-bg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {!msg.read && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]"
                            title="Não lido"
                          />
                        )}
                        <span
                          className={`truncate text-xs ${
                            !msg.read
                              ? "font-bold text-[var(--text-primary)]"
                              : "font-semibold text-[var(--text-primary)]"
                          }`}
                        >
                          {displayParty}
                        </span>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={`text-[11px] ${
                            !msg.read
                              ? "font-semibold text-[var(--accent)]"
                              : "text-[var(--text-tertiary)]"
                          }`}
                        >
                          {formatRelativeTime(msg.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void runMutation("toggle_star", [msg.id])
                          }}
                          aria-label={msg.starred ? "Remover estrela" : "Marcar com estrela"}
                          className={`p-0.5 transition-colors ${
                            msg.starred
                              ? "text-amber-500"
                              : "text-transparent group-hover:text-[var(--text-tertiary)] hover:text-amber-500"
                          }`}
                        >
                          <Star
                            className="h-3.5 w-3.5"
                            fill={msg.starred ? "currentColor" : "none"}
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    </div>

                    <div className="truncate text-xs font-medium text-[var(--text-primary)]">
                      {msg.subject}
                    </div>

                    <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                      {msg.snippet}
                    </p>

                    {(msg.labels.length > 0 || msg.attachments.length > 0 || msg.folder === "drafts") && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {msg.folder === "drafts" && (
                          <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Rascunho
                          </span>
                        )}
                        {msg.labels.map((lblId) => {
                          const meta = MAIL_LABELS.find((l) => l.id === lblId)
                          if (!meta) return null
                          return (
                            <span
                              key={lblId}
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}
                            >
                              {meta.name}
                            </span>
                          )
                        })}
                        {msg.attachments.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                            <Paperclip className="h-2.5 w-2.5" aria-hidden="true" />
                            {msg.attachments.length}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* ─── RIGHT PANE: Reading View, Action Toolbar & Quick Reply ─── */}
        <section
          aria-label="Leitura da mensagem"
          className={`flex flex-col bg-[var(--surface-bg)] min-h-0 ${
            mobileShowReader ? "flex" : "hidden lg:flex"
          }`}
        >
          {selectedMessage ? (
            <>
              {/* Action Toolbar (Matching shadcn/admincn mail header) */}
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMobileShowReader(false)}
                    className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] lg:hidden"
                    aria-label="Voltar à lista"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void runMutation("move_folder", [selectedMessage.id], { folder: "archive" })
                      showToast("Mensagem arquivada")
                    }}
                    title="Arquivar"
                    aria-label="Arquivar"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <Archive className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMessage.folder === "trash") {
                        void runMutation("delete_permanent", [selectedMessage.id])
                        showToast("Mensagem eliminada permanentemente")
                      } else {
                        void runMutation("move_folder", [selectedMessage.id], { folder: "trash" })
                        showToast("Mensagem movida para o Lixo")
                      }
                    }}
                    title={selectedMessage.folder === "trash" ? "Eliminar permanentemente" : "Mover para o Lixo"}
                    aria-label={selectedMessage.folder === "trash" ? "Eliminar permanentemente" : "Mover para o Lixo"}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <div className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />

                  <button
                    type="button"
                    onClick={() => {
                      void runMutation(
                        selectedMessage.read ? "mark_unread" : "mark_read",
                        [selectedMessage.id]
                      )
                      showToast(
                        selectedMessage.read ? "Marcado como não lido" : "Marcado como lido"
                      )
                    }}
                    title={selectedMessage.read ? "Marcar como não lido" : "Marcar como lido"}
                    aria-label={selectedMessage.read ? "Marcar como não lido" : "Marcar como lido"}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    {selectedMessage.read ? (
                      <Mail className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <MailOpen className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void runMutation("toggle_star", [selectedMessage.id])}
                    title={selectedMessage.starred ? "Remover estrela" : "Destacar com estrela"}
                    aria-label={selectedMessage.starred ? "Remover estrela" : "Destacar com estrela"}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                      selectedMessage.starred
                        ? "text-amber-500 hover:bg-amber-500/10"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Star
                      className="h-4 w-4"
                      fill={selectedMessage.starred ? "currentColor" : "none"}
                      aria-hidden="true"
                    />
                  </button>

                  {/* Tag / Label Popover */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLabelMenu((prev) => !prev)
                        setShowMoreMenu(false)
                      }}
                      title="Gerir etiquetas"
                      aria-label="Gerir etiquetas"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      <Tag className="h-4 w-4" aria-hidden="true" />
                    </button>

                    {showLabelMenu && (
                      <div className="absolute top-full left-0 z-30 mt-1.5 w-48 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-1.5 shadow-lg">
                        <p className="px-2 py-1 text-[10px] font-bold tracking-wider text-[var(--text-tertiary)] uppercase">
                          Etiquetas da Mensagem
                        </p>
                        {MAIL_LABELS.map((lbl) => {
                          const active = selectedMessage.labels.includes(lbl.id)
                          return (
                            <button
                              key={lbl.id}
                              type="button"
                              onClick={() =>
                                void runMutation("toggle_label", [selectedMessage.id], {
                                  label: lbl.id,
                                })
                              }
                              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: lbl.color }}
                                />
                                {lbl.name}
                              </span>
                              {active && <Check className="h-3.5 w-3.5 text-[var(--accent)]" />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right-side Reply / Reply All / Forward / More buttons */}
                <div className="flex items-center gap-1">
                  {selectedMessage.folder === "drafts" && (
                    <button
                      type="button"
                      onClick={() =>
                        openComposeModal({
                          id: selectedMessage.id,
                          toEmail: selectedMessage.toEmail,
                          toName: selectedMessage.toName,
                          cc: selectedMessage.cc?.join(", "),
                          subject: selectedMessage.subject.replace(/^\[Rascunho\]\s*/i, ""),
                          bodyText: selectedMessage.bodyText,
                          labels: selectedMessage.labels,
                        })
                      }
                      className="mr-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--accent-hover)]"
                    >
                      <FileEdit className="h-3.5 w-3.5" aria-hidden="true" />
                      Continuar Rascunho
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setReplyAllMode(false)
                      const el = document.getElementById("mail-quick-reply-input")
                      el?.focus()
                    }}
                    title="Responder"
                    aria-label="Responder"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <Reply className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReplyAllMode(true)
                      const el = document.getElementById("mail-quick-reply-input")
                      el?.focus()
                    }}
                    title="Responder a todos"
                    aria-label="Responder a todos"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <ReplyAll className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openComposeModal({
                        subject: selectedMessage.subject.toLowerCase().startsWith("fw:")
                          ? selectedMessage.subject
                          : `Fw: ${selectedMessage.subject}`,
                        bodyText: `\n\n---------- Mensagem reencaminhada ----------\nDe: ${selectedMessage.fromName} <${selectedMessage.fromEmail}>\nData: ${formatFullDateTime(selectedMessage.createdAt)}\nAssunto: ${selectedMessage.subject}\nPara: ${selectedMessage.toEmail}\n\n${selectedMessage.bodyText}`,
                        labels: selectedMessage.labels,
                      })
                    }
                    title="Reencaminhar"
                    aria-label="Reencaminhar"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    <Forward className="h-4 w-4" aria-hidden="true" />
                  </button>

                  <div className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu((prev) => !prev)
                        setShowLabelMenu(false)
                      }}
                      title="Mais opções"
                      aria-label="Mais opções"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                    >
                      <MoreVertical className="h-4 w-4" aria-hidden="true" />
                    </button>

                    {showMoreMenu && (
                      <div className="absolute top-full right-0 z-30 mt-1.5 w-52 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-1.5 shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            void runMutation("move_folder", [selectedMessage.id], {
                              folder: "inbox",
                            })
                            setShowMoreMenu(false)
                            showToast("Movido para a Caixa de Entrada")
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                        >
                          <Inbox className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                          Mover para Caixa de Entrada
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            openComposeModal({
                              toEmail:
                                selectedMessage.fromEmail === account
                                  ? selectedMessage.toEmail
                                  : selectedMessage.fromEmail,
                              toName:
                                selectedMessage.fromEmail === account
                                  ? selectedMessage.toName
                                  : selectedMessage.fromName,
                              subject: selectedMessage.subject.startsWith("Re:")
                                ? selectedMessage.subject
                                : `Re: ${selectedMessage.subject}`,
                              bodyText: `\n\nEm ${formatFullDateTime(selectedMessage.createdAt)}, ${selectedMessage.fromName} escreveu:\n> ${selectedMessage.bodyText.replace(/\n/g, "\n> ")}`,
                              labels: selectedMessage.labels,
                            })
                            setShowMoreMenu(false)
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                        >
                          <PenSquare className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                          Responder em janela completa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sender Metadata Header */}
              <div className="border-b border-[var(--border-subtle)] px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/12 text-xs font-bold text-[var(--accent)] ring-1 ring-[var(--accent)]/20">
                      {getInitials(selectedMessage.fromName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">
                          {selectedMessage.fromName}
                        </h3>
                        <span className="text-xs text-[var(--text-secondary)]">
                          &lt;{selectedMessage.fromEmail}&gt;
                        </span>
                      </div>
                      <h4 className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                        {selectedMessage.subject}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                        <span>
                          <strong className="font-medium text-[var(--text-primary)]">Para:</strong>{" "}
                          {selectedMessage.toName} &lt;{selectedMessage.toEmail}&gt;
                        </span>
                        {selectedMessage.cc && selectedMessage.cc.length > 0 && (
                          <span>
                            <strong className="font-medium text-[var(--text-primary)]">Cc:</strong>{" "}
                            {selectedMessage.cc.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      {formatFullDateTime(selectedMessage.createdAt)}
                    </span>
                    {selectedMessage.deliveryStatus === "delivered" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        Entregue via Resend
                      </span>
                    )}
                  </div>
                </div>

                {selectedMessage.labels.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {selectedMessage.labels.map((lblId) => {
                      const meta = MAIL_LABELS.find((l) => l.id === lblId)
                      if (!meta) return null
                      return (
                        <span
                          key={lblId}
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${meta.badgeClass}`}
                        >
                          {meta.name}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Message Body Area */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--text-primary)]">
                  {selectedMessage.bodyText}
                </div>

                {/* Attachments Tray */}
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 p-4">
                    <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                      <Paperclip className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                      Anexos ({selectedMessage.attachments.length})
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedMessage.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-2.5 text-xs hover:border-[var(--accent)] transition-colors"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <FileText className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[var(--text-primary)]">
                                {att.name}
                              </p>
                              <p className="text-[10px] text-[var(--text-tertiary)]">
                                {formatFileSize(att.size)}
                              </p>
                            </div>
                          </div>
                          <Download className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Inline Bottom Quick Reply Box (Modeled directly after shadcn/admincn mail bottom composer) */}
              <form
                onSubmit={handleQuickReply}
                className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/30 p-4"
              >
                <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-2xs focus-within:border-[var(--accent)]">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)]/60 bg-[var(--surface-muted)]/40 px-3.5 py-1.5 text-[11px] text-[var(--text-secondary)]">
                    <span className="truncate">
                      {replyAllMode ? "Responder a todos:" : "Responder a"}{" "}
                      <strong className="font-semibold text-[var(--text-primary)]">
                        {selectedMessage.fromEmail === account
                          ? `${selectedMessage.toName} <${selectedMessage.toEmail}>`
                          : `${selectedMessage.fromName} <${selectedMessage.fromEmail}>`}
                      </strong>
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--text-tertiary)]">
                      De: {account}
                    </span>
                  </div>

                  <textarea
                    id="mail-quick-reply-input"
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Responder a ${
                      selectedMessage.fromEmail === account
                        ? selectedMessage.toName
                        : selectedMessage.fromName
                    }…`}
                    className="w-full resize-none bg-transparent p-3.5 text-xs leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)]/60 px-3.5 py-2">
                    <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={muteThread}
                        onChange={(e) => {
                          setMuteThread(e.target.checked)
                          void runMutation("toggle_mute", [selectedMessage.id])
                        }}
                        className="h-3.5 w-3.5 rounded border-[var(--border-strong)] accent-[var(--accent)]"
                      />
                      Silenciar esta conversa
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openComposeModal({
                            toEmail:
                              selectedMessage.fromEmail === account
                                ? selectedMessage.toEmail
                                : selectedMessage.fromEmail,
                            toName:
                              selectedMessage.fromEmail === account
                                ? selectedMessage.toName
                                : selectedMessage.fromName,
                            subject: selectedMessage.subject.startsWith("Re:")
                              ? selectedMessage.subject
                              : `Re: ${selectedMessage.subject}`,
                            bodyText: replyText,
                            labels: selectedMessage.labels,
                          })
                        }
                        className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        Expandir
                      </button>

                      <button
                        type="submit"
                        disabled={!replyText.trim() || sendingReply}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        {sendingReply ? "A enviar…" : "Enviar"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--accent)]">
                <Mail className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Selecione uma mensagem para ler
              </h3>
              <p className="mt-1 max-w-xs text-xs text-[var(--text-secondary)]">
                Escolha um email da lista à esquerda ou clique em &ldquo;Novo Email&rdquo; para escrever através de {account}.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ─── COMPOSE EMAIL MODAL (<dialog>) ─── */}
      <dialog
        ref={composeDialogRef}
        onClose={() => setShowComposeModal(false)}
        aria-labelledby="compose-mail-title"
        className="m-auto w-full max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-0 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/45"
      >
        <div className="flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
                <PenSquare className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 id="compose-mail-title" className="text-sm font-bold text-[var(--text-primary)]">
                  Novo Email · {account}
                </h2>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Envio direto autenticado pela Caixa de Correio Linke
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowComposeModal(false)}
              aria-label="Fechar janela de composição"
              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-bg)] hover:text-[var(--text-primary)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Compose Form Fields */}
          <div className="space-y-3.5 p-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Para (Email do destinatário)
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    list="linke-mail-contacts"
                    required
                    value={composeToEmail}
                    onChange={(e) => {
                      const val = e.target.value
                      setComposeToEmail(val)
                      const matched = contacts.find(
                        (c) => c.email.toLowerCase() === val.trim().toLowerCase()
                      )
                      if (matched && !composeToName) {
                        setComposeToName(matched.name)
                      }
                    }}
                    placeholder="cliente@empresa.pt"
                    className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </label>
                <datalist id="linke-mail-contacts">
                  {contacts.map((c, index) => (
                    <option key={`${c.email}-${c.name}-${index}`} value={c.email}>
                      {c.name} {c.category ? `(${c.category})` : ""}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="flex items-end gap-2">
                <label className="block flex-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                  Nome do destinatário
                  <input
                    type="text"
                    autoComplete="name"
                    value={composeToName}
                    onChange={(e) => setComposeToName(e.target.value)}
                    placeholder="Opcional"
                    className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowCcBcc((prev) => !prev)}
                  className="mb-0.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-2 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                >
                  Cc / Bcc
                </button>
              </div>
            </div>

            {showCcBcc && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Cc (separados por vírgula)
                  <input
                    type="text"
                    value={composeCc}
                    onChange={(e) => setComposeCc(e.target.value)}
                    placeholder="financeiro@empresa.pt"
                    className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </label>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                  Bcc (cópia oculta)
                  <input
                    type="text"
                    value={composeBcc}
                    onChange={(e) => setComposeBcc(e.target.value)}
                    placeholder="arquivo@linke.pt"
                    className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                  />
                </label>
              </div>
            )}

            <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
              Assunto
              <input
                type="text"
                required
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Ex.: Confirmação de Recolha / Faturação Mensal Linke"
                className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
            </label>

            {/* Labels Selector */}
            <div>
              <span className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                Etiquetas
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {MAIL_LABELS.map((lbl) => {
                  const selected = composeLabels.includes(lbl.id)
                  return (
                    <button
                      key={lbl.id}
                      type="button"
                      onClick={() =>
                        setComposeLabels((prev) =>
                          prev.includes(lbl.id)
                            ? prev.filter((l) => l !== lbl.id)
                            : [...prev, lbl.id]
                        )
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                        selected
                          ? lbl.badgeClass
                          : "border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 text-[var(--text-secondary)]"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: lbl.color }}
                      />
                      {lbl.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
              Mensagem
              <textarea
                rows={8}
                required
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Escreva a sua mensagem aqui…"
                className="mt-1 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-3 text-xs leading-relaxed text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
            </label>

            {/* Attached Files Preview */}
            {composeAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 p-2.5">
                {composeAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="inline-flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2.5 py-1 text-xs"
                  >
                    <Paperclip className="h-3 w-3 text-[var(--accent)]" aria-hidden="true" />
                    <span className="max-w-[180px] truncate font-medium">{att.name}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      ({formatFileSize(att.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setComposeAttachments((prev) => prev.filter((item) => item.id !== att.id))
                      }
                      aria-label={`Remover anexo ${att.name}`}
                      className="text-[var(--text-tertiary)] hover:text-rose-600"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/60 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => void handleUploadAttachment(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadingAttachment}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                {uploadingAttachment ? "A anexar…" : "Anexar ficheiro"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={sendingCompose}
                onClick={() => void handleSendOrDraftCompose(true)}
                className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                Guardar Rascunho
              </button>
              <button
                type="button"
                disabled={
                  sendingCompose || !composeToEmail.trim() || !composeSubject.trim() || !composeBody.trim()
                }
                onClick={() => void handleSendOrDraftCompose(false)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" aria-hidden="true" />
                {sendingCompose ? "A enviar…" : "Enviar Email"}
              </button>
            </div>
          </div>
        </div>
      </dialog>

      {/* ─── CONNECTION & WEBHOOK INFO MODAL (<dialog>) ─── */}
      <dialog
        ref={connectionDialogRef}
        onClose={() => setShowConnectionModal(false)}
        aria-labelledby="connection-modal-title"
        className="m-auto w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-0 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/45"
      >
        <div className="flex flex-col">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
              <h2 id="connection-modal-title" className="text-sm font-bold">
                Ligação de Email · geral@linke.pt
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowConnectionModal(false)}
              aria-label="Fechar"
              className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--surface-bg)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-4 p-5 text-xs leading-relaxed text-[var(--text-secondary)]">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-emerald-900">
              <p className="font-bold">Envio Direto (SMTP / Resend API) Ativo</p>
              <p className="mt-1 text-[11px] opacity-90">
                Todos os emails enviados a partir desta Caixa de Correio utilizam o domínio{" "}
                <strong>linke.pt</strong> ({account}) com assinatura institucional Linke e ficam sincronizados para toda a equipa.
              </p>
            </div>

            <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-3.5 text-sky-950">
              <p className="font-bold">Sincronização Direta Google Workspace (IMAP)</p>
              <p className="mt-1 text-[11px] opacity-90 leading-relaxed">
                A ligação IMAP lê a caixa de entrada real de <strong>geral@linke.pt</strong> (servidor <code>imap.gmail.com:993</code>) e descarrega novas mensagens automaticamente ao carregar no botão <strong>Sincronizar</strong>.
              </p>
              <div className="mt-2.5 rounded-lg bg-[var(--surface-bg)]/80 p-2.5 font-mono text-[10px] text-slate-800 space-y-1 border border-sky-500/20">
                <div><strong>Host:</strong> imap.gmail.com:993 (SSL)</div>
                <div><strong>Conta:</strong> geral@linke.pt</div>
                <div><strong>Autenticação:</strong> Google App Password (GMAIL_APP_PASSWORD)</div>
              </div>
              <p className="mt-2 text-[10px] text-slate-600">
                Dica: Se a conta tiver verificação de 2 passos (2FA), gere uma senha de aplicação de 16 caracteres em <em>myaccount.google.com/apppasswords</em>.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold text-[var(--text-primary)]">
                Webhook de Receção Automática (Inbound Emails)
              </p>
              <p className="text-[11px]">
                Para encaminhar emails recebidos em <strong>geral@linke.pt</strong> (Google Workspace / Resend Inbound) diretamente para esta Caixa de Entrada em tempo real, aponte o Webhook ou encaminhamento para:
              </p>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 font-mono text-[11px] text-[var(--text-primary)]">
                <span className="flex-1 truncate">{initialData.inboundWebhookUrl}</span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(initialData.inboundWebhookUrl)
                    setCopiedWebhook(true)
                    setTimeout(() => setCopiedWebhook(false), 2500)
                  }}
                  className="inline-flex items-center gap-1 rounded bg-[var(--surface-bg)] px-2 py-1 font-sans text-[10px] font-semibold text-[var(--accent)] shadow-2xs"
                >
                  <Copy className="h-3 w-3" aria-hidden="true" />
                  {copiedWebhook ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/60 px-5 py-3">
            <button
              type="button"
              onClick={() => setShowConnectionModal(false)}
              className="rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-white"
            >
              Concluído
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}

