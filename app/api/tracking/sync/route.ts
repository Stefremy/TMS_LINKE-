import { getAuthContext } from "@/lib/auth/context"
import { syncAuthorizedShipmentBatch } from "@/lib/services/tracking/tracking-batch"

export const maxDuration = 60

function reply(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } })
}

/** Background tracking must not occupy the browser Server Action queue or re-render layouts. */
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return reply({ error: "Origem não autorizada." }, 403)
  }
  const ctx = await getAuthContext()
  if (!ctx || !ctx.user || !ctx.role) return reply({ error: "Sessão necessária." }, 401)
  if (!ctx.tenant_id || !["client", "employee", "admin"].includes(ctx.role) ||
    (ctx.role === "client" && !ctx.client_id)) return reply({ error: "Acesso negado." }, 403)

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return reply({ error: "Pedido inválido." }, 415)
  }
  if (Number(request.headers.get("content-length") || 0) > 16384) {
    return reply({ error: "Pedido demasiado grande." }, 413)
  }
  try {
    const raw = await request.text()
    if (raw.length > 16384) return reply({ error: "Pedido demasiado grande." }, 413)
    const body = JSON.parse(raw)
    if (!body || !Array.isArray(body.shipmentIds) || body.shipmentIds.length > 50 ||
      body.shipmentIds.some((id: unknown) => typeof id !== "string" || id.length > 128 || !id.trim())) {
      return reply({ error: "Seleção de envios inválida." }, 400)
    }
    const result = await syncAuthorizedShipmentBatch(ctx, body.shipmentIds)
    return reply(result, result.error ? 503 : 200)
  } catch {
    return reply({ error: "Não foi possível atualizar o rastreio." }, 400)
  }
}
