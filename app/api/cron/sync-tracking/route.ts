import { NextResponse } from "next/server"
import { syncAllActiveShipmentsTracking } from "@/lib/services/tracking"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Cron / Webhook Endpoint para sincronização contínua de tracking (CTT Expresso e Correos Express)
 * Suporta GET e POST.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
    }

    // Validar Bearer token obrigatoriamente
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Executa a sincronização com privilégios de sistema (sem exigir sessão de browser)
    const result = await syncAllActiveShipmentsTracking({ skipAuth: true })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      syncedCount: result.count,
      errors: result.errors?.length > 0 ? result.errors : undefined,
      message: `Sincronização de tracking concluída com sucesso para ${result.count} envio(s) ativo(s).`,
    })
  } catch (error: any) {
    console.error("Erro no cron sync-tracking:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Falha na sincronização de tracking" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
