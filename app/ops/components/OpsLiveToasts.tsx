"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { MessageSquare, Phone, PhoneOff, Video, X } from "lucide-react"
import { useIncomingCall } from "../chat/hooks/useIncomingCall"
import type { ChatNotification } from "@/lib/team-chat"

const MESSAGE_POLL_MS = 3500
const MESSAGE_TOAST_MS = 9000
const MAX_VISIBLE_MESSAGES = 3

type MessageToast = Omit<ChatNotification, "id" | "sequence"> & { id: string }

function Avatar({ name, url, ringing = false }: { name: string; url: string | null | undefined; ringing?: boolean }) {
  const initials = (name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join("") || "?"
  return (
    <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white ${ringing ? "ring-4 ring-[var(--accent)]/25 animate-pulse" : ""}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" />
      ) : initials}
    </span>
  )
}

/**
 * Global top-of-page pop-ups for the ops area: ringing calls and new team-chat
 * messages, each with the sender's avatar. The chat page keeps its own inline
 * call banner, so everything here is paused while /ops/chat is open.
 */
export function OpsLiveToasts({ viewerId }: { viewerId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const onChat = pathname === "/ops/chat" || pathname.startsWith("/ops/chat/")
  const calls = useIncomingCall(viewerId, undefined, !onChat)
  const [messages, setMessages] = React.useState<MessageToast[]>([])
  const cursor = React.useRef<number | null>(null)
  const chimeContext = React.useRef<AudioContext | null>(null)

  // Browsers only allow sound after a click/key press on the page, so unlock on the first one.
  React.useEffect(() => {
    const unlock = () => {
      try {
        chimeContext.current ||= new AudioContext()
        void chimeContext.current.resume()
      } catch { /* No audio support: the visual pop-up still works. */ }
    }
    document.addEventListener("pointerdown", unlock)
    document.addEventListener("keydown", unlock)
    return () => {
      document.removeEventListener("pointerdown", unlock)
      document.removeEventListener("keydown", unlock)
      void chimeContext.current?.close()
      chimeContext.current = null
    }
  }, [])

  const playChime = React.useCallback(() => {
    const context = chimeContext.current
    if (!context || context.state !== "running") return
    // Two soft rising notes.
    ;[[880, 0], [1175, 0.14]].forEach(([frequency, offset]) => {
      const oscillator = context.createOscillator(), gain = context.createGain()
      const start = context.currentTime + offset
      oscillator.type = "sine"
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35)
      oscillator.connect(gain); gain.connect(context.destination)
      oscillator.start(start); oscillator.stop(start + 0.36)
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    })
  }, [])

  const dismissMessage = React.useCallback((id: string) => setMessages(previous => previous.filter(item => item.id !== id)), [])

  React.useEffect(() => {
    if (onChat) {
      // Re-sync on the way out so messages read inside the chat do not pop up afterwards.
      cursor.current = null
      const clear = setTimeout(() => setMessages([]), 0)
      return () => clearTimeout(clear)
    }
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (document.visibilityState === "visible") {
        try {
          const query = cursor.current === null ? "" : `&after=${cursor.current}`
          const response = await fetch(`/api/ops/chat?viewer=${encodeURIComponent(viewerId)}&notify=1${query}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
          if (response.ok) {
            const data = await response.json() as { viewerId: string; latestSequence: number; items: ChatNotification[] }
            if (data.viewerId === viewerId && !controller.signal.aborted) {
              const fresh = cursor.current !== null ? data.items : []
              cursor.current = data.latestSequence
              if (fresh.length) {
                playChime()
                setMessages(previous => {
                  const known = new Set(previous.map(item => item.id))
                  const added = fresh.filter(item => !known.has(item.id)).map(item => ({ id: item.id, key: item.key, kind: item.kind, title: item.title, sender_id: item.sender_id, sender_name: item.sender_name, sender_avatar_url: item.sender_avatar_url, preview: item.preview, created_at: item.created_at }))
                  return [...previous, ...added].slice(-MAX_VISIBLE_MESSAGES)
                })
              }
            }
          }
        } catch { /* The next poll retries after a temporary network failure. */ }
      }
      if (!controller.signal.aborted) timer = setTimeout(() => { void poll() }, MESSAGE_POLL_MS)
    }
    const onFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer)
        void poll()
      }
    }
    document.addEventListener("visibilitychange", onFocusOrVisible)
    window.addEventListener("focus", onFocusOrVisible)
    void poll()
    return () => {
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onFocusOrVisible)
      window.removeEventListener("focus", onFocusOrVisible)
    }
  }, [viewerId, onChat, playChime])

  React.useEffect(() => {
    if (!messages.length) return
    const timers = messages.map(item => setTimeout(() => dismissMessage(item.id), MESSAGE_TOAST_MS))
    return () => timers.forEach(clearTimeout)
  }, [messages, dismissMessage])

  const call = onChat ? null : calls.incoming
  if (onChat || (!call && !messages.length)) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3" aria-live="polite">
      {call && (
        <div role="alert" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-[var(--accent)] bg-[var(--surface-bg)] p-3 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
          <Avatar name={call.senderName} url={call.senderAvatarUrl} ringing />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--text-primary)]">{call.senderName} está a ligar</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--text-secondary)]">
              {call.mode === "video" ? <Video className="h-3 w-3" aria-hidden="true" /> : <Phone className="h-3 w-3" aria-hidden="true" />}
              {call.mode === "video" ? "Videochamada" : "Chamada de voz"}{call.conversationKey.startsWith("ch_") ? ` · ${call.title}` : ""}
            </p>
          </div>
          {!calls.soundReady && (
            <button type="button" onClick={calls.enableSound} className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]">Ativar toque</button>
          )}
          <button
            type="button"
            aria-label="Recusar chamada"
            title="Recusar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
            onClick={() => {
              calls.dismiss(call.roomId)
              void fetch("/api/ops/chat/calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ viewerId, room: call.roomId, signal: { id: crypto.randomUUID(), instance: crypto.randomUUID(), type: "leave" } }) }).catch(() => {})
            }}
          >
            <PhoneOff className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Atender chamada"
            title="Atender"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
            onClick={() => {
              calls.enableSound()
              calls.dismiss(call.roomId)
              const params = new URLSearchParams({ conv: call.conversationKey, answer: call.roomId, mode: call.mode, title: call.title })
              router.push(`/ops/chat?${params.toString()}`)
            }}
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {messages.map(item => (
        <div key={item.id} role="status" className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-3 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            onClick={() => {
              dismissMessage(item.id)
              router.push(`/ops/chat?conv=${encodeURIComponent(item.key)}`)
            }}
          >
            <Avatar name={item.sender_name} url={item.sender_avatar_url} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 truncate text-sm font-bold text-[var(--text-primary)]">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                <span className="truncate">{item.kind === "channel" ? `${item.sender_name} · ${item.title}` : item.sender_name}</span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-[var(--text-secondary)]">{item.preview}</span>
            </span>
          </button>
          <button type="button" aria-label="Fechar aviso" onClick={() => dismissMessage(item.id)} className="rounded-lg p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
