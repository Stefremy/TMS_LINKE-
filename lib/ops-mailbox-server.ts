import "server-only"
import { getAuthContext, type AuthContext } from "@/lib/auth/context"
import { getAllowedMailAccounts } from "@/lib/auth/permissions"
import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import {
  buildMailSnippet,
  formatEmailHtmlTemplate,
  getSeededMailboxMessages,
  MAIL_ACCOUNTS,
  MAIL_LABELS,
  MailError,
  normalizeMailAccount,
  type MailAccountId,
  type MailComposeInput,
  type MailFolder,
  type MailLabelId,
  type MailListResponse,
  type MailMessage,
  type MailMutationAction,
} from "@/lib/ops-mailbox"
import type { ChatAttachmentItem } from "@/lib/team-chat-media"

const ACTION_MESSAGE = "ops_mailbox_message"
const ACTION_MUTATION = "ops_mailbox_mutation"

export async function mailboxContext(): Promise<AuthContext> {
  const context = await getAuthContext()
  if (!context?.user?.id) {
    throw new MailError("Inicie sessão para aceder à Caixa de Correio.", 401)
  }
  if (context.role !== "admin" && context.role !== "employee") {
    throw new MailError("A Caixa de Correio é exclusiva da equipa.", 403)
  }
  return context
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function parseEmailList(raw?: string): string[] {
  if (!raw || typeof raw !== "string") return []
  return raw
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && isValidEmail(item))
}

function sanitizeLabels(labels?: unknown): MailLabelId[] {
  if (!Array.isArray(labels)) return []
  const valid = new Set<string>(MAIL_LABELS.map((l) => l.id))
  return [...new Set(labels.filter((l): l is MailLabelId => typeof l === "string" && valid.has(l)))]
}

function sanitizeAttachments(attachments?: unknown): ChatAttachmentItem[] {
  if (!Array.isArray(attachments)) return []
  const list: ChatAttachmentItem[] = []
  for (const item of attachments) {
    if (item && typeof item === "object") {
      const att = item as Partial<ChatAttachmentItem>
      if (
        typeof att.url === "string" &&
        (att.url.startsWith("http") ||
          att.url.startsWith("/api/ops/mail/attachment") ||
          att.url.startsWith("data:")) &&
        typeof att.name === "string"
      ) {
        list.push({
          id: typeof att.id === "string" ? att.id : crypto.randomUUID(),
          name: att.name.slice(0, 140),
          size: typeof att.size === "number" && att.size > 0 ? att.size : 1024,
          type: typeof att.type === "string" ? att.type : "application/octet-stream",
          url: att.url,
        })
      }
    }
  }
  return list
}

type StoredMutation = {
  id: string
  read?: boolean
  starred?: boolean
  folder?: Exclude<MailFolder, "starred">
  labels?: MailLabelId[]
  muted?: boolean
  deleted?: boolean
  updatedAt: string
}

export async function listMailboxMessages(
  context: AuthContext,
  requestedAccount?: string | null
): Promise<MailListResponse> {
  const allowedAccounts = getAllowedMailAccounts(context)
  const requested = normalizeMailAccount(requestedAccount)
  const account = allowedAccounts.includes(requested)
    ? requested
    : allowedAccounts[0] || "geral@linke.pt"
  const admin = createAdminClient()

  const { data: rows } = await admin
    .from("audit_log")
    .select("action, details, created_at")
    .eq("tenant_id", context.tenant_id)
    .in("action", [ACTION_MESSAGE, ACTION_MUTATION, "tracking_email_sent"])
    .order("created_at", { ascending: true })
    .limit(2500)

  const messageMap = new Map<string, MailMessage>()
  const deletedIds = new Set<string>()

  // 1. Seed initial realistic company threads for geral@linke.pt
  for (const seed of getSeededMailboxMessages()) {
    messageMap.set(seed.id, { ...seed })
  }

  // 2. Fold stored messages, mutations, and system tracking emails in chronological order
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (!row?.details || typeof row.details !== "object") continue

      if (row.action === ACTION_MESSAGE) {
        const msg = row.details as Partial<MailMessage>
        if (typeof msg.id === "string" && typeof msg.subject === "string") {
          const existing = messageMap.get(msg.id)
          const normalized: MailMessage = {
            id: msg.id,
            threadId: msg.threadId || existing?.threadId || msg.id,
            account: normalizeMailAccount(msg.account || existing?.account),
            folder: msg.folder || existing?.folder || "inbox",
            fromName: msg.fromName || existing?.fromName || "Linke Geral",
            fromEmail: msg.fromEmail || existing?.fromEmail || "geral@linke.pt",
            toName: msg.toName || existing?.toName || msg.toEmail || "Destinatário",
            toEmail: msg.toEmail || existing?.toEmail || "",
            cc: Array.isArray(msg.cc) ? msg.cc : existing?.cc || [],
            bcc: Array.isArray(msg.bcc) ? msg.bcc : existing?.bcc || [],
            replyTo: msg.replyTo || existing?.replyTo || "geral@linke.pt",
            subject: msg.subject,
            snippet: msg.snippet || buildMailSnippet(msg.bodyText || ""),
            bodyText: msg.bodyText || existing?.bodyText || "",
            bodyHtml: msg.bodyHtml || existing?.bodyHtml,
            read: typeof msg.read === "boolean" ? msg.read : (existing?.read ?? true),
            starred: typeof msg.starred === "boolean" ? msg.starred : (existing?.starred ?? false),
            labels: sanitizeLabels(msg.labels ?? existing?.labels),
            attachments: sanitizeAttachments(msg.attachments ?? existing?.attachments),
            createdAt: msg.createdAt || existing?.createdAt || row.created_at || new Date().toISOString(),
            updatedAt: msg.updatedAt || row.created_at || new Date().toISOString(),
            deliveryStatus: msg.deliveryStatus || existing?.deliveryStatus || "sent",
            resendId: msg.resendId ?? existing?.resendId ?? null,
            deliveryError: msg.deliveryError ?? existing?.deliveryError ?? null,
            inReplyToId: msg.inReplyToId ?? existing?.inReplyToId ?? null,
            muted: typeof msg.muted === "boolean" ? msg.muted : existing?.muted,
          }
          messageMap.set(normalized.id, normalized)
          deletedIds.delete(normalized.id)
        }
      } else if (row.action === ACTION_MUTATION) {
        const mut = row.details as Partial<StoredMutation>
        if (typeof mut.id === "string") {
          if (mut.deleted) {
            deletedIds.add(mut.id)
            messageMap.delete(mut.id)
            continue
          }
          const target = messageMap.get(mut.id)
          if (target) {
            if (typeof mut.read === "boolean") target.read = mut.read
            if (typeof mut.starred === "boolean") target.starred = mut.starred
            if (mut.folder) target.folder = mut.folder
            if (Array.isArray(mut.labels)) target.labels = sanitizeLabels(mut.labels)
            if (typeof mut.muted === "boolean") target.muted = mut.muted
            if (mut.updatedAt) target.updatedAt = mut.updatedAt
          }
        }
      } else if (row.action === "tracking_email_sent") {
        const d = row.details as Record<string, unknown>
        const recipientEmail = typeof d.recipient_email === "string" ? d.recipient_email : ""
        const shipmentId = typeof d.shipment_id === "string" ? d.shipment_id : ""
        const eventCode = typeof d.event_code === "string" ? d.event_code : "TRACK"
        const sentAt = typeof d.sent_at === "string" ? d.sent_at : row.created_at || new Date().toISOString()
        const autoId = `tracking-${shipmentId}-${eventCode}-${sentAt.slice(0, 16)}`
        if (recipientEmail && !deletedIds.has(autoId) && !messageMap.has(autoId)) {
          const typeLabel =
            d.type === "in_transit"
              ? "Em Trânsito / Distribuição"
              : d.type === "delivered"
              ? "Entregue"
              : d.type === "incident"
              ? "Incidência na Entrega"
              : "Atualização de Estado"
          const bodyText = `Notificação automática de tracking enviada para ${recipientEmail}.\n\n• Estado: ${typeLabel} (${eventCode})\n• ID do Envio: ${shipmentId}\n• Remetente: notificacoes@linke.pt\n• Data/Hora: ${new Date(sentAt).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })}`
          messageMap.set(autoId, {
            id: autoId,
            threadId: `thread-tracking-${shipmentId}`,
            account: "notificacoes@linke.pt",
            folder: "sent",
            fromName: "Notificações Linke TMS",
            fromEmail: "notificacoes@linke.pt",
            toName: recipientEmail.split("@")[0] || "Destinatário",
            toEmail: recipientEmail,
            subject: `[Tracking Automático] ${typeLabel} (${eventCode})`,
            snippet: buildMailSnippet(bodyText),
            bodyText,
            read: true,
            starred: false,
            labels: d.type === "incident" ? ["incidencias", "operacoes"] : ["operacoes"],
            attachments: [],
            createdAt: sentAt,
            updatedAt: sentAt,
            deliveryStatus: d.success === false ? "failed" : "delivered",
          })
        }
      }
    }
  }

  const allMessages = [...messageMap.values()]
    .filter((m) => !deletedIds.has(m.id) && allowedAccounts.includes(m.account))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const origin = process.env.CLIENT_PORTAL_ORIGIN || "https://app.toke.pt"
  const allowedMailAccountsList = MAIL_ACCOUNTS.filter((a) => allowedAccounts.includes(a.id))

  return {
    account,
    accounts: allowedMailAccountsList.length > 0 ? allowedMailAccountsList : [MAIL_ACCOUNTS[0]],
    messages: allMessages,
    resendConnected: Boolean(process.env.RESEND_API_KEY),
    inboundWebhookUrl: `${origin.replace(/\/$/, "")}/api/webhooks/resend`,
  }
}

export async function composeOrSaveMail(
  context: AuthContext,
  input: MailComposeInput
): Promise<MailMessage> {
  const allowedAccounts = getAllowedMailAccounts(context)
  const account = normalizeMailAccount(input.account || allowedAccounts[0] || "geral@linke.pt")
  if (!allowedAccounts.includes(account)) {
    throw new MailError("Não tem permissão para enviar emails a partir desta caixa de correio.", 403)
  }
  const accountMeta = MAIL_ACCOUNTS.find((a) => a.id === account) || MAIL_ACCOUNTS[0]
  const isDraft = Boolean(input.isDraft)

  const toEmail = (input.toEmail || "").trim()
  if (!isDraft && !isValidEmail(toEmail)) {
    throw new MailError("Indique um endereço de email de destinatário válido.")
  }

  const subject = (input.subject || "").trim().slice(0, 240)
  if (!isDraft && !subject) {
    throw new MailError("Indique o assunto do email.")
  }

  const bodyText = (input.bodyText || "").trim().slice(0, 25000)
  if (!isDraft && !bodyText) {
    throw new MailError("Escreva a mensagem do email antes de enviar.")
  }

  const cc = parseEmailList(input.cc)
  const bcc = parseEmailList(input.bcc)
  const labels = sanitizeLabels(input.labels)
  const attachments = sanitizeAttachments(input.attachments)
  const now = new Date().toISOString()
  const messageId = input.id && input.id.trim() ? input.id.trim() : `mail-${crypto.randomUUID()}`

  const toName =
    (input.toName || "").trim() ||
    (toEmail.includes("@") ? toEmail.split("@")[0].replace(/[._-]+/g, " ") : "Destinatário")

  const html = formatEmailHtmlTemplate({
    senderName: accountMeta.label,
    senderEmail: accountMeta.email,
    subject: subject || "(Sem assunto)",
    bodyText,
    attachments,
  })

  let deliveryStatus: MailMessage["deliveryStatus"] = isDraft ? "draft" : "sent"
  let resendId: string | null = null
  let deliveryError: string | null = null

  if (!isDraft) {
    const fromHeader = `${accountMeta.label} <${accountMeta.email}>`
    const result = await sendEmail({
      from: fromHeader,
      to: [toEmail, ...cc],
      subject,
      html,
      idempotencyKey: messageId,
    })

    if (result.success) {
      deliveryStatus = "delivered"
      const dataObj = result.data as { id?: string } | undefined
      resendId = dataObj?.id || null
    } else {
      // Keep the sent email in Sent folder with warning note if sandbox/domain restriction occurs
      deliveryStatus = "sent"
      const errObj = result.error as { message?: string } | string | undefined
      deliveryError =
        typeof errObj === "string"
          ? errObj
          : typeof errObj?.message === "string"
          ? errObj.message
          : null
    }
  }

  const message: MailMessage = {
    id: messageId,
    threadId: input.inReplyToId || messageId,
    account,
    folder: isDraft ? "drafts" : "sent",
    fromName: accountMeta.label,
    fromEmail: accountMeta.email,
    toName,
    toEmail,
    cc,
    bcc,
    replyTo: accountMeta.email,
    subject: subject || "(Sem assunto)",
    snippet: buildMailSnippet(bodyText),
    bodyText,
    bodyHtml: html,
    read: true,
    starred: false,
    labels,
    attachments,
    createdAt: now,
    updatedAt: now,
    deliveryStatus,
    resendId,
    deliveryError,
    inReplyToId: input.inReplyToId || null,
  }

  const admin = createAdminClient()
  const { error } = await admin.from("audit_log").insert({
    tenant_id: context.tenant_id,
    user_id: context.user.id,
    action: ACTION_MESSAGE,
    details: message,
  })

  if (error) {
    throw new MailError("Não foi possível guardar o email na Caixa de Correio.", 500)
  }

  return message
}

export async function mutateMailMessages(
  context: AuthContext,
  mutation: MailMutationAction
): Promise<{ updatedIds: string[] }> {
  if (!Array.isArray(mutation.ids) || mutation.ids.length === 0) {
    throw new MailError("Nenhum email selecionado.")
  }

  const current = await listMailboxMessages(context)
  const byId = new Map(current.messages.map((m) => [m.id, m]))
  const now = new Date().toISOString()
  const inserts: { tenant_id: string; user_id: string; action: string; details: StoredMutation }[] = []

  for (const rawId of mutation.ids.slice(0, 50)) {
    const id = String(rawId || "").trim()
    if (!id) continue
    const msg = byId.get(id)

    if (mutation.action === "delete_permanent") {
      inserts.push({
        tenant_id: context.tenant_id,
        user_id: context.user.id,
        action: ACTION_MUTATION,
        details: { id, deleted: true, updatedAt: now },
      })
      continue
    }

    if (!msg) continue

    const patch: StoredMutation = { id, updatedAt: now }
    if (mutation.action === "mark_read") {
      patch.read = true
    } else if (mutation.action === "mark_unread") {
      patch.read = false
    } else if (mutation.action === "toggle_star") {
      patch.starred = !msg.starred
    } else if (mutation.action === "toggle_mute") {
      patch.muted = !msg.muted
    } else if (mutation.action === "move_folder" && mutation.folder) {
      patch.folder = mutation.folder
    } else if (mutation.action === "toggle_label" && mutation.label) {
      const has = msg.labels.includes(mutation.label)
      patch.labels = has
        ? msg.labels.filter((l) => l !== mutation.label)
        : [...msg.labels, mutation.label]
    }

    inserts.push({
      tenant_id: context.tenant_id,
      user_id: context.user.id,
      action: ACTION_MUTATION,
      details: patch,
    })
  }

  if (inserts.length > 0) {
    const admin = createAdminClient()
    const { error } = await admin.from("audit_log").insert(inserts)
    if (error) {
      throw new MailError("Não foi possível atualizar a mensagem.", 500)
    }
  }

  return { updatedIds: inserts.map((i) => i.details.id) }
}

export async function recordInboundEmailWebhook(payload: Record<string, unknown>): Promise<MailMessage | null> {
  const data = (payload.data && typeof payload.data === "object" ? payload.data : payload) as Record<string, unknown>
  const fromRaw = typeof data.from === "string" ? data.from : ""
  if (!fromRaw) return null

  const matchAngle = fromRaw.match(/^(.*?)\s*<([^>]+)>$/)
  const fromName = matchAngle ? matchAngle[1].replace(/^["']|["']$/g, "").trim() || matchAngle[2] : fromRaw.split("@")[0]
  const fromEmail = matchAngle ? matchAngle[2].trim() : fromRaw.trim()

  const toList = Array.isArray(data.to) ? data.to.map(String) : typeof data.to === "string" ? [data.to] : ["geral@linke.pt"]
  const primaryTo = toList[0] || "geral@linke.pt"
  const account = normalizeMailAccount(primaryTo)

  const subject = typeof data.subject === "string" && data.subject.trim() ? data.subject.trim() : "(Sem assunto)"
  const bodyText =
    typeof data.text === "string" && data.text.trim()
      ? data.text.trim()
      : typeof data.html === "string"
      ? data.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : ""

  const now = typeof data.created_at === "string" ? data.created_at : new Date().toISOString()
  const id = typeof data.email_id === "string" ? `inbound-${data.email_id}` : `inbound-${crypto.randomUUID()}`

  const message: MailMessage = {
    id,
    threadId: id,
    account,
    folder: "inbox",
    fromName,
    fromEmail,
    toName: "Linke Geral",
    toEmail: account,
    subject,
    snippet: buildMailSnippet(bodyText || subject),
    bodyText: bodyText || subject,
    bodyHtml: typeof data.html === "string" ? data.html : undefined,
    read: false,
    starred: false,
    labels: ["clientes"],
    attachments: [],
    createdAt: now,
    updatedAt: now,
    deliveryStatus: "received",
  }

  const admin = createAdminClient()
  await admin.from("audit_log").insert({
    tenant_id: "11111111-1111-1111-1111-111111111111",
    user_id: null,
    action: ACTION_MESSAGE,
    details: message,
  })

  return message
}
