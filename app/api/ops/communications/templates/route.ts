import { NextResponse } from "next/server"
import { authorizeCommunicationsApi } from "@/lib/services/communications/api-auth"
import { lookupShipmentByTracking } from "@/lib/services/communications/shipment-sources"
import {
  listWhatsappTemplates,
  sendGenericTemplateMessage,
} from "@/lib/services/communications/whatsapp-cloud"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await authorizeCommunicationsApi(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const lookupTracking = searchParams.get("lookupTracking")?.trim()

  if (lookupTracking) {
    const shipment = await lookupShipmentByTracking(lookupTracking)
    if (!shipment) {
      return NextResponse.json(
        { ok: false, error: `Nenhuma guia encontrada para "${lookupTracking}".` },
        { status: 404 }
      )
    }
    return NextResponse.json({ ok: true, shipment })
  }

  const result = await listWhatsappTemplates()
  return NextResponse.json(result, { status: result.ok ? 200 : result.status || 400 })
}

export async function POST(request: Request) {
  const auth = await authorizeCommunicationsApi(request, { checkOrigin: true })
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      to?: string
      templateName?: string
      languageCode?: string
      bodyVariables?: string[]
      buttonUrlVariable?: string
      trackerContext?: {
        clientName?: string
        parcelId?: string
        messageType?: string
        notes?: string
        shipmentId?: string | null
      }
    }

    const result = await sendGenericTemplateMessage({
      to: body.to || "",
      templateName: body.templateName || "",
      languageCode: body.languageCode,
      bodyVariables: body.bodyVariables || [],
      buttonUrlVariable: body.buttonUrlVariable || "",
      trackerContext: body.trackerContext || null,
    })

    return NextResponse.json(result.finalBody, { status: result.status })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao enviar template WhatsApp." },
      { status: 500 }
    )
  }
}

