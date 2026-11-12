import { emailTemplates } from "@/app/ops/configuracao/notificacoes/templates"
import { clientInvitationHtml, clientRecoveryHtml, invoiceEmailHtml, periodStatementHtml, pickupConfirmationHtml, quotationTrackingHtml } from "./code-templates"
import { formatEmailHtmlTemplate } from "@/lib/ops-mailbox"

export type EmailTemplateEntry = { id: string; name: string; subject: string; html_content: string; description: string; readonly?: boolean; sender?: string }
const portal = "https://portal.example.invalid"
export const emailTemplateCatalog: EmailTemplateEntry[] = [
  ...[
    ["pickup_scheduled", "Recolha agendada pelo Ops", "Confirmação de uma recolha pedida diretamente pelo Ops.", "Linke | Recolha CTT Expresso Agendada com Sucesso (1519176/26)"],
    ["low_balance", "Saldo pré-pago baixo", "Aviso de saldo baixo nas contas em pré-pagamento.", "Linke | Aviso de Saldo Baixo"],
    ["in_transit", "Envio em transporte", "Atualização de transporte enviada ao destinatário.", "A sua encomenda está a caminho! 🚚"],
    ["tracking", "Guia de transporte emitida", "Guia emitida e ligação de acompanhamento do envio.", "Linke | Guia de Transporte Emitida"],
    ["incident", "Incidência na entrega", "Aviso de uma incidência no transporte ou entrega.", "Atenção: Problema na Entrega ⚠️"],
  ].map(([id, name, description, subject]) => ({ id, name, description, subject, html_content: emailTemplates[id] })),
  { id: "pickup_confirmed", name: "Pedido de recolha do cliente confirmado", description: "Pedido marcado como Efetuado pela equipa Linke. Envio automático ou confirmação manual.", subject: "Linke | Recolha confirmada · PR-EXEMPLO12345", readonly: true, sender: "notificacoes@linke.pt",
    html_content: pickupConfirmationHtml({ client_name: "Loja de demonstração", reference: "PR-EXEMPLO12345", carrier_reference: "1519176/26", carrier_name: "CTT Expresso", url: `${portal}/app/recolhas` }) },
  { id: "quotation_tracking", name: "Tracking de envio por cotação", description: "Guia registada num pedido internacional por cotação, incluindo Correos ou FedEx.", subject: "O seu envio está registado · COT-EXEMPLO1234", readonly: true,
    html_content: quotationTrackingHtml({ reference: "COT-EXEMPLO1234", tracking_number: "123456789012", carrier: "Correos Express", url: `${portal}/tracking?trk=COT-EXEMPLO1234` }) },
  { id: "client_invitation", name: "Convite de acesso ao portal", description: "Convite para o cliente definir a palavra-passe. Gerido pelo fluxo de acesso.", subject: "Defina a sua palavra-passe · Área do Cliente Linke", readonly: true,
    html_content: clientInvitationHtml("Loja de demonstração", `${portal}/app/ativar#exemplo-sem-token-real`) },
  { id: "client_recovery", name: "Recuperação de palavra-passe", description: "Recuperação de acesso solicitada pelo cliente. Gerido pelo fluxo de autenticação.", subject: "Recuperar palavra-passe · Área do Cliente Linke", readonly: true,
    html_content: clientRecoveryHtml(`${portal}/app/ativar#exemplo-sem-token-real`) },
  { id: "billing_invoice", name: "Fatura e extrato de envios", description: "Email de faturação com os documentos oficiais em anexo.", subject: "Linke | Fatura de Envios FT 2026/123", readonly: true,
    html_content: invoiceEmailHtml({ clientName: "Loja de demonstração", docTitle: "FT 2026/123", statementNumber: "EXT-2026/123", shipmentsCount: 12, totalStr: "61,50" }) },
  { id: "period_statement", name: "Extrato periódico de envios", description: "Extrato automático do período de faturação, com PDF em anexo.", subject: "Linke | Extrato de envios · 01/11/2026 a 15/11/2026", readonly: true,
    html_content: periodStatementHtml({ isTest: false, client_name: "Loja de demonstração", label: "01/11/2026 a 15/11/2026", shipments_count: 12, amount: "50,00 €", statement_number: "EXT-2026/123" }) },
  { id: "mail_composer", name: "Email da caixa de correio Ops", description: "Apresentação dos emails escritos pela equipa. O conteúdo e os anexos são definidos no editor de correio.", subject: "Exemplo de mensagem da equipa Linke", readonly: true, sender: "geral@linke.pt",
    html_content: formatEmailHtmlTemplate({ senderName: "Equipa Linke", senderEmail: "geral@linke.pt", subject: "Exemplo de mensagem da equipa Linke", bodyText: "Olá,\n\nSegue a informação sobre o seu pedido.\n\nObrigado,\nEquipa Linke" }) },
]

/** Code-defined previews cannot be replaced by legacy database rows that delivery never reads. */
export function mergeEmailTemplates(saved: Partial<EmailTemplateEntry>[]): EmailTemplateEntry[] {
  const rows = new Map(saved.filter(row => typeof row.id === "string").map(row => [row.id!, row]))
  const known = new Set(emailTemplateCatalog.map(row => row.id))
  return [...emailTemplateCatalog.map(template => template.readonly ? template : { ...template, ...rows.get(template.id) }),
    ...saved.filter(row => row.id && !known.has(row.id)).map(row => ({
      ...row, id: row.id!, name: row.name || row.id!, subject: row.subject || row.name || row.id!,
      html_content: row.html_content || "", description: row.description || "Modelo adicional guardado na configuração.", readonly: true,
    }))].sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt"))
}
