import { NextResponse } from "next/server"
import { authorizeCommunicationsApi } from "@/lib/services/communications/api-auth"
import {
  loadCommunicationsConfig,
  maskConfigSecrets,
  saveCommunicationsConfig,
  type CommunicationsConfig,
} from "@/lib/services/communications/config"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const auth = await authorizeCommunicationsApi(request)
  if (!auth.ok) return auth.response

  const config = await loadCommunicationsConfig()
  return NextResponse.json({
    ok: true,
    config: maskConfigSecrets(config),
  })
}

export async function POST(request: Request) {
  const auth = await authorizeCommunicationsApi(request, { requireConfigAdmin: true, checkOrigin: true })
  if (!auth.ok) return auth.response

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

