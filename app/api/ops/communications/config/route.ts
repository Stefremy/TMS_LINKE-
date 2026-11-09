import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth/context"
import {
  loadCommunicationsConfig,
  maskConfigSecrets,
  saveCommunicationsConfig,
  type CommunicationsConfig,
} from "@/lib/services/communications/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx || !["admin", "employee"].includes(ctx.role || "")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  const config = await loadCommunicationsConfig()
  return NextResponse.json({
    ok: true,
    config: maskConfigSecrets(config),
  })
}

export async function POST(request: Request) {
  const ctx = await getAuthContext()
  if (!ctx || !["admin", "employee"].includes(ctx.role || "")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Partial<CommunicationsConfig>
    const updated = await saveCommunicationsConfig(body)
    return NextResponse.json({
      ok: true,
      config: maskConfigSecrets(updated),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao guardar configurações." },
      { status: 500 }
    )
  }
}

