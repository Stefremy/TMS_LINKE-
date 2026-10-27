import { createAdminClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/auth/context"
import { isValidUuid, isCorreosShipment, formatOrGenerateCttObjectId } from "./shipment-utils"
import { applyLinkeLogoToCorreosLabel, isCorreosPdfLabel } from "@/lib/services/correos/correos-label-customizer"
import { convertZplToPdfBase64 } from "@/lib/label-utils"
import { loadShipmentPickupDates } from "./shipment-pickup-dates"
import { loadShipmentParcelSummaries } from './shipment-parcel-summaries'
import type { ParcelSummary } from './parcel-summary'

// Native columns only. Display aliases (reference, carrier_name, ctt_object_id) are derived
// below; optional pricing/label snapshots are stored separately in audit_log.
export const SHIPMENT_LIST_COLUMNS = "id, tenant_id, client_id, tracking_number, carrier_tracking_number, carrier_code, sender_name, sender_address, sender_zip3, sender_zip4, sender_phone, recipient_name, recipient_address, recipient_zip3, recipient_zip4, recipient_phone, recipient_email, service_type, buy_price, sell_price, billing_statement_id, status, ops_substatus, created_at, updated_at"

/**
 * Fetches shipments from the DB shipments table without downloading heavy base64 label blobs unless requested.
 */
export async function fetchShipments(options: { includeLabels?: boolean; limit?: number; createdAfter?: string; clientId?: string } = {}): Promise<any[]> {
  const ctx = await requireUser()
  if (!ctx.tenant_id) throw new Error("Conta sem empresa associada.")
  const supabase = createAdminClient()

  try {
    const selectCols = options.includeLabels ? "*" : SHIPMENT_LIST_COLUMNS
    let shipmentsQuery = supabase
      .from("shipments")
      .select(selectCols)
      .eq("tenant_id", ctx.tenant_id)
      .order("created_at", { ascending: false })
      
    if (ctx.role === "client") {
      shipmentsQuery = shipmentsQuery.eq("client_id", ctx.client_id)
    } else if (options.clientId) {
      shipmentsQuery = shipmentsQuery.eq("client_id", options.clientId)
    }
    if (options.createdAfter) {
      shipmentsQuery = shipmentsQuery.gte("created_at", options.createdAfter)
    }
    if (options.limit) {
      shipmentsQuery = shipmentsQuery.limit(options.limit)
    } else {
      shipmentsQuery = shipmentsQuery.limit(10000) // allow up to 10000 to cover 90 days for Contas Corrente
    }

    const { data: dbShipments, error } = await shipmentsQuery

    if (error || !dbShipments) {
      console.warn("Could not query shipments table:", error?.message)
      return []
    }

    return dbShipments.map((rawShipment: any) => {
      const s: any = { ...rawShipment }
      if (!options.includeLabels) {
        delete s.ctt_label_base64
        delete s.carrier_label_base64
      }
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
        has_label: Boolean(s.carrier_tracking_number || s.ctt_object_id || s.carrier_object_id),
      }
    })
  } catch (err: any) {
    console.warn("Exception in fetchShipments:", err?.message)
    return []
  }
}

import { getCttShipmentLabel } from "@/lib/services/ctt/shipment-label"

/** Retrieve only saved official carrier labels, never create another shipment or a substitute label. */
export async function fetchShipmentLabel(identifier: string): Promise<string | null> {
  const ctx = await requireUser()
  const cleanId = String(identifier || "").trim()
  if (!ctx.tenant_id || !cleanId || cleanId.length > 160 || !/^[A-Za-z0-9._/-]+$/.test(cleanId)) return null
  if (ctx.role === "client" && !ctx.client_id) return null
  const supabase = createAdminClient()

  try {
    let query = supabase.from("shipments").select("*").eq("tenant_id", ctx.tenant_id)
    if (ctx.role === "client") query = query.eq("client_id", ctx.client_id)
    query = isValidUuid(cleanId) ? query.eq("id", cleanId)
      : query.or(`tracking_number.eq.${cleanId},carrier_tracking_number.eq.${cleanId}`)
    const { data: shipment } = await query.limit(1).maybeSingle()
    let snapshot: any = null
    const fields = shipment || isValidUuid(cleanId) ? ["id"] : ["carrier_tracking_number", "ctt_object_id", "tracking_number"]
    for (const field of fields) {
      let logs = supabase.from("audit_log").select("details").eq("tenant_id", ctx.tenant_id)
        .eq("action", "shipment_data").eq(`details->>${field}`, shipment?.id || cleanId)
      if (ctx.role === "client") logs = logs.eq("details->>client_id", ctx.client_id)
      const { data, error } = await logs.order("created_at", { ascending: false }).limit(1).maybeSingle()
      if (error) return null
      if (data?.details) { snapshot = data.details; break }
    }
    const saved = snapshot || shipment
    if (!saved) return null
    let label = saved.ctt_label_base64 || saved.carrier_label_base64 || saved.labelBase64 ||
      shipment?.ctt_label_base64 || shipment?.carrier_label_base64 || null
    if (!label && (saved.ctt_documents || saved.rawResponse?.ShipmentData?.[0])) {
      const rawShipment = saved.rawResponse?.ShipmentData?.[0]
      label = getCttShipmentLabel({
        FirstObject: saved.carrier_tracking_number || rawShipment?.FirstObject,
        LabelList: rawShipment?.LabelList,
        DocumentsList: saved.ctt_documents || rawShipment?.DocumentsList,
      })?.data || null
    }
    if (!label) return null
    if (label.trimStart().startsWith("^XA")) label = await convertZplToPdfBase64(label)
    if (isCorreosShipment(saved) && await isCorreosPdfLabel(label)) label = await applyLinkeLogoToCorreosLabel(label)
    return label
  } catch (err: any) {
    console.warn("fetchShipmentLabel: label lookup failed:", err?.message)
    return null
  }
}

export async function fetchPaginatedShipments(options: { 
  page?: number
  pageSize?: number
  includeLabels?: boolean 
  search?: string
  status?: string
} = {}) {
  const ctx = await requireUser()
  if (!ctx.tenant_id) throw new Error("Conta sem empresa associada.")
  if (ctx.role === "client" && !ctx.client_id) throw new Error("Cliente não identificado.")
  const supabase = createAdminClient()
  
  const page = Number.isSafeInteger(options.page) && options.page! > 0 ? options.page! : 1
  const pageSize = Number.isSafeInteger(options.pageSize) && options.pageSize! > 0 ? Math.min(options.pageSize!, 200) : 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  
  const buildQuery = () => {
    const selectCols = options.includeLabels ? "*" : SHIPMENT_LIST_COLUMNS
    let q = supabase
      .from("shipments")
      .select(selectCols, { count: 'estimated' })
      .eq("tenant_id", ctx.tenant_id)
      .order("created_at", { ascending: false })
      .order("id")

    if (ctx.role === "client") {
      q = q.eq("client_id", ctx.client_id)
    }

    if (options.search) {
      const term = options.search.replace(/[,()]/g, " ")
      q = q.or(`tracking_number.ilike.%${term}%,recipient_name.ilike.%${term}%,sender_name.ilike.%${term}%`)
    }

    if (options.status) {
      const sLabel = options.status.toLowerCase()
      if (sLabel === "pendente" || sLabel === "pendentes") q = q.in("status", ["pendente", "rascunho"])
      else if (sLabel === "em trânsito") q = q.in("status", ["entrada_rede", "recolhido"])
      else if (sLabel === "em distribuição" || sLabel === "em distrib.") q = q.eq("status", "em_distribuicao")
      else if (sLabel === "entregue" || sLabel === "entregues") q = q.eq("status", "entregue")
      else if (sLabel === "incidências" || sLabel === "incidência") q = q.eq("status", "incidencia")
      else q = q.eq("status", options.status) // fallback
    }

    return q.range(from, to)
  }

  const { data, count, error } = await buildQuery()

  if (error) {
    console.error("Error fetching paginated shipments:", error?.message || error?.code || JSON.stringify(error))
    return { data: [], total: 0, page, pageSize, totalPages: 0 }
  }

  let pickupDates = new Map<string, string>()
  let parcelSummaries = new Map<string, ParcelSummary>()
  const [pickupResult, parcelResult] = await Promise.allSettled([
    loadShipmentPickupDates(supabase, ctx.tenant_id, (data || []).map((row: { id: string }) => row.id)),
    loadShipmentParcelSummaries(supabase, ctx.tenant_id, data || []),
  ])
  if (pickupResult.status === 'fulfilled') pickupDates = pickupResult.value
  else console.warn('As datas de recolha não estão disponíveis nesta consulta.')
  if (parcelResult.status === 'fulfilled') parcelSummaries = parcelResult.value
  else console.warn('Os pesos dos volumes não estão disponíveis nesta consulta.')

  const mapped = (data || []).map((row: any) => {
    const s = row.details || row
    const isCorreos = isCorreosShipment(s)
    const cttCode = isCorreos ? null : formatOrGenerateCttObjectId(s)
    const linkeRef = s.tracking_number?.startsWith("LTK") ? s.tracking_number : s.reference || null
    const rawStatus = s.status
    const normalizedStatus = (rawStatus === "entrada_rede" || rawStatus === "recolhido") ? "em_transito" : rawStatus
    
    return {
      ...s,
      picked_up_at: pickupDates.get(s.id) || null,
      parcel_summary: parcelSummaries.get(s.id) || null,
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
