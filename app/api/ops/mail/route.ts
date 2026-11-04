import { NextResponse } from "next/server"
import { getAllowedMailAccounts } from "@/lib/auth/permissions"
import {
  MailError,
  normalizeMailAccount,
  type MailComposeInput,
  type MailMutationAction,
} from "@/lib/ops-mailbox"
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
      const allowedAccounts = getAllowedMailAccounts(context)
      const account = normalizeMailAccount(body.account)
      if (!allowedAccounts.includes(account)) {
        throw new MailError("Não tem permissão para aceder ou sincronizar esta caixa de correio.", 403)
      }
      const folder = typeof body.folder === "string" ? (body.folder as any) : undefined
      const offset = typeof body.offset === "number" ? body.offset : 0
      const limit = typeof body.limit === "number" ? Math.min(50, Math.max(5, body.limit)) : 25
      const searchQuery = typeof body.searchQuery === "string" ? body.searchQuery : undefined
      const result = await syncGmailImap(context.tenant_id, {
        account,
        folder,
        offset,
        limit,
        searchQuery,
      })
      const data = await listMailboxMessages(context, account)
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

