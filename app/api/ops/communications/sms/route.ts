import { NextResponse } from "next/server"
import { authorizeCommunicationsApi } from "@/lib/services/communications/api-auth"
import { sendClickSendSms } from "@/lib/services/communications/whatsapp-cloud"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = await authorizeCommunicationsApi(request, { checkOrigin: true })
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      to?: string
      message?: string
      contactName?: string
      trackingNumber?: string
      shipmentId?: string | null
    }

    const result = await sendClickSendSms({
      to: body.to || "",
      message: body.message || "",
      contactName: body.contactName,
      trackingNumber: body.trackingNumber,
      shipmentId: body.shipmentId || null,
      source: "manual",
    })

    if (!result.attempted && result.status === "skipped_not_configured") {
      return NextResponse.json(
        { error: "ClickSend não configurado", details: result.reason },
        { status: 400 }
      )
    }

    if (!result.attempted && result.status === "skipped_invalid_input") {
      return NextResponse.json({ error: result.reason }, { status: 400 })
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao enviar SMS." },
      { status: 500 }
    )
  }
}

