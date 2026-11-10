import { NextResponse } from "next/server"
import { chatContext } from "@/lib/team-chat-server"
import { ChatError } from "@/lib/team-chat"
import { readCallSignals, readIncomingCalls, writeCallSignal } from "@/lib/team-chat-calls"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }
const failure = (error: unknown) => {
  const status = error instanceof ChatError ? error.status : 500
  const responseHeaders = status === 429 ? { ...headers, "Retry-After": "15" } : headers
  return NextResponse.json(
    { error: error instanceof ChatError ? error.message : "Não foi possível ligar a chamada." },
    { status, headers: responseHeaders }
  )
}
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const ctx = await chatContext(params.get("viewer") || undefined)
    if (params.get("incoming") === "1") return NextResponse.json({ viewerId: ctx.user.id, calls: await readIncomingCalls(ctx) }, { headers })
    return NextResponse.json({ viewerId: ctx.user.id, ...await readCallSignals(ctx, params.get("room") || "", params.get("since"), params.get("configuration") !== "0") }, { headers })
  } catch (error) { return failure(error) }
}
export async function POST(request: Request) {
  try {
    const ctx = await chatContext()
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) throw new ChatError("Origem do pedido inválida.", 403)
    if (!request.headers.get("content-type")?.includes("application/json")) throw new ChatError("Pedido inválido.", 415)
    const text = await request.text()
    if (text.length > 50_000) throw new ChatError("Sinal de chamada demasiado grande.", 413)
    let body
    try { body = JSON.parse(text) } catch { throw new ChatError("Pedido inválido.") }
    if (body?.viewerId !== ctx.user.id) throw new ChatError("A sessão mudou. Atualize a página.", 409)
    await writeCallSignal(ctx, String(body.room || ""), body.signal)
    return NextResponse.json({ success: true }, { headers })
  } catch (error) { return failure(error) }
}
