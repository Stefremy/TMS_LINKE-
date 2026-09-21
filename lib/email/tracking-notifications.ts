import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, compileTemplate } from "@/lib/email/resend"

export async function sendTrackingEmailNotification(
  shipmentId: string, 
  type: "tracking" | "in_transit" | "incident",
  extra?: { reason?: string }
) {
  try {
    const supabase = createAdminClient()
    const { data: shipment } = await supabase
      .from("shipments")
      .select("tracking_number, carrier, recipient_email, recipient_name, sender_name")
      .eq("id", shipmentId)
      .single()

    if (!shipment || !shipment.recipient_email) return { success: false, reason: "No recipient email" };

    const { emailTemplates } = await import("@/app/ops/configuracao/notificacoes/templates")
    
    let html = ""
    let subject = ""
    
    const tracking_url = `https://tms.linke.pt/tracking?trk=${shipment.tracking_number}`
    const carrier_name = shipment.carrier === "ctt" ? "CTT Expresso" : "Correos Express"

    if (type === "tracking") {
      subject = "Linke | Guia de Transporte Emitida"
      html = compileTemplate(emailTemplates.tracking, {
        receiver_name: shipment.recipient_name || "Cliente",
        tracking_code: shipment.tracking_number,
        tracking_url
      })
    } else if (type === "in_transit") {
      subject = "A sua encomenda está a caminho! 🚚"
      html = compileTemplate(emailTemplates.in_transit, {
        receiver_name: shipment.recipient_name || "Cliente",
        sender_name: shipment.sender_name || "Nossa Loja",
        tracking_code: shipment.tracking_number,
        carrier_name,
        tracking_url
      })
    } else if (type === "incident") {
      subject = "Atenção: Problema na Entrega ⚠️"
      html = compileTemplate(emailTemplates.incident, {
        tracking_code: shipment.tracking_number,
        incident_reason: extra?.reason || "Ocorreu uma anomalia durante a tentativa de entrega.",
        tracking_url
      })
    }

    if (html) {
      sendEmail({
        to: shipment.recipient_email,
        subject,
        html
      }).catch(err => console.error("Error sending notification email:", err))
      
      return { success: true }
    }
  } catch (err) {
    console.error("Failed to compile tracking notification:", err)
    return { success: false, error: err }
  }
}
