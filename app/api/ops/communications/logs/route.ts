import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { getLegacyWhatsappSupabaseClient } from "@/lib/services/communications/whatsapp-cloud"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface NormalizedLogRow {
  id: number | string
  created_at: string
  direction: string
  channel: string
  to_number: string
  contact_name: string | null
  message_text: string | null
  template_name: string | null
  status: string | null
  api_message_id: string | null
  tracking_number: string | null
  source_system: string | null
}

function normalizeLegacyRow(raw: Record<string, unknown>): NormalizedLogRow {
  const payload =
    raw.payload && typeof raw.payload === "object" ? (raw.payload as Record<string, unknown>) : {}
  const trackerCtx =
    payload.trackerContext && typeof payload.trackerContext === "object"
      ? (payload.trackerContext as Record<string, unknown>)
      : {}

  const trackingNumber = String(
    raw.tracking_number || trackerCtx.parcelId || payload.tracking_number || ""
  ).trim()
  const contactName = String(raw.contact_name || trackerCtx.clientName || "").trim()
  const sourceSystem = String(raw.source_system || payload.source_system || "legacy_tms").trim()

  return {
    id: raw.id as number | string,
    created_at: String(raw.created_at || new Date().toISOString()),
    direction: String(raw.direction || "out"),
    channel: String(raw.channel || "template"),
    to_number: String(raw.to_number || ""),
    contact_name: contactName || null,
    message_text: raw.message_text ? String(raw.message_text) : null,
    template_name: raw.template_name ? String(raw.template_name) : null,
    status: raw.status ? String(raw.status) : null,
    api_message_id: raw.api_message_id ? String(raw.api_message_id) : null,
    tracking_number: trackingNumber || null,
    source_system: sourceSystem || "legacy_tms",
  }
}

export async function GET(request: Request) {
  const ctx = await getAuthContext()
  if (!ctx || !["admin", "employee"].includes(ctx.role || "")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") || "").trim()
  const channel = (searchParams.get("channel") || "all").trim()
  const rawLimit = Number(searchParams.get("limit") || 100)
  const limit = Number.isFinite(rawLimit) ? Math.max(10, Math.min(300, Math.trunc(rawLimit))) : 100

  const combined: NormalizedLogRow[] = []

  try {
    const supabase = createAdminClient()
    let query = supabase
      .from("whatsapp_logs")
      .select(
        "id, created_at, direction, channel, to_number, contact_name, message_text, template_name, status, api_message_id, shipment_id, tracking_number, source_system, payload"
      )
      .in("direction", ["out", "outbound"])
      .order("id", { ascending: false })
      .limit(limit)

    if (channel && channel !== "all") {
      if (channel === "whatsapp") {
        query = query.not("channel", "in", "(sms,clicksend,sms_fallback)")
      } else if (channel === "sms") {
        query = query.in("channel", ["sms", "clicksend", "sms_fallback"])
      } else {
        query = query.eq("channel", channel)
      }
    }

    if (q) {
      const safe = q.replace(/[%_,()]/g, "")
      if (safe) {
        query = query.or(
          `to_number.ilike.%${safe}%,contact_name.ilike.%${safe}%,message_text.ilike.%${safe}%,template_name.ilike.%${safe}%,tracking_number.ilike.%${safe}%`
        )
      }
    }

    const { data, error } = await query
    if (!error && Array.isArray(data)) {
      for (const r of data) {
        combined.push(normalizeLegacyRow(r as Record<string, unknown>))
      }
    }
  } catch {
    // Primary table might not be migrated yet; fallback to legacy below
  }

  // Also fetch historical logs from Legacy Nathalia Supabase if configured
  const legacySb = getLegacyWhatsappSupabaseClient()
  if (legacySb && combined.length < limit) {
    try {
      let lQuery = legacySb
        .from("whatsapp_logs")
        .select("id, created_at, direction, channel, to_number, contact_name, message_text, template_name, status, api_message_id, payload")
        .eq("direction", "out")
        .order("id", { ascending: false })
        .limit(limit - combined.length)

      if (channel && channel !== "all") {
        if (channel === "whatsapp") {
          lQuery = lQuery.in("channel", ["template", "template_incidencias", "chat", "chat_incidencias", "media"])
        } else {
          lQuery = lQuery.eq("channel", channel)
        }
      }

      if (q) {
        const safe = q.replace(/[%_,()]/g, "")
        if (safe) {
          lQuery = lQuery.or(
            `to_number.ilike.%${safe}%,contact_name.ilike.%${safe}%,message_text.ilike.%${safe}%,template_name.ilike.%${safe}%`
          )
        }
      }

      const { data: legacyData } = await lQuery
      if (Array.isArray(legacyData)) {
        for (const r of legacyData) {
          const norm = normalizeLegacyRow(r as Record<string, unknown>)
          norm.id = `leg-${norm.id}`
          combined.push(norm)
        }
      }
    } catch {
      // ignore legacy connection failure
    }
  }

  combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({
    ok: true,
    data: combined.slice(0, limit),
  })
}
