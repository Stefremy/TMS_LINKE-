import "server-only"
import { pickupConfirmationHtml } from "./code-templates"
import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { ClientPickupRequest } from "@/lib/client-pickup-requests"
import { sendEmail } from "./resend"
import { publicUrl } from "@/lib/config/public-origins"

const ACTION = "client_pickup_confirmation_email"
type Confirmation = { request_id: string; client_id: string; status: "pending" | "sent"; created_at: string; sent_at?: string; provider_id?: string
  to: string; from: string; subject: string; html: string; idempotencyKey: string }
function emailId(tenant: string, request: string) {
  const hash = createHash("sha256").update(`${ACTION}:${tenant}:${request}`).digest("hex").slice(0, 32)
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20)}`
}

/** A durable envelope plus provider idempotency protects retries, including a lost response. */
export async function notifyPickupConfirmation(db: SupabaseClient, tenant: string, request: ClientPickupRequest) {
  if (request.status !== "completed" || !request.carrier_reference || !request.carrier_name) throw new Error("O pedido ainda não tem confirmação da transportadora.")
  const id = emailId(tenant, request.id)
  const read = () => db.from("audit_log").select("details").eq("tenant_id", tenant).eq("action", ACTION).eq("id", id).maybeSingle()
  const existing = await read()
  if (existing.error) throw new Error("Não foi possível verificar o envio do email de confirmação.")
  let email = existing.data?.details as Confirmation | undefined
  if (!email) {
    const profile = await db.from("audit_log").select("details").eq("tenant_id", tenant).eq("action", "client_data").eq("details->>id", request.client_id)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle()
    const recipient = profile.data?.details?.email
    if (profile.error || typeof recipient !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim())) throw new Error("O cliente não tem um email de contacto válido na ficha.")
    const url = publicUrl("/app/recolhas", "portal")
    email = { request_id: request.id, client_id: request.client_id, status: "pending", created_at: new Date().toISOString(),
      to: recipient.trim(), from: "Linke <notificacoes@linke.pt>", subject: `Linke | Recolha confirmada · ${request.reference}`,
      idempotencyKey: `pickup-confirmation-${id}`,
      html: pickupConfirmationHtml({client_name:request.client_name,reference:request.reference,carrier_reference:request.carrier_reference!,carrier_name:request.carrier_name!,url}) }
    const saved = await db.from("audit_log").insert({ id, tenant_id: tenant, action: ACTION, details: email })
    if (saved.error) {
      if (saved.error.code !== "23505") throw new Error("Não foi possível preparar o email de confirmação.")
      const winner = await read()
      if (winner.error || !winner.data) throw new Error("Não foi possível confirmar a preparação do email.")
      email = winner.data.details as Confirmation
    }
  }
  if (email.request_id !== request.id || email.client_id !== request.client_id) throw new Error("O email guardado não pertence a este pedido.")
  if (email.status === "sent") return { skipped: true }
  // Resend retains idempotency for 24h. Never automatically re-send an older
  // ambiguous attempt after that protection expires: reconcile it first.
  const age = Date.now() - Date.parse(email.created_at)
  if (!Number.isFinite(age) || age >= 23 * 60 * 60 * 1000) throw new Error("O envio anterior do email precisa de verificação no provedor antes de repetir.")
  const result = await sendEmail({ to: email.to, from: email.from, subject: email.subject, html: email.html, idempotencyKey: email.idempotencyKey })
  const providerId = "data" in result ? result.data?.id : undefined
  if (!result.success || !providerId) throw new Error("Não foi possível confirmar o envio do email. Pode tentar novamente em Pedidos dos clientes → Incluir pedidos efetuados.")
  const sent = await db.from("audit_log").update({ details: { ...email, status: "sent", sent_at: new Date().toISOString(), provider_id: providerId } })
    .eq("tenant_id", tenant).eq("action", ACTION).eq("id", id).select("id").maybeSingle()
  if (sent.error || !sent.data) throw new Error("O provedor aceitou o email, mas o registo local falhou. Confirme o envio antes de repetir.")
  return { skipped: false }
}
