import { NormalizedTrackingEvent, TrackingSyncResult } from "./types"
import { getTenantId } from "@/lib/auth/context"

/**
 * Grava eventos de tracking normalizados na base de dados (tracking_events, shipments, audit_log).
 * Garante:
 * 1. Deduplicação fiável por (shipment_id + event_code + timestamp).
 * 2. Atualização do status em 'shipments' respeitando o enum PostgreSQL ('entrada_rede' em vez de 'em_transito').
 * 3. Atualização do espelho em 'audit_log'.
 */
export async function recordTrackingEvents(
  supabase: any,
  shipmentId: string,
  targetShipment: any,
  events: NormalizedTrackingEvent[]
): Promise<TrackingSyncResult> {
  if (!events || events.length === 0) {
    return {
      success: true,
      carrier: targetShipment?.carrier_code === "correos" ? "correos" : "ctt",
      count: 0,
      latestStatus: targetShipment?.status === "entrada_rede" ? "em_transito" : targetShipment?.status,
    }
  }

  // Ordenar cronologicamente
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
  const lastEvent = sortedEvents[sortedEvents.length - 1]
  const carrier = lastEvent.carrierCode || (targetShipment?.carrier_code === "correos" ? "correos" : "ctt")

  // 1. Atualizar tabela shipments
  try {
    const { error: updateErr } = await supabase
      .from("shipments")
      .update({
        status: lastEvent.status, // Válido no enum Postgres ('entrada_rede', etc.)
        ops_substatus: (lastEvent.eventCode || "").toLowerCase().substring(0, 50),
        updated_at: new Date().toISOString(),
      })
      .eq("id", shipmentId)

    if (updateErr) {
      console.warn("[Tracking Recorder] Aviso ao atualizar estado em shipments:", updateErr.message)
    }
  } catch (err: any) {
    console.warn("[Tracking Recorder] Falha no update shipments:", err?.message)
  }

  // 2. Inserir novos eventos em tracking_events com deduplicação
  let insertedCount = 0
  try {
    const { data: shipmentExists } = await supabase
      .from("shipments")
      .select("id")
      .eq("id", shipmentId)
      .maybeSingle()

    if (shipmentExists) {
      const { data: existingEvents } = await supabase
        .from("tracking_events")
        .select("event_code, timestamp, description")
        .eq("shipment_id", shipmentId)

    const tenantId = targetShipment?.tenant_id || (await getTenantId().catch(() => "11111111-1111-1111-1111-111111111111"))

    for (const evt of sortedEvents) {
      const tEvt = new Date(evt.timestamp).getTime()

      const isDuplicate = existingEvents?.some((ex: any) => {
        if (ex.event_code !== evt.eventCode) return false
        const tEx = new Date(ex.timestamp).getTime()
        if (!isNaN(tEvt) && !isNaN(tEx)) {
          // Se tiver o mesmo código e a diferença for inferior a 2 minutos, é duplicado
          return Math.abs(tEvt - tEx) < 120000
        }
        return ex.timestamp === evt.timestamp
      })

      if (!isDuplicate) {
        const { error: insErr } = await supabase.from("tracking_events").insert({
          tenant_id: tenantId,
          shipment_id: shipmentId,
          event_code: evt.eventCode,
          description: `${evt.description} (${evt.location})`,
          timestamp: evt.timestamp,
          created_at: new Date().toISOString(),
        })

        if (!insErr) {
          insertedCount++
        } else {
          console.warn("[Tracking Recorder] Aviso ao inserir tracking_event:", insErr.message)
        }
      }
    }
    }
  } catch (err: any) {
    console.warn("[Tracking Recorder] Falha ao gravar tracking_events:", err?.message)
  }

  // 3. Atualizar espelho em audit_log (se existir registo com os dados do envio)
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "shipment_data")

    const targetLog = logs?.find((l: any) => l.details?.id === shipmentId)
    if (targetLog) {
      await supabase
        .from("audit_log")
        .update({
          details: {
            ...targetLog.details,
            status: lastEvent.displayStatus, // Espelho visual para frontend ("em_transito")
            ops_substatus: (lastEvent.eventCode || "").toLowerCase(),
            updated_at: new Date().toISOString(),
          },
        })
        .eq("id", targetLog.id)
    }
  } catch (err: any) {
    console.warn("[Tracking Recorder] Falha ao atualizar audit_log:", err?.message)
  }

  // 4. Disparo automático de notificações por email ao destinatário (CTT e Correos Express)
  try {
    const isIncident = Boolean(lastEvent.isIncidencia || lastEvent.status === "incidencia" || lastEvent.displayStatus === "incidencia")
    const isInTransit = Boolean(
      lastEvent.status === "em_distribuicao" ||
      lastEvent.status === "entrada_rede" ||
      lastEvent.displayStatus === "em_distribuicao" ||
      lastEvent.displayStatus === "em_transito"
    )

    if (isIncident) {
      import("@/lib/email/tracking-notifications").then(({ sendTrackingEmailNotification }) => {
        sendTrackingEmailNotification(shipmentId, "incident", {
          reason: lastEvent.description || "Ocorreu uma anomalia durante a tentativa de entrega.",
          eventCode: lastEvent.eventCode,
          shipment: targetShipment,
        }).catch(err => console.warn("[Tracking Recorder] Falha ao enviar email de incidência:", err?.message))
      })
    } else if (isInTransit) {
      import("@/lib/email/tracking-notifications").then(({ sendTrackingEmailNotification }) => {
        sendTrackingEmailNotification(shipmentId, "in_transit", {
          eventCode: lastEvent.eventCode,
          shipment: targetShipment,
        }).catch(err => console.warn("[Tracking Recorder] Falha ao enviar email de trânsito:", err?.message))
      })
    }
  } catch (err: any) {
    console.warn("[Tracking Recorder] Erro ao disparar notificação por email:", err?.message)
  }

  return {
    success: true,
    carrier,
    count: insertedCount,
    latestStatus: lastEvent.displayStatus,
    event: lastEvent,
  }
}
