import type { ChatAttachmentItem } from "@/lib/team-chat-media"

export type MailFolder = "inbox" | "drafts" | "sent" | "junk" | "trash" | "archive" | "starred"

export type MailLabelId =
  | "operacoes"
  | "faturacao"
  | "recolhas"
  | "clientes"
  | "incidencias"
  | "urgente"

export type MailAccountId = "geral@linke.pt" | "clientes@linke.pt" | "notificacoes@linke.pt"

export interface MailAccount {
  id: MailAccountId
  label: string
  email: string
  roleLabel: string
  primary?: boolean
}

export interface MailLabel {
  id: MailLabelId
  name: string
  color: string
  badgeClass: string
}

export interface MailMessage {
  id: string
  threadId: string
  account: MailAccountId
  folder: Exclude<MailFolder, "starred">
  fromName: string
  fromEmail: string
  toName: string
  toEmail: string
  cc?: string[]
  bcc?: string[]
  replyTo?: string
  subject: string
  snippet: string
  bodyText: string
  bodyHtml?: string
  read: boolean
  starred: boolean
  labels: MailLabelId[]
  attachments: ChatAttachmentItem[]
  createdAt: string
  updatedAt: string
  deliveryStatus?: "sent" | "delivered" | "queued" | "received" | "draft" | "failed"
  resendId?: string | null
  deliveryError?: string | null
  inReplyToId?: string | null
  muted?: boolean
}

export interface MailComposeInput {
  id?: string
  account?: MailAccountId
  toEmail: string
  toName?: string
  cc?: string
  bcc?: string
  subject: string
  bodyText: string
  labels?: MailLabelId[]
  attachments?: ChatAttachmentItem[]
  inReplyToId?: string | null
  isDraft?: boolean
}

export interface MailMutationAction {
  action:
    | "mark_read"
    | "mark_unread"
    | "toggle_star"
    | "move_folder"
    | "toggle_label"
    | "toggle_mute"
    | "delete_permanent"
  ids: string[]
  folder?: Exclude<MailFolder, "starred">
  label?: MailLabelId
}

export interface MailListResponse {
  account: MailAccountId
  accounts: MailAccount[]
  messages: MailMessage[]
  resendConnected: boolean
  inboundWebhookUrl: string
}

export class MailError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = "MailError"
    this.status = status
  }
}

export const MAIL_ACCOUNTS: MailAccount[] = [
  {
    id: "geral@linke.pt",
    label: "Linke Geral",
    email: "geral@linke.pt",
    roleLabel: "Caixa Principal da Empresa",
    primary: true,
  },
  {
    id: "clientes@linke.pt",
    label: "Apoio ao Cliente",
    email: "clientes@linke.pt",
    roleLabel: "Suporte & Contas Correntes",
  },
  {
    id: "notificacoes@linke.pt",
    label: "Notificações TMS",
    email: "notificacoes@linke.pt",
    roleLabel: "Avisos Automáticos & Tracking",
  },
]

export const MAIL_LABELS: MailLabel[] = [
  {
    id: "operacoes",
    name: "Operações",
    color: "#16a34a",
    badgeClass: "bg-emerald-500/12 text-emerald-700 border-emerald-500/25",
  },
  {
    id: "recolhas",
    name: "Recolhas CTT",
    color: "#0284c7",
    badgeClass: "bg-sky-500/12 text-sky-700 border-sky-500/25",
  },
  {
    id: "faturacao",
    name: "Faturação",
    color: "#7c3aed",
    badgeClass: "bg-violet-500/12 text-violet-700 border-violet-500/25",
  },
  {
    id: "clientes",
    name: "Clientes",
    color: "#d97706",
    badgeClass: "bg-amber-500/12 text-amber-700 border-amber-500/25",
  },
  {
    id: "incidencias",
    name: "Incidências",
    color: "#e11d48",
    badgeClass: "bg-rose-500/12 text-rose-700 border-rose-500/25",
  },
  {
    id: "urgente",
    name: "Urgente",
    color: "#dc2626",
    badgeClass: "bg-red-500/15 text-red-700 border-red-500/30",
  },
]

export function normalizeMailAccount(value: unknown): MailAccountId {
  const clean = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (clean === "clientes@linke.pt") return "clientes@linke.pt"
  if (clean === "notificacoes@linke.pt") return "notificacoes@linke.pt"
  return "geral@linke.pt"
}

export function buildMailSnippet(bodyText: string, maxLength = 150): string {
  const clean = (bodyText || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (clean.length <= maxLength) return clean
  return `${clean.slice(0, maxLength - 1).trimEnd()}…`
}

export function escapeHtmlText(raw: string): string {
  return (raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function formatEmailHtmlTemplate({
  senderName,
  senderEmail,
  subject,
  bodyText,
  attachments = [],
}: {
  senderName: string
  senderEmail: string
  subject: string
  bodyText: string
  attachments?: ChatAttachmentItem[]
}): string {
  const paragraphs = (bodyText || "")
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 14px 0;color:#1e293b;font-size:14px;line-height:1.65;">${escapeHtmlText(block).replace(/\n/g, "<br/>")}</p>`)
    .join("")

  const attachmentLinks =
    attachments.length > 0
      ? `<div style="margin-top:20px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.04em;">Anexos (${attachments.length})</p>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:#0f172a;">
            ${attachments
              .map(
                (att) =>
                  `<li style="margin-bottom:4px;"><a href="${escapeHtmlText(att.url)}" style="color:#16a34a;text-decoration:underline;font-weight:600;">${escapeHtmlText(att.name)}</a></li>`
              )
              .join("")}
          </ul>
        </div>`
      : ""

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtmlText(subject)}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;margin:0;padding:28px 14px;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px 30px;box-shadow:0 2px 8px rgba(15,23,42,0.04);">
    <div style="padding-bottom:18px;margin-bottom:20px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <strong style="font-size:16px;color:#0f172a;letter-spacing:-0.02em;">Linke Logística &amp; Transportes</strong>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">${escapeHtmlText(senderName)} &lt;${escapeHtmlText(senderEmail)}&gt;</div>
      </div>
    </div>
    <div>
      ${paragraphs}
      ${attachmentLinks}
    </div>
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #f1f5f9;font-size:12px;color:#64748b;line-height:1.5;">
      <strong>Linke TMS · Operações &amp; Logística</strong><br/>
      Email: <a href="mailto:geral@linke.pt" style="color:#16a34a;text-decoration:none;">geral@linke.pt</a> · Web: <a href="https://app.toke.pt" style="color:#16a34a;text-decoration:none;">app.toke.pt</a>
    </div>
  </div>
</body>
</html>`
}

export function getSeededMailboxMessages(nowIso = "2026-11-04T09:30:00.000Z"): MailMessage[] {
  // Production mailbox clean: returns zero fake/seed mock emails.
  return []
}

