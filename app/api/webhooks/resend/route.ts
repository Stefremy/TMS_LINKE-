import { NextResponse } from "next/server"
import { recordInboundEmailWebhook } from "@/lib/ops-mailbox-server"
import { verifyResendWebhook } from "@/lib/email/resend-webhook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!secret) return NextResponse.json({ error: "Webhook de email não configurado" }, { status: 503 })
  let payload: Record<string, unknown>
  try {
    const body = await request.text()
    if (Buffer.byteLength(body, "utf8") > 1024 * 1024) return NextResponse.json({ error: "Payload demasiado grande" }, { status: 413 })
    payload = verifyResendWebhook(body, request.headers, secret)
  } catch {
    return NextResponse.json({ error: "Assinatura de webhook inválida" }, { status: 401 })
  }
  if (payload.type !== "email.received") return NextResponse.json({ received: true, ignored: true })
  try {
    const recorded = await recordInboundEmailWebhook(payload)
    return NextResponse.json({ received: true, id: recorded?.id || null })
  } catch {
    return NextResponse.json({ error: "Erro ao processar webhook de email" }, { status: 500 })
  }
}

