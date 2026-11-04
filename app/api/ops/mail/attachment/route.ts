import { NextResponse } from "next/server"
import { ImapFlow } from "imapflow"
import { simpleParser, type ParsedMail } from "mailparser"
import { mailboxContext } from "@/lib/ops-mailbox-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    await mailboxContext()
    const { searchParams } = new URL(request.url)
    const uidParam = searchParams.get("uid")
    const indexParam = searchParams.get("index") || "0"
    const download = searchParams.get("download") === "1"

    const uid = Number(uidParam)
    const attIndex = Number(indexParam)
    if (!Number.isFinite(uid) || uid <= 0) {
      return NextResponse.json({ error: "UID de mensagem inválido." }, { status: 400 })
    }

    const host = process.env.IMAP_HOST || "imap.gmail.com"
    const port = Number(process.env.IMAP_PORT || 993)
    const user = (process.env.IMAP_USER || "geral@linke.pt").trim()
    const pass = (process.env.GMAIL_APP_PASSWORD || process.env.IMAP_PASSWORD || "").trim()

    if (!pass) {
      return NextResponse.json({ error: "Credenciais IMAP não configuradas." }, { status: 500 })
    }

    const client = new ImapFlow({
      host,
      port,
      secure: port === 993,
      auth: { user, pass },
      logger: false,
      tls: { rejectUnauthorized: false },
    })

    let rawSource: Buffer | null = null
    await client.connect()
    const lock = await client.getMailboxLock("INBOX")
    try {
      for await (const msg of client.fetch(String(uid), { uid: true, source: true }, { uid: true })) {
        if (msg.source) {
          rawSource = msg.source
          break
        }
      }
    } finally {
      lock.release()
    }
    await client.logout()

    if (!rawSource) {
      return NextResponse.json({ error: "Mensagem não encontrada no servidor IMAP." }, { status: 404 })
    }

    const parsed = (await simpleParser(rawSource)) as ParsedMail
    const nonInlineAttachments = (parsed.attachments || []).filter(
      (a) => !(a.contentDisposition === "inline" && a.cid)
    )
    const target =
      nonInlineAttachments[attIndex] || (parsed.attachments || [])[attIndex] || (parsed.attachments || [])[0]

    if (!target || !Buffer.isBuffer(target.content)) {
      return NextResponse.json({ error: "Anexo não encontrado nesta mensagem." }, { status: 404 })
    }

    const filename = (target.filename || `anexo-${uid}`).replace(/["\r\n]/g, "")
    const contentType = target.contentType || "application/octet-stream"
    const disposition = download ? "attachment" : "inline"

    return new NextResponse(new Uint8Array(target.content), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(target.content.length),
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao transferir anexo." },
      { status: 500 }
    )
  }
}

