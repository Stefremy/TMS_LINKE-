import "server-only"
import { z } from "zod"
import { ChatError } from "@/lib/team-chat"

export type CallIceConfiguration = { iceServers: RTCIceServer[]; relayConfigured: boolean; iceTransportPolicy: RTCIceTransportPolicy }
const cloudflareResponse = z.object({ iceServers: z.array(z.object({
  urls: z.union([z.string(), z.array(z.string())]), username: z.string().max(4096).optional(), credential: z.string().max(4096).optional(),
})).min(1) })
const cache = new Map<string, { expires: number; promise: Promise<CallIceConfiguration> }>()
const stun: RTCIceServer = { urls: "stun:stun.l.google.com:19302" }
const isRelay = (value: string) => /^turns?:/i.test(value)
const policy = (): RTCIceTransportPolicy => process.env.CHAT_TURN_FORCE_RELAY === "true" ? "relay" : "all"
const unavailable = () => new ChatError("O serviço de ligação das chamadas não está disponível. Contacte o administrador.", 503)

/** Long-lived provider tokens stay on the server; only short-lived ICE credentials leave it. */
export async function getCallIceConfiguration(sessionKey: string): Promise<CallIceConfiguration> {
  const staticUrls = (process.env.CHAT_TURN_URLS || "").split(",").map(value => value.trim()).filter(Boolean)
  const staticUsername = process.env.CHAT_TURN_USERNAME?.trim(), staticCredential = process.env.CHAT_TURN_CREDENTIAL?.trim()
  if (staticUrls.length || staticUsername || staticCredential) {
    if (!staticUrls.length || !staticUrls.every(isRelay) || !staticUsername || !staticCredential) throw unavailable()
    return { iceServers: [stun, { urls: staticUrls, username: staticUsername, credential: staticCredential }], relayConfigured: true, iceTransportPolicy: policy() }
  }
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID?.trim(), token = process.env.CLOUDFLARE_TURN_API_TOKEN?.trim()
  if (!keyId && !token) {
    if (policy() === "relay") throw unavailable()
    return { iceServers: [stun], relayConfigured: false, iceTransportPolicy: "all" }
  }
  if (!keyId || !token) throw unavailable()
  const cacheKey = `${keyId}:${sessionKey}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) return cached.promise
  const promise = (async (): Promise<CallIceConfiguration> => {
    try {
      const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
        method: "POST", cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: 14_400 }), signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) throw unavailable()
      const parsed = cloudflareResponse.safeParse(await response.json())
      if (!parsed.success) throw unavailable()
      const servers: RTCIceServer[] = parsed.data.iceServers.map(server => ({ ...server,
        urls: (Array.isArray(server.urls) ? server.urls : [server.urls]).filter(url => /^(?:stun|turn)s?:/i.test(url) && !/:53(?:\?|$)/.test(url)),
      })).filter(server => (server.urls as string[]).length > 0)
      if (!servers.some(server => (server.urls as string[]).some(isRelay) && server.username && server.credential)) throw unavailable()
      return { iceServers: servers, relayConfigured: true, iceTransportPolicy: policy() }
    } catch { throw unavailable() }
  })()
  if (cache.size >= 200) cache.delete(cache.keys().next().value!)
  cache.set(cacheKey, { expires: Date.now() + 5 * 60_000, promise })
  void promise.catch(() => { if (cache.get(cacheKey)?.promise === promise) cache.delete(cacheKey) })
  return promise
}
