import { NextResponse } from "next/server"
import { getAuthContextState, type AuthContext } from "@/lib/auth/context"
import { canAccessOpsRoute, hasPermission, PERMISSIONS } from "@/lib/auth/permissions"

export type CommunicationsAuthResult =
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse }

/**
 * Enforces staff authentication, rate-limit handling (429), granular RBAC for /ops/comunicacoes,
 * optional strict admin/integrations checks for config mutations, and same-origin verification.
 */
export async function authorizeCommunicationsApi(
  request: Request,
  options?: {
    requireConfigAdmin?: boolean
    checkOrigin?: boolean
  }
): Promise<CommunicationsAuthResult> {
  const authState = await getAuthContextState()
  if (authState.rateLimited) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sessão temporariamente limitada. Tente novamente em instantes." },
        { status: 429, headers: { "Retry-After": "15", "Cache-Control": "private, no-store" } }
      ),
    }
  }

  const ctx = authState.context
  if (!ctx || !["admin", "employee"].includes(ctx.role || "")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Não autorizado." }, { status: 401 }),
    }
  }

  const allowed = options?.requireConfigAdmin
    ? ctx.role === "admin" ||
      hasPermission(ctx, PERMISSIONS.integrations) ||
      hasPermission(ctx, PERMISSIONS.all)
    : canAccessOpsRoute(ctx, "/ops/comunicacoes")

  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sem permissão para aceder às comunicações." },
        { status: 403 }
      ),
    }
  }

  if (options?.checkOrigin) {
    const origin = request.headers.get("origin")
    if (origin) {
      try {
        if (origin !== new URL(request.url).origin) {
          return {
            ok: false,
            response: NextResponse.json({ error: "Origem do pedido inválida." }, { status: 403 }),
          }
        }
      } catch {
        return {
          ok: false,
          response: NextResponse.json({ error: "Origem do pedido inválida." }, { status: 403 }),
        }
      }
    }
  }

  return { ok: true, ctx }
}

