import { NextResponse } from "next/server"
import { runAutoNotificationByType } from "@/lib/services/communications/auto-notifier"
import { loadCommunicationsConfig } from "@/lib/services/communications/config"
import { isCronAuthorized } from "@/lib/services/communications/cron-auth"
import type { AutoNotificationType } from "@/lib/services/communications/shipment-sources"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const authorized = await isCronAuthorized(request)
  if (!authorized) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const requestedType = searchParams.get("type") as AutoNotificationType | "all" | null
  const dryRun = ["1", "true", "yes"].includes((searchParams.get("dryRun") || "").toLowerCase())

  const cfg = await loadCommunicationsConfig()
  const typesToRun: AutoNotificationType[] = []

  if (requestedType === "em_distribuicao" || requestedType === "em_transporte" || requestedType === "incidencia") {
    typesToRun.push(requestedType)
  } else {
    if (cfg.autoEnvioEnabled) typesToRun.push("em_distribuicao")
    if (cfg.autoTransporteEnabled) typesToRun.push("em_transporte")
    if (cfg.autoIncidenciaEnabled) typesToRun.push("incidencia")
  }

  const results: Record<string, unknown> = {}
  for (const type of typesToRun) {
    results[type] = await runAutoNotificationByType({
      type,
      dryRun,
      sourceMode: cfg.sourceMode,
    })
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    sourceMode: cfg.sourceMode,
    results,
    at: new Date().toISOString(),
  })
}

export async function POST(request: Request) {
  return GET(request)
}
