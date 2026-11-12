import "server-only"
import { quotationTrackingHtml } from "@/lib/email/code-templates"
import type { SupabaseClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/email/resend"
import { publicUrl } from "@/lib/config/public-origins"
import type { ShipmentQuotation } from "./types"
import { partnerTrackingUrl } from "./tracking"


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
    html: quotationTrackingHtml({reference:quote.reference,tracking_number:quote.tracking_number,carrier,url}),
  })
  if (!result.success) throw new Error("Não foi possível enviar o email de tracking.")
}
