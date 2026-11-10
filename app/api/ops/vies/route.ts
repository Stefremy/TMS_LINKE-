import { NextResponse } from "next/server"
import { getAuthContextState } from "@/lib/auth/context"
import { canAccessOpsRoute } from "@/lib/auth/permissions"
import { checkEuViesVat } from "@/lib/tax/vies-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const headers = { "Cache-Control": "private, no-store" }

export async function POST(request: Request) {
  try {
    const authState = await getAuthContextState()
    if (authState.rateLimited) {
      return NextResponse.json(
        { error: "Sessão temporariamente limitada. Aguarde alguns segundos e tente novamente." },
        { status: 429, headers: { ...headers, "Retry-After": "15" } }
      )
    }

    const ctx = authState.context
    if (!ctx || !["admin", "employee"].includes(ctx.role || "")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401, headers })
    }

    if (!canAccessOpsRoute(ctx, "/ops/entidades/clientes")) {
      return NextResponse.json({ error: "Sem permissão para validar dados de clientes." }, { status: 403, headers })
    }

    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Origem do pedido inválida." }, { status: 403, headers })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers })
    }

    const nif = typeof body.nif === "string" ? body.nif : ""
    const countryCode = typeof body.countryCode === "string" ? body.countryCode : undefined
    const force = body.force === true

    const result = await checkEuViesVat(nif, {
      countryCodeHint: countryCode,
      force,
    })

    return NextResponse.json(result, { headers })
  } catch {
    return NextResponse.json(
      { error: "Erro interno ao validar número fiscal no VIES." },
      { status: 500, headers }
    )
  }
}

