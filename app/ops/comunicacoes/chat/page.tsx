import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { createAdminClient } from "@/lib/supabase/server"
import { WhatsappChatConsoleClient } from "./WhatsappChatConsoleClient"
import type { ChatLogItem } from "@/app/api/ops/communications/chat/route"

export const dynamic = "force-dynamic"

function extractMediaFromPayload(payload: unknown): { mediaType: string | null; mediaId: string | null } {
  if (!payload || typeof payload !== "object") {
    return { mediaType: null, mediaId: null }
  }
  const root = payload as Record<string, unknown>

  if (root.uploadedMediaId) {
    return {
      mediaType: String(root.mediaType || "document").toLowerCase(),
      mediaId: String(root.uploadedMediaId).trim(),
    }
  }

  const msg = root.message && typeof root.message === "object" ? (root.message as Record<string, unknown>) : null
  if (!msg) return { mediaType: null, mediaId: null }

  const type = String(msg.type || "").trim().toLowerCase()
  if (!type || type === "text" || type === "button" || type === "interactive") {
    return { mediaType: null, mediaId: null }
  }

  const mediaNode = msg[type] && typeof msg[type] === "object" ? (msg[type] as Record<string, unknown>) : null
  const mediaId = String(mediaNode?.id || "").trim()
  if (!mediaId) return { mediaType: null, mediaId: null }

  return {
    mediaType: type,
    mediaId,
  }
}

function mapRow(raw: Record<string, unknown>): ChatLogItem {
  const payload = raw.payload && typeof raw.payload === "object" ? (raw.payload as Record<string, unknown>) : {}
  const trackerCtx =
    payload.trackerContext && typeof payload.trackerContext === "object"
      ? (payload.trackerContext as Record<string, unknown>)
      : {}
  const trackingNumber = String(
    raw.tracking_number || trackerCtx.parcelId || payload.parcelId || payload.tracking_number || ""
  ).trim()
  const contactName = String(raw.contact_name || trackerCtx.clientName || "").trim()
  const { mediaType, mediaId } = extractMediaFromPayload(payload)

  return {
    id: raw.id as number | string,
    created_at: String(raw.created_at || new Date().toISOString()),
    direction: String(raw.direction || "out").toLowerCase() === "in" ? "in" : "out",
    channel: String(raw.channel || "chat").toLowerCase(),
    to_number: String(raw.to_number || "").trim(),
    contact_name: contactName || null,
    message_text: raw.message_text ? String(raw.message_text) : null,
    template_name: raw.template_name ? String(raw.template_name) : null,
    status: raw.status ? String(raw.status) : null,
    api_message_id: raw.api_message_id ? String(raw.api_message_id) : null,
    tracking_number: trackingNumber || null,
    media_type: mediaType,
    media_id: mediaId,
  }
}

export default async function WhatsappChatConsolePage() {
  await requireOpsPageAccess("/ops/comunicacoes/chat")

  const supabase = createAdminClient()

  let initialMessages: ChatLogItem[] = []
  let initialContacts: Record<string, string> = {}
  let initialContactNotes: Record<string, string> = {}
  let initialTeamReminders: Array<{ id: string; phone: string; note: string; dueAt: string; done?: boolean }> = []

  try {
    const [inboundRes, outboundChatRes, incTemplateRes, stateRes] = await Promise.all([
      supabase
        .from("whatsapp_logs")
        .select(
          "id, created_at, direction, channel, to_number, contact_name, message_text, template_name, status, api_message_id, tracking_number, payload"
        )
        .eq("direction", "in")
        .order("created_at", { ascending: false })
        .limit(700),
      supabase
        .from("whatsapp_logs")
        .select(
          "id, created_at, direction, channel, to_number, contact_name, message_text, template_name, status, api_message_id, tracking_number, payload"
        )
        .eq("direction", "out")
        .in("channel", ["text", "media", "chat", "chat_incidencias"])
        .order("created_at", { ascending: false })
        .limit(700),
      supabase
        .from("whatsapp_logs")
        .select(
          "id, created_at, direction, channel, to_number, contact_name, message_text, template_name, status, api_message_id, tracking_number, payload"
        )
        .eq("channel", "template_incidencias")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("whatsapp_communications_config")
        .select("key, value")
        .in("key", ["contacts", "contact_notes", "team_reminders"]),
    ])

    const merged = new Map<string, ChatLogItem>()
    for (const raw of [
      ...(inboundRes.data || []),
      ...(outboundChatRes.data || []),
      ...(incTemplateRes.data || []),
    ]) {
      const item = mapRow(raw as Record<string, unknown>)
      merged.set(String(item.id), item)
    }

    initialMessages = Array.from(merged.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    for (const row of stateRes.data || []) {
      if (row.key === "contacts" && row.value && typeof row.value === "object" && !Array.isArray(row.value)) {
        initialContacts = row.value as Record<string, string>
      } else if (
        row.key === "contact_notes" &&
        row.value &&
        typeof row.value === "object" &&
        !Array.isArray(row.value)
      ) {
        initialContactNotes = row.value as Record<string, string>
      } else if (row.key === "team_reminders" && Array.isArray(row.value)) {
        initialTeamReminders = row.value as Array<{
          id: string
          phone: string
          note: string
          dueAt: string
          done?: boolean
        }>
      }
    }
  } catch {
    // Fallback to empty state if DB is temporarily unreachable
  }

  return (
    <WhatsappChatConsoleClient
      initialMessages={initialMessages}
      initialContacts={initialContacts}
      initialContactNotes={initialContactNotes}
      initialTeamReminders={initialTeamReminders}
    />
  )
}

