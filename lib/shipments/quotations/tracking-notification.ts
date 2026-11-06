import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/resend"
import { publicUrl } from "@/lib/config/public-origins"
import type { ShipmentQuotation } from "./types"
import { partnerTrackingUrl } from "./tracking"

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!))

/** Notify the store's registered contact only after the booking transaction commits. */
export async function notifyQuotationTracking(db: SupabaseClient, tenant: string, quote: ShipmentQuotation) {
  if (quote.status !== "completed" || !quote.shipment_id || !quote.tracking_number) throw new Error("O envio ainda não tem guia registada.")
  const { data, error } = await db.from("audit_log").select("details")
    .eq("tenant_id", tenant).eq("action", "client_data").eq("details->>id", quote.client_id)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle()
  const email = data?.details?.email
  if (error || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("O cliente não tem um email de contacto válido.")
  const url = partnerTrackingUrl(quote) || publicUrl(`/tracking?trk=${encodeURIComponent(quote.reference)}`, "site")
  const carrier = quote.tracking_carrier === "fedex" ? "FedEx" : "Correos Express"
  const result = await sendEmail({
    to: email.trim(), subject: `O seu envio está registado · ${quote.reference}`,
    idempotencyKey: `quotation-tracking-${quote.id}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a3028;padding:32px"><h1>O seu envio está registado</h1><p>O envio do pedido <strong>${escape(quote.reference)}</strong> foi registado pela equipa Linke.</p><p>Tracking ${carrier}: <strong>${escape(quote.tracking_number)}</strong></p><p><a href="${escape(url)}">Acompanhar o envio</a></p><p>O envio está disponível no histórico da sua loja.</p></div>`,
  })
  if (!result.success) throw new Error("Não foi possível enviar o email de tracking.")
}
