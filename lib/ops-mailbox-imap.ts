import "server-only"
import { ImapFlow } from "imapflow"
import { simpleParser, type ParsedMail } from "mailparser"
import { createAdminClient } from "@/lib/supabase/server"
import { buildMailSnippet, type MailMessage } from "@/lib/ops-mailbox"

export interface ImapSyncResult {
  synced: number
  errors: string[]
  connected: boolean
}

export async function syncGmailImap(
  tenantId: string,
  options?: { limit?: number }
): Promise<ImapSyncResult> {
  const host = process.env.IMAP_HOST || "imap.gmail.com"
  const port = Number(process.env.IMAP_PORT || 993)
  const user = (process.env.IMAP_USER || "geral@linke.pt").trim()
  // Gmail App Password (16 characters, e.g. "abcd efgh ijkl mnop") or standard password
  const pass = (process.env.IMAP_PASSWORD || process.env.GMAIL_APP_PASSWORD || "").trim()

  if (!pass) {
    return {
      synced: 0,
      errors: [
        "IMAP_PASSWORD ou GMAIL_APP_PASSWORD não configurado em .env.local para geral@linke.pt.",
      ],
      connected: false,
    }
  }

  const client = new ImapFlow({
    host,
    port,
    secure: port === 993,
    auth: {
      user,
      pass,
    },
    logger: false,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  })

  const errors: string[] = []
  let synced = 0

  try {
    await client.connect()
    const lock = await client.getMailboxLock("INBOX")
    try {
      const fetchLimit = options?.limit || 25
      const totalMessages = client.mailbox && typeof client.mailbox === "object" ? client.mailbox.exists : 0
      if (!totalMessages || totalMessages < 1) {
        return { synced: 0, errors: [], connected: true }
      }

      const startSeq = Math.max(1, totalMessages - fetchLimit + 1)
      const range = `${startSeq}:*`
      const admin = createAdminClient()

      for await (const msg of client.fetch(range, { uid: true, envelope: true, source: true })) {
        try {
          const uid = msg.uid
          const messageId = `imap-gmail-${uid}`

          // Check if already synced
          const { data: existing } = await admin
            .from("audit_log")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("action", "ops_mailbox_message")
            .contains("details", { id: messageId })
            .limit(1)

          if (existing && existing.length > 0) continue
          if (!msg.source) continue

          // Parse raw email RFC 822 source
          const parsed = (await simpleParser(msg.source)) as ParsedMail
          const fromAddr = parsed.from?.value?.[0]
          const fromName = fromAddr?.name || fromAddr?.address?.split("@")[0] || "Remetente"
          const fromEmail = fromAddr?.address || "desconhecido@linke.pt"
          const subject = parsed.subject || "(Sem assunto)"
          const htmlContent = typeof parsed.html === "string" ? parsed.html : undefined
          const bodyText = parsed.text || htmlContent?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") || ""
          const dateIso = parsed.date ? parsed.date.toISOString() : new Date().toISOString()

          const messageRecord: MailMessage = {
            id: messageId,
            threadId: parsed.messageId ? `thread-${parsed.messageId}` : messageId,
            account: "geral@linke.pt",
            folder: "inbox",
            fromName,
            fromEmail,
            toName: "Linke Geral",
            toEmail: "geral@linke.pt",
            subject,
            snippet: buildMailSnippet(bodyText || subject),
            bodyText: bodyText || subject,
            bodyHtml: htmlContent,
            read: false,
            starred: false,
            labels: ["clientes"],
            attachments: (parsed.attachments || []).map((att) => ({
              id: crypto.randomUUID(),
              name: att.filename || "anexo",
              size: att.size || 1024,
              type: att.contentType || "application/octet-stream",
              url: `data:${att.contentType || "application/octet-stream"};base64,${Buffer.isBuffer(att.content) ? att.content.toString("base64") : ""}`,
            })),
            createdAt: dateIso,
            updatedAt: dateIso,
            deliveryStatus: "received",
          }

          const { error: insertErr } = await admin.from("audit_log").insert({
            tenant_id: tenantId,
            user_id: null,
            action: "ops_mailbox_message",
            details: messageRecord,
          })

          if (!insertErr) {
            synced++
          }
        } catch (msgErr) {
          errors.push(msgErr instanceof Error ? msgErr.message : "Erro ao processar mensagem")
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
    return { synced, errors, connected: true }
  } catch (err) {
    return {
      synced,
      errors: [err instanceof Error ? err.message : "Falha na ligação IMAP com o Gmail"],
      connected: false,
    }
  }
}

