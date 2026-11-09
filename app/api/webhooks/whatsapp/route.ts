import { NextResponse } from "next/server"
import { loadCommunicationsConfig } from "@/lib/services/communications/config"
import { updateCommunicationLogStatusByMessageId } from "@/lib/services/communications/whatsapp-cloud"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const cfg = await loadCommunicationsConfig()
  const mainToken = cfg.whatsappWebhookVerifyToken
  const incToken = String(process.env.INC_WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim()

  if (mode === "subscribe" && token && (token === mainToken || (incToken && token === incToken))) {
    return new Response(challenge || "", { status: 200, headers: { "Content-Type": "text/plain" } })
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      entry?: Array<{
        changes?: Array<{
          field?: string
          value?: {
            statuses?: Array<{
              id?: string
              status?: string
              [key: string]: unknown
            }>
          }
        }>
      }>
    }

    const entries = Array.isArray(body.entry) ? body.entry : []
    const changes = entries.flatMap((entry) => (Array.isArray(entry.changes) ? entry.changes : []))

    for (const change of changes) {
      const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : []
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
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}

