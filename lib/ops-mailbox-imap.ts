import "server-only"
import { ImapFlow } from "imapflow"
import { simpleParser, type ParsedMail } from "mailparser"
import { createAdminClient } from "@/lib/supabase/server"
import { buildMailSnippet, type MailLabelId, type MailMessage } from "@/lib/ops-mailbox"

export interface ImapSyncResult {
  synced: number
  errors: string[]
  connected: boolean
}

function classifyEmailLabels(fromEmail: string, subject: string): MailLabelId[] {
  const combined = `${fromEmail} ${subject}`.toLowerCase()
  const labels: MailLabelId[] = []
  if (
    combined.includes("ctt") ||
    combined.includes("correosexpress") ||
    combined.includes("recolha") ||
    combined.includes("recogida")
  ) {
    labels.push("recolhas", "operacoes")
  }
  if (
    combined.includes("fatura") ||
    combined.includes("pagamento") ||
    combined.includes("contabilidade") ||
    combined.includes("millennium") ||
    combined.includes("santander") ||
    combined.includes("recibo")
  ) {
    labels.push("faturacao")
  }
  if (combined.includes("incidência") || combined.includes("incidencia") || combined.includes("urgente")) {
    labels.push("incidencias")
  }
  if (labels.length === 0) {
    labels.push("clientes")
  }
  return labels
}

export async function syncGmailImap(
  tenantId: string,
  options?: { limit?: number }
): Promise<ImapSyncResult> {
  const host = process.env.IMAP_HOST || "imap.gmail.com"
  const port = Number(process.env.IMAP_PORT || 993)
  const user = (process.env.IMAP_USER || "geral@linke.pt").trim()
  const pass = (process.env.GMAIL_APP_PASSWORD || process.env.IMAP_PASSWORD || "").trim()

  if (!pass) {
    return {
      synced: 0,
      errors: [
        "IMAP_PASSWORD ou GMAIL_APP_PASSWORD não configurado em .env.local para geral@linke.pt.",
      ],
      connected: false,
    }
  }

  const admin = createAdminClient()
  const { data: existingRows } = await admin
    .from("audit_log")
    .select("details")
    .eq("tenant_id", tenantId)
    .eq("action", "ops_mailbox_message")
    .order("created_at", { ascending: false })
    .limit(400)

  const existingIds = new Set<string>(
    (existingRows || [])
      .map((r: { details?: { id?: string } | null }) => r.details?.id)
      .filter((id: unknown): id is string => typeof id === "string")
  )

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
      rejectUnauthorized: false,
    },
  })

  const errors: string[] = []
  let synced = 0
  const rawMessages: { uid: number; seen: boolean; flagged: boolean; source: Buffer }[] = []

  try {
    await client.connect()
    const lock = await client.getMailboxLock("INBOX")
    try {
      const fetchLimit = options?.limit || 30
      const totalMessages = client.mailbox && typeof client.mailbox === "object" ? client.mailbox.exists : 0
      if (!totalMessages || totalMessages < 1) {
        return { synced: 0, errors: [], connected: true }
      }

      const startSeq = Math.max(1, totalMessages - fetchLimit + 1)
      const range = `${startSeq}:*`

      // Step 1: Quickly check UIDs in range so we only download unseen UIDs
      const missingUids: number[] = []
      for await (const meta of client.fetch(range, { uid: true })) {
        if (!existingIds.has(`imap-gmail-${meta.uid}`)) {
          missingUids.push(meta.uid)
        }
      }

      // Step 2: Download source only for new messages
      if (missingUids.length > 0) {
        const uidRange = missingUids.join(",")
        for await (const msg of client.fetch(
          uidRange,
          { uid: true, flags: true, source: { maxLength: 512000 } },
          { uid: true }
        )) {
          if (msg.source) {
            rawMessages.push({
              uid: msg.uid,
              seen: Boolean(msg.flags?.has("\\Seen")),
              flagged: Boolean(msg.flags?.has("\\Flagged")),
              source: msg.source,
            })
          }
        }
      }
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (err) {
    return {
      synced,
      errors: [err instanceof Error ? err.message : "Falha na ligação IMAP com o Gmail"],
      connected: false,
    }
  }

  // Step 3: Parse and persist outside the IMAP lock
  const rowsToInsert: {
    tenant_id: string
    user_id: null
    action: string
    details: MailMessage
    created_at: string
  }[] = []

  for (const item of rawMessages) {
    try {
      const messageId = `imap-gmail-${item.uid}`
      const parsed = (await simpleParser(item.source)) as ParsedMail
      const fromAddr = parsed.from?.value?.[0]
      const fromName = fromAddr?.name || fromAddr?.address?.split("@")[0] || "Remetente"
      const fromEmail = fromAddr?.address || "desconhecido@linke.pt"
      const subject = parsed.subject || "(Sem assunto)"
      const htmlContent = typeof parsed.html === "string" ? parsed.html : undefined
      const bodyText =
        parsed.text ||
        htmlContent?.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ||
        subject
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
        read: item.seen,
        starred: item.flagged,
        labels: classifyEmailLabels(fromEmail, subject),
        attachments: (parsed.attachments || []).map((att) => {
          const isSmall = (att.size || 0) <= 180000 && Buffer.isBuffer(att.content)
          return {
            id: crypto.randomUUID(),
            name: att.filename || "anexo",
            size: att.size || 1024,
            type: att.contentType || "application/octet-stream",
            url: isSmall
              ? `data:${att.contentType || "application/octet-stream"};base64,${att.content.toString("base64")}`
              : "#",
          }
        }),
        createdAt: dateIso,
        updatedAt: dateIso,
        deliveryStatus: "received",
      }

      rowsToInsert.push({
        tenant_id: tenantId,
        user_id: null,
        action: "ops_mailbox_message",
        details: messageRecord,
        created_at: dateIso,
      })
    } catch (msgErr) {
      errors.push(msgErr instanceof Error ? msgErr.message : "Erro ao processar mensagem")
    }
  }

  if (rowsToInsert.length > 0) {
    const { error: insertErr } = await admin.from("audit_log").insert(rowsToInsert)
    if (insertErr) {
      errors.push(insertErr.message)
    } else {
      synced = rowsToInsert.length
    }
  }

  return { synced, errors, connected: true }
}

