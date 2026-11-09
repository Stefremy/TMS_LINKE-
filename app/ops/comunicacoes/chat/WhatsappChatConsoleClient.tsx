"use client"

import * as React from "react"
import Link from "next/link"
import {
  MessageSquare,
  Send,
  Paperclip,
  Smile,
  Search,
  RefreshCw,
  UserPlus,
  Users,
  CheckCheck,
  Check,
  AlertTriangle,
  FileText,
  X,
  Edit3,
  StickyNote,
  Bell,
  Package,
  Copy,
  Sparkles,
  Phone,
  Lock,
  Plus,
  Trash2,
} from "lucide-react"
import type { ChatLogItem } from "@/app/api/ops/communications/chat/route"

interface TeamReminder {
  id: string
  phone: string
  note: string
  dueAt: string
  done?: boolean
}

interface ConversationThread {
  phone: string
  displayName: string
  profileName: string | null
  lastMessageText: string
  lastMessageDirection: "in" | "out"
  lastMessageStatus: string | null
  lastMessageChannel: string
  lastTimestamp: number
  lastTimeFormatted: string
  inboundCount: number
  unreadCount: number
  messages: ChatLogItem[]
}

interface WhatsappChatConsoleClientProps {
  initialMessages: ChatLogItem[]
  initialContacts: Record<string, string>
  initialContactNotes: Record<string, string>
  initialTeamReminders: TeamReminder[]
}

const EMOJI_LIST = [
  "😀",
  "😅",
  "😊",
  "😉",
  "🙌",
  "👍",
  "👌",
  "✅",
  "🎉",
  "❤️",
  "⚠️",
  "🚛",
  "📦",
  "📍",
  "📋",
  "🕐",
  "📞",
  "🙏",
  "🤝",
  "💬",
]

function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "")
}

function normalizePhoneKey(raw: string): string {
  const digits = digitsOnly(raw)
  if (!digits) return ""
  if (digits.length === 9 && digits.startsWith("9")) {
    return `351${digits}`
  }
  return digits
}

function formatPhoneDisplay(phone: string): string {
  const digits = digitsOnly(phone)
  if (!digits) return "—"
  if (digits.startsWith("351") && digits.length === 12) {
    const local = digits.slice(3)
    return `+351 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 9)}`
  }
  return `+${digits}`
}

function formatConversationTimestamp(ts: number): string {
  if (!ts || !Number.isFinite(ts)) return ""
  const date = new Date(ts)
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  if (isToday) {
    return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  if (isYesterday) {
    return "Ontem"
  }

  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })
}

function formatDayDivider(isoString: string): string {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ""
  const now = new Date()
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (isToday) return "Hoje"

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  if (isYesterday) return "Ontem"

  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export function WhatsappChatConsoleClient({
  initialMessages,
  initialContacts,
  initialContactNotes,
  initialTeamReminders,
}: WhatsappChatConsoleClientProps) {
  const [activeInbox, setActiveInbox] = React.useState<"principal" | "incidencias">("principal")
  const [messages, setMessages] = React.useState<ChatLogItem[]>(initialMessages)
  const [phoneFullHistory, setPhoneFullHistory] = React.useState<Record<string, ChatLogItem[]>>({})
  const [includeTemplatesInThread, setIncludeTemplatesInThread] = React.useState(true)
  const [loadingRefresh, setLoadingRefresh] = React.useState(false)
  const [loadingPhoneHistory, setLoadingPhoneHistory] = React.useState(false)

  // Contact book & team context
  const [savedContacts, setSavedContacts] = React.useState<Record<string, string>>(initialContacts)
  const [contactNotes, setContactNotes] = React.useState<Record<string, string>>(initialContactNotes)
  const [teamReminders, setTeamReminders] = React.useState<TeamReminder[]>(initialTeamReminders)

  // Read timestamps per phone (stored in localStorage for per-operator read tracking)
  // Initialized to {} so that SSR and initial client hydration match identically.
  const [readTimestamps, setReadTimestamps] = React.useState<Record<string, number>>({})

  React.useEffect(() => {
    let rafId: number | null = null
    rafId = window.requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem("tms_wa_read_ts")
        if (raw) {
          setReadTimestamps(JSON.parse(raw) as Record<string, number>)
        }
      } catch {
        // Ignore
      }
    })
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId)
    }
  }, [])

  // Filters & search
  const [searchQuery, setSearchQuery] = React.useState("")
  const [contactFilter, setContactFilter] = React.useState<"all" | "inbound" | "unread">("all")
  const [activePhone, setActivePhone] = React.useState<string>("")

  // New conversation / Contact book modals/drawers
  const [newChatOpen, setNewChatOpen] = React.useState(false)
  const [newChatPhone, setNewChatPhone] = React.useState("")
  const [newChatName, setNewChatName] = React.useState("")
  const [contactBookOpen, setContactBookOpen] = React.useState(false)
  const [newBookPhone, setNewBookPhone] = React.useState("")
  const [newBookName, setNewBookName] = React.useState("")
  const [contextPanelOpen, setContextPanelOpen] = React.useState(true)

  // Inline contact rename
  const [editingName, setEditingName] = React.useState(false)
  const [editingNameValue, setEditingNameValue] = React.useState("")

  // Composer state
  const [composeText, setComposeText] = React.useState("")
  const [composeFile, setComposeFile] = React.useState<File | null>(null)
  const [sending, setSending] = React.useState(false)
  const [sendFeedback, setSendFeedback] = React.useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [emojiOpen, setEmojiOpen] = React.useState(false)

  // Team note & reminder inputs
  const [noteDraft, setNoteDraft] = React.useState("")
  const [savingNote, setSavingNote] = React.useState(false)
  const [newReminderText, setNewReminderText] = React.useState("")
  const [newReminderDue, setNewReminderDue] = React.useState("")

  // Refs for scroll & IME-safe enter
  const threadContainerRef = React.useRef<HTMLDivElement | null>(null)
  const lastMessageRef = React.useRef<HTMLElement | null>(null)
  const formRef = React.useRef<HTMLFormElement | null>(null)
  const lastCompositionEndAtRef = React.useRef<number | null>(null)

  const markPhoneAsRead = React.useCallback((phone: string) => {
    if (!phone) return
    const now = Date.now()
    setReadTimestamps((prev) => {
      const next = { ...prev, [phone]: now }
      try {
        localStorage.setItem("tms_wa_read_ts", JSON.stringify(next))
      } catch {
        // Ignore
      }
      return next
    })
  }, [])

  const fetchChatData = React.useCallback(async (silent = false) => {
    if (!silent) setLoadingRefresh(true)
    try {
      const res = await fetch("/api/ops/communications/chat?limit=900")
      const body = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(body.messages)) {
        setMessages(body.messages as ChatLogItem[])
        if (body.contacts && typeof body.contacts === "object") {
          setSavedContacts(body.contacts as Record<string, string>)
        }
        if (body.contactNotes && typeof body.contactNotes === "object") {
          setContactNotes(body.contactNotes as Record<string, string>)
        }
        if (Array.isArray(body.teamReminders)) {
          setTeamReminders(body.teamReminders as TeamReminder[])
        }
      }
    } catch {
      // Non-fatal background refresh error
    } finally {
      if (!silent) setLoadingRefresh(false)
    }
  }, [])

  const fetchFullPhoneHistory = React.useCallback(async (phone: string) => {
    const cleanPhone = normalizePhoneKey(phone)
    if (!cleanPhone) return
    setLoadingPhoneHistory(true)
    try {
      const res = await fetch(`/api/ops/communications/chat?phone=${encodeURIComponent(cleanPhone)}`)
      const body = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(body.messages)) {
        setPhoneFullHistory((prev) => ({
          ...prev,
          [cleanPhone]: body.messages as ChatLogItem[],
        }))
      }
    } catch {
      // Ignore
    } finally {
      setLoadingPhoneHistory(false)
    }
  }, [])

  // Auto-poll every 12 seconds for live incoming webhook messages
  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchChatData(true)
      if (activePhone) {
        void fetchFullPhoneHistory(activePhone)
      }
    }, 12000)
    return () => window.clearInterval(timer)
  }, [activePhone, fetchChatData, fetchFullPhoneHistory])

  // Build conversations grouped by normalized phone for the active inbox
  const conversations = React.useMemo<ConversationThread[]>(() => {
    const byPhone = new Map<string, ConversationThread>()

    const relevantMessages = messages.filter((msg) => {
      const ch = String(msg.channel || "").toLowerCase()
      if (activeInbox === "incidencias") {
        return ch === "chat_incidencias" || ch === "template_incidencias"
      }
      // Principal inbox shows chat, text, media, plus any inbound message
      return (
        ch === "chat" ||
        ch === "text" ||
        ch === "media" ||
        (msg.direction === "in" && ch === "chat_incidencias")
      )
    })

    // Sort oldest -> newest so we build threads in chronological order
    const chronological = [...relevantMessages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    for (const msg of chronological) {
      const phone = normalizePhoneKey(msg.to_number)
      if (!phone) continue

      const msgTs = new Date(msg.created_at).getTime() || 0
      const lastReadTs = readTimestamps[phone] || 0
      const isUnreadInbound = msg.direction === "in" && msgTs > lastReadTs

      const existing = byPhone.get(phone)
      const previewText =
        msg.message_text ||
        (msg.template_name ? `📋 Template: ${msg.template_name}` : "[Mensagem]")

      if (!existing) {
        const customName = savedContacts[phone] || ""
        const profileName = msg.contact_name ? String(msg.contact_name).trim() : null
        byPhone.set(phone, {
          phone,
          displayName: customName || profileName || formatPhoneDisplay(phone),
          profileName,
          lastMessageText: previewText,
          lastMessageDirection: msg.direction,
          lastMessageStatus: msg.status,
          lastMessageChannel: msg.channel,
          lastTimestamp: msgTs,
          lastTimeFormatted: formatConversationTimestamp(msgTs),
          inboundCount: msg.direction === "in" ? 1 : 0,
          unreadCount: isUnreadInbound ? 1 : 0,
          messages: [msg],
        })
      } else {
        if (!existing.profileName && msg.contact_name) {
          existing.profileName = String(msg.contact_name).trim()
        }
        existing.displayName =
          savedContacts[phone] || existing.profileName || formatPhoneDisplay(phone)
        existing.lastMessageText = previewText
        existing.lastMessageDirection = msg.direction
        existing.lastMessageStatus = msg.status
        existing.lastMessageChannel = msg.channel
        if (msgTs >= existing.lastTimestamp) {
          existing.lastTimestamp = msgTs
          existing.lastTimeFormatted = formatConversationTimestamp(msgTs)
        }
        if (msg.direction === "in") {
          existing.inboundCount += 1
        }
        if (isUnreadInbound) {
          existing.unreadCount += 1
        }
        existing.messages.push(msg)
      }
    }

    return Array.from(byPhone.values()).sort((a, b) => b.lastTimestamp - a.lastTimestamp)
  }, [activeInbox, messages, readTimestamps, savedContacts])

  // Count badges for tabs
  const principalInboundCount = React.useMemo(
    () => messages.filter((m) => m.direction === "in" && m.channel === "chat").length,
    [messages]
  )
  const incidenciasInboundCount = React.useMemo(
    () => messages.filter((m) => m.direction === "in" && m.channel === "chat_incidencias").length,
    [messages]
  )

  // Filtered conversation list
  const filteredConversations = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return conversations.filter((conv) => {
      if (contactFilter === "inbound" && conv.inboundCount === 0) return false
      if (contactFilter === "unread" && conv.unreadCount === 0) return false
      if (!q) return true
      return (
        conv.displayName.toLowerCase().includes(q) ||
        conv.phone.includes(q) ||
        conv.lastMessageText.toLowerCase().includes(q)
      )
    })
  }, [contactFilter, conversations, searchQuery])

  // Select a conversation helper
  const handleSelectConversation = React.useCallback(
    (phone: string) => {
      const normalized = normalizePhoneKey(phone)
      setActivePhone(normalized)
      setSendFeedback(null)
      setEditingName(false)
      setNoteDraft(contactNotes[normalized] || "")
      markPhoneAsRead(normalized)
      void fetchFullPhoneHistory(normalized)
    },
    [contactNotes, fetchFullPhoneHistory, markPhoneAsRead]
  )

  // Active conversation object
  const activeConversation = React.useMemo<ConversationThread | null>(() => {
    if (!activePhone) return null
    const existing = conversations.find((c) => c.phone === activePhone)
    if (existing) return existing
    const customName = savedContacts[activePhone] || ""
    return {
      phone: activePhone,
      displayName: customName || formatPhoneDisplay(activePhone),
      profileName: null,
      lastMessageText: "Nova conversa",
      lastMessageDirection: "out",
      lastMessageStatus: null,
      lastMessageChannel: activeInbox === "incidencias" ? "chat_incidencias" : "text",
      lastTimestamp: 0,
      lastTimeFormatted: "Agora",
      inboundCount: 0,
      unreadCount: 0,
      messages: [],
    }
  }, [activeInbox, activePhone, conversations, savedContacts])

  // Active thread messages (merging full phone history when available)
  const activeThreadMessages = React.useMemo<ChatLogItem[]>(() => {
    if (!activePhone) return []
    const baseMessages = activeConversation?.messages || []
    const fullHistory = phoneFullHistory[activePhone] || []

    const byId = new Map<string, ChatLogItem>()
    for (const item of [...baseMessages, ...fullHistory]) {
      const ch = String(item.channel || "").toLowerCase()
      if (!includeTemplatesInThread && (ch === "template" || ch === "template_incidencias" || ch === "sms")) {
        continue
      }
      if (activeInbox === "incidencias") {
        if (ch !== "chat_incidencias" && ch !== "template_incidencias") continue
      }
      byId.set(String(item.id), item)
    }

    return Array.from(byId.values()).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }, [activeConversation?.messages, activeInbox, activePhone, includeTemplatesInThread, phoneFullHistory])

  // Recent shipments / templates associated with active phone (for the right context panel)
  const activePhoneShipments = React.useMemo(() => {
    if (!activePhone) return []
    const full = phoneFullHistory[activePhone] || []
    return full
      .filter((m) => m.template_name || m.tracking_number)
      .slice(0, 8)
  }, [activePhone, phoneFullHistory])

  // Scroll to bottom when switching conversation or new message arrives
  React.useEffect(() => {
    if (!activePhone) return
    const timer = window.setTimeout(() => {
      if (lastMessageRef.current) {
        if (typeof CSS !== "undefined" && !CSS.supports("scroll-initial-target", "nearest")) {
          lastMessageRef.current.scrollIntoView({ behavior: "instant", block: "end" })
        } else if (threadContainerRef.current) {
          threadContainerRef.current.scrollTop = threadContainerRef.current.scrollHeight
        }
      }
    }, 40)
    return () => window.clearTimeout(timer)
  }, [activePhone, activeThreadMessages.length])

  // Persist team state helper
  async function persistTeamState(updates: {
    contacts?: Record<string, string>
    contactNotes?: Record<string, string>
    teamReminders?: TeamReminder[]
  }) {
    await fetch("/api/ops/communications/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_state",
        ...updates,
      }),
    })
  }

  async function handleSaveContactName(phone: string, name: string) {
    const cleanPhone = normalizePhoneKey(phone)
    const cleanName = name.trim()
    if (!cleanPhone) return
    const nextContacts = { ...savedContacts }
    if (cleanName) {
      nextContacts[cleanPhone] = cleanName
    } else {
      delete nextContacts[cleanPhone]
    }
    setSavedContacts(nextContacts)
    setEditingName(false)
    await persistTeamState({ contacts: nextContacts })
  }

  async function handleAddBookContact(e: React.FormEvent) {
    e.preventDefault()
    const cleanPhone = normalizePhoneKey(newBookPhone)
    const cleanName = newBookName.trim()
    if (!cleanPhone || !cleanName) return
    const nextContacts = { ...savedContacts, [cleanPhone]: cleanName }
    setSavedContacts(nextContacts)
    setNewBookPhone("")
    setNewBookName("")
    await persistTeamState({ contacts: nextContacts })
  }

  async function handleRemoveBookContact(phone: string) {
    const nextContacts = { ...savedContacts }
    delete nextContacts[phone]
    setSavedContacts(nextContacts)
    await persistTeamState({ contacts: nextContacts })
  }

  async function handleSaveContactNote() {
    if (!activePhone) return
    setSavingNote(true)
    try {
      const nextNotes = { ...contactNotes, [activePhone]: noteDraft }
      setContactNotes(nextNotes)
      await persistTeamState({ contactNotes: nextNotes })
    } finally {
      setSavingNote(false)
    }
  }

  async function handleAddReminder(e: React.FormEvent) {
    e.preventDefault()
    if (!activePhone || !newReminderText.trim() || !newReminderDue) return
    const item: TeamReminder = {
      id: `rem-${Date.now()}`,
      phone: activePhone,
      note: newReminderText.trim(),
      dueAt: newReminderDue,
    }
    const nextReminders = [item, ...teamReminders]
    setTeamReminders(nextReminders)
    setNewReminderText("")
    setNewReminderDue("")
    await persistTeamState({ teamReminders: nextReminders })
  }

  async function handleCompleteReminder(id: string) {
    const nextReminders = teamReminders.filter((r) => r.id !== id)
    setTeamReminders(nextReminders)
    await persistTeamState({ teamReminders: nextReminders })
  }

  function handleStartNewChat(e: React.FormEvent) {
    e.preventDefault()
    const cleanPhone = normalizePhoneKey(newChatPhone)
    if (!cleanPhone) return
    if (newChatName.trim()) {
      void handleSaveContactName(cleanPhone, newChatName.trim())
    }
    setNewChatOpen(false)
    setNewChatPhone("")
    setNewChatName("")
    handleSelectConversation(cleanPhone)
  }

  // Send text or media message
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!activePhone || sending) return

    const useIncNumber = activeInbox === "incidencias"

    // If a media file is attached, send media (with optional composeText as caption)
    if (composeFile) {
      setSending(true)
      setSendFeedback(null)
      try {
        const formData = new FormData()
        formData.append("file", composeFile)
        formData.append("to", activePhone)
        if (composeText.trim()) {
          formData.append("caption", composeText.trim())
        }
        if (activeConversation?.displayName) {
          formData.append("contactName", activeConversation.displayName)
        }
        formData.append("useIncNumber", useIncNumber ? "true" : "false")

        const res = await fetch("/api/ops/communications/chat", {
          method: "POST",
          body: formData,
        })
        const body = await res.json().catch(() => ({}))

        if (!res.ok || !body.ok) {
          setSendFeedback({
            type: "err",
            text: body?.finalBody?.error || body?.error || `Falha ao enviar ficheiro (${res.status})`,
          })
          return
        }

        const optimisticMsg: ChatLogItem = {
          id: `opt-${Date.now()}`,
          created_at: new Date().toISOString(),
          direction: "out",
          channel: useIncNumber ? "chat_incidencias" : "media",
          to_number: activePhone,
          contact_name: activeConversation?.displayName || null,
          message_text: composeText.trim()
            ? `[📎 ${composeFile.name}] ${composeText.trim()}`
            : `[📎 ${composeFile.name}]`,
          template_name: null,
          status: "accepted",
          api_message_id: body.messageId || null,
          tracking_number: null,
          media_type: body.mediaType || null,
          media_id: body.mediaId || null,
        }

        setMessages((prev) => [optimisticMsg, ...prev])
        setComposeFile(null)
        setComposeText("")
        setSendFeedback({ type: "ok", text: "Ficheiro enviado ✓" })
        void fetchFullPhoneHistory(activePhone)
      } catch (err) {
        setSendFeedback({
          type: "err",
          text: err instanceof Error ? err.message : "Erro de rede ao enviar ficheiro.",
        })
      } finally {
        setSending(false)
      }
      return
    }

    // Plain text message
    const cleanText = composeText.trim()
    if (!cleanText) return

    setSending(true)
    setSendFeedback(null)
    try {
      const res = await fetch("/api/ops/communications/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_text",
          to: activePhone,
          text: cleanText,
          contactName: activeConversation?.displayName || null,
          useIncNumber,
        }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok || !body.ok) {
        setSendFeedback({
          type: "err",
          text:
            body?.finalBody?.error?.message ||
            body?.finalBody?.error ||
            body?.error ||
            `Falha no envio (${res.status})`,
        })
        return
      }

      const optimisticMsg: ChatLogItem = {
        id: `opt-${Date.now()}`,
        created_at: new Date().toISOString(),
        direction: "out",
        channel: useIncNumber ? "chat_incidencias" : "text",
        to_number: activePhone,
        contact_name: activeConversation?.displayName || null,
        message_text: cleanText,
        template_name: null,
        status: "accepted",
        api_message_id: body.messageId || null,
        tracking_number: null,
        media_type: null,
        media_id: null,
      }

      setMessages((prev) => [optimisticMsg, ...prev])
      setComposeText("")
      setSendFeedback({ type: "ok", text: "Enviado ✓" })
      void fetchFullPhoneHistory(activePhone)
    } catch (err) {
      setSendFeedback({
        type: "err",
        text: err instanceof Error ? err.message : "Erro ao enviar mensagem.",
      })
    } finally {
      setSending(false)
    }
  }

  // IME-safe Enter-to-submit handler
  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()

      // Check native IME composition and keyCode 229 fallback
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
        return
      }

      // Safari compositionend timestamp window fallback
      if (
        lastCompositionEndAtRef.current !== null &&
        Math.abs(event.timeStamp - lastCompositionEndAtRef.current) < 50
      ) {
        return
      }

      formRef.current?.requestSubmit()
    }
  }

  const activeReminders = React.useMemo(
    () => teamReminders.filter((r) => r.phone === activePhone && !r.done),
    [activePhone, teamReminders]
  )

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 max-w-[1600px] mx-auto">
      {/* Top Header & Channel Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-white tracking-tight">
                Consola de Chat WhatsApp
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Cloud API
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Atendimento em tempo real, anexos media, contexto de encomendas e notas de equipa
            </p>
          </div>
        </div>

        {/* Inbox Switcher + Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-950/90 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveInbox("principal")
                setActivePhone("")
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeInbox === "principal"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat Principal</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/25 text-emerald-100">
                {principalInboundCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveInbox("incidencias")
                setActivePhone("")
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeInbox === "incidencias"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Respostas Incidências</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/25 text-amber-100">
                {incidenciasInboundCount}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setNewChatOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Nova Conversa</span>
          </button>

          <button
            type="button"
            onClick={() => setContactBookOpen((o) => !o)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition ${
              contactBookOpen
                ? "bg-slate-800 text-white border-slate-600"
                : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Contactos ({Object.keys(savedContacts).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setContextPanelOpen((o) => !o)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition ${
              contextPanelOpen
                ? "bg-slate-800 text-white border-slate-600"
                : "bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800"
            }`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span>Contexto & Notas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void fetchChatData(false)
              if (activePhone) void fetchFullPhoneHistory(activePhone)
            }}
            disabled={loadingRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingRefresh ? "animate-spin text-emerald-400" : ""}`} />
            <span>Atualizar</span>
          </button>

          <Link
            href="/ops/comunicacoes/whatsapp"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Templates & Auto</span>
          </Link>
        </div>
      </div>

      {/* Optional New Chat Quick Bar */}
      {newChatOpen ? (
        <form
          onSubmit={handleStartNewChat}
          className="flex flex-wrap items-end gap-3 bg-slate-900/95 border border-emerald-500/30 rounded-2xl p-4 shadow-md"
        >
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="new-chat-phone" className="block text-xs font-medium text-slate-300 mb-1">
              Telefone do Cliente (E.164 ou 9 dígitos PT)
            </label>
            <input
              id="new-chat-phone"
              type="text"
              value={newChatPhone}
              onChange={(e) => setNewChatPhone(e.target.value)}
              placeholder="Ex: 351912345678 ou 912345678"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="new-chat-name" className="block text-xs font-medium text-slate-300 mb-1">
              Nome do Contacto (opcional)
            </label>
            <input
              id="new-chat-name"
              type="text"
              value={newChatName}
              onChange={(e) => setNewChatName(e.target.value)}
              placeholder="Ex: Maria Silva (Loja COD)"
              className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
            >
              Abrir Conversa
            </button>
            <button
              type="button"
              onClick={() => setNewChatOpen(false)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {/* Optional Saved Contacts Drawer */}
      {contactBookOpen ? (
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Livro de Contactos da Equipa
            </h2>
            <button
              type="button"
              onClick={() => setContactBookOpen(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddBookContact} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newBookPhone}
              onChange={(e) => setNewBookPhone(e.target.value)}
              placeholder="Telefone (ex: 351912345678)"
              aria-label="Telefone do contacto"
              className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-white placeholder:text-slate-500"
            />
            <input
              type="text"
              value={newBookName}
              onChange={(e) => setNewBookName(e.target.value)}
              placeholder="Nome a apresentar"
              aria-label="Nome do contacto"
              className="flex-1 min-w-[180px] rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-white placeholder:text-slate-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Guardar Contacto
            </button>
          </form>

          {Object.keys(savedContacts).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-44 overflow-y-auto pt-1">
              {Object.entries(savedContacts).map(([phone, name]) => (
                <div
                  key={phone}
                  className="flex items-center justify-between gap-2 rounded-xl bg-slate-950/90 border border-slate-800/80 px-3 py-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectConversation(phone)
                      setContactBookOpen(false)
                    }}
                    className="text-left truncate flex-1 hover:text-emerald-400"
                  >
                    <div className="font-medium text-slate-200 truncate">{name}</div>
                    <div className="text-[11px] text-slate-500">{formatPhoneDisplay(phone)}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemoveBookContact(phone)}
                    className="text-slate-500 hover:text-rose-400 p-1"
                    title="Remover contacto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Ainda não existem contactos personalizados guardados.</p>
          )}
        </div>
      ) : null}

      {/* Main WhatsApp Web Simulated Console */}
      <div
        className={`grid gap-4 items-stretch ${
          contextPanelOpen
            ? "grid-cols-1 lg:grid-cols-[340px_1fr_320px]"
            : "grid-cols-1 lg:grid-cols-[350px_1fr]"
        }`}
        style={{ minHeight: "calc(100vh - 210px)", height: "740px" }}
      >
        {/* LEFT PANE: WhatsApp Conversation Sidebar */}
        <aside className="flex flex-col rounded-2xl bg-[#111b21] border border-slate-800/90 overflow-hidden shadow-xl">
          {/* Sidebar Header + Search */}
          <div className="p-3 bg-[#202c33] border-b border-slate-800/80 space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar nome, número ou mensagem..."
                aria-label="Pesquisar conversas"
                className="w-full rounded-xl bg-[#111b21] border border-slate-700/60 pl-9 pr-8 py-2 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setContactFilter("all")}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                  contactFilter === "all"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-[#111b21] text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                Todas ({conversations.length})
              </button>
              <button
                type="button"
                onClick={() => setContactFilter("inbound")}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                  contactFilter === "inbound"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-[#111b21] text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                Clientes ({conversations.filter((c) => c.inboundCount > 0).length})
              </button>
              <button
                type="button"
                onClick={() => setContactFilter("unread")}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                  contactFilter === "unread"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-[#111b21] text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                Não lidas ({conversations.filter((c) => c.unreadCount > 0).length})
              </button>
            </div>
          </div>

          {/* Contact Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs space-y-2">
                <MessageSquare className="w-7 h-7 mx-auto text-slate-600 stroke-[1.5]" />
                <p>Nenhuma conversa encontrada para este filtro.</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.phone === activePhone
                const initials = conv.displayName
                  .replace(/[^a-zA-Z0-9]/g, "")
                  .slice(0, 2)
                  .toUpperCase() || "WA"
                const hasNote = Boolean(contactNotes[conv.phone]?.trim())

                return (
                  <button
                    key={conv.phone}
                    type="button"
                    onClick={() => handleSelectConversation(conv.phone)}
                    className={`w-full text-left px-3.5 py-3 flex items-center gap-3 transition-colors ${
                      isSelected
                        ? "bg-[#2a3942]"
                        : "hover:bg-[#202c33]/80 bg-transparent"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center font-bold text-xs shadow-sm ${
                        activeInbox === "incidencias"
                          ? "bg-gradient-to-br from-amber-500/30 to-rose-500/30 text-amber-200 border border-amber-500/30"
                          : "bg-gradient-to-br from-emerald-500/30 to-teal-600/30 text-emerald-200 border border-emerald-500/30"
                      }`}
                    >
                      {initials}
                    </div>

                    {/* Meta */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-slate-100 truncate flex items-center gap-1.5">
                          {conv.displayName}
                          {hasNote ? (
                            <span
                              title="Tem nota da equipa"
                              className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0"
                            />
                          ) : null}
                        </span>
                        <span
                          suppressHydrationWarning
                          className={`text-[10px] shrink-0 ${
                            conv.unreadCount > 0 ? "text-emerald-400 font-semibold" : "text-slate-400"
                          }`}
                        >
                          {conv.lastTimeFormatted}
                        </span>
                      </div>

                      {conv.displayName !== formatPhoneDisplay(conv.phone) ? (
                        <div className="text-[10px] text-slate-400 truncate">
                          {formatPhoneDisplay(conv.phone)}
                        </div>
                      ) : null}

                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-slate-400 truncate flex items-center gap-1">
                          {conv.lastMessageDirection === "out" ? (
                            conv.lastMessageStatus === "read" ? (
                              <CheckCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            ) : conv.lastMessageStatus === "delivered" ? (
                              <CheckCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )
                          ) : null}
                          <span className="truncate">{conv.lastMessageText}</span>
                        </span>

                        {conv.unreadCount > 0 ? (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#25D366] text-[#0b141a] font-bold text-[10px] flex items-center justify-center shrink-0">
                            {conv.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* CENTER PANE: Simulated WhatsApp Phone / Desktop Chat Window */}
        <section className="flex flex-col rounded-2xl bg-[#0b141a] border border-slate-800/90 overflow-hidden shadow-xl">
          {/* WhatsApp Chat Header */}
          <header className="px-4 py-3 bg-[#202c33] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-bold text-xs ${
                  activeInbox === "incidencias"
                    ? "bg-amber-500/25 text-amber-300 border border-amber-500/40"
                    : "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                {activeConversation
                  ? activeConversation.displayName
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .slice(0, 2)
                      .toUpperCase() || "WA"
                  : "LN"}
              </div>

              <div className="min-w-0">
                {activeConversation ? (
                  editingName ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        void handleSaveContactName(activeConversation.phone, editingNameValue)
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={editingNameValue}
                        onChange={(e) => setEditingNameValue(e.target.value)}
                        placeholder="Nome do contacto..."
                        aria-label="Editar nome do contacto"
                        className="rounded-lg bg-[#111b21] border border-emerald-500/50 px-2.5 py-1 text-xs text-white focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-medium"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingName(false)}
                        className="px-2 py-1 rounded-lg bg-slate-700 text-slate-200 text-[11px]"
                      >
                        ×
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-semibold text-white truncate">
                        {activeConversation.displayName}
                      </strong>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNameValue(savedContacts[activeConversation.phone] || activeConversation.displayName)
                          setEditingName(true)
                        }}
                        className="text-slate-400 hover:text-emerald-400 transition"
                        title="Guardar ou editar nome deste contacto"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                ) : (
                  <strong className="text-sm font-semibold text-slate-200">
                    Seleciona uma conversa
                  </strong>
                )}

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {activeConversation ? (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-400" />
                        {formatPhoneDisplay(activeConversation.phone)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(activeConversation.phone)
                        }}
                        className="hover:text-white text-[11px] inline-flex items-center gap-0.5"
                        title="Copiar número"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <span>Escolhe um cliente na barra lateral ou inicia uma nova conversa</span>
                  )}
                </div>
              </div>
            </div>

            {/* Header Right Controls */}
            {activeConversation ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIncludeTemplatesInThread((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                    includeTemplatesInThread
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-[#111b21] text-slate-400 border-slate-700 hover:text-slate-200"
                  }`}
                  title="Mostrar também na conversa os templates e SMS automáticos enviados para este número"
                >
                  <Package className="w-3 h-3" />
                  <span>{includeTemplatesInThread ? "Templates visíveis" : "Só mensagens chat"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => markPhoneAsRead(activeConversation.phone)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#111b21] hover:bg-slate-800 text-slate-300 border border-slate-700 transition"
                >
                  Marcar lida
                </button>

                <button
                  type="button"
                  onClick={() => setActivePhone("")}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition"
                >
                  Fechar
                </button>
              </div>
            ) : null}
          </header>

          {/* WhatsApp Message Thread Canvas */}
          <main
            ref={threadContainerRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5"
            style={{
              background:
                "radial-gradient(circle at 18% 18%, rgba(16, 185, 129, 0.08), transparent 32%), radial-gradient(circle at 82% 82%, rgba(16, 185, 129, 0.05), transparent 35%), repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.015), rgba(255, 255, 255, 0.015) 10px, transparent 10px, transparent 22px), #0b141a",
            }}
          >
            {/* Meta Cloud API Encryption Notice */}
            <div className="flex justify-center mb-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#182229] border border-slate-800/80 text-[11px] text-amber-200/80 shadow-sm">
                <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                <span>
                  {activeInbox === "incidencias"
                    ? "Canal Oficial WhatsApp Incidências (+351 923 354 371) • Histórico sincronizado"
                    : "Canal Oficial WhatsApp Principal • Histórico sincronizado em tempo real"}
                </span>
              </div>
            </div>

            {!activeConversation ? (
              <div className="h-[420px] flex flex-col items-center justify-center text-center px-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                  <MessageSquare className="w-8 h-8 stroke-[1.5]" />
                </div>
                <h3 className="text-base font-semibold text-slate-200">
                  Consola WhatsApp Linke / Toke
                </h3>
                <p className="text-xs text-slate-400 max-w-md mt-1">
                  Seleciona um contacto à esquerda para ver toda a conversa estilo WhatsApp, responder com texto ou anexos, e consultar as encomendas associadas.
                </p>
              </div>
            ) : activeThreadMessages.length === 0 ? (
              <div className="h-[360px] flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                {loadingPhoneHistory
                  ? "A carregar histórico completo deste número..."
                  : "Ainda não existem mensagens nesta conversa. Escreve abaixo para enviar a primeira mensagem."}
              </div>
            ) : (
              activeThreadMessages.map((msg, index) => {
                const isInbound = msg.direction === "in"
                const isLast = index === activeThreadMessages.length - 1
                const prevMsg = index > 0 ? activeThreadMessages[index - 1] : null
                const currentDayLabel = formatDayDivider(msg.created_at)
                const prevDayLabel = prevMsg ? formatDayDivider(prevMsg.created_at) : ""
                const showDayDivider = currentDayLabel && currentDayLabel !== prevDayLabel

                const ch = String(msg.channel || "").toLowerCase()
                const isTemplate = ch === "template" || ch === "template_incidencias"
                const isSms = ch === "sms"
                const mediaUrl = msg.media_id
                  ? `/api/ops/communications/media/${encodeURIComponent(msg.media_id)}${
                      ch === "chat_incidencias" ? "?inc=1" : ""
                    }`
                  : null

                const msgTime = new Date(msg.created_at)
                const timeStr = Number.isNaN(msgTime.getTime())
                  ? ""
                  : msgTime.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })

                return (
                  <React.Fragment key={msg.id}>
                    {showDayDivider ? (
                      <div className="flex justify-center my-3">
                        <span
                          suppressHydrationWarning
                          className="px-3 py-1 rounded-lg bg-[#182229] text-[11px] font-medium text-slate-300 border border-slate-800/80 shadow-sm"
                        >
                          {currentDayLabel}
                        </span>
                      </div>
                    ) : null}

                    <div className={`flex ${isInbound ? "justify-start" : "justify-end"}`}>
                      <article
                        ref={isLast ? lastMessageRef : undefined}
                        style={isLast ? ({ scrollInitialTarget: "nearest" } as React.CSSProperties) : undefined}
                        className={`relative max-w-[82%] sm:max-w-[72%] rounded-2xl px-3.5 py-2.5 shadow-md text-xs leading-relaxed ${
                          isInbound
                            ? "bg-[#202c33] text-slate-100 rounded-tl-sm border border-slate-700/40"
                            : isTemplate
                            ? "bg-[#13362f] text-emerald-50 rounded-tr-sm border border-emerald-500/30"
                            : isSms
                            ? "bg-indigo-950/90 text-indigo-100 rounded-tr-sm border border-indigo-500/30"
                            : "bg-[#005c4b] text-white rounded-tr-sm"
                        }`}
                      >
                        {/* Badge for Template / SMS / Incidência */}
                        {isTemplate ? (
                          <div className="flex items-center justify-between gap-2 mb-1 pb-1 border-b border-emerald-400/20 text-[10px] text-emerald-300 font-semibold">
                            <span>📋 Template: {msg.template_name || "notificação"}</span>
                            {msg.tracking_number ? (
                              <span className="px-1.5 py-0.2 rounded bg-black/30 font-mono">
                                {msg.tracking_number}
                              </span>
                            ) : null}
                          </div>
                        ) : isSms ? (
                          <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-indigo-400/20 text-[10px] text-indigo-300 font-semibold">
                            <span>📱 SMS ClickSend</span>
                          </div>
                        ) : isInbound && msg.contact_name ? (
                          <div className="text-[11px] font-semibold text-emerald-400 mb-0.5">
                            {msg.contact_name}
                          </div>
                        ) : null}

                        {/* Media Rendering */}
                        {mediaUrl && (msg.media_type === "image" || msg.media_type === "sticker") ? (
                          <a href={mediaUrl} target="_blank" rel="noreferrer" className="block mb-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={mediaUrl}
                              alt={msg.media_type}
                              width={260}
                              height={200}
                              loading="lazy"
                              className="rounded-xl max-h-64 w-auto object-cover border border-white/15 bg-black/20"
                            />
                          </a>
                        ) : null}

                        {mediaUrl && msg.media_type === "video" ? (
                          <video
                            src={mediaUrl}
                            controls
                            preload="metadata"
                            className="rounded-xl max-h-64 w-full mb-2 border border-white/15 bg-black/30"
                          />
                        ) : null}

                        {mediaUrl && msg.media_type === "audio" ? (
                          <audio
                            src={mediaUrl}
                            controls
                            preload="metadata"
                            className="w-60 max-w-full mb-2"
                          />
                        ) : null}

                        {mediaUrl && msg.media_type === "document" ? (
                          <a
                            href={mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 mb-1.5 rounded-xl bg-black/25 hover:bg-black/40 text-emerald-200 font-medium border border-white/10 transition"
                          >
                            <FileText className="w-4 h-4 shrink-0" />
                            <span className="underline">Abrir documento anexo</span>
                          </a>
                        ) : null}

                        {/* Message Body */}
                        <p className="whitespace-pre-wrap break-words text-[13px]">
                          {msg.message_text || (msg.template_name ? `[${msg.template_name}]` : "[Sem texto]")}
                        </p>

                        {/* Timestamp & Delivery Status Ticks */}
                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-300/75 select-none">
                          <span suppressHydrationWarning>{timeStr}</span>
                          {!isInbound ? (
                            msg.status === "read" ? (
                              <span title="Lida pelo destinatário" className="text-sky-300 font-bold">
                                ✓✓
                              </span>
                            ) : msg.status === "delivered" ? (
                              <span title="Entregue" className="text-slate-200 font-bold">
                                ✓✓
                              </span>
                            ) : String(msg.status || "").startsWith("failed") ? (
                              <span title={`Falhou (${msg.status})`} className="text-rose-300 font-bold">
                                ⚠️ falhou
                              </span>
                            ) : (
                              <span title="Enviada / Aceite" className="text-slate-300">
                                ✓
                              </span>
                            )
                          ) : null}
                        </div>
                      </article>
                    </div>
                  </React.Fragment>
                )
              })
            )}
          </main>

          {/* WhatsApp Composer Footer */}
          <form
            ref={formRef}
            onSubmit={handleSendMessage}
            className="bg-[#202c33] border-t border-slate-800/80 p-3 space-y-2"
          >
            {/* Staged Attachment Bar */}
            {composeFile ? (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#111b21] border border-emerald-500/40 text-xs">
                <div className="flex items-center gap-2 truncate text-emerald-300">
                  <Paperclip className="w-4 h-4 shrink-0" />
                  <span className="truncate font-medium">{composeFile.name}</span>
                  <span className="text-[10px] text-slate-400">
                    ({Math.max(1, Math.round(composeFile.size / 1024))} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setComposeFile(null)}
                  className="text-slate-400 hover:text-rose-400 p-1"
                  title="Remover ficheiro"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : null}

            {/* Input Bar */}
            <div className="flex items-end gap-2 relative">
              {/* Emoji Picker Button */}
              <div className="relative">
                <button
                  type="button"
                  disabled={!activeConversation}
                  onClick={() => setEmojiOpen((o) => !o)}
                  aria-label="Abrir seletor de emoji"
                  title="Inserir Emoji"
                  className="w-10 h-10 rounded-xl bg-[#2a3942] hover:bg-slate-700 text-slate-200 flex items-center justify-center transition disabled:opacity-40"
                >
                  <Smile className="w-5 h-5" />
                </button>

                {emojiOpen ? (
                  <div
                    role="menu"
                    className="absolute bottom-12 left-0 z-20 w-60 p-2 rounded-2xl bg-[#111b21] border border-slate-700 shadow-2xl grid grid-cols-5 gap-1"
                  >
                    {EMOJI_LIST.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setComposeText((prev) => prev + emoji)
                          setEmojiOpen(false)
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-lg text-center transition"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Attachment Upload Button */}
              <label
                title="Anexar imagem, PDF, áudio ou vídeo"
                className={`w-10 h-10 rounded-xl bg-[#2a3942] hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer transition ${
                  !activeConversation ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <Paperclip className="w-5 h-5" />
                <input
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  disabled={!activeConversation}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setComposeFile(file)
                    e.target.value = ""
                  }}
                />
              </label>

              {/* Message Textarea */}
              <div className="flex-1">
                <label htmlFor="wa-chat-message-input" className="sr-only">
                  Mensagem WhatsApp
                </label>
                <textarea
                  id="wa-chat-message-input"
                  rows={2}
                  disabled={!activeConversation}
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  onCompositionEnd={(e) => {
                    lastCompositionEndAtRef.current = e.timeStamp
                  }}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={
                    !activeConversation
                      ? "Seleciona um contacto à esquerda para escrever..."
                      : composeFile
                      ? "Adiciona uma legenda opcional ao ficheiro... (Enter para enviar)"
                      : `Escreve uma mensagem para ${activeConversation.displayName}... (Enter envia, Shift+Enter nova linha)`
                  }
                  className="w-full rounded-xl bg-[#2a3942] border border-slate-700/70 px-3.5 py-2 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 resize-none disabled:opacity-40"
                />
              </div>

              {/* Send Submit Button */}
              <button
                type="submit"
                disabled={!activeConversation || sending || (!composeText.trim() && !composeFile)}
                className="h-10 px-4 rounded-xl bg-[#00a884] hover:bg-[#029072] text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                <span>{sending ? "A enviar..." : "Enviar"}</span>
              </button>
            </div>

            {sendFeedback ? (
              <div
                className={`text-[11px] px-2.5 py-1 rounded-lg inline-block ${
                  sendFeedback.type === "ok"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-rose-500/15 text-rose-300"
                }`}
              >
                {sendFeedback.text}
              </div>
            ) : null}
          </form>
        </section>

        {/* RIGHT PANE: Team Notes, Reminders & Shipment Context */}
        {contextPanelOpen ? (
          <aside className="flex flex-col gap-3 rounded-2xl bg-slate-900/95 border border-slate-800 p-4 overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-emerald-400" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Contexto do Cliente
                </h2>
              </div>
              {activeConversation ? (
                <span className="text-[11px] text-emerald-400 font-mono">
                  +{activeConversation.phone}
                </span>
              ) : null}
            </div>

            {!activeConversation ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Seleciona uma conversa para ver as encomendas, notas internas e lembretes deste cliente.
              </p>
            ) : (
              <>
                {/* Recent Shipments / Templates sent to this phone */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Envios & Templates Associados</span>
                  </h3>

                  {activePhoneShipments.length === 0 ? (
                    <div className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-3 text-[11px] text-slate-400">
                      Nenhum template automático registado para este número.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {activePhoneShipments.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl bg-slate-950/90 border border-slate-800 p-2.5 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-emerald-300 truncate">
                              {item.template_name || item.channel}
                            </span>
                            <span suppressHydrationWarning className="text-[10px] text-slate-500 shrink-0">
                              {new Date(item.created_at).toLocaleDateString("pt-PT")}
                            </span>
                          </div>
                          {item.tracking_number ? (
                            <div className="flex items-center justify-between bg-slate-900 rounded-lg px-2 py-1">
                              <span className="font-mono text-amber-300 font-medium">
                                {item.tracking_number}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  void navigator.clipboard?.writeText(item.tracking_number || "")
                                }}
                                className="text-slate-400 hover:text-white text-[10px] inline-flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" />
                                Copiar
                              </button>
                            </div>
                          ) : null}
                          {item.message_text ? (
                            <p className="text-slate-400 line-clamp-2">{item.message_text}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Team Internal Note per Contact */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <label
                    htmlFor="contact-team-note"
                    className="text-xs font-semibold text-slate-200 flex items-center justify-between"
                  >
                    <span>Nota Interna da Equipa</span>
                    {savingNote ? (
                      <span className="text-[10px] text-emerald-400">A guardar...</span>
                    ) : null}
                  </label>
                  <textarea
                    id="contact-team-note"
                    rows={3}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Ex: Cliente pediu entrega da parte da manhã ou confirmou morada..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveContactNote()}
                    disabled={savingNote}
                    className="w-full py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
                  >
                    Guardar Nota
                  </button>
                </div>

                {/* Team Reminders for this Contact */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    <span>Lembretes deste Contacto</span>
                  </h3>

                  <form onSubmit={handleAddReminder} className="space-y-2">
                    <input
                      type="text"
                      value={newReminderText}
                      onChange={(e) => setNewReminderText(e.target.value)}
                      placeholder="Ex: Ligar para confirmar receção"
                      aria-label="Texto do lembrete"
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-white placeholder:text-slate-500"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="datetime-local"
                        value={newReminderDue}
                        onChange={(e) => setNewReminderDue(e.target.value)}
                        aria-label="Data e hora do lembrete"
                        className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-[11px] text-slate-200"
                      />
                      <button
                        type="submit"
                        disabled={!newReminderText.trim() || !newReminderDue}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium disabled:opacity-40"
                      >
                        + Criar
                      </button>
                    </div>
                  </form>

                  {activeReminders.length > 0 ? (
                    <div className="space-y-1.5 pt-1">
                      {activeReminders.map((rem) => (
                        <div
                          key={rem.id}
                          className="flex items-center justify-between gap-2 rounded-xl bg-slate-950 border border-amber-500/30 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-slate-200 truncate">{rem.note}</div>
                            <div suppressHydrationWarning className="text-[10px] text-amber-300">
                              {new Date(rem.dueAt).toLocaleString("pt-PT")}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleCompleteReminder(rem.id)}
                            className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[10px] font-medium shrink-0"
                          >
                            Concluir
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">Sem lembretes pendentes.</p>
                  )}
                </div>
              </>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  )
}

