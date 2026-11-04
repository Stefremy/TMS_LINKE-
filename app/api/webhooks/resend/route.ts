import { NextResponse } from "next/server"
import { recordInboundEmailWebhook } from "@/lib/ops-mailbox-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
    }
    const recorded = await recordInboundEmailWebhook(payload)
    return NextResponse.json({ received: true, id: recorded?.id || null })
  } catch {
    return NextResponse.json({ error: "Erro ao processar webhook de email" }, { status: 500 })
  }
}

