import type { SupabaseClient } from "@supabase/supabase-js"
import { CTTTrackingService } from "@/lib/services/ctt/ctt-tracking.service"
import {
  CTT_INCIDENT_CODES,
  CTT_NON_DELIVERY_REASONS,
  CTT_SITUATIONS,
  CTT_TRACKING_EVENTS,
} from "@/lib/services/ctt/ctt-types"

export interface CTTWebhookEventInput {
  tracking_number: string
  eventCode: string
  reasonCode?: string
  situationCode?: string
  eventDate: string
  location?: string
}

export type CttDbShipmentStatus =
  | "rascunho"
  | "pendente"
  | "aguarda_correcao"
  | "recolha"
  | "atribuido_motorista"
  | "recolhido"
  | "entrada_rede"
  | "em_distribuicao"
  | "entregue"
  | "incidencia"
  | "devolvido"
  | "cancelado"

const TERMINAL_STATUSES = new Set(["entregue", "devolvido", "cancelado"])

export function toDbShipmentStatus(tmsStatus: string): CttDbShipmentStatus {
  if (tmsStatus === "em_transito") return "entrada_rede"
  const allowed: Set<string> = new Set([
    "rascunho",
    "pendente",
    "aguarda_correcao",
    "recolha",
    "atribuido_motorista",
    "recolhido",
    "entrada_rede",
    "em_distribuicao",
    "entregue",
    "incidencia",
    "devolvido",
    "cancelado",
  ])
  return allowed.has(tmsStatus) ? (tmsStatus as CttDbShipmentStatus) : "entrada_rede"
}

function normalizeEventIsoDate(rawDate: string | undefined): string | null {
  if (!rawDate) return new Date().toISOString()
  const parsed = new Date(rawDate)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export interface CTTWebhookProcessOutcome {
  tracking_number?: string
  status?: "updated" | "duplicate" | "recorded_out_of_order"
  tms_status?: string
  shouldNotify?: "in_transit" | "incident" | null
  notifyReason?: string
  error?: string
}

export async function processCttWebhookEvent(
  supabase: SupabaseClient,
  evt: CTTWebhookEventInput
): Promise<CTTWebhookProcessOutcome & { shipmentId?: string }> {
  if (typeof evt.tracking_number !== "string" || !/^[a-z0-9]{8,32}$/i.test(evt.tracking_number)) {
    return { error: "Invalid tracking number" }
  }

  const cttEvent = CTT_TRACKING_EVENTS[evt.eventCode]
  if (!cttEvent) {
    return { tracking_number: evt.tracking_number, error: `Unknown event code: ${evt.eventCode}` }
  }

  const eventTimestamp = normalizeEventIsoDate(evt.eventDate)
  if (!eventTimestamp) {
    return { tracking_number: evt.tracking_number, error: "Invalid eventDate" }
  }

  const { data: shipmentRows, error: fetchError } = await supabase
    .from("shipments")
    .select("id, status, tenant_id")
    .or(`carrier_tracking_number.eq.${evt.tracking_number},tracking_number.eq.${evt.tracking_number}`)
    .limit(1)

  const shipment = Array.isArray(shipmentRows) ? shipmentRows[0] : null
  if (fetchError || !shipment) {
    return { tracking_number: evt.tracking_number, error: "Shipment not found" }
  }

  const descriptionBase = CTTTrackingService.parseEvent(evt.eventCode).eventName
  const reasonDesc = evt.reasonCode ? CTT_NON_DELIVERY_REASONS[evt.reasonCode] : undefined
  const situationDesc = evt.situationCode ? CTT_SITUATIONS[evt.situationCode] : undefined
  const fullDescription = `${descriptionBase}${reasonDesc ? ` | Razão: ${reasonDesc}` : ""}${
    situationDesc ? ` | Situação: ${situationDesc}` : ""
  }`
  const targetDbStatus = toDbShipmentStatus(cttEvent.tms_status)

  const { data: rpcData, error: rpcError } = await supabase.rpc("apply_ctt_tracking_webhook_event", {
    p_shipment_id: shipment.id,
    p_tenant_id: shipment.tenant_id,
    p_event_code: evt.eventCode,
    p_description: fullDescription,
    p_target_status: targetDbStatus,
    p_event_timestamp: eventTimestamp,
  })

  let applied = false
  let duplicate = false
  let statusUpdated = false
  let effectiveStatus = String(shipment.status || targetDbStatus)

  if (!rpcError && rpcData && typeof rpcData === "object") {
    const res = rpcData as Record<string, unknown>
    applied = Boolean(res.applied)
    duplicate = Boolean(res.duplicate)
    statusUpdated = Boolean(res.status_updated)
    effectiveStatus = String(res.status || targetDbStatus)
    if (!applied && !duplicate && res.reason === "not_found") {
      return { tracking_number: evt.tracking_number, error: "Shipment not found" }
    }
  } else if (rpcError) {
    // Graceful pre-migration fallback preserving duplicate & out-of-order safety
    const rpcCode = String((rpcError as { code?: string }).code || "")
    const isMissingFn =
      rpcCode === "PGRST202" || /apply_ctt_tracking_webhook_event/i.test(rpcError.message || "")
    if (!isMissingFn) {
      return { tracking_number: evt.tracking_number, error: "Failed to persist tracking event" }
    }

    const { data: existingEvent } = await supabase
      .from("tracking_events")
      .select("id")
      .eq("shipment_id", shipment.id)
      .eq("event_code", evt.eventCode)
      .eq("timestamp", eventTimestamp)
      .limit(1)
      .maybeSingle()

    if (existingEvent) {
      duplicate = true
    } else {
      const { error: logError } = await supabase.from("tracking_events").insert({
        tenant_id: shipment.tenant_id,
        shipment_id: shipment.id,
        event_code: evt.eventCode,
        description: fullDescription,
        timestamp: eventTimestamp,
        created_at: eventTimestamp,
      })

      if (logError) {
        if (String((logError as { code?: string }).code || "") === "23505") {
          duplicate = true
        } else {
          return { tracking_number: evt.tracking_number, error: "Failed to insert log" }
        }
      } else {
        applied = true
        const { data: newerEvents } = await supabase
          .from("tracking_events")
          .select("id")
          .eq("shipment_id", shipment.id)
          .gt("timestamp", eventTimestamp)
          .limit(1)

        const isTerminal = TERMINAL_STATUSES.has(String(shipment.status || ""))
        const hasNewer = Array.isArray(newerEvents) && newerEvents.length > 0

        if (!isTerminal && !hasNewer) {
          const { error: updateError } = await supabase
            .from("shipments")
            .update({
              status: targetDbStatus,
              ops_substatus: evt.eventCode.toLowerCase().slice(0, 50),
              updated_at: new Date().toISOString(),
            })
            .eq("id", shipment.id)

          if (updateError) {
            return { tracking_number: evt.tracking_number, error: "Failed to update shipment status" }
          }
          statusUpdated = true
          effectiveStatus = targetDbStatus
        }
      }
    }
  }

  if (duplicate) {
    return {
      shipmentId: shipment.id,
      tracking_number: evt.tracking_number,
      status: "duplicate",
      tms_status: effectiveStatus,
      shouldNotify: null,
    }
  }

  let shouldNotify: "in_transit" | "incident" | null = null
  if (statusUpdated) {
    if (evt.eventCode === "EMZ") {
      shouldNotify = "in_transit"
    } else if (CTT_INCIDENT_CODES?.has(evt.eventCode) || evt.eventCode === "EMH") {
      shouldNotify = "incident"
    }
  }

  return {
    shipmentId: shipment.id,
    tracking_number: evt.tracking_number,
    status: statusUpdated ? "updated" : "recorded_out_of_order",
    tms_status: effectiveStatus,
    shouldNotify,
    notifyReason: reasonDesc || descriptionBase,
  }
}

