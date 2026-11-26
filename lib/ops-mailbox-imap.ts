import "server-only"
import { ImapFlow } from "imapflow"
import { simpleParser, type ParsedMail } from "mailparser"
import { createAdminClient } from "@/lib/supabase/server"
import {
  buildMailSnippet,
  normalizeMailAccount,
  type MailAccountId,
  type MailFolder,
  type MailLabelId,
  type MailMessage,
} from "@/lib/ops-mailbox"

export interface ImapSyncOptions {
  account?: MailAccountId
  limit?: number
  offset?: number
  folder?: MailFolder
  searchQuery?: string
}

export interface ImapSyncResult {
  synced: number
  errors: string[]
  connected: boolean
  totalInFolder?: number
}

export function resolveImapCredentials(account: MailAccountId): {
  host: string
  port: number
  user: string
  pass: string
  idPrefix: string
  defaultToName: string
} {
  const host = process.env.IMAP_HOST || "imap.gmail.com"
  const port = Number(process.env.IMAP_PORT || 993)

  if (account === "clientes@linke.pt") {
    const user = (process.env.IMAP_CLIENTES_USER || "cliente@linke.pt").trim()
    const pass = (
      process.env.GMAIL_CLIENTES_APP_PASSWORD ||
      process.env.IMAP_CLIENTES_PASSWORD ||
      ""
    ).trim()
    return {
      host,
      port,
      user,
      pass,
      idPrefix: "imap-clientes",
      defaultToName: "Apoio ao Cliente Linke",
    }
  }

  const user = (process.env.IMAP_USER || "geral@linke.pt").trim()
  const pass = (process.env.GMAIL_APP_PASSWORD || process.env.IMAP_PASSWORD || "").trim()
  return {
    host,
    port,
    user,
    pass,
    idPrefix: "imap-gmail",
    defaultToName: "Linke Geral",
  }
}

function classifyEmailLabels(fromEmail: string, toEmail: string, subject: string): MailLabelId[] {
  const combined = `${fromEmail} ${toEmail} ${subject}`.toLowerCase()
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

const FOLDER_TO_SPECIAL_USE: Record<Exclude<MailFolder, "starred">, string> = {
  inbox: "\\Inbox",
  sent: "\\Sent",
  drafts: "\\Drafts",
  archive: "\\All",
  trash: "\\Trash",
  junk: "\\Junk",
}

export async function syncGmailImap(
  tenantId: string,
  options?: ImapSyncOptions
): Promise<ImapSyncResult> {
  const account = normalizeMailAccount(options?.account)
  if (account === "notificacoes@linke.pt") {
    return { synced: 0, errors: [], connected: true }
  }

  const creds = resolveImapCredentials(account)

  if (!creds.pass) {
    const envVarName =
      account === "clientes@linke.pt" ? "GMAIL_CLIENTES_APP_PASSWORD" : "GMAIL_APP_PASSWORD"
    return {
      synced: 0,
      errors: [`${envVarName} ainda não configurado em .env.local para ${account}.`],
      connected: false,
    }
  }

  const admin = createAdminClient()
  const client = new ImapFlow({
    host: creds.host,
    port: creds.port,
    secure: creds.port === 993,
    auth: {
      user: creds.user,
      pass: creds.pass,
    },
    logger: false,
    tls: {
      rejectUnauthorized: true,
    },
  })

  const errors: string[] = []
  let synced = 0
  let totalInFolder = 0

  type RawFetchedMessage = {
    uid: number
    boxKey: Exclude<MailFolder, "starred"> | "all"
    targetFolder: Exclude<MailFolder, "starred">
    seen: boolean
    flagged: boolean
    source: Buffer
  }
  const rawMessages: RawFetchedMessage[] = []

  const buildMsgId = (boxKey: string, uid: number) =>
    boxKey === "inbox" ? `${creds.idPrefix}-${uid}` : `${creds.idPrefix}-${boxKey}-${uid}`

  // Ask only about the emails Gmail just listed (reading every stored id times out).
  // A failed check aborts the sync, otherwise the same emails get imported again.
  const dropStored = async (boxKey: string, uids: number[]) => {
    if (uids.length === 0) return uids
    const { data, error } = await admin.from("audit_log").select("mid:details->>id")
      .eq("tenant_id", tenantId).eq("action", "ops_mailbox_message")
      .in("details->>id", uids.map((uid) => buildMsgId(boxKey, uid)))
    if (error) throw new Error(error.message)
    const stored = new Set((data || []).map((r) => r.mid))
    return uids.filter((uid) => !stored.has(buildMsgId(boxKey, uid)))
  }

  try {
    await client.connect()
    const mailboxes = await client.list()

    const resolvePath = (specialUse: string, fallback = "INBOX"): string => {
      if (specialUse === "\\Inbox") return "INBOX"
      const found = mailboxes.find((m) => m.specialUse === specialUse)
      return found?.path || fallback
    }

    const searchQuery = options?.searchQuery?.trim() || ""
    const fetchLimit = options?.limit || 25
    const offset = Math.max(0, options?.offset || 0)

    const foldersToSync: Exclude<MailFolder, "starred">[] = []
    if (options?.folder && options.folder !== "starred") {
      foldersToSync.push(options.folder)
    } else if (searchQuery) {
      foldersToSync.push("archive")
    } else {
      foldersToSync.push("inbox", "sent")
    }

    for (const targetFolder of foldersToSync) {
      const specialUse = FOLDER_TO_SPECIAL_USE[targetFolder] || "\\Inbox"
      const mailboxPath = resolvePath(specialUse, "INBOX")
      const boxKey: Exclude<MailFolder, "starred"> | "all" =
        specialUse === "\\All" ? "all" : targetFolder

      const lock = await client.getMailboxLock(mailboxPath)
      try {
        const totalMessages =
          client.mailbox && typeof client.mailbox === "object" ? client.mailbox.exists : 0
        totalInFolder = totalMessages
        if (!totalMessages || totalMessages < 1) {
          continue
        }

        let targetUids: number[] = []

        if (searchQuery) {
          let matchedUids: number[] | false | undefined = false
          try {
            matchedUids = await client.search({ gmraw: searchQuery } as Record<string, unknown>, {
              uid: true,
            })
          } catch {
            matchedUids = await client.search(
              {
                or: [
                  { subject: searchQuery },
                  { from: searchQuery },
                  { to: searchQuery },
                  { body: searchQuery },
                ],
              },
              { uid: true }
            )
          }

          if (Array.isArray(matchedUids) && matchedUids.length > 0) {
            const slice = matchedUids.slice(-fetchLimit)
            targetUids = await dropStored(boxKey, slice)
          }
        } else {
          const endSeq = Math.max(1, totalMessages - offset)
          const startSeq = Math.max(1, endSeq - fetchLimit + 1)
          if (endSeq >= 1 && startSeq <= endSeq) {
            const range = `${startSeq}:${endSeq}`
            const listed: number[] = []
            for await (const meta of client.fetch(range, { uid: true })) listed.push(meta.uid)
            targetUids = await dropStored(boxKey, listed)
          }
        }

        if (targetUids.length > 0) {
          const uidRange = targetUids.join(",")
          for await (const msg of client.fetch(
            uidRange,
            { uid: true, flags: true, source: true },
            { uid: true }
          )) {
            if (msg.source) {
              rawMessages.push({
                uid: msg.uid,
                boxKey,
                targetFolder,
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
    }

    await client.logout()
  } catch (err) {
    return {
      synced,
      errors: [err instanceof Error ? err.message : `Falha na ligação IMAP com ${account}`],
      connected: false,
    }
  }

  const rowsToInsert: {
    tenant_id: string
    user_id: null
    action: string
    details: MailMessage
    created_at: string
  }[] = []

  const queued = new Set<string>()
  for (const item of rawMessages) {
    try {
      const messageId = buildMsgId(item.boxKey, item.uid)
      if (queued.has(messageId)) continue
      queued.add(messageId)

      const parsed = (await simpleParser(item.source)) as ParsedMail
      const fromAddr = parsed.from?.value?.[0]
      const fromName = fromAddr?.name || fromAddr?.address?.split("@")[0] || "Remetente"
      const fromEmail = (fromAddr?.address || "desconhecido@linke.pt").trim()

      const toList = Array.isArray(parsed.to) ? parsed.to : parsed.to ? [parsed.to] : []
      const firstTo = toList[0]?.value?.[0]
      const toName = firstTo?.name || firstTo?.address?.split("@")[0] || creds.defaultToName
      const toEmail = (firstTo?.address || account).trim()

      const ccList = Array.isArray(parsed.cc) ? parsed.cc : parsed.cc ? [parsed.cc] : []
      const ccEmails = ccList
        .flatMap((c) => c.value.map((v) => v.address || ""))
        .filter(Boolean)

      const isSentByLinke =
        item.targetFolder === "sent" ||
        fromEmail.toLowerCase() === account.toLowerCase() ||
        fromEmail.toLowerCase() === creds.user.toLowerCase()
      const resolvedFolder: Exclude<MailFolder, "starred"> =
        item.boxKey === "all" ? (isSentByLinke ? "sent" : "inbox") : item.targetFolder

      const subject = parsed.subject || "(Sem assunto)"
      const htmlContent = typeof parsed.html === "string" ? parsed.html : undefined
      const bodyText =
        parsed.text ||
        htmlContent
          ?.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim() ||
        subject
      const dateIso = parsed.date ? parsed.date.toISOString() : new Date().toISOString()

      const nonInlineAttachments = (parsed.attachments || []).filter(
        (att) => !(att.contentDisposition === "inline" && att.cid)
      )

      const messageRecord: MailMessage = {
        id: messageId,
        threadId: parsed.messageId ? `thread-${parsed.messageId}` : messageId,
        account,
        folder: resolvedFolder,
        fromName: isSentByLinke ? fromName || creds.defaultToName : fromName,
        fromEmail: isSentByLinke ? account : fromEmail,
        toName,
        toEmail,
        cc: ccEmails,
        subject,
        snippet: buildMailSnippet(bodyText || subject),
        bodyText: bodyText || subject,
        bodyHtml: htmlContent,
        read: isSentByLinke ? true : item.seen,
        starred: item.flagged,
        labels: classifyEmailLabels(fromEmail, toEmail, subject),
        attachments: nonInlineAttachments.map((att, idx) => {
          const filename = att.filename || `anexo-${idx + 1}`
          return {
            id: crypto.randomUUID(),
            name: filename,
            size: att.size || 1024,
            type: att.contentType || "application/octet-stream",
            url: `/api/ops/mail/attachment?uid=${item.uid}&index=${idx}&box=${item.boxKey}&account=${encodeURIComponent(account)}&name=${encodeURIComponent(filename)}`,
          }
        }),
        createdAt: dateIso,
        updatedAt: dateIso,
        deliveryStatus: isSentByLinke ? "sent" : "received",
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

  return { synced, errors, connected: true, totalInFolder }
}
