import { createAdminClient } from "@/lib/supabase/server"
import { sendEmail, compileTemplate } from "@/lib/email/resend"

export interface TrackingNotificationExtra {
  reason?: string
  eventCode?: string
  shipment?: any
}

export async function sendTrackingEmailNotification(
  shipmentId: string, 
  type: "tracking" | "in_transit" | "incident",
  extra?: TrackingNotificationExtra
) {
  try {
    const supabase = createAdminClient()

    // 1. Obter os dados do envio (se já fornecidos em extra, usa direto; senão consulta)
    let shipment = extra?.shipment

    if (!shipment) {
      const { data } = await supabase
        .from("shipments")
        .select("id, tracking_number, carrier_tracking_number, carrier, carrier_code, service_type, recipient_email, recipient_contact_email, recipient_name, sender_name, tenant_id")
        .eq("id", shipmentId)
        .maybeSingle()
      shipment = data
    }

    // Fallback para audit_log se não constar na tabela shipments
    if (!shipment) {
      try {
        const { data: logs } = await supabase
          .from("audit_log")
          .select("details")
          .eq("action", "shipment_data")
          .order("created_at", { ascending: false })

        const found = logs?.find((l: any) => l.details?.id === shipmentId || l.details?.tracking_number === shipmentId)
        if (found?.details) {
          shipment = found.details
        }
      } catch {}
    }

    const recipientEmail = (shipment?.recipient_email || shipment?.recipient_contact_email || "").trim()
    if (!recipientEmail || !recipientEmail.includes("@")) {
      return { success: false, reason: "No valid recipient email configured" }
    }

    const effectiveShipmentId = shipment?.id || shipmentId

    // 2. Deduplicação fiável: evitar envio repetido do mesmo tipo de email
    try {
      const { data: sentLogs } = await supabase
        .from("audit_log")
        .select("details")
        .eq("action", "tracking_email_sent")
        .filter("details->>shipment_id", "eq", effectiveShipmentId)

      if (sentLogs && sentLogs.length > 0) {
        if (type === "in_transit") {
          const alreadySentTransit = sentLogs.some((l: any) => l.details?.type === "in_transit")
          if (alreadySentTransit) {
            return { success: true, skipped: true, reason: "in_transit notification already sent" }
          }
        } else if (type === "incident") {
          const alreadySentIncident = sentLogs.some(
            (l: any) => l.details?.type === "incident" && l.details?.event_code === extra?.eventCode
          )
          if (alreadySentIncident) {
            return { success: true, skipped: true, reason: "incident notification already sent for this event" }
          }
        } else if (type === "tracking") {
          const alreadySentTracking = sentLogs.some((l: any) => l.details?.type === "tracking")
          if (alreadySentTracking) {
            return { success: true, skipped: true, reason: "tracking created notification already sent" }
          }
        }
      }
    } catch (dedupErr) {
      console.warn("[Tracking Notifications] Aviso na verificação de deduplicação:", dedupErr)
    }

    const { emailTemplates } = await import("@/app/ops/configuracao/notificacoes/templates")
    
    let html = ""
    let subject = ""

    const isCorreos =
      shipment.carrier_code === "correos" ||
      shipment.carrier_code === "correos_express" ||
      (typeof shipment.service_type === "string" && shipment.service_type.toLowerCase().includes("correos")) ||
      (typeof shipment.carrier === "string" && shipment.carrier.toLowerCase().includes("correos")) ||
      /^\d{16}$/.test(shipment.carrier_tracking_number || "")

    const carrier_name = isCorreos ? "Correos Express" : "CTT Expresso"

    const trackingCode =
      (shipment.tracking_number?.startsWith("LTK") ? shipment.tracking_number : null) ||
      shipment.carrier_tracking_number ||
      shipment.tracking_number ||
      effectiveShipmentId

    const tracking_url = `https://tms.linke.pt/tracking?trk=${encodeURIComponent(trackingCode)}`

    if (type === "tracking") {
      subject = "Linke | Guia de Transporte Emitida"
      html = compileTemplate(emailTemplates.tracking, {
        receiver_name: shipment.recipient_name || "Cliente",
        tracking_code: trackingCode,
        tracking_url
      })
    } else if (type === "in_transit") {
      subject = "A sua encomenda está a caminho! 🚚"
      html = compileTemplate(emailTemplates.in_transit, {
        receiver_name: shipment.recipient_name || "Estimado(a) Cliente",
        sender_name: shipment.sender_name || "Linke Logistics",
        tracking_code: trackingCode,
        carrier_name,
        tracking_url
      })
    } else if (type === "incident") {
      subject = "Atenção: Problema na Entrega ⚠️"
      html = compileTemplate(emailTemplates.incident, {
        tracking_code: trackingCode,
        incident_reason: extra?.reason || "Ocorreu uma anomalia durante a tentativa de entrega.",
        incident_date: new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        tracking_url,
        support_url: tracking_url
      })
    }

    if (html) {
      const emailResult = await sendEmail({
        to: recipientEmail,
        subject,
        html
      })

      // Registar envio no audit_log para deduplicação
      try {
        await supabase.from("audit_log").insert({
          tenant_id: shipment.tenant_id || "11111111-1111-1111-1111-111111111111",
          action: "tracking_email_sent",
          details: {
            shipment_id: effectiveShipmentId,
            type,
            event_code: extra?.eventCode || null,
            recipient_email: recipientEmail,
            sent_at: new Date().toISOString(),
            success: Boolean(emailResult?.success)
          }
        })
      } catch {}

      return { success: true, emailResult }
    }

    return { success: false, reason: "No template generated" }
  } catch (err: any) {
    console.error("Failed to compile tracking notification:", err)
    return { success: false, error: err?.message || err }
  }
}
