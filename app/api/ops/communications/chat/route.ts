import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import {
  sendWhatsappTextMessage,
  sendWhatsappMediaMessage,
} from "@/lib/services/communications/whatsapp-cloud"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export interface ChatLogItem {
  id: number | string
  created_at: string
  direction: "in" | "out"
  channel: string
  to_number: string
  contact_name: string | null
  message_text: string | null
  template_name: string | null
  status: string | null
  api_message_id: string | null
  tracking_number: string | null
  media_type: string | null
  media_id: string | null
}

function extractMediaFromPayload(payload: unknown): { mediaType: string | null; mediaId: string | null } {
  if (!payload || typeof payload !== "object") {
    return { mediaType: null, mediaId: null }
  }
  const root = payload as Record<string, unknown>

  // Outbound media uploaded via TMS Linke
  if (root.uploadedMediaId) {
    return {
      mediaType: String(root.mediaType || "document").toLowerCase(),
      mediaId: String(root.uploadedMediaId).trim(),
    }
  }

  // Inbound webhook media stored under payload.message
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

function mapRowToChatLogItem(raw: Record<string, unknown>): ChatLogItem {
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

export async function GET(request: Request) {
  const ctx = await getAuthContext()
  if (!ctx || !["admin", "employee"].includes(ctx.role || "")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const phoneFilter = String(searchParams.get("phone") || "").replace(/\D/g, "")
  const limit = Math.min(1500, Math.max(50, Number(searchParams.get("limit") || 800)))

  const supabase = createAdminClient()

  try {
    if (phoneFilter) {
      // Load full history for a specific phone number (including templates & SMS)
      const shortPhone = phoneFilter.startsWith("351") && phoneFilter.length === 12 ? phoneFilter.slice(3) : phoneFilter
      const { data: phoneRows, error } = await supabase
        .from("whatsapp_logs")
        .select(
          "id, created_at, direction, channel, to_number, contact_name, message_text, template_name, status, api_message_id, tracking_number, payload"
        )
        .or(`to_number.ilike.%${shortPhone}%`)
        .order("created_at", { ascending: false })
        .limit(300)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const items = (phoneRows || []).map((r) => mapRowToChatLogItem(r as Record<string, unknown>))
      return NextResponse.json({
        ok: true,
        phone: phoneFilter,
        messages: items,
      })
    }

    // Fetch all active chat logs (inbound + outbound chat/text/media/incidencias) + team state in parallel
    const [inboundRes, outboundChatRes, incTemplateRes, stateRes] = await Promise.all([
      supabase
        .from("whatsapp_logs")
        .select(
          "id, created_at, direction, channel, to_number, contact_name, message_text, template_name, status, api_message_id, tracking_number, payload"
        )
        .eq("direction", "in")
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("whatsapp_logs")
        .select(
          "id, created_at, direction, channel, to_number, contact_name, message_text, template_name, status, api_message_id, tracking_number, payload"
        )
        .eq("direction", "out")
        .in("channel", ["text", "media", "chat", "chat_incidencias"])
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("whatsapp_logs")
        .select(
          "id, created_at, direction, channel, to_number, contact_name, message_text, template_name, status, api_message_id, tracking_number, payload"
        )
        .eq("channel", "template_incidencias")
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("whatsapp_communications_config")
        .select("key, value")
        .in("key", ["contacts", "contact_notes", "team_reminders"]),
    ])

    const mergedById = new Map<string, ChatLogItem>()
    for (const raw of [
      ...(inboundRes.data || []),
      ...(outboundChatRes.data || []),
      ...(incTemplateRes.data || []),
    ]) {
      const mapped = mapRowToChatLogItem(raw as Record<string, unknown>)
      mergedById.set(String(mapped.id), mapped)
    }

    const messages = Array.from(mergedById.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )

    let contacts: Record<string, string> = {}
    let contactNotes: Record<string, string> = {}
    let teamReminders: Array<{ id: string; phone: string; note: string; dueAt: string; done?: boolean }> = []

    for (const row of stateRes.data || []) {
      if (row.key === "contacts" && row.value && typeof row.value === "object" && !Array.isArray(row.value)) {
        contacts = row.value as Record<string, string>
      } else if (
        row.key === "contact_notes" &&
        row.value &&
        typeof row.value === "object" &&
        !Array.isArray(row.value)
      ) {
        contactNotes = row.value as Record<string, string>
      } else if (row.key === "team_reminders" && Array.isArray(row.value)) {
        teamReminders = row.value as Array<{ id: string; phone: string; note: string; dueAt: string; done?: boolean }>
      }
    }

    return NextResponse.json({
      ok: true,
      messages,
      contacts,
      contactNotes,
      teamReminders,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Erro ao carregar consola de chat WhatsApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const ctx = await getAuthContext()
  if (!ctx || !["admin", "employee"].includes(ctx.role || "")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const contentType = String(request.headers.get("content-type") || "").toLowerCase()

  // Handle multipart/form-data media upload + send
  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData()
      const file = formData.get("file")
      const to = String(formData.get("to") || "").trim()
      const caption = String(formData.get("caption") || "").trim()
      const contactName = String(formData.get("contactName") || "").trim()
      const useIncNumber = String(formData.get("useIncNumber") || "") === "true"

      if (!file || !(file instanceof File) || !to) {
        return NextResponse.json(
          { error: "Ficheiro e número de destino ('to') são obrigatórios." },
          { status: 400 }
        )
      }

      const arrayBuffer = await file.arrayBuffer()
      const fileBuffer = Buffer.from(arrayBuffer)

      const result = await sendWhatsappMediaMessage({
        to,
        fileBuffer,
        fileName: file.name || "anexo",
        mimeType: file.type || "application/octet-stream",
        caption,
        contactName: contactName || null,
        useIncNumber,
      })

      return NextResponse.json(result, { status: result.ok ? 200 : result.status })
    } catch (error) {
      return NextResponse.json(
        {
          error: "Falha ao processar ficheiro de media",
          details: error instanceof Error ? error.message : "Erro desconhecido",
        },
        { status: 500 }
      )
    }
  }

  // Handle JSON actions
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(body.action || "send_text").trim()

    if (action === "save_state") {
      const supabase = createAdminClient()
      const nowIso = new Date().toISOString()
      const upserts: Array<{ key: string; value: unknown; updated_at: string; updated_by: string }> = []

      if (body.contacts && typeof body.contacts === "object") {
        upserts.push({
          key: "contacts",
          value: body.contacts,
          updated_at: nowIso,
          updated_by: ctx.user.id,
        })
      }
      if (body.contactNotes && typeof body.contactNotes === "object") {
        upserts.push({
          key: "contact_notes",
          value: body.contactNotes,
          updated_at: nowIso,
          updated_by: ctx.user.id,
        })
      }
      if (Array.isArray(body.teamReminders)) {
        upserts.push({
          key: "team_reminders",
          value: body.teamReminders,
          updated_at: nowIso,
          updated_by: ctx.user.id,
        })
      }

      if (upserts.length > 0) {
        const { error } = await supabase
          .from("whatsapp_communications_config")
          .upsert(upserts, { onConflict: "key" })
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }

      return NextResponse.json({ ok: true })
    }

    // Default: send_text
    const to = String(body.to || "").trim()
    const text = String(body.text || "").trim()
    const contactName = body.contactName ? String(body.contactName).trim() : null
    const useIncNumber = Boolean(body.useIncNumber)

    const result = await sendWhatsappTextMessage({
      to,
      text,
      contactName,
      useIncNumber,
    })

    return NextResponse.json(result, { status: result.ok ? 200 : result.status })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Erro na consola de chat WhatsApp",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    )
  }
}

