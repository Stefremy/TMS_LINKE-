import { NextResponse } from "next/server"
import { MailError, type MailComposeInput, type MailMutationAction } from "@/lib/ops-mailbox"
import {
  composeOrSaveMail,
  listMailboxMessages,
  mailboxContext,
  mutateMailMessages,
} from "@/lib/ops-mailbox-server"
import { syncGmailImap } from "@/lib/ops-mailbox-imap"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const headers = { "Cache-Control": "private, no-store" }

function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof MailError
          ? error.message
          : "Não foi possível processar o pedido na Caixa de Correio.",
    },
    { status: error instanceof MailError ? error.status : 500, headers }
  )
}

export async function GET(request: Request) {
  try {
    const context = await mailboxContext()
    const params = new URL(request.url).searchParams
    const account = params.get("account")
    const data = await listMailboxMessages(context, account)
    return NextResponse.json(data, { headers })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: Request) {
  try {
    const context = await mailboxContext()
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) {
      throw new MailError("Origem do pedido inválida.", 403)
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== "object") {
      throw new MailError("Pedido inválido.", 400)
    }

    if (body.kind === "sync_imap") {
      const result = await syncGmailImap(context.tenant_id, { limit: 25 })
      const data = await listMailboxMessages(context, "geral@linke.pt")
      return NextResponse.json({ ok: true, sync: result, ...data }, { headers })
    }

    if (body.kind === "mutate") {
      const mutation = body as unknown as MailMutationAction
      const result = await mutateMailMessages(context, mutation)
      return NextResponse.json({ ok: true, ...result }, { headers })
    }

    const input = body as unknown as MailComposeInput
    const message = await composeOrSaveMail(context, input)
    return NextResponse.json({ ok: true, message }, { status: 201, headers })
  } catch (error) {
    return failure(error)
  }
}

