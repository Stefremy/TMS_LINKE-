import { NextResponse } from "next/server"
import { runAutoNotificationByType } from "@/lib/services/communications/auto-notifier"
import { loadCommunicationsConfig } from "@/lib/services/communications/config"
import { isCronAuthorized } from "@/lib/services/communications/cron-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  const authorized = await isCronAuthorized(request)
  if (!authorized) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dryRun = ["1", "true", "yes"].includes((searchParams.get("dryRun") || "").toLowerCase())
  const force = ["1", "true", "yes"].includes((searchParams.get("force") || "").toLowerCase())

  const cfg = await loadCommunicationsConfig()
  if (!force && !cfg.autoTransporteEnabled && !dryRun) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Auto-notificação em transporte está desativada nas configurações.",
    })
  }

  const result = await runAutoNotificationByType({
    type: "em_transporte",
    dryRun,
    sourceMode: cfg.sourceMode,
  })

  return NextResponse.json({
    triggeredBy: force ? "manual_force" : "cron",
    ...result,
  })
}

export async function POST(request: Request) {
  return GET(request)
}

