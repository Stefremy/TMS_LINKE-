import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { loadCommunicationsConfig } from "@/lib/services/communications/config"
import {
  createCommunicationLogRow,
  updateCommunicationLogStatusByMessageId,
} from "@/lib/services/communications/whatsapp-cloud"
import { createAdminClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function digitsOnly(value: unknown): string {
  return String(value || "").replace(/\D/g, "")
}

function extractInboundMessageText(message: Record<string, unknown>): string {
  const type = String(message?.type || "unknown").toLowerCase()

  if (type === "text") {
    const textNode =
      message?.text && typeof message.text === "object"
        ? (message.text as Record<string, unknown>)
        : null
    return String(textNode?.body || "").trim() || "[Texto]"
  }

  if (type === "button") {
    const buttonNode =
      message?.button && typeof message.button === "object"
        ? (message.button as Record<string, unknown>)
        : null
    return `[Botão] ${String(buttonNode?.text || "").trim()}`.trim()
  }

  if (type === "interactive") {
    const interNode =
      message?.interactive && typeof message.interactive === "object"
        ? (message.interactive as Record<string, unknown>)
        : null
    const listReply =
      interNode?.list_reply && typeof interNode.list_reply === "object"
        ? String((interNode.list_reply as Record<string, unknown>)?.title || "").trim()
        : ""
    const buttonReply =
      interNode?.button_reply && typeof interNode.button_reply === "object"
        ? String((interNode.button_reply as Record<string, unknown>)?.title || "").trim()
        : ""
    const reply = listReply || buttonReply
    return reply ? `[Resposta] ${reply}` : "[Interativo]"
  }

  if (type === "reaction") {
    const rx =
      message?.reaction && typeof message.reaction === "object"
        ? (message.reaction as Record<string, unknown>)
        : null
    return rx?.emoji ? String(rx.emoji) : "[Reação]"
  }

  if (type === "image") {
    const node =
      message?.image && typeof message.image === "object"
        ? (message.image as Record<string, unknown>)
        : null
    const caption = String(node?.caption || "").trim()
    return caption ? `[Fotografia] ${caption}` : "[Fotografia]"
  }

  if (type === "document") {
    const node =
      message?.document && typeof message.document === "object"
        ? (message.document as Record<string, unknown>)
        : null
    const filename = String(node?.filename || "").trim()
    const caption = String(node?.caption || "").trim()
    const desc = [filename, caption].filter(Boolean).join(" - ")
    return desc ? `[Documento: ${desc}]` : "[Documento]"
  }

  if (type === "video") {
    const node =
      message?.video && typeof message.video === "object"
        ? (message.video as Record<string, unknown>)
        : null
    const caption = String(node?.caption || "").trim()
    return caption ? `[Vídeo] ${caption}` : "[Vídeo]"
  }

  if (type === "audio") {
    const node =
      message?.audio && typeof message.audio === "object"
        ? (message.audio as Record<string, unknown>)
        : null
    return node?.voice ? "[Mensagem de Voz]" : "[Áudio]"
  }

  if (type === "sticker") {
    return "[Sticker]"
  }

  if (type === "location") {
    const node =
      message?.location && typeof message.location === "object"
        ? (message.location as Record<string, unknown>)
        : null
    const name = String(node?.name || node?.address || "").trim()
    return name ? `[Localização: ${name}]` : "[Localização]"
  }

  return `[${type}]`
}

function extractInboundMediaInfo(
  message: Record<string, unknown>
): { mediaType: string | null; mediaId: string | null } {
  const type = String(message?.type || "").trim().toLowerCase()
  if (!type || ["text", "button", "interactive", "reaction", "location"].includes(type)) {
    return { mediaType: null, mediaId: null }
  }

  const mediaNode =
    message?.[type] && typeof message[type] === "object"
      ? (message[type] as Record<string, unknown>)
      : null
  const mediaId = String(mediaNode?.id || "").trim()
  if (!mediaId) return { mediaType: null, mediaId: null }

  return {
    mediaType: type,
    mediaId,
  }
}

async function forwardWebhookToBotpress(payload: unknown) {
  const botpressUrl = String(process.env.BOTPRESS_WEBHOOK_RELAY_URL || "").trim()
  if (!botpressUrl) return

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const botpressKey = String(process.env.BOTPRESS_API_KEY || "").trim()
  if (botpressKey) {
    headers.Authorization = `Bearer ${botpressKey}`
    headers["x-botpress-api-key"] = botpressKey
  }

  try {
    await fetch(botpressUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000),
    })
  } catch {
    // Best-effort relay
  }
}

/**
 * Meta signs every webhook POST with HMAC-SHA256 of the raw body using the App Secret.
 * Both numbers may belong to different Meta apps, so either configured secret is accepted.
 */
function verifyMetaSignature(rawBody: string, header: string | null): "valid" | "invalid" | "unconfigured" {
  const secrets = [process.env.WHATSAPP_APP_SECRET, process.env.INC_WHATSAPP_APP_SECRET]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
  if (secrets.length === 0) return "unconfigured"
  const received = String(header || "").trim()
  if (!received.startsWith("sha256=")) return "invalid"
  const receivedBuf = Buffer.from(received.slice(7), "hex")
  for (const secret of secrets) {
    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest()
    if (receivedBuf.length === expected.length && timingSafeEqual(receivedBuf, expected)) return "valid"
  }
  return "invalid"
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const cfg = await loadCommunicationsConfig()
  const mainToken = cfg.whatsappWebhookVerifyToken || String(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim()
  const incToken = String(process.env.INC_WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim()

  const isValidToken =
    token &&
    ((mainToken && token === mainToken) ||
      (incToken && token === incToken))

  if (mode === "subscribe" && isValidToken) {
    return new Response(challenge || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export async function POST(request: Request) {
  const rawText = await request.text()
  const signature = verifyMetaSignature(rawText, request.headers.get("x-hub-signature-256"))
  if (signature === "invalid") {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }
  if (signature === "unconfigured") {
    console.warn("WhatsApp webhook: WHATSAPP_APP_SECRET is not set; payload signature was NOT verified.")
  }

  try {
    let rawBody: unknown = {}
    try { rawBody = JSON.parse(rawText || "{}") } catch { rawBody = {} }
    const body = (rawBody && typeof rawBody === "object" ? rawBody : {}) as {
      entry?: Array<{
        changes?: Array<{
          field?: string
          value?: {
            metadata?: {
              phone_number_id?: string
              display_phone_number?: string
            }
            contacts?: Array<{
              profile?: { name?: string }
              wa_id?: string
            }>
            messages?: Array<Record<string, unknown>>
            statuses?: Array<{
              id?: string
              status?: string
              [key: string]: unknown
            }>
          }
        }>
      }>
    }

    // Optional Botpress forwarding
    void forwardWebhookToBotpress(rawBody)

    const entries = Array.isArray(body.entry) ? body.entry : []
    const changes = entries.flatMap((entry) => (Array.isArray(entry.changes) ? entry.changes : []))

    const cfg = await loadCommunicationsConfig()
    const incPhoneNumberId = String(
      process.env.INC_WHATSAPP_PHONE_NUMBER_ID || cfg.incWhatsappPhoneNumberId || ""
    ).trim()
    const incPhoneNumber = digitsOnly(process.env.INC_WHATSAPP_PHONE_NUMBER || "")

    const supabase = createAdminClient()

    for (const change of changes) {
      const val = change?.value

      // 1. Process delivery / read statuses
      const statuses = Array.isArray(val?.statuses) ? val.statuses : []
      for (const statusEvent of statuses) {
        const messageId = String(statusEvent?.id || "").trim()
        const status = String(statusEvent?.status || "").trim()
        if (messageId && status) {
          await updateCommunicationLogStatusByMessageId({
            messageId,
            status,
            statusEvent,
          })
        }
      }

      // 2. Process incoming customer replies (messages)
      const messages = Array.isArray(val?.messages) ? val.messages : []
      if (messages.length > 0) {
        const contacts = Array.isArray(val?.contacts) ? val.contacts : []
        const eventPhoneNumberId = String(val?.metadata?.phone_number_id || "").trim()
        const eventDisplayPhoneNumber = digitsOnly(val?.metadata?.display_phone_number || "")

        const isIncidenciasNumber =
          (incPhoneNumberId && eventPhoneNumberId && eventPhoneNumberId === incPhoneNumberId) ||
          (incPhoneNumber && eventDisplayPhoneNumber && eventDisplayPhoneNumber === incPhoneNumber)

        const inboundChannel = isIncidenciasNumber ? "chat_incidencias" : "chat"

        for (const inboundMessage of messages) {
          const from = String(inboundMessage?.from || "").trim()
          if (!from) continue

          const inboundMessageId = String(inboundMessage?.id || "").trim()
          if (!inboundMessageId) continue

          // Deduplication check: ignore if already recorded
          const { data: existing } = await supabase
            .from("whatsapp_logs")
            .select("id")
            .eq("api_message_id", inboundMessageId)
            .limit(1)
            .maybeSingle()

          if (existing?.id) {
            continue
          }

          // Find contact profile name
          const contact =
            contacts.find((c) => digitsOnly(c?.wa_id) === digitsOnly(from)) || null
          const contactName = String(contact?.profile?.name || "").trim() || null

          const summaryText = extractInboundMessageText(inboundMessage)
          const mediaInfo = extractInboundMediaInfo(inboundMessage)

          await createCommunicationLogRow({
            direction: "in",
            channel: inboundChannel,
            to: from,
            contactName,
            messageText: summaryText,
            status: "received",
            apiMessageId: inboundMessageId,
            sourceSystem: "manual",
            payload: {
              direction: "inbound",
              contact,
              message: inboundMessage,
              media: {
                type: mediaInfo.mediaType,
                id: mediaInfo.mediaId,
              },
              metadata: val?.metadata || null,
            },
          })
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
