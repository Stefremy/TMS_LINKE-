import type { CallSignal, OutgoingCallSignal } from "./chat-call-peer"

export async function openCallTransport(options: { room: string; viewer: string; instance: string; onError: (error: unknown) => void }) {
  const base = `/api/ops/chat/calls?viewer=${encodeURIComponent(options.viewer)}&room=${encodeURIComponent(options.room)}`
  const controller = new AbortController()
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined
  let since = ""
  let sendQueue = Promise.resolve()
  const seen = new Set<string>()
  const read = async (configuration = false) => {
    const response = await fetch(`${base}&configuration=${configuration ? "1" : "0"}${since ? `&since=${encodeURIComponent(since)}` : ""}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) })
    const data = await response.json()
    if (!response.ok || data.viewerId !== options.viewer) {
      const err = new Error(data.error || "Não foi possível ligar a chamada.") as Error & { status?: number }
      if (typeof response.status === "number") err.status = response.status
      throw err
    }
    return data as { signals: CallSignal[]; iceServers?: RTCIceServer[]; relayConfigured?: boolean; iceTransportPolicy?: RTCIceTransportPolicy }
  }
  const initial = await read(true)
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
    iceServers: initial.iceServers || [],
    relayConfigured: initial.relayConfigured === true,
    iceTransportPolicy: initial.iceTransportPolicy || "all",
    send(signal: OutgoingCallSignal) {
      if (stopped) return
      sendQueue = sendQueue.then(() => post(signal)).catch(options.onError)
    },
    start(handle: (signal: CallSignal) => Promise<void>) {
      let consecutiveErrors = 0
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
        let nextDelay = 1000
        try {
          await consume((await read()).signals)
          consecutiveErrors = 0
        } catch (error) {
          const status = (error as { status?: number })?.status
          if (!stopped) options.onError(error)
          if (typeof status === "number" && [401, 403, 404, 409].includes(status)) {
            stopped = true
            return
          }
          consecutiveErrors = Math.min(4, consecutiveErrors + 1)
          nextDelay = Math.min(15_000, 1000 * Math.pow(2, consecutiveErrors))
        }
        if (!stopped) timer = setTimeout(() => { void poll() }, nextDelay)
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
