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
  return [
    {
      id: "mail-seed-ctt-recolhas",
      threadId: "thread-ctt-recolhas",
      account: "geral@linke.pt",
      folder: "inbox",
      fromName: "CTT Expresso · Apoio Empresarial",
      fromEmail: "empresas.expresso@ctt.pt",
      toName: "Linke Geral",
      toEmail: "geral@linke.pt",
      subject: "Resumo Operacional de Recolhas e SLA — Contrato 300330941",
      snippet: "Bom dia equipa Linke, enviamos em detalhe o ponto de situação das recolhas diárias agendadas via Webservice RecolhasWS e janelas horárias para Guimarães e Porto.",
      bodyText: `Bom dia equipa Linke,

Enviamos o ponto de situação relativo às recolhas B2B e e-commerce associadas ao contrato 300330941 (Cliente 100032458).

Resumo da operação:
• Janela horária padrão ativa: 09:00 – 19:00
• Sincronização bidirecional RecolhasWS (GetPickUpData / NewOfferPickUp) operacional
• Taxa de cumprimento de recolhas no distrito de Braga e Porto: 98,4%

Qualquer ajuste de última hora para volumes paletizados acima de 150 kg deve ser submetido até às 13:00 do próprio dia na vossa consola TMS.

Com os melhores cumprimentos,
Equipa de Suporte Operacional Empresas
CTT Expresso — Serviços Postais e Logística`,
      read: false,
      starred: true,
      labels: ["operacoes", "recolhas"],
      attachments: [],
      createdAt: "2026-11-04T09:15:00.000Z",
      updatedAt: "2026-11-04T09:15:00.000Z",
      deliveryStatus: "received",
    },
    {
      id: "mail-seed-cacto-pedido",
      threadId: "thread-cacto-pedido",
      account: "geral@linke.pt",
      folder: "inbox",
      fromName: "Rui Barbosa (Cacto Moda)",
      fromEmail: "encomendas@cacto.pt",
      toName: "Linke Geral",
      toEmail: "geral@linke.pt",
      cc: ["financeiro@cacto.pt"],
      subject: "Pedido de reforço de recolha — Coleção Inverno (35 volumes)",
      snippet: "Olá equipa Linke! Hoje vamos ter um pico de expedição na loja de Guimarães com cerca de 35 caixas para seguir no serviço ePAQ24 e CTT Expresso 19h.",
      bodyText: `Olá equipa Linke!

Hoje vamos ter um pico de expedição no nosso armazém da Avenida Dom Afonso Henriques (Guimarães) devido ao lançamento da Coleção de Inverno.

Previsão para as 16h30:
- 22 volumes CTT Expresso 19h (Portugal Continental)
- 13 volumes Linke ePAQ24 B2C (Espanha Peninsular)

Podem confirmar se o motorista habitual consegue recolher tudo numa única passagem ou se devemos separar os manifestos?

Obrigado pela disponibilidade de sempre,
Rui Barbosa
Responsável de Logística · Cacto Moda & Acessórios, Lda`,
      read: false,
      starred: true,
      labels: ["clientes", "recolhas", "urgente"],
      attachments: [],
      createdAt: "2026-11-04T08:42:00.000Z",
      updatedAt: "2026-11-04T08:42:00.000Z",
      deliveryStatus: "received",
    },
    {
      id: "mail-seed-correos-tarifas",
      threadId: "thread-correos-tarifas",
      account: "geral@linke.pt",
      folder: "inbox",
      fromName: "Correos Express Ibérica",
      fromEmail: "operaciones.iberica@correosexpress.com",
      toName: "Linke Geral",
      toEmail: "geral@linke.pt",
      subject: "Confirmação de rotas ibéricas ePAQ24 — Hub Lisboa & Madrid",
      snippet: "Estimados parceiros Linke, confirmamos que a ligação noturna entre o centro operacional do Norte e o Hub de Madrid encontra-se sem restrições.",
      bodyText: `Estimados parceiros Linke,

Confirmamos que a ligação noturna entre o centro operacional do Norte (Porto/Guimarães) e o Hub Central de Madrid encontra-se a operar a 100% para todos os envios ePAQ24 B2C (código 63 / 93).

Notas importantes para esta semana:
1. Envios com destino a Ilhas Baleares mantêm trânsito de 48h/72h.
2. Etiquetas térmicas devem apresentar o bloco de serviço ePAQ24 visível para triagem automática no sorter.
3. Reembolsos (Contra-Reembolso) serão liquidados no ciclo habitual de quinta-feira.

Atentamente,
Departamento de Operações Ibéricas
Correos Express Portugal & Espanha`,
      read: true,
      starred: false,
      labels: ["operacoes"],
      attachments: [],
      createdAt: "2026-11-03T17:20:00.000Z",
      updatedAt: "2026-11-03T17:20:00.000Z",
      deliveryStatus: "received",
    },
    {
      id: "mail-seed-detailer-faturacao",
      threadId: "thread-detailer-faturacao",
      account: "geral@linke.pt",
      folder: "inbox",
      fromName: "André Silva · Detailer Car Care",
      fromEmail: "contabilidade@detailer.pt",
      toName: "Linke Geral",
      toEmail: "geral@linke.pt",
      subject: "Comprovativo de liquidação de extrato quinzenal & Tabela E-Commerce",
      snippet: "Boa tarde! Segue a confirmação da transferência referente à última fatura Moloni. Aproveito para perguntar sobre as condições para envios multiparcel.",
      bodyText: `Boa tarde equipa Linke,

Informamos que já procedemos à regularização da última fatura emitida no portal, referente à quinzena anterior.

Aproveitamos para questionar se podemos ativar uma tabela dedicada para envios multiparcel de produtos de detalhe automóvel (embalagens de 5L e 20L) com destino a oficinas parceiras no Algarve.

Ficamos a aguardar o vosso feedback comercial.

Cumprimentos,
André Silva
Detailer Car Care Unipessoal Lda · Porto`,
      read: true,
      starred: false,
      labels: ["faturacao", "clientes"],
      attachments: [],
      createdAt: "2026-11-03T14:05:00.000Z",
      updatedAt: "2026-11-03T14:05:00.000Z",
      deliveryStatus: "received",
    },
    {
      id: "mail-seed-lili-incidencia",
      threadId: "thread-lili-incidencia",
      account: "geral@linke.pt",
      folder: "inbox",
      fromName: "Lili Store Guimarães",
      fromEmail: "apoio@lilistore.pt",
      toName: "Linke Geral",
      toEmail: "geral@linke.pt",
      subject: "Alteração de contacto de entrega — Envio 330003511702173",
      snippet: "Olá! A destinatária do envio 330003511702173 pediu para atualizar o contacto telefónico para o distribuidor conseguir ligar antes da entrega.",
      bodyText: `Olá equipa Linke,

Relativamente ao nosso envio 330003511702173 (serviço Linke ePAQ24 B2C), a cliente final contactou-nos a pedir que o estafeta ligue 15 minutos antes da entrega e que considere o piso 2º Esq.

Conseguem adicionar esta observação no suporte à incidência para garantir entrega hoje?

Muito obrigada!
Equipa Lili Store · Guimarães`,
      read: false,
      starred: false,
      labels: ["incidencias", "clientes"],
      attachments: [],
      createdAt: "2026-11-03T11:48:00.000Z",
      updatedAt: "2026-11-03T11:48:00.000Z",
      deliveryStatus: "received",
    },
    {
      id: "mail-seed-sent-boasvindas",
      threadId: "thread-sent-boasvindas",
      account: "geral@linke.pt",
      folder: "sent",
      fromName: "Linke Geral",
      fromEmail: "geral@linke.pt",
      toName: "Rui Barbosa (Cacto Moda)",
      toEmail: "encomendas@cacto.pt",
      subject: "Atualização das Tabelas de Preço & Perfil Comercial 2026",
      snippet: "Exmo. Sr. Rui Barbosa, confirmamos a associação da nova tabela comercial personalizada à conta corrente da Cacto Moda no portal Linke TMS.",
      bodyText: `Exmo. Sr. Rui Barbosa,

Confirmamos a associação da nova tabela comercial personalizada à conta corrente da Cacto Moda & Acessórios no portal Linke TMS.

A partir de hoje, todas as simulações de envio e emissões de etiquetas (CTT Expresso e Correos Express ePAQ24) aplicam automaticamente o vosso escalão contratado.

Estamos ao inteiro dispor através de geral@linke.pt para qualquer questão operacional.

Com os melhores cumprimentos,
Direção de Operações
Linke Logística & Transportes (geral@linke.pt)`,
      read: true,
      starred: false,
      labels: ["clientes", "faturacao"],
      attachments: [],
      createdAt: "2026-11-02T16:10:00.000Z",
      updatedAt: "2026-11-02T16:10:00.000Z",
      deliveryStatus: "delivered",
    },
    {
      id: "mail-seed-draft-proposta",
      threadId: "thread-draft-proposta",
      account: "geral@linke.pt",
      folder: "drafts",
      fromName: "Linke Geral",
      fromEmail: "geral@linke.pt",
      toName: "Direção Logística · Grupo Têxtil do Ave",
      toEmail: "logistica@textilave.pt",
      subject: "[Rascunho] Proposta Comercial Linke TMS — Expedições Ibéricas 24h",
      snippet: "Bom dia, conforme conversado telefonicamente, apresentamos as condições especiais para expedição diária a partir de Guimarães e Famalicão...",
      bodyText: `Bom dia,

Conforme conversado telefonicamente, apresentamos as condições especiais da Linke para expedição diária B2B e B2C a partir de Guimarães, Vizela e Famalicão:

1. Integração direta com emissão de etiquetas térmicas e fecho de manifesto
2. Recolha diária dedicada entre as 16h00 e as 18h30
3. Controlo de reembolsos e conta corrente em tempo real no Portal do Cliente

[Completar valores do escalão 5–10 kg antes de enviar]`,
      read: true,
      starred: false,
      labels: ["clientes", "operacoes"],
      attachments: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      deliveryStatus: "draft",
    },
  ]
}

