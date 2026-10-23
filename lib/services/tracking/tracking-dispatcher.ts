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
  tenantId?: string | null
}

/**
 * Dispatcher central de sincronização de tracking.
 * Identifica a transportadora (Correos Express vs CTT Expresso),
 * consulta o leitor adequado e grava os dados normalizados através do gravador comum.
 */
export async function syncShipmentTracking(
  identifier: { trackingNumber?: string; shipmentId?: string; shipment?: any },
  options: SyncOptions = {}
): Promise<TrackingSyncResult> {
  const isClient = options.userRole === "client"
  const denied: TrackingSyncResult = {
    success: false,
    carrier: "ctt",
    count: 0,
    error: "Não autorizado a sincronizar este envio.",
  }
  if (isClient && (!options.clientId || !options.tenantId)) return denied

  const supabase = createAdminClient()
  const { trackingNumber, shipmentId, shipment } = identifier

  // Client requests always reload ownership; supplied snapshots and skipAuth cannot bypass it.
  let targetShipment: any = isClient ? null : shipment || null
  const lookupId = shipmentId || (isClient ? shipment?.id : undefined)

  const TRACKING_SELECT_COLS = "id, tenant_id, client_id, tracking_number, carrier_tracking_number, carrier_code, service_type, status, ops_substatus, recipient_phone, recipient_email, recipient_name, updated_at, created_at"

  async function findShipment(column: "id" | "tracking_number" | "carrier_tracking_number", value: string) {
    let query = supabase.from("shipments").select(TRACKING_SELECT_COLS).eq(column, value)
    if (isClient) {
      query = query.eq("tenant_id", options.tenantId!).eq("client_id", options.clientId!)
    }
    const { data, error } = await query.maybeSingle()
    if (error) throw new Error("Shipment lookup failed")
    return data
  }

  if (!targetShipment) {
    try {
      if (lookupId) {
        targetShipment = await findShipment("id", lookupId)
      } else if (trackingNumber) {
        const cleanTrk = trackingNumber.trim()
        targetShipment = await findShipment("tracking_number", cleanTrk)
        if (!targetShipment) {
          targetShipment = await findShipment("carrier_tracking_number", cleanTrk)
        }
      }
    } catch {
      return {
        success: false,
        carrier: "ctt",
        count: 0,
        error: "Não foi possível confirmar o acesso a este envio. Tente novamente.",
      }
    }
  }

  // An error, missing record or missing ownership proof must stop before carrier calls or writes.
  if (isClient && (
    !targetShipment?.id ||
    targetShipment.client_id !== options.clientId ||
    targetShipment.tenant_id !== options.tenantId
  )) return denied

  const effectiveTrackingNumber = isClient
    ? targetShipment.carrier_tracking_number || targetShipment.carrier_object_id ||
      targetShipment.ctt_object_id || targetShipment.tracking_number
    : trackingNumber

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
    Boolean(effectiveTrackingNumber && /^\d{16}$/.test(effectiveTrackingNumber.trim()))

  if (isCorreos) {
    // ── CORREOS EXPRESS ──────────────────────────────────────────────────────────
    const correosTracking =
      targetShipment?.carrier_tracking_number ||
      targetShipment?.carrier_object_id ||
      targetShipment?.tracking_number ||
      effectiveTrackingNumber

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
      effectiveTrackingNumber

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
