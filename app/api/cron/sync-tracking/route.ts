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

    // Se CRON_SECRET estiver configurado, validar Bearer token ou query param
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const url = new URL(request.url)
      const tokenQuery = url.searchParams.get("token")
      if (tokenQuery !== cronSecret) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
      }
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
