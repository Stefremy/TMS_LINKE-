import { createAdminClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth/context"
import { isValidUuid, isCorreosShipment, formatOrGenerateCttObjectId } from "./shipment-utils"
import { applyLinkeLogoToCorreosLabel, isCorreosPdfLabel } from "@/lib/services/correos/correos-label-customizer"
import { convertZplToPdfBase64 } from "@/lib/label-utils"

/**
 * Fetches all shipments from the DB shipments table.
 */
export async function fetchShipments(options: { includeLabels?: boolean; limit?: number; createdAfter?: string } = {}): Promise<any[]> {
  const ctx = await requireUser()
  const supabase = createAdminClient()

  try {
    let shipmentsQuery = supabase
      .from("shipments")
      .select("*")
      .order("created_at", { ascending: false })
      
    if (ctx.role === "client") {
      shipmentsQuery = shipmentsQuery.eq("client_id", ctx.client_id)
    }
    if (options.createdAfter) {
      shipmentsQuery = shipmentsQuery.gte("created_at", options.createdAfter)
    }
    if (options.limit) {
      shipmentsQuery = shipmentsQuery.limit(options.limit)
    } else {
      shipmentsQuery = shipmentsQuery.limit(50)
    }

    const { data: dbShipments, error } = await shipmentsQuery

    if (error || !dbShipments) {
      console.warn("Could not query shipments table:", error?.message)
      return []
    }

    return dbShipments.map((s: any) => {
      const isCorreos = s.service_type?.toLowerCase().includes("correos") || s.carrier_code === "correos"
      const cttCode = isCorreos ? null : formatOrGenerateCttObjectId(s)
      const linkeRef = s.tracking_number?.startsWith("LTK") ? s.tracking_number : null
      const rawStatus = s.status
      const normalizedStatus = (rawStatus === "entrada_rede" || rawStatus === "recolhido") ? "em_transito" : rawStatus
      
      return {
        ...s,
        status: normalizedStatus,
        reference: linkeRef,
        carrier_code: isCorreos ? "correos" : (s.carrier_code || "ctt"),
        carrier_name: isCorreos ? "Correos Express" : (s.carrier_name || "CTT Expresso"),
        carrier_tracking_number: s.carrier_tracking_number || (isCorreos ? s.carrier_object_id : null),
        ctt_object_id: cttCode,
        has_label: true,
      }
    })
  } catch (err: any) {
    console.warn("Exception in fetchShipments:", err?.message)
    return []
  }
}

import { generateTransportLabelPdfBase64 } from "./transport-label-generator"

/** Retrieve a label only when the user explicitly opens or prints that shipment. */
export async function fetchShipmentLabel(identifier: string): Promise<string | null> {
  const ctx = await requireUser()
  if (!identifier) return null

  const cleanId = String(identifier).trim()
  const supabase = createAdminClient()
  let label: string | null = null
  const isUuid = isValidUuid(cleanId)

  // 1. Query shipments table directly
  try {
    let query = supabase.from("shipments").select("*")
    if (isUuid) {
      query = query.eq("id", cleanId)
    } else {
      query = query.or(`tracking_number.eq.${cleanId},carrier_tracking_number.eq.${cleanId}`)
    }
    const { data: shipment } = await query.maybeSingle()
    if (shipment) {
      if (ctx.role === "client" && shipment.client_id !== ctx.client_id) {
        return null
      }

      let existingLabel = shipment.ctt_label_base64 || shipment.carrier_label_base64 || null
      if (existingLabel) {
        if (existingLabel.trimStart().startsWith("^XA")) {
          existingLabel = await convertZplToPdfBase64(existingLabel)
        }
        if (await isCorreosPdfLabel(existingLabel)) {
          existingLabel = await applyLinkeLogoToCorreosLabel(existingLabel)
        }
        return existingLabel
      }

      // Generate printable transport label
      label = await generateTransportLabelPdfBase64(shipment)
      if (label) {
        // Save to audit_log for future instant retrieval
        try {
          const { data: auditLogs } = await supabase.from("audit_log").select("id, details").eq("action", "shipment_data")
          const targetLog = auditLogs?.find((l: any) => l.details?.id === shipment.id)
          if (targetLog) {
            await supabase.from("audit_log").update({
              details: { ...targetLog.details, ctt_label_base64: label }
            }).eq("id", targetLog.id)
          }
        } catch (e) {
          console.warn("Could not save generated label to audit_log:", e)
        }
        return label
      }
    }
  } catch (err: any) {
    console.warn("fetchShipmentLabel: shipments table query error:", err?.message)
  }

  return label
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
  
  const buildQuery = () => {
    let q = supabase
      .from("shipments")
      .select("*", { count: 'estimated' })
      .order("created_at", { ascending: false })

    if (ctx.role === "client") {
      q = q.eq("client_id", ctx.client_id)
    }

    if (options.search) {
      const term = options.search.replace(/[,()]/g, " ")
      q = q.or(`tracking_number.ilike.%${term}%,recipient_name.ilike.%${term}%,sender_name.ilike.%${term}%`)
    }
    return q.range(from, to)
  }

  let { data, count, error } = (await buildQuery()) as any

  if (error) {
    console.error("Error fetching paginated shipments:", error?.message || error?.code || JSON.stringify(error))
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
      has_label: true,
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
