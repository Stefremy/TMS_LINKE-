import { createAdminClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth/context"
import { isValidUuid, isCorreosShipment, formatOrGenerateCttObjectId } from "./shipment-utils"

/**
 * Fetches all shipments combining the DB shipments table and audit log resilience.
 */
export async function fetchShipments(options: { includeLabels?: boolean } = {}): Promise<any[]> {
  const ctx = await requireUser()
  const supabase = createAdminClient()
  const shipmentsMap = new Map<string, any>()
  const deletedIds = new Set<string>()

  // 0. Fetch deleted IDs to prevent them from resurrecting
  try {
    const { data: deletedLogs } = await supabase
      .from("audit_log")
      .select("details")
      .in("action", ["shipment_deleted", "shipments_bulk_deleted"])
    
    if (deletedLogs) {
      deletedLogs.forEach((log: any) => {
        if (log.details?.deletedShipmentId) deletedIds.add(log.details.deletedShipmentId)
        if (log.details?.deletedShipmentIds) {
          log.details.deletedShipmentIds.forEach((id: string) => deletedIds.add(id))
        }
      })
    }
  } catch (err: any) {
    console.warn("Could not query audit_log for deleted shipments:", err?.message)
  }

  // 1. Fetch from shipments table
  try {
    const lean = options.includeLabels === false
    let shipmentsQuery = supabase
      .from(lean ? "shipment_metadata" : "shipments")
      .select(lean ? "details" : "*")
      .order("created_at", { ascending: false })
    if (ctx.role === "client") {
      shipmentsQuery = shipmentsQuery.eq("client_id", ctx.client_id)
    }

    let { data: dbShipments, error } = await shipmentsQuery
    if (error && lean) {
      let fallbackQuery = supabase.from("shipments").select("*").order("created_at", { ascending: false })
      if (ctx.role === "client") fallbackQuery = fallbackQuery.eq("client_id", ctx.client_id)
      const fallback = await fallbackQuery
      dbShipments = fallback.data
      error = fallback.error
    }

    if (!error && dbShipments) {
      dbShipments.forEach((row: any) => {
        const s = row.details || row
        const key = s.id || s.tracking_number
        if (key && !deletedIds.has(key) && !deletedIds.has(s.id)) {
          const isCorreos = isCorreosShipment(s)
          const cttCode = isCorreos ? "" : formatOrGenerateCttObjectId(s)
          const linkeRef = s.tracking_number?.startsWith("LTK") ? s.tracking_number : s.reference || null
          const rawStatus = s.status
          const normalizedStatus = (rawStatus === "entrada_rede" || rawStatus === "recolhido") ? "em_transito" : rawStatus
          shipmentsMap.set(key, {
            ...s,
            status: normalizedStatus,
            reference: linkeRef,
            carrier_code: isCorreos ? "correos" : (s.carrier_code || "ctt"),
            carrier_name: isCorreos ? "Correos Express" : (s.carrier_name || "CTT Expresso"),
            carrier_tracking_number: s.carrier_tracking_number || (isCorreos ? s.carrier_object_id : null),
            ctt_object_id: isCorreos ? null : cttCode,
            has_label: Boolean(s.has_label || s.ctt_label_base64),
          })
        }
      })
    }
  } catch (err: any) {
    console.warn("Could not query shipments table:", err?.message)
  }

  // A lightweight view removes PDF/ZPL payloads before they leave Postgres.
  try {
    const source = options.includeLabels === false ? "shipment_audit_metadata" : "audit_log"
    let logsQuery = supabase
      .from(source)
      .select("details, created_at")
      .eq("action", "shipment_data")
      .order("created_at", { ascending: false })
    if (ctx.role === "client") {
      logsQuery = logsQuery.eq(source === "audit_log" ? "details->>client_id" : "client_id", ctx.client_id!)
    }
    let { data: logs, error: logError } = await logsQuery

    if (logError && source !== "audit_log") {
      let fallbackQuery = supabase
        .from("audit_log")
        .select("details, created_at")
        .eq("action", "shipment_data")
        .order("created_at", { ascending: false })
      if (ctx.role === "client") fallbackQuery = fallbackQuery.eq("details->>client_id", ctx.client_id!)
      const fallback = await fallbackQuery
      logs = fallback.data
      logError = fallback.error
    }

    if (!logError && logs) {
      logs.forEach((log: any) => {
        const s = log.details
        if (s) {
          if (ctx.role === "client" && s.client_id !== ctx.client_id) return

          const key = s.id || s.tracking_number
          if (key && !deletedIds.has(key) && !deletedIds.has(s.id)) {
            const existing = shipmentsMap.get(key)
            const isCorreos = isCorreosShipment(s) || isCorreosShipment(existing)
            const isRealTracking = (val?: string) => val && (
              /^(EQ|DD|DB|DA|EG|EA)/i.test(val.trim()) || 
              /^\d{16}$/.test(val.trim())
            )
            
            const linkeRef = s.reference 
              || (existing?.tracking_number?.startsWith("LTK") ? existing.tracking_number : null)
              || (s.tracking_number?.startsWith("LTK") ? s.tracking_number : null)
              || (s.ctt_label_base64?.match(/Ref:\s*(LTK\d+)/i)?.[1])
              || existing?.reference
              || null

            if (existing) {
              const ltkRef =
                existing.tracking_number?.startsWith("LTK") ? existing.tracking_number
                : s.tracking_number?.startsWith("LTK") ? s.tracking_number
                : linkeRef

              const carrierRef =
                isRealTracking(existing.carrier_tracking_number) ? existing.carrier_tracking_number
                : isRealTracking(s.carrier_tracking_number) ? s.carrier_tracking_number
                : isRealTracking(s.tracking_number) ? s.tracking_number
                : isRealTracking(existing.tracking_number) ? existing.tracking_number
                : isRealTracking(s.carrier_object_id) ? s.carrier_object_id
                : (!isCorreos && isRealTracking(s.ctt_object_id)) ? s.ctt_object_id
                : existing.carrier_tracking_number || s.carrier_tracking_number || s.carrier_object_id

              const effectiveTracking = ltkRef || carrierRef || existing.tracking_number || s.tracking_number
              const currentStatus = existing.status || s.status
              const normalizedStatus = (currentStatus === "entrada_rede" || currentStatus === "recolhido") ? "em_transito" : currentStatus

              shipmentsMap.set(key, {
                ...existing,
                ...s,
                status: normalizedStatus,
                tracking_number: effectiveTracking,
                carrier_code: isCorreos ? "correos" : (existing.carrier_code || s.carrier_code || "ctt"),
                carrier_name: isCorreos ? "Correos Express" : (existing.carrier_name || s.carrier_name || "CTT Expresso"),
                carrier_tracking_number: carrierRef || existing.carrier_tracking_number || s.carrier_tracking_number,
                reference: linkeRef,
                ctt_label_base64: options.includeLabels === false ? undefined : (s.ctt_label_base64 || existing.ctt_label_base64 || s.carrier_label_base64),
                has_label: Boolean(s.has_label || s.ctt_label_base64 || s.carrier_label_base64 || existing.has_label || existing.ctt_label_base64),
                ctt_object_id: isCorreos ? null : formatOrGenerateCttObjectId({ ...existing, ...s, tracking_number: carrierRef || effectiveTracking }),
              })
            } else {
              const cttCode = isCorreos ? null : formatOrGenerateCttObjectId(s)
              shipmentsMap.set(key, {
                ...s,
                ...(options.includeLabels === false ? { ctt_label_base64: undefined, carrier_label_base64: undefined } : {}),
                has_label: Boolean(s.has_label || s.ctt_label_base64 || s.carrier_label_base64),
                carrier_code: isCorreos ? "correos" : (s.carrier_code || "ctt"),
                carrier_name: isCorreos ? "Correos Express" : (s.carrier_name || "CTT Expresso"),
                carrier_tracking_number: s.carrier_tracking_number || s.carrier_object_id || (isRealTracking(s.tracking_number) ? s.tracking_number : null),
                reference: linkeRef,
                ctt_object_id: cttCode,
                created_at: s.created_at || log.created_at || new Date().toISOString()
              })
            }
          }
        }
      })
    }
  } catch (err: any) {
    console.warn("Could not query audit_log for shipments:", err?.message)
  }

  return Array.from(shipmentsMap.values()).map((s) => {
    const isCorreos = isCorreosShipment(s)
    const result = {
      ...s,
      carrier_code: isCorreos ? "correos" : (s.carrier_code || "ctt"),
      carrier_name: isCorreos ? "Correos Express" : (s.carrier_name || "CTT Expresso"),
      carrier_tracking_number: s.carrier_tracking_number || (isCorreos ? s.carrier_object_id : null),
      ctt_object_id: isCorreos ? null : (s.ctt_object_id || formatOrGenerateCttObjectId(s))
    }
    if (options.includeLabels === false) {
      delete result.ctt_label_base64
      delete result.carrier_label_base64
      delete result.labelBase64
      delete result.ctt_manifest_pdf
    }
    return result
  }).sort((a, b) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })
}

/** Retrieve a label only when the user explicitly opens or prints that shipment. */
export async function fetchShipmentLabel(shipmentId: string): Promise<string | null> {
  const ctx = await requireUser()
  if (!isValidUuid(shipmentId)) return null

  const supabase = createAdminClient()
  const { data: labelRows, error: rpcError } = await supabase.rpc("shipment_label_by_id", { shipment_id: shipmentId })
  if (!rpcError) {
    const labelRow = labelRows?.[0]
    return labelRow && (ctx.role !== "client" || labelRow.client_id === ctx.client_id) ? labelRow.label : null
  }

  // Rollout fallback while the database migration has not been applied.
  const { data, error } = await supabase
    .from("audit_log")
    .select("details")
    .eq("action", "shipment_data")
    .eq("details->>id", shipmentId)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) throw new Error("Não foi possível consultar a etiqueta do envio.")
  const details = data?.map((row: any) => row.details).find((item: any) => item?.ctt_label_base64 || item?.carrier_label_base64 || item?.labelBase64)
  if (details) {
    return ctx.role !== "client" || details.client_id === ctx.client_id
      ? details.ctt_label_base64 || details.carrier_label_base64 || details.labelBase64 || null
      : null
  }
  const { data: shipment } = await supabase.from("shipments")
    .select("client_id,ctt_label_base64")
    .eq("id", shipmentId)
    .maybeSingle()
  return shipment && (ctx.role !== "client" || shipment.client_id === ctx.client_id)
    ? shipment.ctt_label_base64 || null
    : null
}

export async function fetchPaginatedShipments(options: { 
  page?: number
  pageSize?: number
  includeLabels?: boolean 
  search?: string
} = {}) {
  const ctx = await requireUser()
  const supabase = createAdminClient()
  
  const page = options.page || 1
  const pageSize = options.pageSize || 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  
  const lean = options.includeLabels === false
  let query = supabase
    .from(lean ? "shipment_metadata" : "shipments")
    .select(lean ? "details" : "*", { count: 'exact' })
    .order("created_at", { ascending: false })
    
  if (ctx.role === "client") {
    query = query.eq("client_id", ctx.client_id)
  }
  
  if (options.search) {
    query = query.or(`tracking_number.ilike.%${options.search}%,reference.ilike.%${options.search}%,recipient_name.ilike.%${options.search}%`)
  }
  
  const { data, count, error } = await query.range(from, to)
  
  if (error) {
    console.error("Error fetching paginated shipments:", error)
    return { data: [], total: 0, page, pageSize, totalPages: 0 }
  }

  const mapped = (data || []).map((row: any) => {
    const s = row.details || row
    const isCorreos = isCorreosShipment(s)
    const cttCode = isCorreos ? null : formatOrGenerateCttObjectId(s)
    const linkeRef = s.tracking_number?.startsWith("LTK") ? s.tracking_number : s.reference || null
    const rawStatus = s.status
    const normalizedStatus = (rawStatus === "entrada_rede" || rawStatus === "recolhido") ? "em_transito" : rawStatus
    
    return {
      ...s,
      status: normalizedStatus,
      reference: linkeRef,
      carrier_code: isCorreos ? "correos" : (s.carrier_code || "ctt"),
      carrier_name: isCorreos ? "Correos Express" : (s.carrier_name || "CTT Expresso"),
      carrier_tracking_number: s.carrier_tracking_number || (isCorreos ? s.carrier_object_id : null),
      ctt_object_id: isCorreos ? null : cttCode,
      has_label: Boolean(s.has_label || s.ctt_label_base64),
    }
  })

  return {
    data: mapped,
    total: count || 0,
    page,
    pageSize,
    totalPages: Math.ceil((count || 0) / pageSize)
  }
}
