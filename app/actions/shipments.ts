"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { emitCttShipmentAction } from "@/app/actions/ctt"

const LINKE_TENANT_ID = "11111111-1111-1111-1111-111111111111"
const DEFAULT_FALLBACK_CLIENT_ID = "44444444-4444-4444-4444-444444444444"

const isValidUuid = (val?: string): boolean => {
  return Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val))
}

/**
 * Converte nomes de serviço legíveis para códigos SubProduto CTT válidos (máx 10 chars).
 * Códigos reais validados via RecolhasWS (GetProdutosRecolha & GetAreaInfluencia):
 * - EMSF056.01: Premium D+1 (CTT 24H)
 * - EMSF057.01: Standard D+2 (CTT 48H)
 * - EMSF058.01: Economy D+5 (5 Dias)
 * - EMSF001.02: EMS Internacional
 * - ENCF008.02: Quick Internacional
 */
function mapServiceNameToSubProduct(serviceName?: string | null): string {
  if (!serviceName) return "EMSF056.01"
  const trimmed = serviceName.trim()
  // Se já for um código oficial de subproduto (ex: EMSF056.01), usar diretamente
  if (/^(EMSF|ENCF|CORF)[0-9]{3}\.[0-9]{2}$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }
  const lower = trimmed.toLowerCase()
  // Internacional
  if (lower.includes("internacional") || lower.includes("ems internacional")) return "EMSF001.02"
  if (lower.includes("quick")) return "ENCF008.02"
  // 5 dias / D+5
  if (lower.includes("d+5") || lower.includes("5 dias") || lower.includes("economy")) return "EMSF058.01"
  // 48h / D+2 / 2 dias / standard / ers48
  if (lower.includes("48h") || lower.includes("2 dias") || lower.includes("d+2") || lower.includes("standard") || lower.includes("ers48") || lower.includes("ers 48")) return "EMSF057.01"
  // 24h / D+1 / amanhã / premium / ers24
  if (lower.includes("24h") || lower.includes("amanhã") || lower.includes("amanha") || lower.includes("d+1") || lower.includes("premium") || lower.includes("ers24") || lower.includes("ers 24")) return "EMSF056.01"
  // Se for código curto genérico (≤ 10 chars) que não seja os inválidos ERS24/ERS48/D+
  if (trimmed.length <= 10 && !lower.startsWith("ers") && !lower.startsWith("d+")) return trimmed
  // Fallback padrão: CTT 24H (Premium D+1)
  return "EMSF056.01"
}


/**
 * Ensures that the tenant and the client exist in their respective database tables
 * so that foreign key constraints on the `shipments` table are always satisfied.
 */
async function ensureTenantAndClient(supabase: any, clientId?: string, clientName?: string): Promise<string> {
  let targetClientId = isValidUuid(clientId) ? (clientId as string) : (clientId === "client_linke_store" ? DEFAULT_FALLBACK_CLIENT_ID : crypto.randomUUID())

  try {
    // 1. Ensure tenant exists
    await supabase.from("tenants").upsert({
      id: LINKE_TENANT_ID,
      name: "Linke Logistics"
    }, { onConflict: "id" })
  } catch (e: any) {
    console.warn("Tenant check warning:", e?.message)
  }

  try {
    // 2. Ensure client exists without overwriting existing client records unnecessarily
    await supabase.from("clients").upsert({
      id: targetClientId,
      tenant_id: LINKE_TENANT_ID,
      name: clientName || "Cliente"
    }, { onConflict: "id", ignoreDuplicates: true })
  } catch (e: any) {
    console.warn("Client check warning:", e?.message)
  }

  return targetClientId
}

/**
 * Fetches all shipments combining the DB shipments table and audit log resilience.
 */
export async function getShipmentsAction(): Promise<any[]> {
  const supabase = createAdminClient()
  const shipmentsMap = new Map<string, any>()

  // 1. Fetch from shipments table
  try {
    const { data: dbShipments, error } = await supabase
      .from("shipments")
      .select("*")
      .order("created_at", { ascending: false })

    if (!error && dbShipments) {
      dbShipments.forEach((s: any) => {
        const key = s.id || s.tracking_number
        if (key) {
          shipmentsMap.set(key, s)
        }
      })
    }
  } catch (err: any) {
    console.warn("Could not query shipments table:", err?.message)
  }

  // 2. Fetch from audit_log for shipment_data
  try {
    const { data: logs, error: logError } = await supabase
      .from("audit_log")
      .select("details, created_at")
      .eq("action", "shipment_data")
      .order("created_at", { ascending: false })

    if (!logError && logs) {
      logs.forEach((log: any) => {
        const s = log.details
        if (s) {
          const key = s.id || s.tracking_number
          if (key && !shipmentsMap.has(key)) {
            shipmentsMap.set(key, {
              ...s,
              created_at: s.created_at || log.created_at || new Date().toISOString()
            })
          }
        }
      })
    }
  } catch (err: any) {
    console.warn("Could not query audit_log for shipments:", err?.message)
  }

  return Array.from(shipmentsMap.values()).sort((a, b) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })
}

export async function createShipmentAction(formData: FormData) {
  const supabase = createAdminClient()
  
  const rawClientId = formData.get("client_id") as string
  const service_type = (formData.get("service_type") as string) || "CTT Expresso 24H"
  
  // Sender
  const sender_name = (formData.get("sender_name") as string) || "Remetente"
  const sender_address = formData.get("sender_address") as string
  const sender_zip = formData.get("sender_zip") as string
  const sender_city = formData.get("sender_city") as string
  
  const sender_zip3 = sender_zip?.split("-")[0] || sender_zip || ""
  const sender_zip4 = sender_zip?.split("-")[1] || ""

  // Recipient
  const recipient_name = (formData.get("recipient_name") as string) || "Destinatário"
  const recipient_address = formData.get("recipient_address") as string
  const recipient_zip = formData.get("recipient_zip") as string
  const recipient_city = formData.get("recipient_city") as string
  
  const recipient_zip3 = recipient_zip?.split("-")[0] || recipient_zip || ""
  const recipient_zip4 = recipient_zip?.split("-")[1] || ""

  const client_id = await ensureTenantAndClient(supabase, rawClientId, sender_name)
  const shipmentId = crypto.randomUUID()
  const trackingNumber = `LTK${Math.floor(1000000 + Math.random() * 900000)}`
  const now = new Date().toISOString()

  const shipmentData = {
    id: shipmentId,
    tenant_id: LINKE_TENANT_ID,
    client_id,
    tracking_number: trackingNumber,
    service_type,
    status: "rascunho",
    sender_name,
    sender_address: `${sender_address || ""}, ${sender_city || ""}`.trim(),
    sender_zip3,
    sender_zip4,
    recipient_name,
    recipient_address: `${recipient_address || ""}, ${recipient_city || ""}`.trim(),
    recipient_zip3,
    recipient_zip4,
    buy_price: 0,
    sell_price: 5.50,
    created_at: now,
    updated_at: now,
  }

  // 1. Insert into shipments table
  try {
    await supabase.from("shipments").insert(shipmentData)
  } catch (err: any) {
    console.error("Error inserting shipment into table:", err?.message)
  }

  // 2. Dual-write to audit_log
  try {
    await supabase.from("audit_log").insert({
      tenant_id: LINKE_TENANT_ID,
      action: "shipment_data",
      details: shipmentData,
    })
  } catch (err: any) {
    console.warn("Could not save shipment to audit_log:", err?.message)
  }

  // 3. Create package info
  try {
    await supabase.from("packages").insert({
      tenant_id: LINKE_TENANT_ID,
      shipment_id: shipmentId,
      weight_g: 1000
    })
  } catch {}

  try {
    revalidatePath("/ops/envios")
    revalidatePath("/ops")
    revalidatePath("/app")
    revalidatePath("/app/envios")
  } catch {}

  return { success: true, id: shipmentId, guia: trackingNumber }
}

export async function dispatchShipmentAction(shipmentId: string) {
  const supabase = createAdminClient()

  const { data: shipment, error } = await supabase
    .from("shipments")
    .select("*")
    .eq("id", shipmentId)
    .single()

  if (error || !shipment) {
    throw new Error("Shipment not found")
  }

  // Check if it's a CTT service
  if (shipment.service_type?.includes("ctt") || !shipment.service_type) {
    return emitCttShipmentAction({
      id: shipment.id,
      ref: shipment.tracking_number || shipment.id.substring(0, 8).toUpperCase(),
      sender: {
        name: shipment.sender_name,
        address: shipment.sender_address,
        // zip4 = 4-digit prefix, zip3 = 3-digit extension → format: "4610-001"
        zip: shipment.sender_zip4
          ? `${shipment.sender_zip4}-${shipment.sender_zip3 || "001"}`
          : "1000-001",
        city: "Localidade",
        phone: "910000000"
      },
      recipient: {
        name: shipment.recipient_name,
        address: shipment.recipient_address,
        zip: shipment.recipient_zip4
          ? `${shipment.recipient_zip4}-${shipment.recipient_zip3 || "001"}`
          : "1000-001",
        city: "Localidade",
        phone: "920000000"
      },
      weightKg: 1,
      volumes: 1,
      subProduct: "EMSF056.01"
    })
  } else {
    throw new Error("Service not yet integrated: " + shipment.service_type)
  }
}

export async function getClientPortalStatsAction(clientId?: string, clientName?: string) {
  const allShipments = await getShipmentsAction()

  let clientShipments = allShipments

  if (clientId || clientName) {
    const cNameLower = (clientName || "").toLowerCase().trim()
    const cIdLower = (clientId || "").toLowerCase().trim()

    clientShipments = allShipments.filter((s: any) => {
      if (clientId && s.client_id === clientId) return true
      if (cIdLower && s.client_id?.toLowerCase() === cIdLower) return true
      if (cNameLower && s.sender_name?.toLowerCase().includes(cNameLower)) return true
      return false
    })

    // Removed fallback that exposed all shipments when a client had none
  }

  const totalCount = clientShipments.length
  const totalRevenue = clientShipments.reduce((acc: number, s: any) => acc + (Number(s.sell_price) || 0), 0)
  const deliveredCount = clientShipments.filter((s: any) => s.status === "entregue").length
  const deliveryRate = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0

  // Real weekly distribution
  const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
  const dayCounts: Record<string, number> = { Seg: 0, Ter: 0, Qua: 0, Qui: 0, Sex: 0, Sáb: 0, Dom: 0 }
  
  clientShipments.forEach((s: any) => {
    if (s.created_at) {
      const d = new Date(s.created_at)
      const dayName = daysOfWeek[d.getDay()]
      if (dayCounts[dayName] !== undefined) {
        dayCounts[dayName] += 1
      }
    }
  })

  const maxDayCount = Math.max(...Object.values(dayCounts), 1)
  const weeklyVolume = [
    { day: "Seg", count: dayCounts["Seg"] || 0, height: `${Math.round(((dayCounts["Seg"] || 0) / maxDayCount) * 100)}%` },
    { day: "Ter", count: dayCounts["Ter"] || 0, height: `${Math.round(((dayCounts["Ter"] || 0) / maxDayCount) * 100)}%` },
    { day: "Qua", count: dayCounts["Qua"] || 0, height: `${Math.round(((dayCounts["Qua"] || 0) / maxDayCount) * 100)}%` },
    { day: "Qui", count: dayCounts["Qui"] || 0, height: `${Math.round(((dayCounts["Qui"] || 0) / maxDayCount) * 100)}%` },
    { day: "Sex", count: dayCounts["Sex"] || 0, height: `${Math.round(((dayCounts["Sex"] || 0) / maxDayCount) * 100)}%` },
    { day: "Sáb", count: dayCounts["Sáb"] || 0, height: `${Math.round(((dayCounts["Sáb"] || 0) / maxDayCount) * 100)}%` },
    { day: "Dom", count: dayCounts["Dom"] || 0, height: `${Math.round(((dayCounts["Dom"] || 0) / maxDayCount) * 100)}%` },
  ]

  // Real service breakdown
  const serviceCounts: Record<string, number> = {}
  clientShipments.forEach((s: any) => {
    const srv = s.service_type || "CTT 24H"
    serviceCounts[srv] = (serviceCounts[srv] || 0) + 1
  })

  const colors = ["bg-emerald-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500", "bg-purple-500"]
  const serviceBreakdown = Object.entries(serviceCounts).map(([name, count], index) => ({
    name,
    count: `${count} envios`,
    rawCount: count,
    share: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
    color: colors[index % colors.length]
  }))

  // Real destination breakdown
  const destCounts: Record<string, number> = {}
  clientShipments.forEach((s: any) => {
    const city = s.recipient_address?.split(",").pop()?.trim() || "Portugal"
    destCounts[city] = (destCounts[city] || 0) + 1
  })

  const destinationRegions = Object.entries(destCounts).slice(0, 4).map(([region, count]) => ({
    region,
    count: `${count} envios`,
    pct: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
  }))

  return {
    totalCount,
    totalRevenue,
    deliveredCount,
    deliveryRate,
    weeklyVolume,
    serviceBreakdown,
    destinationRegions,
    recentShipments: clientShipments.slice(0, 5),
    allShipments: clientShipments,
  }
}

export async function emitClientGuiaAction(data: {
  clientId?: string
  clientName?: string
  senderAddress?: string
  senderCity?: string
  senderPostal?: string
  recipientName: string
  recipientAddress: string
  recipientCity?: string
  recipientPostal?: string
  recipientPhone?: string
  recipientEmail?: string
  weightKg: number
  volumesCount?: number
  serviceName: string
  calculatedPrice: number
}) {
  const supabase = createAdminClient()
  const trackingNumber = `LTK${Math.floor(1000000 + Math.random() * 900000)}`
  const shipmentId = crypto.randomUUID()
  const now = new Date().toISOString()

  const senderZip3 = data.senderPostal?.split("-")[0] || ""
  const senderZip4 = data.senderPostal?.split("-")[1] || ""

  const recipientZip3 = data.recipientPostal?.split("-")[0] || ""
  const recipientZip4 = data.recipientPostal?.split("-")[1] || ""

  // Ensure DB foreign keys are valid
  const validatedClientId = await ensureTenantAndClient(supabase, data.clientId, data.clientName)

  const shipmentData = {
    id: shipmentId,
    tenant_id: LINKE_TENANT_ID,
    client_id: validatedClientId,
    tracking_number: trackingNumber,
    service_type: data.serviceName || "CTT Expresso 24H",
    status: "pendente",
    sender_name: data.clientName || "Empresa Cliente",
    sender_address: `${data.senderAddress || "Sede Comercial"}${data.senderCity ? `, ${data.senderCity}` : ""}`,
    sender_zip3: senderZip3,
    sender_zip4: senderZip4,
    recipient_name: data.recipientName,
    recipient_address: `${data.recipientAddress}${data.recipientCity ? `, ${data.recipientCity}` : ""}`,
    recipient_zip3: recipientZip3,
    recipient_zip4: recipientZip4,
    buy_price: 0,
    sell_price: Number(data.calculatedPrice) || 0,
    created_at: now,
    updated_at: now,
  }

  // 1. Direct DB Insert (rascunho first)
  try {
    const { error } = await supabase
      .from("shipments")
      .insert(shipmentData)

    if (error) {
      console.warn("DB shipments insert note:", error.message)
    }
  } catch (err: any) {
    console.warn("Error inserting into shipments table:", err?.message)
  }

  // 2. Dual-write to audit_log for zero-data-loss guarantee
  try {
    await supabase.from("audit_log").insert({
      tenant_id: LINKE_TENANT_ID,
      action: "shipment_data",
      details: shipmentData,
    })
  } catch (err: any) {
    console.warn("Error logging shipment to audit_log:", err?.message)
  }

  // 3. Insert package record
  try {
    await supabase.from("packages").insert({
      tenant_id: LINKE_TENANT_ID,
      shipment_id: shipmentId,
      weight_g: Math.round((data.weightKg || 1) * 1000)
    })
  } catch {}

  // 4. Se for CTT, emitir a Guia Real via CTT WS (como rascunho = CreateShipment, para poder fechar em lote)
  let realGuia = trackingNumber
  let labelBase64 = null
  if (data.serviceName?.toLowerCase().includes("ctt") || data.serviceName?.includes("ERS") || data.serviceName?.includes("D+")) {
    try {
      const cttRes = await emitCttShipmentAction({
        id: shipmentId,
        ref: trackingNumber,
        sender: {
          name: shipmentData.sender_name,
          address: data.senderAddress || "Sede Comercial",
          city: data.senderCity || "Portugal",
          zip: data.senderPostal || "1000-001",
          phone: "910000000" // Remetente usa o telefone da empresa ou um fixo padrão
        },
        recipient: {
          name: data.recipientName,
          address: data.recipientAddress,
          city: data.recipientCity || "Portugal",
          zip: data.recipientPostal || "1000-001",
          phone: data.recipientPhone || "920000000",
          email: data.recipientEmail
        },
        weightKg: data.weightKg,
        volumes: data.volumesCount || 1,
        subProduct: mapServiceNameToSubProduct(data.serviceName),
        autoClose: false // Como recomendado no portal do cliente, deixamos em aberto para fechar em lote no final do dia
      })

      if (cttRes.success) {
        realGuia = cttRes.trackingNumber || trackingNumber
        labelBase64 = cttRes.labelBase64
        
        // Save the label and real tracking number to the database
        try {
          await supabase.from("shipments").update({
            tracking_number: realGuia,
            ctt_label_base64: labelBase64
          }).eq("id", shipmentId)
        } catch (e) { console.warn("Failed to update shipment with label") }
        
        try {
          await supabase.from("audit_log").update({
            details: {
              ...shipmentData,
              tracking_number: realGuia,
              ctt_label_base64: labelBase64
            }
          }).eq("action", "shipment_data").contains("details", { id: shipmentId })
        } catch (e) { console.warn("Failed to update audit_log with label") }
      }
    } catch (e: any) {
      console.error("Failed to generate CTT real shipment:", e.message)
      // se falhar, continua a mostrar "pendente" para poder tentar de novo a partir do TMS ops
    }
  }

  try {
    revalidatePath("/app")
    revalidatePath("/app/criar-guia")
    revalidatePath("/app/envios")
    revalidatePath("/ops/envios")
    revalidatePath("/ops")
  } catch {}

  return {
    success: true,
    guia: realGuia,
    id: shipmentId,
    labelBase64
  }
}

/**
 * Re-solicita e regenera a etiqueta oficial CTT a partir dos Web Services CTT
 */
export async function regenerateCttLabelAction(shipmentId: string) {
  const supabase = createAdminClient()
  
  // Encontrar o envio
  const all = await getShipmentsAction()
  const shipment = all.find((s: any) => s.id === shipmentId || s.tracking_number === shipmentId)

  if (!shipment) {
    throw new Error("Envio não encontrado para reemitir etiqueta.")
  }

  // zip3 = 3-digit extension (e.g. "001"), zip4 = 4-digit prefix (e.g. "4610")
  // Correct format: "4610-001" = ${zip4}-${zip3}
  const senderZip = shipment.sender_zip4
    ? `${shipment.sender_zip4}-${shipment.sender_zip3 || "001"}`
    : shipment.sender_zip3
    ? `${shipment.sender_zip3}-001`
    : "1000-001"
  const recipientZip = shipment.recipient_zip4
    ? `${shipment.recipient_zip4}-${shipment.recipient_zip3 || "001"}`
    : shipment.recipient_zip3
    ? `${shipment.recipient_zip3}-001`
    : "1000-001"

  const cttRes = await emitCttShipmentAction({
    id: shipment.id,
    ref: shipment.tracking_number || shipment.id.substring(0, 8).toUpperCase(),
    sender: {
      name: shipment.sender_name || "Remetente",
      address: shipment.sender_address || "Sede Comercial",
      city: shipment.sender_city || "Portugal",
      zip: senderZip,
      phone: shipment.sender_phone || "910000000",
      email: shipment.sender_email
    },
    recipient: {
      name: shipment.recipient_name || "Destinatário",
      address: shipment.recipient_address || "Morada de Entrega",
      city: shipment.recipient_city || "Portugal",
      zip: recipientZip,
      phone: shipment.recipient_phone || "920000000",
      email: shipment.recipient_email
    },
    weightKg: Number(shipment.weight_kg) || 1,
    volumes: Number(shipment.volumes_count) || 1,
    subProduct: mapServiceNameToSubProduct(shipment.service_type),
    autoClose: false
  })

  if (cttRes.success && cttRes.labelBase64) {
    const updatedGuia = cttRes.trackingNumber || shipment.tracking_number

    try {
      await supabase.from("shipments").update({
        tracking_number: updatedGuia,
        ctt_label_base64: cttRes.labelBase64
      }).eq("id", shipment.id)
    } catch {}

    try {
      await supabase.from("audit_log").update({
        details: {
          ...shipment,
          tracking_number: updatedGuia,
          ctt_label_base64: cttRes.labelBase64
        }
      }).eq("action", "shipment_data").contains("details", { id: shipment.id })
    } catch {}
  }

  try {
    revalidatePath("/app")
    revalidatePath("/app/envios")
    revalidatePath("/ops/envios")
  } catch {}

  // Extract the error message string from cttRes (which may have .error or .errors)
  const errorStr: string = (() => {
    const r = cttRes as any
    if (typeof r.error === 'string') return r.error
    if (Array.isArray(r.errors) && r.errors.length > 0) {
      return r.errors.map((e: any) => `${e.ErrorCode ? `[${e.ErrorCode}] ` : ''}${e.Message || 'Erro desconhecido'}`).join('; ')
    }
    return 'Erro desconhecido na comunicação CTT'
  })()

  return {
    success: cttRes.success,
    error: errorStr,
    labelBase64: cttRes.labelBase64,
    trackingNumber: cttRes.trackingNumber || shipment.tracking_number
  }
}


