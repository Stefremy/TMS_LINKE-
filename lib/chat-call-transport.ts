import type { CallSignal, OutgoingCallSignal } from "./chat-call-peer"

export async function openCallTransport(options: { room: string; viewer: string; instance: string; onError: (error: unknown) => void }) {
  const base = `/api/ops/chat/calls?viewer=${encodeURIComponent(options.viewer)}&room=${encodeURIComponent(options.room)}`
  const controller = new AbortController()
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined
  let since = ""
  let sendQueue = Promise.resolve()
  const seen = new Set<string>()
  const read = async () => {
    const response = await fetch(`${base}${since ? `&since=${encodeURIComponent(since)}` : ""}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) })
    const data = await response.json()
    if (!response.ok || data.viewerId !== options.viewer) throw new Error(data.error || "Não foi possível ligar a chamada.")
    return data as { signals: CallSignal[]; iceServers: RTCIceServer[] }
  }
  const initial = await read()
  const post = async (signal: OutgoingCallSignal, keepalive = false) => {
    const body = JSON.stringify({ viewerId: options.viewer, room: options.room, signal: { ...signal, id: crypto.randomUUID(), instance: options.instance } })
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch("/api/ops/chat/calls", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive, signal: AbortSignal.timeout(10000) })
        if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Falha ao enviar sinal da chamada.") }
        return
      } catch (error) { if (attempt === 1) throw error }
    }
  }
  return {
    iceServers: initial.iceServers,
    send(signal: OutgoingCallSignal) {
      if (stopped) return
      sendQueue = sendQueue.then(() => post(signal)).catch(options.onError)
    },
    start(handle: (signal: CallSignal) => Promise<void>) {
      const consume = async (signals: CallSignal[]) => {
        for (const signal of signals) {
          if (stopped) return
          if (seen.has(signal.id)) continue
          seen.add(signal.id)
          if (!since || signal.createdAt > since) since = signal.createdAt
          if (signal.senderId === options.viewer) continue
          try { await handle(signal) } catch (error) { options.onError(error) }
        }
      }
      const poll = async () => {
        try { await consume((await read()).signals) }
        catch (error) { if (!stopped) options.onError(error) }
        if (!stopped) timer = setTimeout(() => { void poll() }, 1000)
      }
      void consume(initial.signals).then(() => { if (!stopped) void poll() })
    },
    close() {
      if (stopped) return
      stopped = true
      controller.abort()
      clearTimeout(timer)
      // A hangup must survive the polling abort and page navigation.
      void sendQueue.then(() => post({ type: "leave" }, true)).catch(() => {})
    },
  }
}
