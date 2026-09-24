import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { CTTTrackingService } from "@/lib/services/ctt/ctt-tracking.service"
import {
  CTT_NON_DELIVERY_REASONS,
  CTT_SITUATIONS,
  CTT_TRACKING_EVENTS,
  CTT_INCIDENT_CODES
} from "@/lib/services/ctt/ctt-types"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Schema expected from CTT (simulated or real webhook)
export interface CTTTrackingWebhookPayload {
  events: {
    tracking_number: string
    eventCode: string
    reasonCode?: string
    situationCode?: string
    eventDate: string // ISO string
    location?: string
  }[]
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as CTTTrackingWebhookPayload

    if (!payload.events || !Array.isArray(payload.events)) {
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 })
    }

    const results = []

    for (const evt of payload.events) {
      // Look up by carrier_tracking_number (EQ…) first; fall back to tracking_number for
      // legacy records that stored the CTT number there before the LTK/EQ split fix.
      const { data: shipment, error: fetchError } = await supabase
        .from("shipments")
        .select("id, status, tenant_id")
        .or(`carrier_tracking_number.eq.${evt.tracking_number},tracking_number.eq.${evt.tracking_number}`)
        .single()

      if (fetchError || !shipment) {
        results.push({ tracking_number: evt.tracking_number, error: "Shipment not found" })
        continue
      }

      // Parse the event code
      const cttEvent = CTT_TRACKING_EVENTS[evt.eventCode]
      if (!cttEvent) {
        results.push({ tracking_number: evt.tracking_number, error: `Unknown event code: ${evt.eventCode}` })
        continue
      }

      const description = CTTTrackingService.parseEvent(evt.eventCode).eventName
      const reasonDesc = evt.reasonCode ? CTT_NON_DELIVERY_REASONS[evt.reasonCode] : undefined
      const situationDesc = evt.situationCode ? CTT_SITUATIONS[evt.situationCode] : undefined

      // Prepare details
      const details = {
        tracking_number: evt.tracking_number,
        eventCode: evt.eventCode,
        description,
        reasonCode: evt.reasonCode,
        reasonDesc,
        situationCode: evt.situationCode,
        situationDesc,
        location: evt.location,
        timestamp: evt.eventDate
      }

      // 1. Insert into tracking_events
      const { error: logError } = await supabase
        .from("tracking_events")
        .insert({
          tenant_id: shipment.tenant_id,
          shipment_id: shipment.id,
          event_code: evt.eventCode,
          description: `${description}${reasonDesc ? ` | Razão: ${reasonDesc}` : ''}${situationDesc ? ` | Situação: ${situationDesc}` : ''}`,
          timestamp: evt.eventDate || new Date().toISOString(),
          created_at: evt.eventDate || new Date().toISOString()
        })

      if (logError) {
        results.push({ tracking_number: evt.tracking_number, error: "Failed to insert log" })
        continue
      }

      // 2. Update the main shipment status
      const { error: updateError } = await supabase
        .from("shipments")
        .update({
          status: cttEvent.tms_status,
          updated_at: new Date().toISOString()
        })
        .eq("id", shipment.id)

      if (updateError) {
        results.push({ tracking_number: evt.tracking_number, error: "Failed to update shipment status" })
        continue
      }

      // 3. Trigger Email Notifications
      try {
        const { sendTrackingEmailNotification } = await import("@/lib/email/tracking-notifications")
        if (evt.eventCode === "EMZ") {
          sendTrackingEmailNotification(shipment.id, "in_transit")
        } else if (CTT_INCIDENT_CODES?.has(evt.eventCode) || evt.eventCode === "EMH") {
          sendTrackingEmailNotification(shipment.id, "incident", { reason: reasonDesc || description })
        }
      } catch (err) {
        console.warn("Failed to trigger tracking email in webhook", err)
      }

      results.push({ tracking_number: evt.tracking_number, status: "updated", tms_status: cttEvent.tms_status })
    }

    return NextResponse.json({ success: true, results }, { status: 200 })
  } catch (error: any) {
    console.error("CTT Webhook Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
