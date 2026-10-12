"use server"

import fs from "fs"
import path from "path"
import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import { requireUser, getTenantId } from "@/lib/auth/context"
import { getClientesAction } from "./clientes"
import * as XLSX from "xlsx"
import type { 
  ReconcileItem, 
  ReconcileStats, 
  ReconcileRunResult, 
  AuditHistoryEntry 
} from "@/app/ops/tesouraria/reconciliacao/types"
import { 
  CttParsedItem, 
  parseCttItemsFromWorkbook, 
  normalizeParcelId 
} from "@/app/ops/tesouraria/reconciliacao/parser"

const TOLERANCE = 0.005

function isPickupCollectionId(parcelId: string): boolean {
  const id = normalizeParcelId(parcelId)
  return /^\d+\/\d+$/.test(id)
}

function isEgMultiParcelWithoutCttPrice(parcelId: string, cttPrice: number): boolean {
  const id = normalizeParcelId(parcelId)
  return id.startsWith("EG") && isNaN(cttPrice)
}

/**
 * Motor central de reconciliação: cruza os objetos faturados pelos CTT contra o banco de dados do TMS.
 */
async function executeReconciliationCore(
  cttItems: CttParsedItem[],
  filename: string,
  comparisonMode: "buy_price" | "sell_price" = "buy_price",
  dateFrom?: string,
  dateTo?: string
): Promise<{ success: boolean; result?: ReconcileRunResult; error?: string }> {
  try {
    await requireUser()
    const supabase = createAdminClient()
    const tenantId = await getTenantId()

    if (!cttItems.length) {
      return { success: false, error: "Nenhum registo de objetos válido para reconciliar." }
    }

    // 1. Obter envios da base de dados do TMS
    let shipmentsQuery = supabase
      .from("shipments")
      .select(
        "id, tracking_number, carrier_tracking_number, buy_price, sell_price, client_id, sender_name, recipient_name, service_type, created_at, status"
      )
      .order("created_at", { ascending: false })
      .limit(25000)

    if (dateFrom) {
      shipmentsQuery = shipmentsQuery.gte("created_at", dateFrom)
    }
    if (dateTo) {
      shipmentsQuery = shipmentsQuery.lte("created_at", dateTo + "T23:59:59.999Z")
    }

    const { data: dbShipments, error: shipErr } = await shipmentsQuery
    if (shipErr) {
      return { success: false, error: `Erro ao consultar envios do TMS: ${shipErr.message}` }
    }

    // 2. Mapeamento de clientes
    const clients = await getClientesAction()
    const clientMap = new Map<string, any>()
    clients.forEach((c) => clientMap.set(c.id, c))

    // 3. Indexar envios internos por carrier_tracking_number e tracking_number
    const shipmentMap = new Map<string, any>()
    ;(dbShipments || []).forEach((s: any) => {
      if (s.carrier_tracking_number) {
        shipmentMap.set(normalizeParcelId(s.carrier_tracking_number), s)
      }
      if (s.tracking_number) {
        shipmentMap.set(normalizeParcelId(s.tracking_number), s)
      }
    })

    // 4. Cruzamento dos dados no ambiente Linke
    const items: ReconcileItem[] = []

    cttItems.forEach((ctt) => {
      const cttId = ctt.id
      const cttPrice = isNaN(ctt.cttPrice) ? 0 : ctt.cttPrice
      const refCliente = ctt.refCliente ? normalizeParcelId(ctt.refCliente) : ""

      let shipment = shipmentMap.get(cttId)
      if (!shipment && refCliente) {
        shipment = shipmentMap.get(refCliente)
      }

      let lnkPrice = 0
      let status: "ok" | "mismatch" | "undercharged" | "unknown" = "unknown"

      if (shipment) {
        lnkPrice = comparisonMode === "sell_price" 
          ? Number(shipment.sell_price || 0) 
          : Number(shipment.buy_price || 0)

        if (cttPrice > lnkPrice + TOLERANCE) {
          status = "mismatch" // Cobrado a mais pelos CTT
        } else if (cttPrice < lnkPrice - TOLERANCE) {
          status = "undercharged" // Cobrado a menos pelos CTT (poupado pela Linke)
        } else {
          status = "ok" // Conforme
        }
      } else {
        // Exceções conhecidas dos CTT (recolhas internas e multi-volumes EG)
        if (isPickupCollectionId(cttId)) return
        if (isEgMultiParcelWithoutCttPrice(cttId, cttPrice)) return
        status = "unknown" // Não registado no TMS
      }

      const diff = +(cttPrice - lnkPrice).toFixed(4)
      const client = shipment?.client_id ? clientMap.get(shipment.client_id) : null
      const clientName = client?.short_name || client?.legal_name || shipment?.sender_name || "—"

      items.push({
        id: cttId,
        cttPrice: +cttPrice.toFixed(2),
        lnkPrice: +lnkPrice.toFixed(2),
        diff: +diff.toFixed(2),
        status,
        cttDate: ctt.cttDate || "",
        shipmentId: shipment?.id,
        trackingNumber: shipment?.tracking_number,
        carrierTrackingNumber: shipment?.carrier_tracking_number || cttId,
        clientName,
        clientId: shipment?.client_id,
        senderName: shipment?.sender_name || ctt.senderName || "",
        recipientName: shipment?.recipient_name || ctt.recipientName || "",
        serviceType: shipment?.service_type || ctt.serviceType || "Expresso"
      })
    })

    // 5. Cálculo de Métricas e Risco Financeiro
    const totalItems = items.length
    const mismatchItems = items.filter((i) => i.status === "mismatch")
    const underchargedItems = items.filter((i) => i.status === "undercharged")
    const unknownItems = items.filter((i) => i.status === "unknown")
    const okItems = items.filter((i) => i.status === "ok")

    const totalCttBilled = +items.reduce((sum, i) => sum + i.cttPrice, 0).toFixed(2)
    const totalLnkExpected = +items.filter((i) => i.status !== "unknown").reduce((sum, i) => sum + i.lnkPrice, 0).toFixed(2)
    const totalOverchargedRisk = +mismatchItems.reduce((sum, i) => sum + Math.max(0, i.diff), 0).toFixed(2)
    const totalUnderchargedGain = +underchargedItems.reduce((sum, i) => sum + Math.max(0, -i.diff), 0).toFixed(2)
    const maxMismatch = +mismatchItems.reduce((max, i) => Math.max(max, i.diff), 0).toFixed(2)
    const flaggedRate = totalItems > 0 ? +(((mismatchItems.length + unknownItems.length) / totalItems) * 100).toFixed(1) : 0

    const stats: ReconcileStats = {
      totalItems,
      mismatchCount: mismatchItems.length,
      underchargedCount: underchargedItems.length,
      unknownCount: unknownItems.length,
      okCount: okItems.length,
      totalCttBilled,
      totalLnkExpected,
      totalOverchargedRisk,
      totalUnderchargedGain,
      maxMismatch,
      flaggedRate
    }

    const runId = "audit_" + Date.now()
    const result: ReconcileRunResult = {
      runId,
      executedAt: new Date().toISOString(),
      filename,
      comparisonMode,
      dateFilter: { from: dateFrom, to: dateTo },
      stats,
      items
    }

    // 6. Gravar histórico no audit_log
    try {
      const effectiveTenantId = tenantId || "11111111-1111-1111-1111-111111111111"
      await supabase.from("audit_log").insert({
        tenant_id: effectiveTenantId,
        action: "ctt_reconciliation_audit",
        details: {
          entity: "tesouraria",
          runId,
          filename,
          comparisonMode,
          stats,
          totalItems,
          topMismatchesCount: mismatchItems.length,
          underchargedCount: underchargedItems.length,
          unknownCount: unknownItems.length
        }
      })
    } catch (logErr: any) {
      console.warn("Could not save audit to audit_log:", logErr?.message)
    }

    revalidatePath("/ops/tesouraria/reconciliacao")

    return { success: true, result }
  } catch (err: any) {
    console.error("[executeReconciliationCore] Erro fatal:", err)
    return { success: false, error: err.message || "Erro inesperado ao processar reconciliação." }
  }
}

/**
 * Server Action para reconciliar itens pré-analisados no browser (ideal para ficheiros grandes, sem timeout de upload)
 */
export async function reconcileCttParsedItemsAction(payload: {
  items: CttParsedItem[]
  filename: string
  comparisonMode?: "buy_price" | "sell_price"
  dateFrom?: string
  dateTo?: string
}): Promise<{ success: boolean; result?: ReconcileRunResult; error?: string }> {
  return executeReconciliationCore(
    payload.items,
    payload.filename,
    payload.comparisonMode || "buy_price",
    payload.dateFrom,
    payload.dateTo
  )
}

/**
 * Server Action para carregar o ficheiro de exemplo oficial (public/Discriminativo 6.xls) diretamente do disco do servidor
 */
export async function reconcileCttSampleAction(payload?: {
  comparisonMode?: "buy_price" | "sell_price"
  dateFrom?: string
  dateTo?: string
}): Promise<{ success: boolean; result?: ReconcileRunResult; error?: string }> {
  try {
    const samplePath = path.join(process.cwd(), "public", "Discriminativo 6.xls")
    if (!fs.existsSync(samplePath)) {
      return { success: false, error: "Ficheiro Discriminativo 6.xls não encontrado em public/." }
    }

    const buffer = fs.readFileSync(samplePath)
    const wb = XLSX.read(buffer, { type: "buffer" })
    const items = parseCttItemsFromWorkbook(wb)

    return executeReconciliationCore(
      items,
      "Discriminativo 6.xls",
      payload?.comparisonMode || "buy_price",
      payload?.dateFrom,
      payload?.dateTo
    )
  } catch (err: any) {
    console.error("[reconcileCttSampleAction] Erro:", err)
    return { success: false, error: err.message || "Erro ao carregar ficheiro de exemplo." }
  }
}

/**
 * Reconciliação via FormData (compatibilidade com upload direto ou parsed_items em JSON)
 */
export async function reconcileCttInvoiceAction(
  formData: FormData
): Promise<{ success: boolean; result?: ReconcileRunResult; error?: string }> {
  try {
    const comparisonMode = (formData.get("comparison_mode") as "buy_price" | "sell_price") || "buy_price"
    const dateFrom = (formData.get("date_from") as string) || undefined
    const dateTo = (formData.get("date_to") as string) || undefined

    // 1. Modo Exemplo
    if (formData.get("sample_mode") === "true") {
      return reconcileCttSampleAction({ comparisonMode, dateFrom, dateTo })
    }

    // 2. Modo Itens Pré-Analisados
    const parsedItemsJson = formData.get("parsed_items") as string | null
    if (parsedItemsJson) {
      try {
        const items: CttParsedItem[] = JSON.parse(parsedItemsJson)
        const filename = (formData.get("filename") as string) || "Fatura CTT"
        return executeReconciliationCore(items, filename, comparisonMode, dateFrom, dateTo)
      } catch (e: any) {
        return { success: false, error: `Erro ao deserializar itens do CTT: ${e.message}` }
      }
    }

    // 3. Modo Ficheiro em FormData (para ficheiros pequenos)
    const file = formData.get("file") as File | null
    if (!file) {
      return { success: false, error: "Nenhum ficheiro fornecido para auditoria." }
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const wb = XLSX.read(buffer, { type: "buffer" })
    const items = parseCttItemsFromWorkbook(wb)

    return executeReconciliationCore(items, file.name, comparisonMode, dateFrom, dateTo)
  } catch (err: any) {
    console.error("[reconcileCttInvoiceAction] Erro:", err)
    return { success: false, error: err.message || "Erro inesperado ao processar reconciliação." }
  }
}

/**
 * Obtém o histórico de auditorias anteriores guardadas.
 */
export async function getReconciliacaoHistoryAction(): Promise<AuditHistoryEntry[]> {
  try {
    await requireUser()
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from("audit_log")
      .select("id, created_at, details")
      .eq("action", "ctt_reconciliation_audit")
      .order("created_at", { ascending: false })
      .limit(20)

    if (error || !data) return []

    return data.map((d: any) => {
      const details = d.details || {}
      return {
        id: d.id,
        created_at: d.created_at,
        filename: details.filename || "Extrato CTT",
        comparisonMode: details.comparisonMode || "buy_price",
        stats: details.stats || {
          totalItems: details.totalItems || 0,
          mismatchCount: details.topMismatchesCount || 0,
          underchargedCount: details.underchargedCount || 0,
          unknownCount: details.unknownCount || 0,
          okCount: 0,
          totalCttBilled: 0,
          totalLnkExpected: 0,
          totalOverchargedRisk: 0,
          totalUnderchargedGain: 0,
          maxMismatch: 0,
          flaggedRate: 0
        },
        totalRows: details.totalItems || 0
      }
    })
  } catch {
    return []
  }
}
