import "server-only"
import { createAdminClient } from "@/lib/supabase/server"
import { loadScopedClientProfiles } from "@/lib/services/clients/scoped-client-profiles"
import type { ReembolsoRawItem, ReembolsoMatchedItem, ClientReembolsoSummary, ReembolsoBatch, ReconcileStatus } from "./types"

export async function reconcileReembolsoItems(
  rawItems: ReembolsoRawItem[],
  metadata: {
    filename: string
    carrier: "ctt" | "correos" | string
    carrierAccount?: string
    carrierContract?: string
    destinationIban?: string
  },
  tenantId: string
): Promise<ReembolsoBatch> {
  if (!tenantId) throw new Error("Company access is missing")
  const supabase = createAdminClient()

  // 1. Gather all tracking identifiers to search in the database
  const trackingSet = new Set<string>()
  rawItems.forEach((it) => {
    if (it.carrierTracking) trackingSet.add(it.carrierTracking.trim().toUpperCase())
    if (it.clientReference) trackingSet.add(it.clientReference.trim().toUpperCase())
  })

  const trackingArray = Array.from(trackingSet)

  // 2. Query shipments matching these tracking numbers
  const matchedShipmentsMap = new Map<string, any>()

  if (trackingArray.length > 0) {
    // Query by carrier_tracking_number
    const { data: byCarrier, error: carrierError } = await supabase
      .from("shipments")
      .select("id, client_id, tracking_number, carrier_tracking_number, recipient_name, status, sell_price")
      .eq("tenant_id", tenantId)
      .in("carrier_tracking_number", trackingArray)

    if (carrierError) throw new Error("Shipment lookup failed")

    if (byCarrier) {
      byCarrier.forEach((s: any) => {
        if (s.carrier_tracking_number) {
          matchedShipmentsMap.set(s.carrier_tracking_number.trim().toUpperCase(), s)
        }
      })
    }

    // Query by tracking_number
    const { data: byTracking, error: trackingError } = await supabase
      .from("shipments")
      .select("id, client_id, tracking_number, carrier_tracking_number, recipient_name, status, sell_price")
      .eq("tenant_id", tenantId)
      .in("tracking_number", trackingArray)

    if (trackingError) throw new Error("Shipment lookup failed")

    if (byTracking) {
      byTracking.forEach((s: any) => {
        if (s.tracking_number) {
          const key = s.tracking_number.trim().toUpperCase()
          if (!matchedShipmentsMap.has(key)) {
            matchedShipmentsMap.set(key, s)
          }
        }
      })
    }
  }

  const clientMap = await loadScopedClientProfiles(supabase, tenantId,
    [...matchedShipmentsMap.values()].map(s => s.client_id).filter(Boolean))

  // 3. Match each item
  const reconciledItems: ReembolsoMatchedItem[] = []
  const clientGroups = new Map<string, { summary: ClientReembolsoSummary; items: ReembolsoMatchedItem[] }>()

  let matchedCount = 0
  let unmatchedCount = 0

  for (const raw of rawItems) {
    const trackingKey = raw.carrierTracking.trim().toUpperCase()
    const refKey = raw.clientReference ? raw.clientReference.trim().toUpperCase() : ""

    const shipment = matchedShipmentsMap.get(trackingKey) || (refKey ? matchedShipmentsMap.get(refKey) : null)

    let status: ReconcileStatus = "unmatched"
    let clientId: string | undefined = undefined
    let clientName = "Não Identificado"
    let clientIban = ""
    let clientEmail = ""
    let expectedCod = 0
    let difference = 0

    if (shipment) {
      clientId = shipment.client_id
      const client = clientId ? clientMap.get(clientId) : null

      clientName = client?.short_name || client?.legal_name || client?.name || "Cliente Desconhecido"
      clientIban = client?.iban || "Sem IBAN configurado"
      clientEmail = client?.billing_email || client?.email || ""

      expectedCod = Number(shipment.cod_value || 0)
      difference = Math.round((raw.amount - expectedCod) * 100) / 100

      // If COD value wasn't recorded or matches within small tolerance
      if (expectedCod === 0 || Math.abs(difference) < 0.05) {
        status = "matched"
      } else {
        status = "value_mismatch"
      }

      matchedCount++
    } else {
      unmatchedCount++
    }

    const matchedItem: ReembolsoMatchedItem = {
      ...raw,
      reconcileStatus: status,
      shipmentId: shipment?.id,
      clientId,
      clientName,
      clientIban,
      expectedCod: expectedCod > 0 ? expectedCod : undefined,
      difference: expectedCod > 0 ? difference : undefined,
    }

    reconciledItems.push(matchedItem)

    // Group by Client
    const groupKey = clientId || "unmatched_group"
    const groupName = clientId ? clientName : "Envios Sem Cliente Associado (Não Encontrados no TMS)"
    const groupIban = clientId ? clientIban : "N/A"

    if (!clientGroups.has(groupKey)) {
      clientGroups.set(groupKey, {
        summary: {
          clientId: groupKey,
          clientName: groupName,
          clientIban: groupIban,
          clientEmail,
          totalAmount: 0,
          itemsCount: 0,
          isPaid: false,
          items: [],
        },
        items: [],
      })
    }

    const group = clientGroups.get(groupKey)!
    group.summary.totalAmount = Math.round((group.summary.totalAmount + raw.amount) * 100) / 100
    group.summary.itemsCount += 1
    group.summary.items.push(matchedItem)
  }

  const clientSummaries = Array.from(clientGroups.values())
    .map((g) => g.summary)
    .sort((a, b) => {
      // Put unmatched group at the end
      if (a.clientId === "unmatched_group") return 1
      if (b.clientId === "unmatched_group") return -1
      return b.totalAmount - a.totalAmount
    })

  const totalAmount = Math.round(rawItems.reduce((acc, it) => acc + it.amount, 0) * 100) / 100

  return {
    id: crypto.randomUUID(),
    filename: metadata.filename,
    carrier: metadata.carrier,
    carrierAccount: metadata.carrierAccount,
    carrierContract: metadata.carrierContract,
    destinationIban: metadata.destinationIban,
    totalItems: rawItems.length,
    totalAmount,
    matchedCount,
    unmatchedCount,
    items: reconciledItems,
    clientSummaries,
    created_at: new Date().toISOString(),
  }
}
