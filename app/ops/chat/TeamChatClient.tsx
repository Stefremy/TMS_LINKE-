"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, Download, FileSpreadsheet, FileText, Film, Hash, Image as ImageIcon, LockKeyhole, Maximize2, MessageSquare, Mic, MicOff, Minimize2, MonitorUp, Paperclip, Phone, PhoneCall, PhoneOff, Pin, Plus, Search, Send, Smile, Star, Users, Video, VideoOff, X } from "lucide-react"
import { RefreshIcon } from "@/components/ui/refresh-icon"
import { createCallNegotiator } from "@/lib/chat-call-peer"
import { openCallTransport } from "@/lib/chat-call-transport"
import { useIncomingCall } from "./hooks/useIncomingCall"
import { CHAT_MAX_LENGTH, DEFAULT_CHANNELS, mergeChatMessages, type ChatChannel, type ChatInboxItem, type ChatPage } from "@/lib/team-chat"
import { CURATED_GIFS, EMOJI_CATEGORIES, formatAttachmentMessage, formatCallMessage, formatFileSize, isOnlyEmojis, parseAttachmentMessage, parseCallMessage, parseGifMessage, type CallMode, type ChatAttachmentItem, type GifItem } from "@/lib/team-chat-media"
import styles from "./TeamChat.module.css"

function Avatar({ name, url }: { name: string; url: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  return <span className={styles.avatar} aria-hidden="true">{url && failedUrl !== url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(url)} />
  ) : name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()}</span>
}
const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Lisbon" }).format(new Date(value))
const timeLabel = (value: string) => new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" }).format(new Date(value))
const inboxDate = (value: string | null) => {
  if (!value) return ""
  const date = new Date(value), today = new Date()
  return date.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" }) === today.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" })
    ? timeLabel(value)
    : new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", timeZone: "Europe/Lisbon" }).format(date)
}
type InboxFilter = "all" | "unread" | "groups" | "favourites" | "pinned"
type InboxPreferences = { favourites: string[]; pinned: string[]; read: Record<string, number> }
type ActiveCallState = {
  roomId: string
  mode: CallMode
  title: string
  startedAt: number
  minimized: boolean
  micMuted: boolean
  cameraEnabled: boolean
  screenSharing: boolean
  mediaNotice: string | null
  micPermissionBlocked: boolean
  micRetrying: boolean
  remoteConnected: boolean
  remotePeerName: string | null
  remoteHasVideo: boolean
}

function microphoneErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "O navegador bloqueou o microfone. Nas permissões do site, permita o Microfone e tente novamente. No macOS, confirme também o acesso do navegador em Definições do Sistema > Privacidade e Segurança > Microfone."
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "Não foi encontrado um microfone ligado a este dispositivo."
  if (name === "NotReadableError" || name === "TrackStartError") return "O microfone está a ser usado por outra aplicação ou não pode ser iniciado. Feche essa aplicação e tente novamente."
  return "Não foi possível iniciar o microfone. Verifique as permissões e o dispositivo de áudio."
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ""
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "O navegador bloqueou a câmara. Nas permissões do site, permita a Câmara e tente novamente. No macOS, confirme também o acesso do navegador em Definições do Sistema > Privacidade e Segurança > Câmara."
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "Não foi encontrada uma câmara ligada a este dispositivo."
  if (name === "NotReadableError" || name === "TrackStartError") return "A câmara está a ser usada por outra aplicação ou não pode ser iniciada. Feche essa aplicação e tente novamente."
  return "Não foi possível iniciar a câmara. Verifique as permissões e o dispositivo de vídeo."
}

function formatCallDuration(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60)
  const secs = Math.floor(Math.max(0, seconds) % 60)
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

export function TeamChatClient({ initial, initialError, initialInbox }: { initial: ChatPage; initialError: string | null; initialInbox: ChatInboxItem[] }) {
  const [recipient, setRecipient] = useState<string | null>(null)
  const [channels, setChannels] = useState<ChatChannel[]>(initial.channels?.length ? initial.channels : DEFAULT_CHANNELS)
  const [activeChannel, setActiveChannel] = useState<string>(initial.activeChannel || "geral")
  const [members, setMembers] = useState(initial.members)
  const [messages, setMessages] = useState(initial.messages)
  const [hasOlder, setHasOlder] = useState(initial.hasMore)
  const [error, setError] = useState(initialError)
  const [ready, setReady] = useState(!initialError)
  const [blocked, setBlocked] = useState(false)
  const [sending, setSending] = useState(false)
  const [olderLoading, setOlderLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [retry, setRetry] = useState(0)
  const [inbox, setInbox] = useState(initialInbox)
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>("all")
  const [showMembers, setShowMembers] = useState(false)
  const [preferences, setPreferences] = useState<InboxPreferences>({ favourites: [], pinned: [], read: {} })
  const [preferencesReady, setPreferencesReady] = useState(false)

  // Modal para criar novo canal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newChannelName, setNewChannelName] = useState("")
  const [newChannelDesc, setNewChannelDesc] = useState("")
  const [creatingChannel, setCreatingChannel] = useState(false)
  const [channelError, setChannelError] = useState<string | null>(null)

  // Emojis e GIFs
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [emojiCategory, setEmojiCategory] = useState<string>(EMOJI_CATEGORIES[0].name)
  const [emojiSearch, setEmojiSearch] = useState("")
  const [gifCategory, setGifCategory] = useState<string>("Tudo")
  const [gifSearch, setGifSearch] = useState("")

  // Chamada de Voz e Vídeo (WebRTC + MediaDevices)
  const [activeCall, setActiveCall] = useState<ActiveCallState | null>(null)
  const [callElapsedSec, setCallElapsedSec] = useState(0)

  // Anexos (ficheiros e imagens)
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachmentItem[]>([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)

  const scroll = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiPopoverRef = useRef<HTMLDivElement>(null)
  const gifPopoverRef = useRef<HTMLDivElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const callSignalCleanupRef = useRef<(() => void) | null>(null)
  const callInstanceIdRef = useRef<string>("")
  const callStartingRef = useRef(false)
  const micRetryingRef = useRef(false)
  const notifyCallVideoRef = useRef<(() => void) | null>(null)
  const incomingCalls = useIncomingCall(initial.viewerId, activeCall?.roomId)
  const latest = useRef(initial.messages.at(-1)?.sequence || 0)
  const initialized = useRef(!initialError)
  const firstEffect = useRef(true)
  const stickBottom = useRef(true)
  const pending = useRef<{ key: string; body: string; id: string } | null>(null)

  const key = recipient ? `dm_${recipient}` : `ch_${activeChannel || "geral"}`
  const draft = drafts[key] || ""
  const peer = members.find(member => member.user_id === recipient)
  const me = members.find(member => member.user_id === initial.viewerId)
  const currentChannel = channels.find(c => c.slug === activeChannel) || channels[0] || { name: "Sala geral", description: "Toda a equipa", slug: "geral" }

  const deepLinkHandled = useRef(false)
  useEffect(() => {
    if (deepLinkHandled.current) return
    const params = new URLSearchParams(window.location.search)
    const conversation = params.get("conv"), answer = params.get("answer")
    if (!conversation) return
    // Opened from the global pop-up: jump to that conversation and optionally join the call.
    const timer = window.setTimeout(() => {
      deepLinkHandled.current = true
      if (conversation.startsWith("dm_")) selectConversation(conversation.slice(3))
      else if (conversation.startsWith("ch_")) selectChannel(conversation.slice(3))
      const mode = params.get("mode") === "video" ? "video" : "audio"
      if (answer && /^[a-z0-9_-]{2,64}$/i.test(answer)) void startOrJoinCall(mode, answer, params.get("title") || undefined, false)
      window.history.replaceState(null, "", "/ops/chat")
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(`linke-team-chat:${initial.viewerId}`)
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<InboxPreferences>
          const read: Record<string, number> = {}
          if (parsed.read && typeof parsed.read === "object") {
            for (const [conversation, sequence] of Object.entries(parsed.read)) {
              if (typeof sequence === "number" && Number.isSafeInteger(sequence) && sequence >= 0) read[conversation] = sequence
            }
          }
          setPreferences({ favourites: Array.isArray(parsed.favourites) ? parsed.favourites.filter(v => typeof v === "string") : [], pinned: Array.isArray(parsed.pinned) ? parsed.pinned.filter(v => typeof v === "string") : [], read })
        }
      } catch { /* Keep the inbox usable if local storage is unavailable. */ }
      setPreferencesReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [initial.viewerId])

  useEffect(() => {
    if (preferencesReady) localStorage.setItem(`linke-team-chat:${initial.viewerId}`, JSON.stringify(preferences))
  }, [initial.viewerId, preferences, preferencesReady])

  useEffect(() => {
    const controller = new AbortController()
    let stopped = false
    let inFlight = false
    const refresh = async () => {
      if (stopped || inFlight || controller.signal.aborted) return
      inFlight = true
      try {
        const response = await fetch(`/api/ops/chat?viewer=${initial.viewerId}&inbox=1`, { cache: "no-store", signal: controller.signal })
        if (response.ok) {
          const data = await response.json()
          if (data.viewerId === initial.viewerId && Array.isArray(data.items)) setInbox(data.items)
        } else if ([401, 403, 409].includes(response.status)) {
          stopped = true
        }
      } catch { /* Keep the last inbox snapshot and retry on the next interval. */ }
      finally { inFlight = false }
    }
    const timer = setInterval(() => { if (document.visibilityState === "visible" && !stopped) void refresh() }, 15000)
    return () => { stopped = true; controller.abort(); clearInterval(timer) }
  }, [initial.viewerId])

  useEffect(() => {
    if (!ready || !messages.length) return
    const activeKey = key, last = messages.at(-1)!
    const timer = window.setTimeout(() => {
      setPreferences(previous => ({ ...previous, read: { ...previous.read, [activeKey]: Math.max(previous.read[activeKey] || 0, last.sequence) } }))
      const gif = parseGifMessage(last.body).isGif
      const callInfo = parseCallMessage(last.body)
      const attInfo = parseAttachmentMessage(last.body)
      setInbox(previous => {
        const existing = previous.find(item => item.key === activeKey)
        if (!existing) return previous
        const preview = gif
          ? "GIF"
          : callInfo.isCall
            ? (callInfo.mode === "video" ? "Videochamada" : "Chamada de voz")
            : attInfo.hasAttachments
              ? `Anexo: ${attInfo.attachments[0].name}`
              : last.body.slice(0, 300)
        return [{ ...existing, preview, sender_name: last.sender_name, created_at: last.created_at, sequence: last.sequence }, ...previous.filter(item => item.key !== activeKey)]
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [key, messages, ready])

  const endpoint = useCallback((extra = "") => {
    const target = recipient ? `&recipient=${recipient}` : `&channel=${encodeURIComponent(activeChannel || "geral")}`
    return `/api/ops/chat?viewer=${initial.viewerId}${target}${extra}`
  }, [initial.viewerId, recipient, activeChannel])

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false
    let stopped = false
    let consecutiveErrors = 0
    let retryAfterMs: number | null = null
    const first = firstEffect.current
    firstEffect.current = false
    if (!first) initialized.current = false
    async function update() {
      if (running || stopped || controller.signal.aborted || document.visibilityState === "hidden") return
      running = true
      retryAfterMs = null
      try {
        let more = true, pages = 0
        let cursor = initialized.current && latest.current ? Math.max(1, latest.current - 100) : 0
        while (more && pages++ < 10) {
          const incremental = initialized.current
          const after = cursor ? `&after=${cursor}` : ""
          const response = await fetch(endpoint(after), { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
          const data = await response.json()
          if (controller.signal.aborted) return
          if (!response.ok) {
            if ([401, 403, 409].includes(response.status)) {
              stopped = true
              setBlocked(true)
            } else if (response.status === 429) {
              const header = Number(response.headers?.get("Retry-After"))
              if (Number.isFinite(header) && header > 0) retryAfterMs = Math.min(60_000, header * 1000)
            }
            throw new Error(data.error || "Não foi possível atualizar a conversa.")
          }
          if (data.viewerId !== initial.viewerId) { stopped = true; setBlocked(true); throw new Error("A sessão mudou. Atualize a página.") }
          consecutiveErrors = 0
          const page = data as ChatPage
          setMembers(page.members)
          if (page.channels && Array.isArray(page.channels)) {
            setChannels(page.channels)
          }
          setMessages(previous => incremental ? mergeChatMessages(previous, page.messages) : page.messages)
          if (!incremental || !latest.current) setHasOlder(page.hasMore)
          latest.current = Math.max(latest.current, page.messages.at(-1)?.sequence || 0)
          initialized.current = true
          setReady(true)
          setError(null)
          const nextCursor = page.messages.at(-1)?.sequence || cursor
          more = !!after && page.hasMore && nextCursor > cursor
          cursor = nextCursor
        }
      } catch (failure) {
        consecutiveErrors = Math.min(5, consecutiveErrors + 1)
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Ligação interrompida. Vamos tentar novamente.")
      } finally { running = false }
    }
    function schedule() {
      if (stopped || controller.signal.aborted) return
      const delay = consecutiveErrors === 0
        ? 5000
        : retryAfterMs ?? Math.min(60_000, 5000 * Math.pow(2, consecutiveErrors))
      timer = setTimeout(async () => { await update(); if (!controller.signal.aborted && !stopped) schedule() }, delay)
    }
    queueMicrotask(() => { void update().then(() => { if (!controller.signal.aborted && !stopped) schedule() }) })
    const onVisible = () => { if (document.visibilityState === "visible" && !stopped) void update() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { stopped = true; controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible) }
  }, [endpoint, initial.viewerId, retry])

  useEffect(() => {
    if (stickBottom.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight
  }, [messages, recipient, activeChannel])

  function selectChannel(slug: string) {
    if (sending || olderLoading || (!recipient && activeChannel === slug)) return
    setRecipient(null)
    setActiveChannel(slug)
    setMessages([])
    setPendingAttachments([])
    setHasOlder(false)
    setReady(false)
    setError(null)
    latest.current = 0
    initialized.current = false
    stickBottom.current = true
  }

  function selectConversation(value: string | null) {
    if (sending || olderLoading || value === recipient) return
    setRecipient(value)
    setMessages([])
    setPendingAttachments([])
    setHasOlder(false)
    setReady(false)
    setError(null)
    latest.current = 0
    initialized.current = false
    stickBottom.current = true
  }

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault()
    if (!newChannelName.trim() || creatingChannel) return
    setCreatingChannel(true)
    setChannelError(null)
    try {
      const response = await fetch("/api/ops/chat/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newChannelName.trim(), description: newChannelDesc.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível criar o canal.")
      const created: ChatChannel = data.channel
      setChannels(prev => [...prev.filter(c => c.slug !== created.slug), created])
      setShowCreateModal(false)
      setNewChannelName("")
      setNewChannelDesc("")
      selectChannel(created.slug)
    } catch (err) {
      setChannelError(err instanceof Error ? err.message : "Erro ao criar canal.")
    } finally {
      setCreatingChannel(false)
    }
  }

  async function loadOlder() {
    if (!messages.length || olderLoading) return
    setOlderLoading(true)
    const selectedKey = key
    try {
      const response = await fetch(endpoint(`&before=${messages[0].sequence}`), { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar o histórico.")
      if (selectedKey !== key) return
      const element = scroll.current
      const previousHeight = element?.scrollHeight || 0
      stickBottom.current = false
      setMessages(previous => mergeChatMessages(previous, data.messages)); setHasOlder(data.hasMore)
      requestAnimationFrame(() => { if (element) element.scrollTop += element.scrollHeight - previousHeight })
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível carregar o histórico.") }
    finally { setOlderLoading(false) }
  }

  async function handleUploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList)
    if (!files.length || uploadingAttachments || !ready || blocked) return
    setUploadingAttachments(true)
    setError(null)
    try {
      const uploaded: ChatAttachmentItem[] = []
      for (const file of files.slice(0, 5)) {
        const form = new FormData()
        form.append("file", file)
        const response = await fetch("/api/ops/chat/attachments", {
          method: "POST",
          body: form,
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || `Não foi possível anexar ${file.name}.`)
        }
        if (data.attachment) {
          uploaded.push(data.attachment as ChatAttachmentItem)
        }
      }
      if (uploaded.length) {
        setPendingAttachments(prev => [...prev, ...uploaded])
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível carregar o anexo.")
    } finally {
      setUploadingAttachments(false)
    }
  }

  function handleRemovePendingAttachment(id: string) {
    setPendingAttachments(prev => prev.filter(item => item.id !== id))
  }

  async function send() {
    const text = draft.trim()
    const body = pendingAttachments.length > 0 ? formatAttachmentMessage(pendingAttachments, text) : text
    if (!body || sending || uploadingAttachments || !ready || blocked) return
    setSending(true); setError(null)
    if (pending.current?.key !== key || pending.current?.body !== body) pending.current = { key, body, id: crypto.randomUUID() }
    try {
      const response = await fetch("/api/ops/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          viewerId: initial.viewerId,
          recipient,
          channel: recipient ? null : (activeChannel || "geral"),
          body,
          clientMessageId: pending.current.id,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        if ([401, 403, 409].includes(response.status)) setBlocked(true)
        throw new Error(data.error || "A mensagem não foi enviada.")
      }
      stickBottom.current = true
      setMessages(previous => mergeChatMessages(previous, [data.message]))
      setDrafts(previous => ({ ...previous, [key]: "" }))
      setPendingAttachments([])
      pending.current = null
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível confirmar o envio. O texto foi mantido; pode tentar novamente.") }
    finally { setSending(false) }
  }

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest?.(`.${styles.composerTools}`)) return

      if (showEmojiPicker && emojiPopoverRef.current && !emojiPopoverRef.current.contains(target)) {
        setShowEmojiPicker(false)
      }
      if (showGifPicker && gifPopoverRef.current && !gifPopoverRef.current.contains(target)) {
        setShowGifPicker(false)
      }
    }
    if (showEmojiPicker || showGifPicker) {
      document.addEventListener("mousedown", handleOutside)
      return () => document.removeEventListener("mousedown", handleOutside)
    }
  }, [showEmojiPicker, showGifPicker])

  function handleSelectEmoji(char: string) {
    const current = draft
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart ?? current.length
      const end = textarea.selectionEnd ?? current.length
      const next = current.slice(0, start) + char + current.slice(end)
      setDrafts(prev => ({ ...prev, [key]: next }))
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + char.length, start + char.length)
      }, 0)
    } else {
      setDrafts(prev => ({ ...prev, [key]: current + char }))
    }
  }

  async function handleSendGif(gif: GifItem) {
    setShowGifPicker(false)
    if (sending || !ready || blocked) return
    const gifBody = `[gif:${gif.url}]`
    setSending(true)
    setError(null)
    const clientMessageId = crypto.randomUUID()
    try {
      const response = await fetch("/api/ops/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          viewerId: initial.viewerId,
          recipient,
          channel: recipient ? null : (activeChannel || "geral"),
          body: gifBody,
          clientMessageId,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        if ([401, 403, 409].includes(response.status)) setBlocked(true)
        throw new Error(data.error || "O GIF não foi enviado.")
      }
      stickBottom.current = true
      setMessages(previous => mergeChatMessages(previous, [data.message]))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível enviar o GIF.")
    } finally {
      setSending(false)
    }
  }

  const cleanupCallResources = useCallback(() => {
    try {
      callSignalCleanupRef.current?.()
    } catch { /* ignore */ }
    callSignalCleanupRef.current = null
    notifyCallVideoRef.current = null
    callInstanceIdRef.current = ""
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close() } catch { /* ignore */ }
      peerConnectionRef.current = null
    }
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) track.stop()
      localStreamRef.current = null
    }
    if (screenStreamRef.current) {
      for (const track of screenStreamRef.current.getTracks()) track.stop()
      screenStreamRef.current = null
    }
    remoteStreamRef.current = null
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
  }, [])

  useEffect(() => {
    return () => {
      cleanupCallResources()
    }
  }, [cleanupCallResources])

  useEffect(() => {
    if (!activeCall) return
    const timer = window.setInterval(() => {
      setCallElapsedSec(Math.floor((Date.now() - activeCall.startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeCall])

  useEffect(() => {
    if (!activeCall || activeCall.minimized) return
    const activeVideoStream = activeCall.screenSharing && screenStreamRef.current ? screenStreamRef.current : localStreamRef.current
    if (localVideoRef.current && activeVideoStream) {
      localVideoRef.current.srcObject = activeVideoStream
    }
    if (remoteVideoRef.current && remoteStreamRef.current) {
      remoteVideoRef.current.srcObject = remoteStreamRef.current
    }
    if (remoteAudioRef.current && remoteStreamRef.current) {
      remoteAudioRef.current.srcObject = remoteStreamRef.current
    }
  }, [activeCall])

  async function postCallInviteMessage(mode: CallMode, roomId: string, title: string) {
    if (!ready || blocked) throw new Error("A conversa ainda não está pronta para ligar.")
    const callBody = formatCallMessage(mode, roomId, title)
    const clientMessageId = crypto.randomUUID()
    try {
      const response = await fetch("/api/ops/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          viewerId: initial.viewerId,
          recipient,
          channel: recipient ? null : (activeChannel || "geral"),
          body: callBody,
          clientMessageId,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data?.message) throw new Error(data.error || "Não foi possível chamar o colega.")
      stickBottom.current = true
      setMessages(previous => mergeChatMessages(previous, [data.message]))
    } catch (error) { throw error }
  }

  async function startOrJoinCall(mode: CallMode, customRoomId?: string, customTitle?: string, announce = false) {
    const targetTitle = customTitle || (recipient ? (peer?.name || "Conversa privada") : `#${currentChannel.name}`)
    const roomId = customRoomId || `call-${crypto.randomUUID()}`

    if (activeCall && activeCall.roomId === roomId) {
      if (mode === "video" && !activeCall.cameraEnabled) {
        await toggleCallCamera()
      }
      setActiveCall(prev => prev ? { ...prev, minimized: false } : null)
      return
    }

    if (callStartingRef.current) return
    callStartingRef.current = true
    if (announce) {
      try { await postCallInviteMessage(mode, roomId, targetTitle) }
      catch (error) { setError(error instanceof Error ? error.message : "Não foi possível chamar o colega."); callStartingRef.current = false; return }
    }
    cleanupCallResources()
    const instanceId = crypto.randomUUID()
    callInstanceIdRef.current = instanceId

    setCallElapsedSec(0)
    setActiveCall({
      roomId,
      mode,
      title: targetTitle,
      // This function runs only from call/answer buttons, never during rendering.
       
      startedAt: Date.now(),
      minimized: false,
      micMuted: false,
      cameraEnabled: mode === "video",
      screenSharing: false,
      mediaNotice: null,
      micPermissionBlocked: false,
      micRetrying: false,
      remoteConnected: false,
      remotePeerName: customTitle || (recipient ? (peer?.name || "Colega") : null),
      remoteHasVideo: false,
    })

    let stream: MediaStream | null = null
    let cameraOk = mode === "video"
    let notice: string | null = null
    let micPermissionBlocked = false

    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        })
      } catch (error) {
        if (mode === "video") {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            cameraOk = false
            notice = `${cameraErrorMessage(error)} A chamada continua apenas com áudio. Use «Ligar câmara» depois de permitir o acesso.`
          } catch (audioError) {
            cameraOk = false
            notice = `${microphoneErrorMessage(audioError)} A chamada continua em modo de escuta.`
            micPermissionBlocked = true
          }
        } else {
          notice = `${microphoneErrorMessage(error)} A chamada continua em modo de escuta.`
          micPermissionBlocked = true
        }
      }
    } else {
      cameraOk = false
      notice = "Dispositivos de áudio/vídeo não suportados neste contexto."
    }

    if (callInstanceIdRef.current !== instanceId) {
      if (stream) for (const t of stream.getTracks()) t.stop()
      callStartingRef.current = false
      return
    }

    localStreamRef.current = stream
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream
    }
    setActiveCall(prev => prev && prev.roomId === roomId ? { ...prev, cameraEnabled: cameraOk, mediaNotice: notice, micPermissionBlocked } : prev)

    const reportError = (error: unknown) => {
      if (callInstanceIdRef.current !== instanceId) return
      setActiveCall(previous => previous?.roomId === roomId ? { ...previous, mediaNotice: error instanceof Error ? error.message : "Falha de ligação à chamada. Tente novamente." } : previous)
    }
    try {
      if (typeof RTCPeerConnection === "undefined") throw new Error("Este navegador não suporta chamadas WebRTC.")
      const transport = await openCallTransport({ room: roomId, viewer: initial.viewerId, instance: instanceId, onError: reportError })
      if (callInstanceIdRef.current !== instanceId) { transport.close(); return }
      callSignalCleanupRef.current = () => transport.close()
      const pc = new RTCPeerConnection({ iceServers: transport.iceServers, iceTransportPolicy: transport.iceTransportPolicy })
      peerConnectionRef.current = pc
      if (localStreamRef.current) for (const track of localStreamRef.current.getTracks()) pc.addTrack(track, localStreamRef.current)
      // Keep both media sections available when a voice call gains video later.
      if (!pc.getTransceivers().some(item => item.sender.track?.kind === "video")) pc.addTransceiver("video", { direction: "sendrecv" })
      if (!pc.getTransceivers().some(item => item.sender.track?.kind === "audio")) pc.addTransceiver("audio", { direction: "sendrecv" })
      const remoteStream = new MediaStream()
      remoteStreamRef.current = remoteStream
      pc.ontrack = event => {
        const tracks = event.streams[0]?.getTracks() || [event.track]
        for (const track of tracks) {
          if (!remoteStream.getTrackById(track.id)) remoteStream.addTrack(track)
          const updateVideo = () => setActiveCall(previous => previous?.roomId === roomId ? { ...previous, remoteHasVideo: remoteStream.getVideoTracks().some(video => !video.muted && video.readyState === "live") } : previous)
          track.onunmute = updateVideo
          track.onmute = updateVideo
          track.onended = updateVideo
        }
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream
          void remoteAudioRef.current.play().catch(() => reportError(new Error("O navegador bloqueou o áudio. Carregue em «Ouvir áudio».")))
        }
        setActiveCall(previous => previous?.roomId === roomId ? { ...previous, remoteHasVideo: remoteStream.getVideoTracks().some(track => !track.muted && track.readyState === "live") } : previous)
      }
      pc.onconnectionstatechange = () => {
        if (peerConnectionRef.current !== pc) return
        if (pc.connectionState === "connected") setActiveCall(previous => previous?.roomId === roomId ? { ...previous, remoteConnected: true, mediaNotice: notice } : previous)
        if (pc.connectionState === "failed") setActiveCall(previous => previous?.roomId === roomId ? { ...previous, remoteConnected: false, mediaNotice: transport.relayConfigured ? "Não foi possível estabelecer áudio/vídeo nesta rede. Tente novamente ou contacte o administrador." : "Esta rede precisa de retransmissão para as chamadas. O serviço da equipa ainda não está configurado." } : previous)
        if (pc.connectionState === "disconnected") setActiveCall(previous => previous?.roomId === roomId ? { ...previous, remoteConnected: false, mediaNotice: "A ligação ao colega foi interrompida." } : previous)
      }
      const negotiator = createCallNegotiator(pc, {
        instance: instanceId,
        hasVideo: () => Boolean(screenStreamRef.current?.getVideoTracks().length || localStreamRef.current?.getVideoTracks().some(track => track.enabled)),
        send: transport.send,
        onPeer: (name, hasVideo) => setActiveCall(previous => previous?.roomId === roomId ? { ...previous, remotePeerName: name, remoteHasVideo: hasVideo } : previous),
        onLeave: () => { cleanupCallResources(); setActiveCall(null); setCallElapsedSec(0) },
        onError: reportError,
      })
      notifyCallVideoRef.current = negotiator.notifyVideo
      transport.start(negotiator.handle)
      transport.send({ type: "join", hasVideo: cameraOk })
    } catch (error) { reportError(error) }
    finally { callStartingRef.current = false }
  }

  function toggleCallMic() {
    if (!activeCall) return
    const nextMuted = !activeCall.micMuted
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getAudioTracks()) {
        track.enabled = !nextMuted
      }
    }
    setActiveCall(prev => prev ? { ...prev, micMuted: nextMuted } : null)
  }

  async function retryCallMicrophone() {
    if (!activeCall || micRetryingRef.current) return
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setActiveCall(previous => previous ? { ...previous, mediaNotice: "O navegador não disponibiliza o microfone neste endereço. Abra o TMS em localhost ou num endereço HTTPS." } : previous)
      return
    }
    micRetryingRef.current = true
    setActiveCall(previous => previous ? { ...previous, micRetrying: true } : null)
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const audioTrack = audioStream.getAudioTracks()[0]
      if (!audioTrack) throw new Error("Não foi possível iniciar o microfone.")
      const localStream = localStreamRef.current
      if (localStream) localStream.addTrack(audioTrack)
      else localStreamRef.current = audioStream
      const audioSender = peerConnectionRef.current?.getTransceivers().find(item => item.receiver.track.kind === "audio")?.sender
      if (audioSender) await audioSender.replaceTrack(audioTrack)
      else if (peerConnectionRef.current && localStreamRef.current) peerConnectionRef.current.addTrack(audioTrack, localStreamRef.current)
      setActiveCall(previous => previous ? { ...previous, micMuted: false, micPermissionBlocked: false, mediaNotice: null } : null)
    } catch (error) {
      setActiveCall(previous => previous ? { ...previous, micPermissionBlocked: true, mediaNotice: microphoneErrorMessage(error) } : null)
    } finally {
      micRetryingRef.current = false
      setActiveCall(previous => previous ? { ...previous, micRetrying: false } : null)
    }
  }

  async function toggleCallCamera() {
    if (!activeCall) return
    const stream = localStreamRef.current
    const existingVideoTracks = stream?.getVideoTracks() || []
    if (existingVideoTracks.length > 0) {
      const nextEnabled = !activeCall.cameraEnabled
      for (const track of existingVideoTracks) {
        track.enabled = nextEnabled
      }
      notifyCallVideoRef.current?.()
      setActiveCall(prev => prev ? { ...prev, cameraEnabled: nextEnabled, mode: nextEnabled ? "video" : prev.mode } : null)
      return
    }

    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } })
        const videoTrack = videoStream.getVideoTracks()[0]
        if (videoTrack) {
          if (stream) {
            stream.addTrack(videoTrack)
          } else {
            localStreamRef.current = videoStream
          }
          if (peerConnectionRef.current && localStreamRef.current) {
            const sender = peerConnectionRef.current.getTransceivers().find(item => item.receiver.track.kind === "video")?.sender
            if (sender) await sender.replaceTrack(videoTrack)
            else peerConnectionRef.current.addTrack(videoTrack, localStreamRef.current)
          }
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current
          }
          notifyCallVideoRef.current?.()
          setActiveCall(prev => prev ? { ...prev, cameraEnabled: true, mode: "video", mediaNotice: null } : null)
        }
      } catch (error) {
        setActiveCall(prev => prev ? { ...prev, mediaNotice: cameraErrorMessage(error) } : null)
      }
    }
  }

  async function toggleScreenShare() {
    if (!activeCall) return
    if (activeCall.screenSharing) {
      if (screenStreamRef.current) {
        for (const track of screenStreamRef.current.getTracks()) track.stop()
        screenStreamRef.current = null
      }
      const camTrack = localStreamRef.current?.getVideoTracks()[0] || null
      const sender = peerConnectionRef.current?.getTransceivers().find(item => item.receiver.track.kind === "video")?.sender
      if (sender) await sender.replaceTrack(camTrack)
      notifyCallVideoRef.current?.()
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
      }
      setActiveCall(prev => prev ? { ...prev, screenSharing: false } : null)
      return
    }

    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getDisplayMedia) {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        const screenTrack = displayStream.getVideoTracks()[0]
        if (!screenTrack) return
        screenStreamRef.current = displayStream
        const sender = peerConnectionRef.current?.getTransceivers().find(item => item.receiver.track.kind === "video")?.sender
        if (sender) {
          await sender.replaceTrack(screenTrack)
        } else if (peerConnectionRef.current) {
          peerConnectionRef.current.addTrack(screenTrack, displayStream)
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = displayStream
        }
        screenTrack.onended = () => {
          screenStreamRef.current = null
          const cameraTrack = localStreamRef.current?.getVideoTracks()[0] || null
          const videoSender = peerConnectionRef.current?.getTransceivers().find(item => item.receiver.track.kind === "video")?.sender
          if (videoSender) void videoSender.replaceTrack(cameraTrack).then(() => notifyCallVideoRef.current?.())
          if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current
          setActiveCall(prev => prev ? { ...prev, screenSharing: false } : null)
        }
        notifyCallVideoRef.current?.()
        setActiveCall(prev => prev ? { ...prev, screenSharing: true, mode: "video" } : null)
      } catch { /* User cancelled screen share picker */ }
    }
  }

  function endCall() {
    cleanupCallResources()
    setActiveCall(null)
    setCallElapsedSec(0)
  }

  const filteredEmojis = emojiSearch.trim()
    ? EMOJI_CATEGORIES.flatMap(cat => cat.emojis).filter(e =>
        e.keywords.toLowerCase().includes(emojiSearch.trim().toLowerCase()) || e.char.includes(emojiSearch.trim())
      )
    : (EMOJI_CATEGORIES.find(c => c.name === emojiCategory) || EMOJI_CATEGORIES[0]).emojis

  const filteredGifs = CURATED_GIFS.filter(g => {
    if (gifSearch.trim()) {
      const term = gifSearch.trim().toLowerCase()
      return (
        g.title.toLowerCase().includes(term) ||
        g.category.toLowerCase().includes(term) ||
        g.tags.some(t => t.toLowerCase().includes(term))
      )
    }
    if (gifCategory !== "Tudo") {
      return g.category === gifCategory
    }
    return true
  })

  const searchTerm = search.trim().toLocaleLowerCase("pt-PT")
  const privateMembers = members.filter(member => member.user_id !== initial.viewerId)
  const getUnreadCount = (item: ChatInboxItem) => {
    const lastRead = preferences.read[item.key] || 0
    if (item.sequences && item.sequences.length) {
      return item.sequences.filter(seq => seq > lastRead).length
    }
    return item.sequence > 0 && item.sequence > lastRead ? 1 : 0
  }
  const hasUnreadMessages = (item: ChatInboxItem) => getUnreadCount(item) > 0
  const unreadCount = inbox.filter(hasUnreadMessages).length
  const favouriteCount = inbox.filter(item => preferences.favourites.includes(item.key)).length
  const pinnedCount = inbox.filter(item => preferences.pinned.includes(item.key)).length
  const inboxItems = inbox.filter(item => {
    const matchesSearch = !searchTerm || `${item.title} ${item.subtitle} ${item.preview} ${item.sender_name || ""}`.toLocaleLowerCase("pt-PT").includes(searchTerm)
    if (!matchesSearch) return false
    if (inboxFilter === "unread") return hasUnreadMessages(item)
    if (inboxFilter === "groups") return item.kind === "channel"
    if (inboxFilter === "favourites") return preferences.favourites.includes(item.key)
    if (inboxFilter === "pinned") return preferences.pinned.includes(item.key)
    return true
  }).sort((a, b) => Number(preferences.pinned.includes(b.key)) - Number(preferences.pinned.includes(a.key)) ||
    (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0) || a.title.localeCompare(b.title, "pt-PT"))
  const memberItems = inboxItems.filter(item => item.kind === "dm" && item.sequence === 0)
  const conversationItems = inboxItems.filter(item => item.kind !== "dm" || item.sequence > 0)

  function selectInboxItem(item: ChatInboxItem) {
    if (item.kind === "channel") selectChannel(item.key.slice(3))
    else selectConversation(item.key.slice(3))
  }

  function toggleInboxPreference(field: "favourites" | "pinned", itemKey: string) {
    setPreferences(previous => {
      const values = new Set(previous[field])
      if (values.has(itemKey)) values.delete(itemKey)
      else values.add(itemKey)
      return { ...previous, [field]: [...values] }
    })
  }

  return <div className={styles.page}>
    <div className={styles.heading}>
      <div>
        <h1>Chat da equipa<span className={styles.headingDot} aria-hidden="true" /></h1>
        <p>Canais temáticos e conversas privadas com a equipa.</p>
      </div>
      <span className={styles.headingBadge}><LockKeyhole size={13} /> Espaço da equipa</span>
    </div>

    {incomingCalls.incoming && (() => {
      const callerAvatar =
        incomingCalls.incoming.senderAvatarUrl ||
        members.find(m => m.user_id === incomingCalls.incoming?.senderId)?.avatar_url ||
        null
      return (
        <div className={styles.incomingCall} role="alert">
          {callerAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={callerAvatar}
              alt={incomingCalls.incoming.senderName}
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-[var(--accent)]"
            />
          ) : (
            <PhoneCall size={22} aria-hidden="true" />
          )}
          <div><strong>{incomingCalls.incoming.senderName} está a ligar</strong><p>{incomingCalls.incoming.mode === "video" ? "Videochamada" : "Chamada de voz"} · {incomingCalls.incoming.title}</p></div>
          {!incomingCalls.soundReady && <button type="button" className={styles.callControlBtn} onClick={incomingCalls.enableSound}>Ativar toque</button>}
          <button type="button" className={styles.callHangupBtn} onClick={() => {
            const call = incomingCalls.incoming!
            incomingCalls.dismiss(call.roomId)
            void fetch("/api/ops/chat/calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ viewerId: initial.viewerId, room: call.roomId, signal: { id: crypto.randomUUID(), instance: crypto.randomUUID(), type: "leave" } }) }).catch(() => setError("Não foi possível recusar a chamada. Tente novamente."))
          }}><PhoneOff size={15} />Recusar</button>
          <button type="button" className={styles.sendButton} onClick={() => {
            const call = incomingCalls.incoming!
            incomingCalls.enableSound()
            incomingCalls.dismiss(call.roomId)
            if (call.conversationKey.startsWith("dm_")) selectConversation(call.conversationKey.slice(3))
            else selectChannel(call.conversationKey.slice(3))
            void startOrJoinCall(call.mode, call.roomId, call.title, false)
          }}><Phone size={15} />Atender</button>
        </div>
      )
    })()}

    <div className={styles.mobileConversation}>
      <label htmlFor="chat-conversation">Conversa</label>
      <div>
        <select id="chat-conversation" value={key} disabled={sending || olderLoading} onChange={event => {
          const value = event.target.value
          if (value.startsWith("ch_")) selectChannel(value.slice(3))
          else selectConversation(value.slice(3))
        }}>
          <optgroup label="Canais">{channels.map(channel => {
            const item = inbox.find(i => i.key === `ch_${channel.slug}`)
            const count = item ? getUnreadCount(item) : 0
            return <option key={channel.slug} value={`ch_${channel.slug}`}># {channel.name}{count > 0 ? ` (${count} não lida${count > 1 ? "s" : ""})` : ""}</option>
          })}</optgroup>
          <optgroup label="Conversas privadas">{privateMembers.map(member => {
            const item = inbox.find(i => i.key === `dm_${member.user_id}`)
            const count = item ? getUnreadCount(item) : 0
            return <option key={member.user_id} value={`dm_${member.user_id}`}>{member.name}{count > 0 ? ` (${count} não lida${count > 1 ? "s" : ""})` : ""}</option>
          })}</optgroup>
        </select>
        <button type="button" className={styles.refresh} aria-label="Criar novo canal" onClick={() => { setChannelError(null); setShowCreateModal(true) }}><Plus size={18} /></button>
      </div>
    </div>
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Conversas">
        <div className={styles.sidebarHeader}><div><MessageSquare size={17} /><h2>Conversas</h2></div><button type="button" className={styles.createChannelBtn} onClick={() => { setChannelError(null); setShowCreateModal(true) }} aria-label="Criar novo canal" title="Criar novo canal"><Plus size={16} /></button></div>
        <label className={styles.search}>
          <Search size={16} />
          <input aria-label="Procurar conversa" placeholder="Procurar…" value={search} onChange={event => setSearch(event.target.value)} />
        </label>
        <nav className={styles.inboxFilters} aria-label="Filtros de conversas">
          {([
            ["all", "Todas", inbox.length], ["unread", "Não lidas", unreadCount], ["groups", "Grupos", inbox.filter(item => item.kind === "channel").length],
            ["favourites", "Favoritos", favouriteCount], ["pinned", "Afixadas", pinnedCount],
          ] as [InboxFilter, string, number][]).map(([filter, label, count]) => <button key={filter} type="button" className={inboxFilter === filter ? styles.activeInboxFilter : ""} aria-pressed={inboxFilter === filter} onClick={() => setInboxFilter(filter)}><span>{label}</span><span>{count}</span></button>)}
        </nav>
        <div className={styles.inboxList}>
          {conversationItems.map(item => {
            const selected = key === item.key
            const itemUnreadCount = getUnreadCount(item)
            const isUnread = itemUnreadCount > 0
            const preview = item.sender_name ? `${item.sender_name === me?.name ? "Tu" : item.sender_name}: ${item.preview}` : item.preview
            return <div className={`${styles.inboxItem} ${selected ? styles.selectedInboxItem : ""}`} key={item.key}>
              <button type="button" className={styles.inboxOpen} onClick={() => selectInboxItem(item)} disabled={sending || olderLoading} aria-pressed={selected} aria-label={`${item.kind === "channel" ? "Grupo" : "Conversa com"} ${item.title}${isUnread ? `, ${itemUnreadCount} mensagens não lidas` : ""}`}>
                {item.kind === "channel" ? <span className={styles.inboxGroupIcon}><Hash size={17} /></span> : <Avatar name={item.title} url={item.avatar_url} />}
                <span className={styles.inboxCopy}>
                  <span className={styles.inboxTitle}><strong>{item.title}</strong><time>{inboxDate(item.created_at)}</time></span>
                  <span className={`${styles.inboxPreview} ${isUnread ? styles.unreadPreview : ""}`}>{preview}</span>
                </span>
                {isUnread && <span className={styles.unreadBadge} aria-label={`${itemUnreadCount} não lidas`}>{itemUnreadCount > 99 ? "99+" : itemUnreadCount}</span>}
              </button>
              <div className={styles.inboxActions}>
                <button type="button" aria-label={`${preferences.favourites.includes(item.key) ? "Remover dos" : "Adicionar aos"} favoritos: ${item.title}`} aria-pressed={preferences.favourites.includes(item.key)} title="Favorito" onClick={() => toggleInboxPreference("favourites", item.key)}><Star size={13} fill={preferences.favourites.includes(item.key) ? "currentColor" : "none"} /></button>
                <button type="button" aria-label={`${preferences.pinned.includes(item.key) ? "Desafixar" : "Afixar"}: ${item.title}`} aria-pressed={preferences.pinned.includes(item.key)} title="Afixar" onClick={() => toggleInboxPreference("pinned", item.key)}><Pin size={13} fill={preferences.pinned.includes(item.key) ? "currentColor" : "none"} /></button>
              </div>
            </div>
          })}
          {!!memberItems.length && <div className={styles.membersSection}>
            <div className={`${styles.membersContent} ${showMembers ? styles.membersContentOpen : ""}`} aria-hidden={!showMembers}>
              <div className={styles.membersContentInner}>
                {memberItems.map(item => {
                  const selected = key === item.key
                  return <div className={`${styles.inboxItem} ${selected ? styles.selectedInboxItem : ""}`} key={item.key}>
                    <button type="button" className={styles.inboxOpen} onClick={() => selectInboxItem(item)} disabled={sending || olderLoading || !showMembers} aria-pressed={selected} aria-label={`Iniciar conversa privada com ${item.title}`}>
                      <Avatar name={item.title} url={item.avatar_url} />
                      <span className={styles.inboxCopy}><span className={styles.inboxTitle}><strong>{item.title}</strong></span><span className={styles.inboxPreview}>Iniciar conversa</span></span>
                    </button>
                    <div className={styles.inboxActions}>
                      <button type="button" disabled={!showMembers} aria-label={`${preferences.favourites.includes(item.key) ? "Remover dos" : "Adicionar aos"} favoritos: ${item.title}`} aria-pressed={preferences.favourites.includes(item.key)} title="Favorito" onClick={() => toggleInboxPreference("favourites", item.key)}><Star size={13} fill={preferences.favourites.includes(item.key) ? "currentColor" : "none"} /></button>
                      <button type="button" disabled={!showMembers} aria-label={`${preferences.pinned.includes(item.key) ? "Desafixar" : "Afixar"}: ${item.title}`} aria-pressed={preferences.pinned.includes(item.key)} title="Afixar" onClick={() => toggleInboxPreference("pinned", item.key)}><Pin size={13} fill={preferences.pinned.includes(item.key) ? "currentColor" : "none"} /></button>
                    </div>
                  </div>
                })}
              </div>
            </div>
            <button type="button" className={styles.membersToggle} aria-expanded={showMembers} onClick={() => setShowMembers(value => !value)}>
              <span>{showMembers ? "Ocultar membros" : "Ver membros"}<small>{memberItems.length}</small></span>
              <ChevronDown size={14} className={showMembers ? styles.membersChevronOpen : ""} />
            </button>
          </div>}
          {!inboxItems.length && <p className={styles.directoryNote}>{inboxFilter === "unread" ? "Não tens conversas por ler." : inboxFilter === "favourites" ? "Adiciona conversas aos favoritos com a estrela." : inboxFilter === "pinned" ? "Afixa conversas com o ícone do alfinete." : "Não foram encontradas conversas."}</p>}
        </div>
        <div className={styles.myProfile}>
          {me && <Avatar name={me.name} url={me.avatar_url} />}
          <span>
            <strong>{me?.name || "A tua conta"}</strong>
            <small>Sessão iniciada</small>
          </span>
        </div>
      </aside>

      {/* Thread de Mensagens */}
      <section className={styles.thread} aria-label={recipient ? `Conversa com ${peer?.name || "colega"}` : `#${currentChannel.name}`}>
        <div className={styles.threadHeader}>
          <div className={styles.threadTitle}>
            {recipient && peer ? <Avatar name={peer.name} url={peer.avatar_url} /> : <span className={styles.generalIcon}><Hash size={21} /></span>}
            <div>
              <h2>{recipient ? peer?.name || "Conversa privada" : `# ${currentChannel.name}`}</h2>
              <p>{recipient ? "Visível apenas aos dois participantes" : currentChannel.description || "Canal público para a equipa"}</p>
            </div>
          </div>
          <div className={styles.threadActions}>
            {activeCall && (
              <span className={styles.activeCallPill} role="status">
                <span className={styles.liveDot} aria-hidden="true" />
                {activeCall.mode === "video" ? "Vídeo" : "Voz"} · {formatCallDuration(callElapsedSec)}
              </span>
            )}
            <button
              type="button"
              className={`${styles.callBtn} ${activeCall && activeCall.mode === "audio" ? styles.callBtnActive : ""}`}
              aria-label="Iniciar chamada de voz"
              title="Iniciar chamada de voz"
              disabled={!ready || blocked}
              onClick={() => void startOrJoinCall("audio", undefined, undefined, true)}
            >
              <Phone size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`${styles.callBtn} ${activeCall && activeCall.mode === "video" ? styles.callBtnActive : ""}`}
              aria-label="Iniciar videochamada"
              title="Iniciar videochamada"
              disabled={!ready || blocked}
              onClick={() => void startOrJoinCall("video", undefined, undefined, true)}
            >
              <Video size={16} aria-hidden="true" />
            </button>
            <span className={styles.privacyBadge}>{recipient ? <LockKeyhole size={12} /> : <Users size={12} />}{recipient ? "Privada" : "Canal da equipa"}</span>
            <button type="button" className={styles.refresh} aria-label="Atualizar conversa" onClick={() => setRetry(value => value + 1)}><RefreshIcon size={17} /></button>
          </div>
        </div>

        {activeCall && (
          <div className={`${styles.callStage} ${activeCall.minimized ? styles.callStageMinimized : ""}`} role="region" aria-label={`Chamada em curso: ${activeCall.title}`}>
            <audio ref={remoteAudioRef} autoPlay playsInline hidden />
            <div className={styles.callStageHeader}>
              <div className={styles.callStageTitle}>
                <span className={styles.liveDot} aria-hidden="true" />
                <strong>{activeCall.mode === "video" ? "Videochamada" : "Chamada de voz"} · {activeCall.title}</strong>
                <span>{formatCallDuration(callElapsedSec)} · {activeCall.remoteConnected ? `Ligado com ${activeCall.remotePeerName || "colega"}` : "Sala pronta (a aguardar participantes)"}</span>
              </div>
              {activeCall.minimized && (
                <div className={styles.callControls}>
                  <button
                    type="button"
                    className={`${styles.callControlBtn} ${activeCall.micMuted ? styles.callControlMuted : ""}`}
                    aria-pressed={!activeCall.micMuted}
                    aria-label={activeCall.micMuted ? "Ativar microfone" : "Desativar microfone"}
                    onClick={toggleCallMic}
                  >
                    {activeCall.micMuted ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    className={styles.callControlBtn}
                    aria-label="Expandir painel de chamada"
                    onClick={() => setActiveCall(prev => prev ? { ...prev, minimized: false } : null)}
                  >
                    <Maximize2 size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.callHangupBtn}
                    aria-label="Terminar chamada"
                    onClick={endCall}
                  >
                    <PhoneOff size={15} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            {!activeCall.minimized && (
              <>
                {activeCall.mediaNotice && <p className={styles.callMediaNote} role="status">{activeCall.mediaNotice}</p>}
                {activeCall.micPermissionBlocked && <button type="button" className={styles.callControlBtn} disabled={activeCall.micRetrying} onClick={() => void retryCallMicrophone()}><Mic size={15} aria-hidden="true" /><span>{activeCall.micRetrying ? "A ativar microfone…" : "Tentar ativar microfone"}</span></button>}
                {activeCall.remoteConnected && <button type="button" className={styles.callControlBtn} onClick={() => { void remoteAudioRef.current?.play().then(() => setActiveCall(previous => previous ? { ...previous, mediaNotice: null } : previous)).catch(() => setActiveCall(previous => previous ? { ...previous, mediaNotice: "Confirme a saída de áudio e as permissões do navegador." } : previous)) }}>Ouvir áudio</button>}
                <div className={styles.callStageGrid}>
                  <div className={styles.callTile}>
                    {(activeCall.cameraEnabled || activeCall.screenSharing) ? (
                      <video
                        ref={localVideoRef}
                        className={`${styles.callVideo} ${!activeCall.screenSharing ? styles.callVideoMirrored : ""}`}
                        autoPlay
                        muted
                        playsInline
                      />
                    ) : (
                      <div className={styles.callAvatarWrap}>
                        <div className={styles.callAvatarRing}>
                          <Avatar name={me?.name || "Tu"} url={me?.avatar_url || null} />
                        </div>
                      </div>
                    )}
                    <span className={styles.callTileLabel}>
                      {activeCall.micMuted ? <MicOff size={12} aria-hidden="true" /> : <Mic size={12} aria-hidden="true" />}
                      {me?.name || "Tu"} (tu){activeCall.screenSharing ? " · Ecrã" : ""}
                    </span>
                  </div>

                  <div className={styles.callTile}>
                    {activeCall.remoteConnected && activeCall.remoteHasVideo ? (
                      <video ref={remoteVideoRef} className={styles.callVideo} autoPlay playsInline muted />
                    ) : (
                      <div className={styles.callAvatarWrap}>
                        <div className={styles.callAvatarRing}>
                          {recipient && peer ? (
                            <Avatar name={peer.name} url={peer.avatar_url} />
                          ) : (
                            <span className={styles.generalIcon}><Users size={20} aria-hidden="true" /></span>
                          )}
                        </div>
                        <small style={{ color: "#a7c4b5", fontSize: 11 }}>
                          {activeCall.remoteConnected
                            ? `${activeCall.remotePeerName || "Colega"} em chamada`
                            : "Convite enviado na conversa"}
                        </small>
                      </div>
                    )}
                    <span className={styles.callTileLabel}>
                      {activeCall.remotePeerName || (recipient ? peer?.name || "Colega" : `#${currentChannel.name}`)}
                    </span>
                  </div>
                </div>

                <div className={styles.callControls}>
                  <button
                    type="button"
                    className={`${styles.callControlBtn} ${activeCall.micMuted ? styles.callControlMuted : ""}`}
                    aria-pressed={!activeCall.micMuted}
                    onClick={toggleCallMic}
                  >
                    {activeCall.micMuted ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}
                    <span>{activeCall.micMuted ? "Ativar som" : "Silenciar"}</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.callControlBtn} ${!activeCall.cameraEnabled ? styles.callControlMuted : ""}`}
                    aria-pressed={activeCall.cameraEnabled}
                    onClick={() => void toggleCallCamera()}
                  >
                    {activeCall.cameraEnabled ? <Video size={15} aria-hidden="true" /> : <VideoOff size={15} aria-hidden="true" />}
                    <span>{activeCall.cameraEnabled ? "Desligar câmara" : "Ligar câmara"}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.callControlBtn}
                    aria-pressed={activeCall.screenSharing}
                    onClick={() => void toggleScreenShare()}
                  >
                    <MonitorUp size={15} aria-hidden="true" />
                    <span>{activeCall.screenSharing ? "Parar partilha" : "Partilhar ecrã"}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.callControlBtn}
                    onClick={() => setActiveCall(prev => prev ? { ...prev, minimized: true } : null)}
                  >
                    <Minimize2 size={15} aria-hidden="true" />
                    <span>Minimizar</span>
                  </button>
                  <button
                    type="button"
                    className={styles.callHangupBtn}
                    onClick={endCall}
                  >
                    <PhoneOff size={15} aria-hidden="true" />
                    <span>Terminar</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {error && <div className={styles.error} role="alert">{error}{blocked && " Volte a iniciar sessão se necessário."}</div>}

        <div className={styles.messages} ref={scroll} onScroll={event => { const node = event.currentTarget; stickBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 100 }} role="log" aria-label="Mensagens" aria-live="polite" aria-relevant="additions">
          {hasOlder && <button type="button" className={styles.older} onClick={loadOlder} disabled={olderLoading}>{olderLoading ? "A carregar…" : "Ver mensagens anteriores"}</button>}
          {!ready && !error && <p className={styles.loading} role="status">A abrir conversa…</p>}
          {ready && !messages.length && <div className={styles.empty}>
            <MessageSquare size={32} strokeWidth={1.5} />
            <h3>{recipient ? "Começa a conversa" : `Bem-vindos ao #${currentChannel.name}`}</h3>
            <p>{recipient ? `Escreve uma mensagem a ${peer?.name || "este colega"}.` : (currentChannel.description || "Partilha novidades, combina tarefas e mantém a equipa a par.")}</p>
          </div>}

          {messages.map((message, index) => {
            const own = message.sender_id === initial.viewerId
            const showDate = !index || dateLabel(messages[index - 1].created_at) !== dateLabel(message.created_at)
            const gifInfo = parseGifMessage(message.body)
            const callInfo = !gifInfo.isGif ? parseCallMessage(message.body) : { isCall: false }
            const attInfo = !gifInfo.isGif && !callInfo.isCall ? parseAttachmentMessage(message.body) : { hasAttachments: false, attachments: [], text: message.body }
            const onlyEmoji = !gifInfo.isGif && !callInfo.isCall && !attInfo.hasAttachments && isOnlyEmojis(message.body)
            return <div key={message.id}>
              {showDate && <div className={styles.day}>{dateLabel(message.created_at)}</div>}
              <article className={`${styles.message} ${own ? styles.own : ""}`}>
                {!own && <Avatar name={message.sender_name} url={members.find(member => member.user_id === message.sender_id)?.avatar_url ?? message.sender_avatar_url} />}
                <div className={styles.bubble}>
                  <div className={styles.messageMeta}>
                    <strong>{own ? `${message.sender_name} (tu)` : message.sender_name}</strong>
                  </div>
                  {gifInfo.isGif ? (
                    <div>
                      {gifInfo.text && <p style={{ marginBottom: 6 }}>{gifInfo.text}</p>}
                      <div className={styles.gifBubble}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={gifInfo.gifUrl} alt="GIF animado" loading="lazy" />
                      </div>
                    </div>
                  ) : callInfo.isCall && callInfo.mode && callInfo.roomId ? (
                    <div className={styles.callCard}>
                      <div className={styles.callCardInfo}>
                        <span className={styles.callCardIcon} aria-hidden="true">
                          {callInfo.mode === "video" ? <Video size={16} /> : <PhoneCall size={16} />}
                        </span>
                        <div className={styles.callCardText}>
                          <strong>{callInfo.mode === "video" ? "Videochamada de equipa" : "Chamada de voz"}</strong>
                          <small>{callInfo.title}</small>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={styles.callJoinBtn}
                        onClick={() => void startOrJoinCall(callInfo.mode!, callInfo.roomId, callInfo.title, false)}
                      >
                        {activeCall?.roomId === callInfo.roomId ? "Na chamada" : "Entrar"}
                      </button>
                    </div>
                  ) : attInfo.hasAttachments ? (
                    <div>
                      <div className={styles.messageAttachments}>
                        {attInfo.attachments.map(att => {
                          const isImage = att.type.startsWith("image/")
                          const isSheet = /excel|spreadsheet|csv|xls/i.test(att.type) || /\.(xlsx?|csv)$/i.test(att.name)
                          return isImage ? (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.attachmentImageLink}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={att.url} alt={att.name} loading="lazy" />
                            </a>
                          ) : (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={att.name}
                              className={styles.attachmentCard}
                            >
                              <span className={styles.attachmentCardLeft}>
                                <span className={styles.attachmentCardIcon} aria-hidden="true">
                                  {isSheet ? <FileSpreadsheet size={16} /> : <FileText size={16} />}
                                </span>
                                <span className={styles.attachmentCardCopy}>
                                  <strong>{att.name}</strong>
                                  <small>{(att.name.split(".").pop() || "FILE").toUpperCase()} · {formatFileSize(att.size)}</small>
                                </span>
                              </span>
                              <Download size={14} className={styles.attachmentDownloadIcon} aria-hidden="true" />
                            </a>
                          )
                        })}
                      </div>
                      {attInfo.text && <p>{attInfo.text}</p>}
                    </div>
                  ) : onlyEmoji ? (
                    <p className={styles.largeEmoji}>{message.body}</p>
                  ) : (
                    <p>{message.body}</p>
                  )}
                  <time className={styles.messageTime} dateTime={message.created_at} title={dateLabel(message.created_at)}>{timeLabel(message.created_at)}</time>
                </div>
                {own && <Avatar name={me?.name || message.sender_name} url={me ? me.avatar_url : message.sender_avatar_url} />}
              </article>
            </div>
          })}
        </div>

        <form
          className={styles.composer}
          onSubmit={event => { event.preventDefault(); void send() }}
          onDragOver={event => { if (event.dataTransfer?.types?.includes("Files")) event.preventDefault() }}
          onDrop={event => {
            if (event.dataTransfer?.files?.length) {
              event.preventDefault()
              void handleUploadFiles(event.dataTransfer.files)
            }
          }}
        >
          {/* Emoji Popover */}
          {showEmojiPicker && (
            <div className={styles.emojiPopover} ref={emojiPopoverRef} role="dialog" aria-label="Seletor de emojis">
              <div className={styles.emojiSearch}>
                <input
                  type="text"
                  placeholder="Procurar emoji..."
                  value={emojiSearch}
                  onChange={e => setEmojiSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className={styles.emojiTabs}>
                {EMOJI_CATEGORIES.map(cat => (
                  <button
                    key={cat.name}
                    type="button"
                    className={`${styles.emojiTab} ${emojiCategory === cat.name && !emojiSearch ? styles.activeTab : ""}`}
                    onClick={() => {
                      setEmojiCategory(cat.name)
                      setEmojiSearch("")
                    }}
                  >
                    {cat.icon} {cat.name.split(" ")[0]}
                  </button>
                ))}
              </div>
              <div className={styles.emojiGrid}>
                {filteredEmojis.map((e, idx) => (
                  <button
                    key={`${e.char}-${idx}`}
                    type="button"
                    className={styles.emojiItem}
                    onClick={() => handleSelectEmoji(e.char)}
                    title={e.keywords}
                  >
                    {e.char}
                  </button>
                ))}
                {filteredEmojis.length === 0 && (
                  <p style={{ gridColumn: "span 8", textAlign: "center", fontSize: 12, color: "var(--text-secondary)", padding: 12 }}>
                    Nenhum emoji encontrado
                  </p>
                )}
              </div>
            </div>
          )}

          {/* GIF Popover */}
          {showGifPicker && (
            <div className={styles.gifPopover} ref={gifPopoverRef} role="dialog" aria-label="Seletor de GIFs animados">
              <div className={styles.gifHeader}>
                <div className={styles.gifSearchBox}>
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Procurar GIFs (sucesso, foco, café...)"
                    value={gifSearch}
                    onChange={e => setGifSearch(e.target.value)}
                    autoFocus
                  />
                  {gifSearch && (
                    <button
                      type="button"
                      onClick={() => setGifSearch("")}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--text-secondary)" }}
                      aria-label="Limpar pesquisa"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className={styles.gifCategories}>
                  {["Tudo", "Celebração", "Equipa", "Trabalho", "Logística", "Reações"].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      className={`${styles.gifCategoryBadge} ${gifCategory === cat && !gifSearch ? styles.activeBadge : ""}`}
                      onClick={() => {
                        setGifCategory(cat)
                        setGifSearch("")
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.gifGrid}>
                {filteredGifs.map(gif => (
                  <div
                    key={gif.id}
                    className={styles.gifCard}
                    onClick={() => void handleSendGif(gif)}
                    role="button"
                    tabIndex={0}
                    title={`Enviar GIF: ${gif.title}`}
                    onKeyDown={e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        void handleSendGif(gif)
                      }
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={gif.previewUrl} alt={gif.title} loading="lazy" />
                    <span className={styles.gifCardTitle}>{gif.title}</span>
                  </div>
                ))}
                {filteredGifs.length === 0 && (
                  <p style={{ gridColumn: "span 2", textAlign: "center", fontSize: 12, color: "var(--text-secondary)", padding: 20 }}>
                    Nenhum GIF encontrado para &quot;{gifSearch}&quot;
                  </p>
                )}
              </div>
            </div>
          )}

          {(pendingAttachments.length > 0 || uploadingAttachments) && (
            <div className={styles.attachmentsTray} role="region" aria-label="Anexos selecionados">
              {pendingAttachments.map(att => {
                const isImage = att.type.startsWith("image/")
                const isSheet = /excel|spreadsheet|csv|xls/i.test(att.type) || /\.(xlsx?|csv)$/i.test(att.name)
                return (
                  <div key={att.id} className={styles.attachmentChip}>
                    <span className={styles.attachmentThumb} aria-hidden="true">
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={att.url} alt="" />
                      ) : isSheet ? (
                        <FileSpreadsheet size={16} />
                      ) : (
                        <FileText size={16} />
                      )}
                    </span>
                    <span className={styles.attachmentChipMeta}>
                      <strong>{att.name}</strong>
                      <small>{(att.name.split(".").pop() || "FILE").toUpperCase()} · {formatFileSize(att.size)}</small>
                    </span>
                    <button
                      type="button"
                      className={styles.attachmentRemoveBtn}
                      aria-label={`Remover anexo ${att.name}`}
                      onClick={() => handleRemovePendingAttachment(att.id)}
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                )
              })}
              {uploadingAttachments && (
                <div className={styles.attachmentChip} role="status">
                  <span className={styles.attachmentThumb} aria-hidden="true">
                    <ImageIcon size={15} />
                  </span>
                  <span className={styles.attachmentChipMeta}>
                    <strong>A carregar anexo…</strong>
                    <small>Por favor aguarde</small>
                  </span>
                </div>
              )}
            </div>
          )}

          <label className={styles.visuallyHidden} htmlFor="team-chat-attachments">Adicionar anexos</label>
          <input
            ref={fileInputRef}
            id="team-chat-attachments"
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
            className={styles.visuallyHidden}
            onChange={event => {
              if (event.target.files?.length) {
                void handleUploadFiles(event.target.files)
              }
              event.target.value = ""
            }}
          />

          <label className="sr-only" htmlFor="team-chat-message">Mensagem</label>
          <textarea
            ref={textareaRef}
            id="team-chat-message"
            placeholder={recipient ? `Mensagem para ${peer?.name || "colega"}…` : `Escreve em #${currentChannel.name}…`}
            rows={2}
            maxLength={CHAT_MAX_LENGTH}
            value={draft}
            disabled={!ready || blocked || sending}
            onChange={event => setDrafts(previous => ({ ...previous, [key]: event.target.value }))}
            onPaste={event => {
              if (event.clipboardData?.files?.length) {
                event.preventDefault()
                void handleUploadFiles(event.clipboardData.files)
              }
            }}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
                void send()
              }
            }}
          />
          <div className={styles.composerFooter}>
            <div className={styles.composerTools}>
              <button
                type="button"
                className={styles.mediaBtn}
                disabled={!ready || blocked || sending || uploadingAttachments}
                onClick={() => fileInputRef.current?.click()}
                title="Anexar ficheiro ou imagem"
                aria-label="Anexar ficheiro ou imagem"
              >
                <Paperclip size={15} aria-hidden="true" />
                <span>{uploadingAttachments ? "A anexar…" : "Anexar"}</span>
              </button>
              <button
                type="button"
                className={`${styles.mediaBtn} ${showEmojiPicker ? styles.active : ""}`}
                onClick={() => {
                  setShowEmojiPicker(v => !v)
                  setShowGifPicker(false)
                }}
                title="Adicionar emoji"
                aria-label="Adicionar emoji"
                aria-expanded={showEmojiPicker}
              >
                <Smile size={16} aria-hidden="true" />
                <span>Emoji</span>
              </button>
              <button
                type="button"
                className={`${styles.mediaBtn} ${showGifPicker ? styles.active : ""}`}
                onClick={() => {
                  setShowGifPicker(v => !v)
                  setShowEmojiPicker(false)
                }}
                title="Inserir GIF animado"
                aria-label="Inserir GIF animado"
                aria-expanded={showGifPicker}
              >
                <Film size={15} aria-hidden="true" />
                <span>GIF</span>
              </button>
            </div>

            <button className={styles.sendButton} type="submit" disabled={!ready || blocked || sending || uploadingAttachments || (!draft.trim() && pendingAttachments.length === 0)}>
              <Send size={15} aria-hidden="true" />{sending ? "A enviar…" : "Enviar mensagem"}
            </button>
          </div>
          <div className={styles.composerHint}><small className={styles.keyboardHint}>Enter para enviar · Shift + Enter para nova linha</small><small>{draft.length}/{CHAT_MAX_LENGTH}</small></div>
        </form>
      </section>
    </div>

    {/* Modal para criar canal */}
    {showCreateModal && (
      <div className={styles.modalOverlay} onClick={() => !creatingChannel && setShowCreateModal(false)}>
        <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="modal-title">
          <header className={styles.modalHeader}>
            <h3 id="modal-title">Criar novo canal</h3>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setShowCreateModal(false)}
              disabled={creatingChannel}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </header>
          <form onSubmit={handleCreateChannel}>
            <div className={styles.modalBody}>
              {channelError && <div className={styles.modalError}>{channelError}</div>}
              <div className={styles.field}>
                <label htmlFor="new-channel-name">Nome do canal *</label>
                <input
                  id="new-channel-name"
                  type="text"
                  placeholder="ex: Operações, Armazém, Incidências"
                  value={newChannelName}
                  onChange={e => setNewChannelName(e.target.value)}
                  maxLength={80}
                  autoFocus
                  required
                  disabled={creatingChannel}
                />
                <small>Será prefixado com # automaticamente</small>
              </div>
              <div className={styles.field}>
                <label htmlFor="new-channel-desc">Descrição (opcional)</label>
                <textarea
                  id="new-channel-desc"
                  placeholder="ex: Coordenação de recolhas, trânsito e incidências"
                  value={newChannelDesc}
                  onChange={e => setNewChannelDesc(e.target.value)}
                  maxLength={250}
                  rows={2}
                  disabled={creatingChannel}
                />
              </div>
            </div>
            <footer className={styles.modalFooter}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowCreateModal(false)}
                disabled={creatingChannel}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={creatingChannel || !newChannelName.trim()}
              >
                {creatingChannel ? "A criar…" : "Criar canal"}
              </button>
            </footer>
          </form>
        </div>
      </div>
    )}
  </div>
}

