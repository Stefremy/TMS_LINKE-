import { requireOpsPageAccess } from "@/lib/auth/ops-page-access"
import { createAdminClient } from "@/lib/supabase/server"
import { WhatsappChatConsoleClient } from "./WhatsappChatConsoleClient"
import { mapRowToChatLogItem, type ChatLogItem } from "@/lib/services/communications/chat-log-mapper"

export const dynamic = "force-dynamic"

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
      const item = mapRowToChatLogItem(raw as Record<string, unknown>)
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

