import "server-only"
import { z } from "zod"
import type { AuthContext } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { ChatError } from "@/lib/team-chat"
import { getCallIceConfiguration } from "@/lib/chat-call-ice"
import { getChatStaffAvatars } from "@/lib/team-chat-avatars"
import { parseCallMessage } from "@/lib/team-chat-media"

const roomSchema = z.string().regex(/^[a-z0-9_-]{2,64}$/i)
export const callSignalSchema = z.object({
  id: z.string().uuid(),
  instance: z.string().min(1).max(128),
  type: z.enum(["join", "offer", "answer", "ice", "leave", "video-toggle"]),
  sdp: z.object({ type: z.enum(["offer", "answer"]), sdp: z.string().max(40_000) }).optional(),
  candidate: z.object({ candidate: z.string().max(4096), sdpMid: z.string().max(128).nullable().optional(), sdpMLineIndex: z.number().int().min(0).nullable().optional(), usernameFragment: z.string().max(256).nullable().optional() }).optional(),
  hasVideo: z.boolean().optional(),
  target: z.string().min(1).max(128).optional(),
}).superRefine((signal, ctx) => {
  if ((signal.type === "offer" || signal.type === "answer") && signal.sdp?.type !== signal.type) ctx.addIssue({ code: "custom", message: "Descrição da chamada inválida." })
  if (signal.type === "ice" && !signal.candidate) ctx.addIssue({ code: "custom", message: "Ligação da chamada inválida." })
})
export type CallSignalInput = z.infer<typeof callSignalSchema>
type StoredSignalRow = { id: string; created_at: string; details: { room_id: string; sender_id: string; sender_name: string; signal: Omit<CallSignalInput, "id"> } }
export type IncomingCall = { roomId: string; mode: "audio" | "video"; title: string; senderId: string; senderName: string; senderAvatarUrl?: string | null; conversationKey: string; createdAt: string }

type InviteRow = { sender_id: string; recipient_id: string | null; sender_name: string; body: string; created_at: string }
const cleanBody = (body: string) => body.replace(/^\[c:[a-z0-9_-]+\]\s*/, "")
const canReadInvite = (ctx: AuthContext, row: InviteRow) => !row.recipient_id || row.sender_id === ctx.user.id || row.recipient_id === ctx.user.id

export async function requireCallRoom(ctx: AuthContext, room: string) {
  if (!roomSchema.safeParse(room).success) throw new ChatError("Chamada inválida.")
  const db = createAdminClient()
  const { data, error } = await db.from("team_chat_messages").select("sender_id,recipient_id,sender_name,body,created_at")
    .eq("tenant_id", ctx.tenant_id).gte("created_at", new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()).like("body", `%[call:%:${room.replace(/_/g, "\\_")}%`)
    .order("sequence", { ascending: true }).limit(20)
  if (error) throw new ChatError("Não foi possível consultar a chamada.", 503)
  // Bind access to the original invitation. Copying a private invite into a
  // public channel must never grant access to its existing signaling room.
  const invite = (data || []).find((row: InviteRow) => parseCallMessage(cleanBody(row.body)).roomId === room) as InviteRow | undefined
  if (!invite || !canReadInvite(ctx, invite) || Date.now() - Date.parse(invite.created_at) > 4 * 60 * 60 * 1000) throw new ChatError("Chamada terminada ou sem acesso.", 404)
  return invite
}

export async function readCallSignals(ctx: AuthContext, room: string, since?: string | null, includeConfiguration = true) {
  const invite = await requireCallRoom(ctx, room)
  const after = since && Number.isFinite(Date.parse(since)) ? new Date(Math.max(Date.parse(invite.created_at), Date.parse(since) - 1000)).toISOString() : invite.created_at
  const { data, error } = await createAdminClient().from("audit_log").select("id,created_at,details")
    .eq("tenant_id", ctx.tenant_id).eq("action", "team_chat_call_signal").eq("details->>room_id", room)
    .gte("created_at", after).order("created_at", { ascending: false }).limit(200)
  if (error) throw new ChatError("Não foi possível receber os sinais da chamada.", 503)
  const configuration = includeConfiguration ? await getCallIceConfiguration(`${ctx.tenant_id}:${ctx.user.id}:${room}`) : {}
  return { ...configuration, signals: ((data || []) as StoredSignalRow[]).reverse().map(row => ({ id: row.id, createdAt: row.created_at, ...row.details.signal, senderId: row.details.sender_id, senderName: row.details.sender_name })) }
}

export async function writeCallSignal(ctx: AuthContext, room: string, input: unknown) {
  await requireCallRoom(ctx, room)
  const result = callSignalSchema.safeParse(input)
  if (!result.success) throw new ChatError("Sinal de chamada inválido.")
  const { id, ...signal } = result.data
  const { error } = await createAdminClient().from("audit_log").insert({ id, tenant_id: ctx.tenant_id, action: "team_chat_call_signal", details: {
    room_id: room, sender_id: ctx.user.id, sender_name: String(ctx.user.user_metadata?.name || ctx.user.user_metadata?.full_name || ctx.user.email?.split("@")[0] || "Colega").slice(0,120), signal,
  } })
  if (error && error.code !== "23505") throw new ChatError("Não foi possível enviar os sinais da chamada.", 503)
}

export async function readIncomingCalls(ctx: AuthContext): Promise<IncomingCall[]> {
  const db = createAdminClient()
  const cutoff = new Date(Date.now() - 90_000).toISOString()
  const { data, error } = await db.from("team_chat_messages").select("sender_id,recipient_id,sender_name,body,created_at")
    .eq("tenant_id", ctx.tenant_id).gte("created_at", cutoff).order("sequence", { ascending: false }).limit(100)
  if (error) throw new ChatError("Não foi possível consultar chamadas recebidas.", 503)
  const calls: IncomingCall[] = []
  for (const row of (data || []) as InviteRow[]) {
    if (row.sender_id === ctx.user.id || !canReadInvite(ctx, row)) continue
    const invite = parseCallMessage(cleanBody(row.body))
    if (!invite.isCall || !invite.roomId || !invite.mode) continue
    const channel = /^\[c:([a-z0-9_-]+)\]/.exec(row.body)?.[1] || "geral"
    calls.push({ roomId: invite.roomId, mode: invite.mode, title: row.recipient_id ? row.sender_name : invite.title || channel, senderId: row.sender_id, senderName: row.sender_name, conversationKey: row.recipient_id ? `dm_${row.sender_id}` : `ch_${channel}`, createdAt: row.created_at })
  }
  if (!calls.length) return []
  const { data: ended, error: endedError } = await db.from("audit_log").select("details")
    .eq("tenant_id", ctx.tenant_id).eq("action", "team_chat_call_signal").in("details->>room_id", calls.map(call => call.roomId))
    .eq("details->signal->>type", "leave").gte("created_at", cutoff).limit(100)
  if (endedError) throw new ChatError("Não foi possível confirmar as chamadas recebidas.", 503)
  const endedRooms = new Set(((ended || []) as { details: { room_id: string } }[]).map(row => row.details.room_id))
  const active = calls.filter(call => !endedRooms.has(call.roomId))
  if (!active.length) return active
  // Avatars are cosmetic: a lookup failure must never hide a ringing call.
  let avatars = new Map<string, string | null>()
  try { avatars = await getChatStaffAvatars(ctx.tenant_id) } catch { /* keep the call without a photo */ }
  return active.map(call => ({ ...call, senderAvatarUrl: avatars.get(call.senderId) ?? null }))
}
