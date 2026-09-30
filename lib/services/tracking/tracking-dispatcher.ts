import { createAdminClient } from "@/lib/supabase/server"
import { isCorreosShipment } from "../shipments/shipment-utils"
import { fetchCorreosTrackingEvents } from "./correos-tracking-sync"
import { fetchCttTrackingEvents } from "./ctt-tracking-sync"
import { recordTrackingEvents } from "./tracking-recorder"
import { TrackingSyncResult } from "./types"

export interface SyncOptions {
  skipAuth?: boolean
  userRole?: string | null
  clientId?: string | null
}

/**
 * Dispatcher central de sincronização de tracking.
 * Identifica a transportadora (Correos Express vs CTT Expresso),
 * consulta o leitor adequado e grava os dados normalizados através do gravador comum.
 */
export async function syncShipmentTracking(
  identifier: { trackingNumber?: string; shipmentId?: string },
  options: SyncOptions = {}
): Promise<TrackingSyncResult> {
  const supabase = createAdminClient()
  const { trackingNumber, shipmentId } = identifier

  // 1. Obter registo do envio
  let targetShipment: any = null

  if (shipmentId) {
    const { data } = await supabase.from("shipments").select("*").eq("id", shipmentId).maybeSingle()
    targetShipment = data
  } else if (trackingNumber) {
    const cleanTrk = trackingNumber.trim()
    const { data: d1 } = await supabase
      .from("shipments")
      .select("*")
      .eq("tracking_number", cleanTrk)
      .maybeSingle()

    if (d1) {
      targetShipment = d1
    } else {
      const { data: d2 } = await supabase
        .from("shipments")
        .select("*")
        .eq("carrier_tracking_number", cleanTrk)
        .maybeSingle()
      targetShipment = d2
    }
  }

  // Fallback audit_log se não estiver na tabela shipments
  if (!targetShipment && (shipmentId || trackingNumber)) {
    try {
      const { data: logs } = await supabase
        .from("audit_log")
        .select("details")
        .eq("action", "shipment_data")
        .order("created_at", { ascending: false })

      const found = logs?.find(
        (l: any) =>
          (shipmentId && l.details?.id === shipmentId) ||
          (trackingNumber &&
            (l.details?.tracking_number === trackingNumber ||
              l.details?.carrier_tracking_number === trackingNumber ||
              l.details?.ctt_object_id === trackingNumber))
      )
      if (found?.details) {
        targetShipment = found.details
      }
    } catch {}
  }

  // 2. Validação de autorização para clientes
  if (!options.skipAuth && options.userRole === "client" && options.clientId) {
    if (targetShipment && targetShipment.client_id !== options.clientId) {
      return {
        success: false,
        carrier: "ctt",
        count: 0,
        error: "Não autorizado a sincronizar este envio.",
      }
    }
  }

  const effectiveId = targetShipment?.id || shipmentId
  if (!effectiveId && !trackingNumber) {
    return {
      success: false,
      carrier: "ctt",
      count: 0,
      error: "Identificador de envio ou número de tracking em falta.",
    }
  }

  // 3. Determinar transportadora: Correos Express vs CTT Expresso
  const isCorreos =
    isCorreosShipment(targetShipment) ||
    Boolean(trackingNumber && /^\d{16}$/.test(trackingNumber.trim()))

  if (isCorreos) {
    // ── CORREOS EXPRESS ──────────────────────────────────────────────────────────
    const correosTracking =
      targetShipment?.carrier_tracking_number ||
      targetShipment?.carrier_object_id ||
      targetShipment?.tracking_number ||
      trackingNumber

    if (!correosTracking) {
      return {
        success: false,
        carrier: "correos",
        count: 0,
        error: "Número de envio Correos Express em falta.",
      }
    }

    const correosResult = await fetchCorreosTrackingEvents(correosTracking)
    if (!correosResult.success || correosResult.events.length === 0) {
      return {
        success: false,
        carrier: "correos",
        count: 0,
        error: correosResult.error || "A Correos Express não devolveu eventos para este envio.",
      }
    }

    if (effectiveId) {
      return recordTrackingEvents(supabase, effectiveId, targetShipment, correosResult.events)
    }

    const last = correosResult.events[correosResult.events.length - 1]
    return {
      success: true,
      carrier: "correos",
      count: correosResult.events.length,
      latestStatus: last.displayStatus,
      event: last,
    }
  } else {
    // ── CTT EXPRESSO ─────────────────────────────────────────────────────────────
    let cttTracking =
      targetShipment?.carrier_tracking_number ||
      targetShipment?.ctt_object_id ||
      targetShipment?.tracking_number ||
      trackingNumber

    // Se começa por LTK e temos carrier_tracking_number real, usar o real
    if (cttTracking && (cttTracking.startsWith("LTK") || cttTracking.startsWith("LKT"))) {
      if (targetShipment?.carrier_tracking_number && !targetShipment.carrier_tracking_number.startsWith("LTK")) {
        cttTracking = targetShipment.carrier_tracking_number
      } else if (targetShipment?.ctt_object_id && !targetShipment.ctt_object_id.startsWith("LTK")) {
        cttTracking = targetShipment.ctt_object_id
      }
    }

    if (!cttTracking) {
      return {
        success: false,
        carrier: "ctt",
        count: 0,
        error: "Número de objeto CTT em falta.",
      }
    }

    const cttResult = await fetchCttTrackingEvents(cttTracking)
    if (!cttResult.success || cttResult.events.length === 0) {
      return {
        success: false,
        carrier: "ctt",
        count: 0,
        error: cttResult.error || "A CTT não devolveu eventos para este envio.",
      }
    }

    if (effectiveId) {
      return recordTrackingEvents(supabase, effectiveId, targetShipment, cttResult.events)
    }

    const last = cttResult.events[cttResult.events.length - 1]
    return {
      success: true,
      carrier: "ctt",
      count: cttResult.events.length,
      latestStatus: last.displayStatus,
      event: last,
    }
  }
}

/**
 * Sincroniza em lote todos os envios ativos da base de dados.
 * Seguro para ser executado tanto por crons da Vercel (sem sessão de utilizador)
 * como por colaboradores na plataforma.
 */
export async function syncAllActiveShipmentsTracking(
  options: { skipAuth?: boolean } = {}
): Promise<{ success: boolean; count: number; errors: string[] }> {
  const supabase = createAdminClient()
  const errors: string[] = []

  // 1. Obter todos os envios não terminados diretamente via admin client
  const { data: activeShipments, error: fetchErr } = await supabase
    .from("shipments")
    .select("id, tracking_number, carrier_tracking_number, carrier_code, service_type, status")
    .not("status", "in", '("entregue","cancelado","devolvido")')

  if (fetchErr) {
    console.error("[Sync All Tracking] Erro ao pesquisar envios ativos:", fetchErr.message)
    return { success: false, count: 0, errors: [fetchErr.message] }
  }

  let syncedCount = 0
  const shipmentsToSync = activeShipments || []

  for (const s of shipmentsToSync) {
    const trk = s.carrier_tracking_number || s.tracking_number || s.id
    if (!trk && !s.id) continue

    try {
      const res = await syncShipmentTracking(
        { shipmentId: s.id, trackingNumber: trk },
        { skipAuth: true }
      )
      if (res.success) {
        syncedCount++
      } else if (res.error) {
        errors.push(`Envio ${s.tracking_number || s.id}: ${res.error}`)
      }
    } catch (err: any) {
      errors.push(`Envio ${s.tracking_number || s.id}: ${err?.message || "Erro desconhecido"}`)
    }
  }

  return {
    success: true,
    count: syncedCount,
    errors,
  }
}
