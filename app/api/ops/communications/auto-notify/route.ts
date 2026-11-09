import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth/context"
import { runAutoNotificationByType } from "@/lib/services/communications/auto-notifier"
import type { NotificationSourceMode } from "@/lib/services/communications/config"
import type { AutoNotificationType } from "@/lib/services/communications/shipment-sources"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const ctx = await getAuthContext()
  if (!ctx || !["admin", "employee"].includes(ctx.role || "")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      type?: AutoNotificationType
      dryRun?: boolean
      sourceMode?: NotificationSourceMode
      maxSendsPerRun?: number
      includeIlhas?: boolean
    }

    const validTypes: AutoNotificationType[] = ["em_distribuicao", "em_transporte", "incidencia"]
    const type: AutoNotificationType = validTypes.includes(body.type as AutoNotificationType)
      ? (body.type as AutoNotificationType)
      : "em_distribuicao"

    const summary = await runAutoNotificationByType({
      type,
      dryRun: Boolean(body.dryRun),
      sourceMode: body.sourceMode,
      maxSendsPerRun: body.maxSendsPerRun,
      includeIlhas: body.includeIlhas,
    })

    return NextResponse.json(summary)
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro ao executar auto-notificação." },
      { status: 500 }
    )
  }
}

