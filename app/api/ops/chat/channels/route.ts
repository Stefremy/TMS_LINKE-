import { NextResponse } from "next/server"
import { ChatError } from "@/lib/team-chat"
import { chatContext, createTeamChatChannel, listTeamChatChannels } from "@/lib/team-chat-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }

function failure(error: unknown) {
  return NextResponse.json(
    { error: error instanceof ChatError ? error.message : "Não foi possível processar o pedido de canais." },
    { status: error instanceof ChatError ? error.status : 500, headers }
  )
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const context = await chatContext(params.get("viewer") || undefined)
    const channels = await listTeamChatChannels(context.tenant_id)
    return NextResponse.json({ channels }, { headers })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: Request) {
  try {
    const context = await chatContext()
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) {
      throw new ChatError("Origem do pedido inválida.", 403)
    }
    if (!request.headers.get("content-type")?.includes("application/json")) {
      throw new ChatError("Pedido inválido.", 415)
    }
    const raw = await request.text()
    let input
    try {
      input = JSON.parse(raw)
    } catch {
      throw new ChatError("Dados do canal inválidos.")
    }
    const name = typeof input?.name === "string" ? input.name : ""
    const description = typeof input?.description === "string" ? input.description : ""
    const channel = await createTeamChatChannel(context, name, description)
    return NextResponse.json({ channel }, { status: 201, headers })
  } catch (error) {
    return failure(error)
  }
}
