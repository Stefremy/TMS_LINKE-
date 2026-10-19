import { NextResponse } from "next/server"
import { ChatError, chatBody, chatCursor, chatRecipient, isChatUuid } from "@/lib/team-chat"
import { chatContext, readTeamChat, sendTeamChat } from "@/lib/team-chat-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof ChatError ? error.message : "Não foi possível aceder ao chat." }, { status: error instanceof ChatError ? error.status : 500, headers })
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const context = await chatContext(params.get("viewer") || undefined)
    const before = chatCursor(params.get("before")), after = chatCursor(params.get("after"))
    if (before && after) throw new ChatError("Página inválida.")
    const channel = params.get("channel") || "geral"
    return NextResponse.json(await readTeamChat(context, chatRecipient(params.get("recipient")), channel, before, after), { headers })
  } catch (error) { return failure(error) }
}

export async function POST(request: Request) {
  try {
    const context = await chatContext()
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) throw new ChatError("Origem do pedido inválida.", 403)
    if (!request.headers.get("content-type")?.includes("application/json")) throw new ChatError("Pedido inválido.", 415)
    const raw = await request.text()
    if (raw.length > 24000) throw new ChatError("Mensagem demasiado longa.", 413)
    let input
    try { input = JSON.parse(raw) } catch { throw new ChatError("Pedido inválido.") }
    if (!input || !isChatUuid(input.clientMessageId) || input.viewerId !== context.user.id) throw new ChatError("A sessão mudou ou o pedido é inválido. Atualize a página.", 409)
    const channel = input.channel ? String(input.channel).trim() : null
    const message = await sendTeamChat(context, chatRecipient(input.recipient), channel, chatBody(input.body), input.clientMessageId)
    return NextResponse.json({ message }, { status: 201, headers })
  } catch (error) { return failure(error) }
}
