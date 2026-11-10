import { errorMessage } from "@/lib/errors"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { timingSafeEqual } from "node:crypto"
import {
  processCttWebhookEvent,
  type CTTWebhookEventInput,
} from "@/lib/services/tracking/ctt-webhook"

export interface CTTTrackingWebhookPayload {
  events: CTTWebhookEventInput[]
}

export async function POST(req: Request) {
  try {
    const secret = process.env.CTT_WEBHOOK_SECRET
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!secret || !supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
    }

    const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""
    const expectedBytes = Buffer.from(secret)
    const suppliedBytes = Buffer.from(supplied)
    if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const payload = (await req.json().catch(() => null)) as CTTTrackingWebhookPayload | null

    if (!Array.isArray(payload?.events) || payload.events.length > 100) {
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const results = []

    for (const evt of payload.events) {
      const outcome = await processCttWebhookEvent(supabase, evt)

      if (outcome.shipmentId && outcome.shouldNotify) {
        try {
          const { sendTrackingEmailNotification } = await import("@/lib/email/tracking-notifications")
          if (outcome.shouldNotify === "in_transit") {
            await sendTrackingEmailNotification(outcome.shipmentId, "in_transit")
          } else if (outcome.shouldNotify === "incident") {
            await sendTrackingEmailNotification(outcome.shipmentId, "incident", {
              reason: outcome.notifyReason || "Ocorrência registada",
            })
          }
        } catch (err) {
          console.warn("Failed to trigger tracking email in webhook", err)
        }
      }

      results.push({
        tracking_number: outcome.tracking_number,
        ...(outcome.status ? { status: outcome.status } : {}),
        ...(outcome.tms_status ? { tms_status: outcome.tms_status } : {}),
        ...(outcome.error ? { error: outcome.error } : {}),
      })
    }

    return NextResponse.json({ success: true, results }, { status: 200 })
  } catch (error) {
    console.error("CTT Webhook Error:", error)
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
