import "server-only"
import type { AuthContext } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { syncShipmentTracking } from "@/lib/services/tracking"
import type { TrackingSyncResult } from "./types"

type BatchShipment = {
  id: string
  status?: string
  ops_substatus?: string | null
  [key: string]: unknown
}

/** Receives only server-verified context; authorization is preserved for both entry points. */
export async function syncAuthorizedShipmentBatch(ctx: AuthContext, shipmentIds: unknown): Promise<{
  updatedCount: number
  error?: string
}> {
  if (!ctx.user || !ctx.tenant_id || !["client", "employee", "admin"].includes(ctx.role || "") || (ctx.role === "client" && !ctx.client_id)) {
    throw new Error("Não foi possível confirmar o acesso aos envios.")
  }
  if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) return { updatedCount: 0 }

  const cleanIds = Array.from(new Set(shipmentIds.filter(id => typeof id === "string" && id.trim()))).slice(0, 50)
  if (cleanIds.length === 0) return { updatedCount: 0 }
  let updatedCount = 0

  const supabase = createAdminClient()
  const lookupFailure = { updatedCount: 0, error: "Não foi possível consultar os envios. Tente novamente." }
  let activeShipments: BatchShipment[] | null
  try {
    let query = supabase.from("shipments")
      .select("id, tenant_id, client_id, tracking_number, reference, carrier_tracking_number, carrier_object_id, ctt_object_id, carrier_code, service_type, status, ops_substatus, recipient_phone, recipient_email, recipient_name, updated_at, created_at")
      .eq("tenant_id", ctx.tenant_id)
      .in("id", cleanIds)
    if (ctx.role === "client") query = query.eq("client_id", ctx.client_id!)

    const { data, error } = await query
      .not("status", "in", '("entregue","cancelado","devolvido")')
    if (error) return lookupFailure
    activeShipments = data as BatchShipment[] | null
  } catch {
    return lookupFailure
  }

  if (!activeShipments || activeShipments.length === 0) {
    return { updatedCount: 0 }
  }

  // Chunk requests into batches of 5 to avoid overloading the CTT API and network bottlenecks
  const chunkSize = 5
  for (let i = 0; i < activeShipments.length; i += chunkSize) {
    const chunk = activeShipments.slice(i, i + chunkSize)
    
    await Promise.allSettled(
      chunk.map(async (shipment) => {
        let timeout: ReturnType<typeof setTimeout> | undefined
        try {
          // Strict 3.5s timeout per tracking sync to prevent API hangs from halting the entire batch
          const timeoutPromise = new Promise<TrackingSyncResult>((_, reject) => {
            timeout = setTimeout(() => reject(new Error("Timeout")), 3500)
          })
          const syncPromise = syncShipmentTracking(
            { shipmentId: shipment.id, shipment },
            {
              skipAuth: ctx.role !== "client",
              userRole: ctx.role,
              clientId: ctx.client_id,
              tenantId: ctx.tenant_id,
            }
          )
          
          const res = await Promise.race([syncPromise, timeoutPromise])
          const normalizedStatus = shipment.status === "entrada_rede" || shipment.status === "recolhido"
            ? "em_transito" : shipment.status
          const statusChanged = Boolean(res.latestStatus && res.latestStatus !== normalizedStatus)
          const substatusChanged = Boolean(res.event &&
            (res.event.eventCode || "").toLowerCase().substring(0, 50) !== (shipment.ops_substatus || ""))
          if (res.success && (res.count > 0 || statusChanged || substatusChanged)) updatedCount++
        } catch (err: unknown) {
          console.warn(`[Sync Active Batch] Erro/Timeout ao sincronizar envio ${shipment.id}:`,
            err instanceof Error ? err.message : "Erro desconhecido")
        } finally {
          if (timeout !== undefined) clearTimeout(timeout)
        }
      })
    )
  }

  return { updatedCount }
}
