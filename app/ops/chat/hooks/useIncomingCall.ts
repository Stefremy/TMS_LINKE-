"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import type { IncomingCall } from "@/lib/team-chat-calls"

export function useIncomingCall(viewer: string, activeRoom?: string, enabled = true) {
  const [incoming, setIncoming] = useState<IncomingCall | null>(null)
  const [soundReady, setSoundReady] = useState(false)
  const dismissed = useRef(new Set<string>())
  const audio = useRef<AudioContext | null>(null)
  const enableSound = useCallback(() => {
    try {
      audio.current ||= new AudioContext()
      void audio.current.resume().then(() => setSoundReady(audio.current?.state === "running")).catch(() => setSoundReady(false))
    } catch { /* The visible button lets the recipient retry after a gesture. */ }
  }, [])
  useEffect(() => {
    document.addEventListener("pointerdown", enableSound, { once: true })
    document.addEventListener("keydown", enableSound, { once: true })
    return () => {
      document.removeEventListener("pointerdown", enableSound)
      document.removeEventListener("keydown", enableSound)
      void audio.current?.close()
      audio.current = null
    }
  }, [enableSound])
  useEffect(() => {
    if (!enabled) { const reset = setTimeout(() => setIncoming(null), 0); return () => clearTimeout(reset) }
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    let inFlight = false
    let consecutiveErrors = 0
    let lastPollAt = 0

    const scheduleNext = (delayMs: number) => {
      if (controller.signal.aborted || stopped) return
      clearTimeout(timer)
      timer = setTimeout(() => { void poll() }, delayMs)
    }

    const poll = async () => {
      if (controller.signal.aborted || stopped || inFlight) return
      if (document.visibilityState !== "visible") {
        scheduleNext(4000)
        return
      }
      inFlight = true
      lastPollAt = Date.now()
      let nextDelay = 3000 + Math.floor(Math.random() * 400)
      try {
        const response = await fetch(`/api/ops/chat/calls?viewer=${encodeURIComponent(viewer)}&incoming=1`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
        if (response.ok) {
          consecutiveErrors = 0
          const data = await response.json()
          if (data.viewerId === viewer && !controller.signal.aborted) {
            const next = (data.calls as IncomingCall[]).find(call => !dismissed.current.has(call.roomId) && call.roomId !== activeRoom)
            setIncoming(activeRoom ? null : next || null)
          }
        } else if ([401, 403, 409].includes(response.status)) {
          stopped = true
          setIncoming(null)
          return
        } else {
          consecutiveErrors = Math.min(5, consecutiveErrors + 1)
          const retryAfter = Number(response.headers?.get("Retry-After"))
          nextDelay = response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(60_000, retryAfter * 1000)
            : Math.min(60_000, 3500 * Math.pow(2, consecutiveErrors))
        }
      } catch {
        consecutiveErrors = Math.min(5, consecutiveErrors + 1)
        nextDelay = Math.min(60_000, 3500 * Math.pow(2, consecutiveErrors))
      } finally {
        inFlight = false
      }
      scheduleNext(nextDelay)
    }
    const onFocusOrVisible = () => {
      if (document.visibilityState === "visible" && !stopped && !inFlight && Date.now() - lastPollAt > 1200) {
        clearTimeout(timer)
        void poll()
      }
    }
    document.addEventListener("visibilitychange", onFocusOrVisible)
    window.addEventListener("focus", onFocusOrVisible)
    void poll()
    return () => {
      stopped = true
      controller.abort()
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", onFocusOrVisible)
      window.removeEventListener("focus", onFocusOrVisible)
    }
  }, [viewer, activeRoom, enabled])
  const incomingRoom = incoming?.roomId
  useEffect(() => { if (incomingRoom) enableSound() }, [incomingRoom, enableSound])
  useEffect(() => {
    if (!incomingRoom || !soundReady) return
    const context = audio.current
    if (!context) return
    const ring = () => {
      if (context.state !== "running") return
      for (const offset of [0, .35]) {
        const oscillator = context.createOscillator(), gain = context.createGain()
        const start = context.currentTime + offset
        oscillator.frequency.value = 540
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(.09, start + .03)
        gain.gain.linearRampToValueAtTime(0, start + .25)
        oscillator.connect(gain); gain.connect(context.destination)
        oscillator.start(start); oscillator.stop(start + .26)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
      }
    }
    ring()
    const timer = setInterval(ring, 2200)
    return () => clearInterval(timer)
  }, [incomingRoom, soundReady])
  return {
    incoming, soundReady, enableSound,
    dismiss(room: string) { dismissed.current.add(room); setIncoming(null) },
  }
}
