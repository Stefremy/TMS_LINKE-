"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { calculateShipmentPrice } from "@/lib/pricing/calculate-shipment-price"
import { calculateShipmentSpecialFees, resolveServiceCarrier } from "@/lib/pricing/calculate-shipment-quote"
import { loadShipmentPricingContext, validateShipmentPricingInput, ShipmentPricingError, ShipmentPricingUnavailableError } from "@/lib/pricing/shipment-pricing-context"
import { getAuthContext, requireUser, requireEmployee, requireClientAccess, getTenantId } from "@/lib/auth/context"
import { CTT_TRACKING_EVENTS, CTT_INCIDENT_CODES } from "@/lib/services/ctt/ctt-types"
import { CttProvider } from "@/lib/services/carriers/ctt-provider"
import { CorreosShipmentService } from "@/lib/services/correos/correos-shipment.service"
import { resolveCttCredentials, resolveCorreosCredentials } from "@/lib/services/carriers/credentials"
import { convertZplToPdfBase64 } from "@/lib/label-utils"
import { applyLinkeLogoToCorreosLabel } from "@/lib/services/correos/correos-label-customizer"
import { isValidUuid, isCorreosShipment, formatOrGenerateCttObjectId } from "@/lib/services/shipments/shipment-utils"
import { fetchShipments, fetchShipmentLabel, fetchPaginatedShipments } from "@/lib/services/shipments/shipment-fetcher"
import { syncShipmentTracking, mapCorreosStatus } from "@/lib/services/tracking"
import { syncAuthorizedShipmentBatch } from "@/lib/services/tracking/tracking-batch"
import { publicUrl } from "@/lib/config/public-origins"
import type { CTTShipment2Close, CTTCompleteShipmentOutput } from "@/lib/services/ctt/ctt-types"

export async function getShipmentsAction(options: { includeLabels?: boolean; limit?: number; createdAfter?: string; clientId?: string } = {}): Promise<any[]> {
  return fetchShipments(options)
}

export async function getShipmentLabelAction(shipmentId: string): Promise<string | null> {
  return fetchShipmentLabel(shipmentId)
}

import { createShipment, dispatchShipment } from "@/lib/services/shipments/shipment-creator"
import { currentAccountOutstanding } from "@/lib/billing/client-balance"
import { reserveWallet, transitionWallet, walletSnapshot, type WalletReservation } from "@/lib/billing/wallet"
import { deleteShipment, deleteShipmentsBulk } from "@/lib/services/shipments/shipment-deleter"

export async function createShipmentAction(formData: FormData) {
  return createShipment(formData)
}

export async function dispatchShipmentAction(shipmentId: string) {
  return dispatchShipment(shipmentId)
}

export async function getClientPortalStatsAction(clientId?: string, clientName?: string) {
  
  const ctx = await requireUser()

  const effectiveClientId = ctx.role === "client" ? ctx.client_id : clientId
  const [{ getBillingStatementsAction }, { getClientesAction }] = await Promise.all([
    import("@/app/actions/moloni"),
    import("@/app/actions/clientes"),
  ])
  // Independent reads share the verified session; do not scan every store for one profile.
  const [allShipments, allStatements, profiles] = await Promise.all([
    getShipmentsAction({ includeLabels: false, limit: 100000, clientId: effectiveClientId || undefined }),
    getBillingStatementsAction(effectiveClientId || undefined),
    effectiveClientId ? getClientesAction(effectiveClientId) : Promise.resolve([]),
  ])

  let clientShipments = allShipments

  if (effectiveClientId || clientName) {
    const cNameLower = (clientName || "").toLowerCase().trim()
    const cIdLower = (effectiveClientId || "").toLowerCase().trim()

    clientShipments = allShipments.filter((s: any) => {
      if (effectiveClientId && s.client_id === effectiveClientId) return true
      if (cIdLower && s.client_id?.toLowerCase() === cIdLower) return true
      if (cNameLower && s.sender_name?.toLowerCase().includes(cNameLower)) return true
      return false
    })

    // Removed fallback that exposed all shipments when a client had none
  }

  const client = profiles.find(profile => profile.id === effectiveClientId)
  const clientBillingType = client?.billing_type || "conta_corrente"

  const now = new Date()
  const currentMonthPrefix = now.toISOString().slice(0, 7) // e.g. "2026-10"
  const currentPeriodName = now.toLocaleDateString("pt-PT", { month: "long", year: "numeric" }) // "outubro de 2026"

  // Envios do mês/período atual
  const monthShipments = clientShipments.filter((s: any) => s.created_at && s.created_at.startsWith(currentMonthPrefix))
  const monthCount = monthShipments.length
  const monthDeliveredCount = monthShipments.filter((s: any) => s.status === "entregue").length
  const monthRevenue = monthShipments
    .filter((s: any) => s.status !== "anulado")
    .reduce((acc: number, s: any) => acc + Number(s.sell_price || 0), 0)

  const clientStatementsForBalance = allStatements.filter((stmt: any) => !effectiveClientId || stmt.client_id === effectiveClientId)

  // The two billing models are computed by separate, independent functions (lib/billing/client-balance.ts):
  //  - pay_as_you_go: shipment consumption plus outstanding reservations
  //  - conta_corrente: invoiced amounts still owed (pending shipments + unpaid statements)
  const wallet = clientBillingType === "pay_as_you_go" && effectiveClientId
    ? await walletSnapshot(createAdminClient(), ctx.tenant_id, effectiveClientId) : null
  const totalDebt = wallet
    ? wallet.spent + wallet.reserved
    : currentAccountOutstanding(clientShipments, clientStatementsForBalance)

  const totalCount = clientShipments.length
  // Change totalRevenue to reflect the real Debt (Used Balance)
  const totalRevenue = totalDebt
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

  const clientStatements = allStatements
    .filter((stmt: any) => !effectiveClientId || stmt.client_id === effectiveClientId)
    .sort((a: any, b: any) => new Date(b.created_at || b.period_end || 0).getTime() - new Date(a.created_at || a.period_end || 0).getTime())

  const latestInvoice = clientStatements.find((stmt: any) => stmt.moloni_document_number || stmt.moloni_document_id || stmt.statement_number)

  return {
    totalCount,
    totalRevenue,
    walletBalance: wallet?.balance,
    monthCount,
    monthDeliveredCount,
    monthRevenue,
    currentPeriodName,
    deliveredCount,
    deliveryRate,
    weeklyVolume,
    serviceBreakdown,
    destinationRegions,
    recentShipments: clientShipments.slice(0, 5),
    allShipments: clientShipments.slice(0, 500),
    latestInvoice: latestInvoice ? {
      id: String(latestInvoice.id),
      statement_number: latestInvoice.statement_number ? String(latestInvoice.statement_number) : undefined,
      moloni_document_number: latestInvoice.moloni_document_number ? String(latestInvoice.moloni_document_number) : undefined,
      total_value: Number(latestInvoice.total_value || 0),
      status: latestInvoice.status,
      created_at: latestInvoice.created_at,
      hasReceipt: !!latestInvoice.moloni_receipt_pdf,
    } : null,
    pendingInvoicesCount: clientStatements.filter((s: any) => !s.moloni_receipt_pdf && s.status !== "paid").length,
  }
}

export async function emitClientGuiaAction(data: {
  clientId?: string
  clientName?: string
  senderAddress?: string
  senderCity?: string
  senderPostal?: string
  senderPhone?: string
  recipientName: string
  recipientAddress: string
  recipientCity?: string
  recipientPostal?: string
  recipientCountry?: string
  recipientPhone?: string
  recipientEmail?: string
  weightKg: number
  volumesCount?: number
  serviceId?: string
  serviceName: string
  subProductId?: string
  webserviceConnectionId?: string
  calculatedPrice: number
  isReturn?: boolean
  selectedSpecialServices?: string[]
  codValue?: number
  lengthCm: number
  widthCm: number
  heightCm: number
  observations?: string
}) {
  let reservation: WalletReservation | undefined
  let submitted = false
  let confirmedRejection = false
  try {
    const ctx = await requireUser()

    const finalClientId = ctx.role === "client" ? ctx.client_id! : data.clientId

    if (finalClientId) {
      const { readPortalAccess } = await import("@/lib/client-portal/suspension")
      const access = await readPortalAccess(ctx.tenant_id, finalClientId).catch(() => null)
      if (access && (access.suspended || access.blocked)) {
        return {
          success: false,
          error: "A sua conta encontra-se suspensa para a criação de novos envios. Contacte geral@linke.pt para reativar.",
        }
      }
    }

    const supabase = createAdminClient()
    const trackingNumber = `LTK${Math.floor(1000000 + Math.random() * 900000)}`
    const shipmentId = crypto.randomUUID()
    const now = new Date().toISOString()

    // Portuguese postal code: "4610-001" → zip4="4610" (4-digit prefix), zip3="001" (3-digit extension)
    const senderZip4 = data.senderPostal?.split("-")[0] || ""
    const senderZip3 = data.senderPostal?.split("-")[1] || ""

    const recipientZip4 = data.recipientPostal?.split("-")[0] || ""
    const recipientZip3 = data.recipientPostal?.split("-")[1] || ""
    const validatedClientId = finalClientId

    // Server-side price recalculation — never trust the frontend value
    let computedSellPrice: number
    let computedBuyPrice = 0
    let computedSpecialAmount = 0
    let computedFuelAmount = 0
    let computedBasePrice: number
    let computedSpecialDesc: string | null = null
    let matchedClient: any = {}
    let carrierCode: "ctt" | "correos"
    try {
      validateShipmentPricingInput(data)
      const pricing = await loadShipmentPricingContext(supabase, ctx, finalClientId, data)
      matchedClient = pricing.client
      const chosenService = pricing.service
      carrierCode = resolveServiceCarrier(chosenService)
      if (!chosenService.webservice_service_code?.trim()) {
        throw new ShipmentPricingError("Serviço sem configuração de transportadora. Contacte o suporte.")
      }
      const recipientCountry = data.recipientCountry || "PT"
      const recipientPostal = data.recipientPostal || ""
      const priceResult = calculateShipmentPrice(
        data.weightKg,
        { ...matchedClient, default_linke_table_id: chosenService.id },
        [chosenService],
        recipientCountry,
        recipientPostal,
        { requireConfiguredTariff: true }
      )

      // Carrier routing and credentials come from the verified service, not the request.
      data = { ...data, serviceName: chosenService.name, subProductId: chosenService.webservice_service_code,
        webserviceConnectionId: chosenService.webservice_connection_id }

      computedSellPrice = priceResult.sellPrice
      computedBuyPrice = priceResult.buyPrice
      computedFuelAmount = priceResult.fuelSurchargeAmount
      computedBasePrice = priceResult.basePrice
      const specials = calculateShipmentSpecialFees(computedSellPrice, matchedClient, carrierCode,
        data.selectedSpecialServices, data.codValue)
      computedSellPrice = specials.totalPrice
      computedSpecialAmount = specials.amount
      computedSpecialDesc = specials.items.length > 0 ? JSON.stringify(specials.items) : null


    } catch (pricingErr) {
      return { success: false, error: pricingErr instanceof ShipmentPricingError || pricingErr instanceof ShipmentPricingUnavailableError
        ? pricingErr.message : "Não foi possível validar a tarifa. Tente novamente ou contacte o suporte." }
    }

    const shipmentData = {
      id: shipmentId,
      tenant_id: (await getTenantId()),
      client_id: validatedClientId,
      billing_type: "conta_corrente",
      tracking_number: trackingNumber,
      service_type: data.serviceName || "CTT Expresso 24H",
      status: "pendente",
      sender_name: ctx.role === "client" ? matchedClient.short_name || "Empresa Cliente" : (data.clientName || "Empresa Cliente"),
      sender_address: `${data.senderAddress || "Sede Comercial"}${data.senderCity ? `, ${data.senderCity}` : ""}`,
      sender_zip3: senderZip3,
      sender_zip4: senderZip4,
      recipient_name: data.recipientName,
      recipient_address: `${data.recipientAddress}${data.recipientCity ? `, ${data.recipientCity}` : ""}`,
      recipient_zip3: recipientZip3,
      recipient_zip4: recipientZip4,
      recipient_email: data.recipientEmail,
      recipient_phone: data.recipientPhone,
      sender_phone: data.senderPhone,
      base_price: computedBasePrice,
      fuel_tax_amount: computedFuelAmount,
      buy_price: computedBuyPrice,
      sell_price: computedSellPrice,
      reference: trackingNumber,
      special_fees_amount: computedSpecialAmount || 0,
      special_fees_description: computedSpecialDesc,
      cod_value: data.codValue || 0,
      length_cm: data.lengthCm,
      weight_kg: data.weightKg,
      package_count: data.volumesCount || 1,
      width_cm: data.widthCm,
      height_cm: data.heightCm,
      created_at: now,
      updated_at: now,
    }

    reservation = await reserveWallet(supabase, ctx.tenant_id, matchedClient.id, shipmentId, computedSellPrice, trackingNumber)
    shipmentData.billing_type = reservation.reserved ? 'pay_as_you_go' : 'conta_corrente'

    // ─── STEP 1: Call carrier API — only write to DB if carrier accepts ──────────
    let realGuia = trackingNumber
    let labelBase64: string | null = null
    let cttCloseData: (CTTShipment2Close & { shipmentId: string; connectionId?: string }) | undefined

    if (carrierCode === "correos") {
      // ── CORREOS EXPRESS ──────────────────────────────────────────────────────────
      try {
        const cleanPostal = (zip?: string) => (zip || "").trim()
        const creds = await resolveCorreosCredentials(data.webserviceConnectionId)
        const correosService = new CorreosShipmentService()
        await transitionWallet(supabase, reservation, 'reserved', 'submitted')
        submitted = true
        const result = await correosService.createShipment(creds, {
          ref: trackingNumber,
          fecha: new Date().toLocaleDateString("pt-PT").replace(/\//g, ""),
          remitente: {
            nombre: shipmentData.sender_name,
            direccion: data.senderAddress || "Sede Comercial",
            poblacion: data.senderCity || "Portugal",
            cpNacional: "",
            cpInternacional: cleanPostal(data.senderPostal || "4000-001"),
            paisISO: "PT",
            contacto: shipmentData.sender_name,
            telefono: data.senderPhone || "910000000"
          },
          destinatario: {
            nombre: data.recipientName,
            direccion: data.recipientAddress,
            poblacion: data.recipientCity || "Portugal",
            cpNacional: "",
            cpInternacional: cleanPostal(data.recipientPostal || "1000-001"),
            paisISO: "PT",
            contacto: data.recipientName,
            telefono: data.recipientPhone || "920000000",
            email: data.recipientEmail
          },
          bultos: data.volumesCount || 1,
          kilos: data.weightKg || 1,
          producto: data.subProductId || "63",
          portes: "P",
          reembolso: data.selectedSpecialServices?.includes("correos_cod") && data.codValue ? data.codValue.toString() : "",
          entrSabado: data.selectedSpecialServices?.includes("correos_saturday") ? "S" : undefined,
          seguro: data.selectedSpecialServices?.includes("correos_insurance") ? "1" : undefined,
          observaciones: [
            data.selectedSpecialServices?.includes("correos_fragil") ? "CUIDADO: FRÁGIL" : undefined,
            data.observations
          ].filter(Boolean).join(" | ").substring(0, 40) || undefined,
          tipoEtiqueta: "1"
        })

        // codigoRetorno === 0 = success; 404 with datosResultado = created but no label (sandbox warning)
        console.log("CORREOS PRODUCTION RESPONSE:", JSON.stringify(result, null, 2))
        if (result.codigoRetorno === 0 || (result.codigoRetorno === 404 && result.datosResultado)) {
          realGuia = result.datosResultado || trackingNumber
          let rawLabel = ""
          if (result.etiqueta && result.etiqueta.length > 0) {
            const firstEtiqueta = result.etiqueta[0]
            rawLabel = firstEtiqueta.etiqueta1 || Object.values(firstEtiqueta)[0] || ""
          }
          if (!rawLabel && result.listaInformacionAdicional && result.listaInformacionAdicional.length > 0) {
            rawLabel = result.listaInformacionAdicional[0].etiquetaPDF || ""
          }
          // Fallback mock label in test environment if test endpoint returns 404
          labelBase64 = rawLabel || (creds.environment === "test"
            ? "JVBERi0xLjcKCjEgMCBvYmogICUgZW50cnkgcG9pbnQKPDwKICAvVHlwZSAvQ2F0YWxvZwogIC9QYWdlcyAyIDAgUgo+PgplbmRvYmoKCjIgMCBvYmoKPDwKICAvVHlwZSAvUGFnZXMKICAvTWVkaWFCb3ggWyAwIDAgNDAwIDIwMCBdCiAgL0NvdW50IDEKICAvS2lkcyBbIDMgMCBSIF0KPj4KZW5kb2JqCgozIDAgb2JqCjw8CiAgL1R5cGUgL1BhZ2UKICAvUGFyZW50IDIgMCBSCiAgL1Jlc291cmNlcyA8PAogICAgL0ZvbnQgPDwKICAgICAgL0YxIDQgMCBSCiAgICA+PgogID4+CiAgL0NvbnRlbnRzIDUgMCBSCj4+CmVuZG9iagoKNCAwIG9iago8PAogIC9UeXBlIC9Gb250CiAgL1N1YnR5cGUgL1R5cGUxCiAgL0Jhc2VGb250IC9UaW1lcy1Sb21hbgo+PgplbmRvYmoKCjUgMCBvYmogICUgcGFnZSBjb250ZW50Cjw8CiAgL0xlbmd0aCA4MAo+PgpzdHJlYW0KQlQKNTAgMTAwIFRECi9GMSAyNCBUZgooRXRpcXVldGEgQ29ycmVvcyBUZXN0ZSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNzkgMDAwMDAgbiAKMDAwMDAwMDE3MyAwMDAwMCBuIAowMDAwMDAwMzAwIDAwMDAwIG4gCjAwMDAwMDAzODggMDAwMDAgbiAKdHJhaWxlcgo8PAogIC9TaXplIDYKICAvUm9vdCAxIDAgUgo+PgpzdGFydHhyZWYKNTM2CiUlRU9GCg=="
            : null)

          if (labelBase64) {
            labelBase64 = await applyLinkeLogoToCorreosLabel(labelBase64)
          }
        } else {
          confirmedRejection = typeof result.codigoRetorno === 'number' && result.codigoRetorno !== 0 && !result.datosResultado
          throw new Error(`Correos Express: ${result.mensajeRetorno || "Erro desconhecido"} (Código ${result.codigoRetorno})`)
        }
      } catch (e: any) {
        throw new Error("Erro Correos Express: " + (e?.message || "Tente novamente."))
      }

    } else if (carrierCode === "ctt") {
      // ── CTT EXPRESSO ─────────────────────────────────────────────────────────────
      try {
        const cttCreds = await resolveCttCredentials(data.webserviceConnectionId)
        const cttProvider = new CttProvider()
        await cttProvider.initialize(cttCreds)

        const obsLines: string[] = []
        if (data.selectedSpecialServices?.includes("fragil")) obsLines.push("CUIDADO: FRÁGIL")
        if (data.selectedSpecialServices?.includes("cod") && data.codValue) obsLines.push(`COBRANÇA: ${data.codValue.toFixed(2)}€`)
        if (data.selectedSpecialServices?.includes("auth_return")) obsLines.push("LOGÍSTICA INVERSA")
        if (data.observations) obsLines.push(data.observations)
        const observations = obsLines.length > 0 ? obsLines.join(" | ").substring(0, 40) : undefined

        await transitionWallet(supabase, reservation, 'reserved', 'submitted')
        submitted = true
        const cttResult = await cttProvider.createShipment({
          reference: trackingNumber,
          sender: {
            name: shipmentData.sender_name,
            address: data.senderAddress || "Sede Comercial",
            city: data.senderCity || "Portugal",
            zip: data.senderPostal || "1000-001",
            phone: data.senderPhone || "910000000",
            country: "PT"
          },
          recipient: {
            name: data.recipientName,
            address: data.recipientAddress,
            city: data.recipientCity || "Portugal",
            zip: data.recipientPostal || "1000-001",
            phone: data.recipientPhone || "920000000",
            email: data.recipientEmail,
            country: "PT"
          },
          weightKg: data.weightKg || 1,
          volumes: data.volumesCount || 1,
          subProduct: data.subProductId || "EMSF056.01",
          codValue: data.selectedSpecialServices?.includes("cod") ? data.codValue : 0,
          isReturn: data.isReturn,
          observations,
          autoClose: false
        })

        if (!cttResult.success) {
          confirmedRejection = cttResult.confirmedRejection === true
          const raw = cttResult.error || ""
          console.error("[CTT] Raw error:", raw)
          // Show exact CTT error — prefix with [CTT] so it's clear but not hidden
          throw new Error(raw || "Os CTT não devolveram uma resposta válida. Verifique o terminal do servidor.")
        }

        realGuia = cttResult.trackingNumber || trackingNumber
        const emitted = (cttResult.rawResponse as CTTCompleteShipmentOutput | undefined)?.ShipmentData?.[0]
        if (emitted?.FirstObject && emitted.LastObject) {
          cttCloseData = {
            shipmentId,
            connectionId: data.webserviceConnectionId,
            FirstObjectCode: emitted.FirstObject,
            LastObjectCode: emitted.LastObject,
            SubProductCode: data.subProductId || "EMSF056.01",
          }
        }
        const rawZpl = cttResult.labelBase64 || ""
        labelBase64 = rawZpl ? await convertZplToPdfBase64(rawZpl) : null
      } catch (e: any) {
        if (e.message?.includes("rejeitaram") || e.message?.includes("inválido") || e.message?.includes("suportado")) {
          throw e
        }
        throw new Error("Erro de ligação aos CTT: " + (e?.message || "Tente novamente."))
      }
    }

    await transitionWallet(supabase, reservation, submitted ? 'submitted' : 'reserved', 'consumed', {
      shipment: shipmentData, carrier_tracking_number: realGuia, carrier_code: carrierCode,
      label_base64: labelBase64, ctt_close_data: cttCloseData || null,
    })

    let dbErrorMessage: string | null = null

    // ─── STEP 2: CTT accepted — now write to DB ─────────────────────────────────
    // Insert into shipments table (only valid table columns to prevent silent schema rejection)
    try {
      if (shipmentData.recipient_name === "ERRO_TESTE") {
        throw new Error("Erro Simulado de Base de Dados (Teste de Resiliência)!")
      }

      const shipmentRow = {
        id: shipmentId,
        tenant_id: shipmentData.tenant_id,
        client_id: shipmentData.client_id,
        tracking_number: trackingNumber,
        carrier_tracking_number: realGuia,
        carrier_code: carrierCode,
        service_type: shipmentData.service_type,
        status: "pendente",
        ops_substatus: null,
        sender_name: shipmentData.sender_name,
        sender_address: shipmentData.sender_address,
        sender_zip3: shipmentData.sender_zip3,
        sender_zip4: shipmentData.sender_zip4,
        recipient_name: shipmentData.recipient_name,
        recipient_address: shipmentData.recipient_address,
        recipient_zip3: shipmentData.recipient_zip3,
        recipient_zip4: shipmentData.recipient_zip4,
        recipient_email: shipmentData.recipient_email,
        recipient_phone: shipmentData.recipient_phone,
        sender_phone: shipmentData.sender_phone,
        buy_price: shipmentData.buy_price,
        sell_price: shipmentData.sell_price,
        created_at: shipmentData.created_at,
        updated_at: shipmentData.updated_at,
      }

      const { error } = await supabase
        .from("shipments")
        .insert(shipmentRow)

      if (error) {
        console.warn("DB shipments insert note:", error.message)
        dbErrorMessage = error.message
      }
      
      // Dual-write to audit_log to persist full JSON including labelBase64
      await supabase.from("audit_log").insert({
        tenant_id: shipmentData.tenant_id,
        action: "shipment_data",
        details: {
          ...shipmentData,
          id: shipmentId,
          ctt_label_base64: labelBase64,
          ctt_close_data: cttCloseData,
          carrier_tracking_number: realGuia,
          carrier_code: carrierCode
        },
        created_at: now
      })
    } catch (err: any) {
      console.warn("Error inserting into DB:", err?.message)
      if (!dbErrorMessage) dbErrorMessage = err?.message || "Unknown DB Error"
    }

    // Insert package record
    try {
      const { error: packageError } = await supabase.from("packages").insert({
        tenant_id: (await getTenantId()),
        shipment_id: shipmentId,
        weight_g: Math.round(data.weightKg * 1000),
        dimensions: { length_cm: data.lengthCm, width_cm: data.widthCm, height_cm: data.heightCm, unit: 'cm' },
      })
      if (packageError) {
        console.warn('Declared parcel dimensions could not be saved in packages:', packageError.message)
        if (!dbErrorMessage) dbErrorMessage = 'O envio foi aceite pela transportadora; verifique a gravação do volume antes de repetir qualquer emissão.'
      }
    } catch {
      if (!dbErrorMessage) dbErrorMessage = 'O envio foi aceite pela transportadora; a gravação do volume ficou por confirmar. Não repita a emissão.'
    }

    // Wallet consumption is represented by the shipment and its reservation, never a second decrement.
    if (reservation.reserved && (reservation.balanceBefore ?? 0) >= 15 && matchedClient.email) {
      try {
        const after = await walletSnapshot(supabase, ctx.tenant_id, matchedClient.id)
        if (after.balance < 15) {
          const { sendEmail, compileTemplate } = await import("@/lib/email/resend")
          const { emailTemplates } = await import("@/app/ops/configuracao/notificacoes/templates")
          void sendEmail({ to: matchedClient.email, subject: "Linke | Aviso de Saldo Baixo",
            html: compileTemplate(emailTemplates.low_balance, { current_balance: after.balance.toFixed(2), topup_url: publicUrl("/app", "portal") })
          }).catch(error => console.warn("Low balance email pending", error))
        }
      } catch (error) { console.warn("Low balance notification pending", error) }
    }

    // ─── STEP 4: Send Tracking Email Notification ───────────────────────────────
    if (data.recipientEmail && !dbErrorMessage) {
      try {
        const { sendTrackingEmailNotification } = await import("@/lib/email/tracking-notifications")
        // Run in background without awaiting to prevent UI blocking or timeout
        sendTrackingEmailNotification(shipmentId, "tracking", {
          shipment: {
            ...shipmentData,
            id: shipmentId,
            recipient_email: data.recipientEmail,
            carrier_tracking_number: realGuia,
            carrier_code: carrierCode
          }
        }).catch(err => {
          console.warn("Failed to trigger tracking email in background:", err)
        })
      } catch (err) {
        console.warn("Failed to trigger tracking email on creation:", err)
      }
    }

    try {
      revalidatePath("/app", "layout")
      revalidatePath("/app/[storeSlug]/criar-guia", "page")
      revalidatePath("/app/[storeSlug]/envios", "page")
      revalidatePath("/ops/envios")
      revalidatePath("/ops")
    } catch {}

    return {
      success: true,
      guia: realGuia,
      id: shipmentId,
      labelBase64,
      cttError: null,
      sellPrice: computedSellPrice,
      dbWarning: dbErrorMessage
    }
  } catch (err: any) {
    console.error("emitClientGuiaAction error:", err)
    if (reservation?.reserved && (!submitted || confirmedRejection)) {
      try { await transitionWallet(createAdminClient(), reservation, submitted ? 'submitted' : 'reserved', 'released') }
      catch { return { success: false, error: `O pedido ${reservation.shipment} ficou por confirmar. Não repita antes de verificar o saldo e a transportadora.` } }
    }
    if (reservation?.reserved && submitted && !confirmedRejection) {
      return { success: false, error: `O resultado do pedido ${reservation.shipment} ficou por confirmar. O saldo permanece reservado; confirme na transportadora antes de repetir. ${err.message || ''}` }
    }
    return {
      success: false,
      error: err.message || "Erro interno ao criar envio.",
    }
  }
}

/**
 * Re-solicita e regenera a etiqueta oficial CTT a partir dos Web Services CTT
 */
export async function regenerateCttLabelAction(shipmentId: string) {
  
  await requireEmployee()

  const supabase = createAdminClient()
  
  // Encontrar o envio
  const { data: dbShipments } = await supabase.from("shipments").select("*").or(`id.eq.${shipmentId},tracking_number.eq.${shipmentId}`).limit(1)
  const shipment = dbShipments?.[0]

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

  const cttCreds2 = await resolveCttCredentials()
  const cttProvider2 = new CttProvider()
  await cttProvider2.initialize(cttCreds2)
  const cttRes = await cttProvider2.createShipment({
    reference: shipment.tracking_number || shipment.id.substring(0, 8).toUpperCase(),
    sender: {
      name: shipment.sender_name || "Remetente",
      address: shipment.sender_address || "Sede Comercial",
      city: shipment.sender_city || "Portugal",
      zip: senderZip,
      phone: shipment.sender_phone || "910000000",
      email: shipment.sender_email,
      country: "PT"
    },
    recipient: {
      name: shipment.recipient_name || "Destinatário",
      address: shipment.recipient_address || "Morada de Entrega",
      city: shipment.recipient_city || "Portugal",
      zip: recipientZip,
      phone: shipment.recipient_phone || "920000000",
      email: shipment.recipient_email,
      country: "PT"
    },
    weightKg: Number(shipment.weight_kg) || 1,
    volumes: Number(shipment.volumes_count) || 1,
    subProduct: shipment.service_type || "EMSF056.01",
    autoClose: false
  })

  if (cttRes.success && cttRes.labelBase64) {
    const updatedGuia = cttRes.trackingNumber || shipment.tracking_number

    try {
      await supabase.from("shipments").update({
        // Keep tracking_number as the internal LTK ref — only update the carrier (CTT EQ) number
        carrier_tracking_number: updatedGuia,
        updated_at: new Date().toISOString(),
      }).eq("id", shipment.id)
    } catch {}

    try {
      const { data: existingLogs } = await supabase
        .from("audit_log")
        .select("id, details")
        .eq("action", "shipment_data")
      
      const targetLog = existingLogs?.find((l: any) => l.details?.id === shipment.id)
      if (targetLog) {
        await supabase.from("audit_log").update({
          details: {
            ...targetLog.details,
            id: shipment.id,
            tracking_number: updatedGuia,
            ctt_object_id: updatedGuia,
            carrier_tracking_number: updatedGuia,
            ctt_label_base64: cttRes.labelBase64,
            updated_at: new Date().toISOString(),
          }
        }).eq("id", targetLog.id)
      }
    } catch {}
  }

  try {
    revalidatePath("/app", "layout")
    revalidatePath("/app/[storeSlug]/envios", "page")
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

/**
 * Atualiza o estado de um envio de forma atómica e sincronizada no TMS Linke
 */
export async function updateShipmentStatusAction(
  shipmentId: string,
  newStatus: "pendente" | "em_transito" | "em_distribuicao" | "entregue" | "incidencia" | "devolvido" | "cancelado",
  reason?: string,
  location?: string
) {
  
  await requireEmployee()

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // 1. Update in shipments table
  try {
    await supabase
      .from("shipments")
      .update({
        status: newStatus,
        updated_at: now,
      })
      .eq("id", shipmentId)
  } catch (err: any) {
    console.warn("Could not update status in shipments table:", err?.message)
  }

  // 2. Dual-write in audit_log
  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "shipment_data")

    if (logs) {
      for (const item of logs) {
        if (item.details?.id === shipmentId || item.details?.tracking_number === shipmentId) {
          await supabase
            .from("audit_log")
            .update({
              details: {
                ...item.details,
                status: newStatus,
                status_reason: reason || item.details?.status_reason,
                status_location: location || item.details?.status_location,
                updated_at: now,
              },
            })
            .eq("id", item.id)
        }
      }
    }
  } catch (err: any) {
    console.warn("Could not update status in audit_log:", err?.message)
  }

  // 3. Insert tracking event in tracking_events table
  try {
    const eventCode = 
      newStatus === "entregue" ? "EMI" :
      newStatus === "em_distribuicao" ? "EMZ" :
      newStatus === "incidencia" ? "EMH" :
      newStatus === "em_transito" ? "EMF" :
      newStatus === "devolvido" ? "EMM" : "EMA"

    const eventDesc = reason 
      ? `Estado alterado para ${newStatus} (${reason})` 
      : `Estado atualizado para ${newStatus}`

    await supabase.from("tracking_events").insert({
      tenant_id: (await getTenantId()),
      shipment_id: shipmentId,
      event_code: eventCode,
      description: eventDesc,
      created_at: now,
    })
  } catch {}

  revalidatePath("/ops/envios")
  revalidatePath("/ops")
  revalidatePath("/app", "layout")
  revalidatePath("/app/[storeSlug]/envios", "page")

  return { success: true, status: newStatus }
}

/**
 * Obtém a timeline completa de eventos de rastreio e pickagens de um envio
 */
type TimelineShipment = {
  id: string
  client_id?: string | null
  carrier_code?: string | null
  service_type?: string | null
  carrier_tracking_number?: string | null
  tracking_number?: string | null
  ctt_object_id?: string | null
  reference?: string | null
}

type PrivateTimelineScope = {
  tenantId: string
  clientId?: string
  shipment: TimelineShipment
}

async function loadShipmentTrackingTimeline(
  shipmentId: string,
  trackingNumber?: string,
  scope?: PrivateTimelineScope
) {
  const supabase = createAdminClient()
  const events: any[] = []

  // Private callers reuse the authorized record instead of repeating its lookup.
  let eventsQuery = supabase.from("tracking_events").select("*").eq("shipment_id", shipmentId)
  if (scope) eventsQuery = eventsQuery.eq("tenant_id", scope.tenantId)
  const [sRowResult, dbEventsResult] = await Promise.all([
    scope ? Promise.resolve({ data: scope.shipment }) : supabase
      .from("shipments")
      .select("carrier_code, service_type, carrier_tracking_number, tracking_number")
      .eq("id", shipmentId)
      .maybeSingle(),
    eventsQuery.order("created_at", { ascending: true })
  ])

  let isCorreos = false
  if (sRowResult.data) {
    isCorreos = isCorreosShipment(sRowResult.data)
  } else if (trackingNumber && /^\d{16}$/.test(trackingNumber.trim())) {
    isCorreos = true
  }

  // 1. Process dbEvents
  try {
    const dbEvents = dbEventsResult.data
    const error = dbEventsResult.error

    if (!error && dbEvents && dbEvents.length > 0) {
      dbEvents.forEach((ev: any) => {
        const evDesc = ev.description || ""
        const evIsCorreos = isCorreos || evDesc.includes("Correos") || /^\d+$/.test(ev.event_code || "")

        if (evIsCorreos) {
          const mapped = mapCorreosStatus(ev.event_code, evDesc)
          events.push({
            id: ev.id,
            eventCode: ev.event_code || "CORREOS",
            eventName: ev.event_name || mapped.eventName,
            description: evDesc || "Evento registado na rede Correos Express",
            location: ev.location || "Rede Correos Express",
            timestamp: ev.timestamp || ev.created_at,
            tmsStatus: mapped.displayStatus,
            isTerminal: mapped.isTerminal,
            isIncidencia: mapped.isIncidencia,
          })
        } else {
          const cttInfo = CTT_TRACKING_EVENTS[ev.event_code]
          const isIncidencia = CTT_INCIDENT_CODES.has(ev.event_code)
          events.push({
            id: ev.id,
            eventCode: ev.event_code || "EMA",
            eventName: cttInfo?.description || ev.event_name || (
              ev.event_code === "EMI" ? "Entrega Conseguida" :
              ev.event_code === "EMZ" ? "Em Distribuição (Com o Estafeta)" :
              ev.event_code === "EMH" ? "Entrega Não Conseguida (Incidência)" :
              ev.event_code === "EMF" ? "Expedição Nacional" : "Aceitação CTT"
            ),
            description: evDesc || "Evento registado na rede CTT",
            location: ev.location || "Rede CTT Expresso",
            timestamp: ev.timestamp || ev.created_at,
            tmsStatus: cttInfo?.tms_status || (
                       ev.event_code === "EMI" ? "entregue" :
                       ev.event_code === "EMZ" ? "em_distribuicao" :
                       ev.event_code === "EMH" ? "incidencia" : "em_transito"),
            isTerminal: cttInfo?.is_terminal ?? (ev.event_code === "EMI" || ev.event_code === "EMM"),
            isIncidencia,
          })
        }
      })
    }
  } catch (err: any) {
    console.warn("Could not load tracking_events from table:", err?.message)
  }

  // 1b. Se não encontrou eventos pelo shipment_id, tenta pelo carrier_tracking_number (EQ... ou 16 dígitos)
  if (events.length === 0 && trackingNumber && /^[A-Za-z0-9-]{1,80}$/.test(trackingNumber)) {
    try {
      let linkedQuery = supabase
        .from("shipments")
        .select("id, carrier_code, service_type")
      // Never interpolate an arbitrary reference into PostgREST filter syntax.
      linkedQuery = linkedQuery.or(`carrier_tracking_number.eq.${trackingNumber},tracking_number.eq.${trackingNumber}`)
      if (scope) {
        linkedQuery = linkedQuery.eq("tenant_id", scope.tenantId)
        if (scope.clientId) linkedQuery = linkedQuery.eq("client_id", scope.clientId)
        // Staff may view multiple stores, but an individual timeline stays in its store.
        else if (scope.shipment.client_id) linkedQuery = linkedQuery.eq("client_id", scope.shipment.client_id)
        else linkedQuery = linkedQuery.eq("id", shipmentId)
      }
      const { data: linkedShipments } = await linkedQuery.limit(1)

      if (linkedShipments && linkedShipments.length > 0) {
        const linkedShipment = linkedShipments[0]
        const linkedId = linkedShipment.id
        const linkedIsCorreos = isCorreosShipment(linkedShipment) || /^\d{16}$/.test(trackingNumber.trim())

        let linkedEventsQuery = supabase
          .from("tracking_events")
          .select("*")
          .eq("shipment_id", linkedId)
        if (scope) linkedEventsQuery = linkedEventsQuery.eq("tenant_id", scope.tenantId)
        const { data: linkedEvents, error: evtErr } = await linkedEventsQuery.order("created_at", { ascending: true })

        if (!evtErr && linkedEvents && linkedEvents.length > 0) {
          linkedEvents.forEach((ev: any) => {
            const evDesc = ev.description || ""
            const evIsCorreos = linkedIsCorreos || evDesc.includes("Correos") || /^\d+$/.test(ev.event_code || "")

            if (evIsCorreos) {
              const mapped = mapCorreosStatus(ev.event_code, evDesc)
              events.push({
                id: ev.id,
                eventCode: ev.event_code || "CORREOS",
                eventName: ev.event_name || mapped.eventName,
                description: evDesc || "Evento registado na rede Correos Express",
                location: ev.location || "Rede Correos Express",
                timestamp: ev.timestamp || ev.created_at,
                tmsStatus: mapped.displayStatus,
                isTerminal: mapped.isTerminal,
                isIncidencia: mapped.isIncidencia,
              })
            } else {
              const cttInfo = CTT_TRACKING_EVENTS[ev.event_code]
              const isIncidencia = CTT_INCIDENT_CODES.has(ev.event_code)
              events.push({
                id: ev.id,
                eventCode: ev.event_code || "EMA",
                eventName: cttInfo?.description || ev.event_name || (
                  ev.event_code === "EMI" ? "Entrega Conseguida" :
                  ev.event_code === "EMZ" ? "Em Distribuição (Com o Estafeta)" :
                  ev.event_code === "EMH" ? "Entrega Não Conseguida (Incidência)" :
                  ev.event_code === "EMF" ? "Expedição Nacional" : "Aceitação CTT"
                ),
                description: evDesc || "Evento registado na rede CTT",
                location: ev.location || "Rede CTT Expresso",
                timestamp: ev.timestamp || ev.created_at,
                tmsStatus: cttInfo?.tms_status || (
                           ev.event_code === "EMI" ? "entregue" :
                           ev.event_code === "EMZ" ? "em_distribuicao" :
                           ev.event_code === "EMH" ? "incidencia" : "em_transito"),
                isTerminal: cttInfo?.is_terminal ?? (ev.event_code === "EMI" || ev.event_code === "EMM"),
                isIncidencia,
              })
            }
          })
        }
      }
    } catch (err: any) {
      console.warn("Could not load tracking_events by carrier_tracking_number:", err?.message)
    }
  }

  // 2. Se ainda não existirem eventos na tabela tracking_events, verificar no audit_log
  if (events.length === 0) {
    try {
      let auditQuery = supabase
        .from("audit_log")
        .select("*")
        .eq("entity_id", shipmentId)
      if (scope) auditQuery = auditQuery.eq("tenant_id", scope.tenantId)
      const { data: auditEvents } = await auditQuery.order("created_at", { ascending: true })

      if (auditEvents && auditEvents.length > 0) {
        auditEvents.forEach((log: any) => {
          const d = log.details || {}
          if (d.eventCode || d.status) {
            const evIsCorreos = isCorreos || (d.carrierCode === "correos") || (d.carrier === "correos")
            if (evIsCorreos) {
              const mapped = mapCorreosStatus(d.eventCode, d.description || d.eventName)
              events.push({
                id: log.id,
                eventCode: d.eventCode || "CORREOS",
                eventName: d.eventName || mapped.eventName,
                description: d.description || "Evento registado",
                location: d.location || "Rede Correos Express",
                timestamp: d.timestamp || log.created_at,
                tmsStatus: mapped.displayStatus || d.status || "em_transito",
                isTerminal: mapped.isTerminal,
                isIncidencia: Boolean(mapped.isIncidencia),
              })
            } else {
              const code = d.eventCode || (d.status === "entregue" ? "EMI" : d.status === "em_distribuicao" ? "EMZ" : "EMA")
              const cttInfo = CTT_TRACKING_EVENTS[code]
              const isIncidencia = CTT_INCIDENT_CODES.has(code)
              events.push({
                id: log.id,
                eventCode: code,
                eventName: cttInfo?.description || d.eventName || (isIncidencia ? "Incidência de Entrega" : "Atualização de Estado"),
                description: d.description || (d.reasonDesc ? `Razão: ${d.reasonDesc}` : "Evento registado"),
                location: d.location || "Rede CTT Expresso",
                timestamp: d.timestamp || log.created_at,
                tmsStatus: cttInfo?.tms_status || d.status || "em_transito",
                isTerminal: cttInfo?.is_terminal || false,
                isIncidencia: Boolean(isIncidencia),
              })
            }
          }
        })
      }
    } catch (auditErr: any) {
      console.warn("Could not load audit_log fallback:", auditErr?.message)
    }
  }

  return events
}

export async function getShipmentTrackingTimelineAction(shipmentId: string, trackingNumber?: string) {
  const ctx = await requireUser()
  const denied = () => new Error("Acesso negado ao rastreio deste envio.")
  if (!ctx.tenant_id || !["client", "employee", "admin"].includes(ctx.role || "") ||
      (ctx.role === "client" && !ctx.client_id) || !isValidUuid(shipmentId) ||
      (trackingNumber !== undefined && typeof trackingNumber !== "string")) throw denied()

  const supabase = createAdminClient()
  const clientId = ctx.role === "client" ? ctx.client_id! : undefined
  const query = supabase.from("shipments")
    .select("id, client_id, carrier_code, service_type, carrier_tracking_number, tracking_number")
    .eq("id", shipmentId).eq("tenant_id", ctx.tenant_id)
  const { data, error } = await query.maybeSingle()
  // A failed authorization lookup must never fall back to stale ownership.
  if (error) throw denied()
  let shipment: TimelineShipment | null = data
  // An existing row is authoritative; old audit data cannot override its owner.
  if (shipment && clientId && shipment.client_id !== clientId) throw denied()
  if (!shipment) {
    const auditQuery = supabase.from("audit_log").select("details")
      .eq("tenant_id", ctx.tenant_id).eq("action", "shipment_data").eq("details->>id", shipmentId)
    // Check the latest snapshot's owner; filtering by owner first could select stale access.
    const { data: audit, error: auditError } = await auditQuery.order("created_at", { ascending: false }).limit(1).maybeSingle()
    if (auditError) throw denied()
    shipment = audit?.details || null
  }
  if (!shipment || shipment.id !== shipmentId || (clientId && shipment.client_id !== clientId)) throw denied()

  const references = [shipment.carrier_tracking_number, shipment.ctt_object_id, shipment.tracking_number, shipment.reference]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
  const submitted = trackingNumber?.trim()
  if (submitted && !references.includes(submitted)) throw denied()
  // Every fallback uses the stored reference, never the caller's unverified input.
  return loadShipmentTrackingTimeline(shipment.id, references[0], {
    tenantId: ctx.tenant_id, clientId, shipment,
  })
}

/**
 * Sincroniza o tracking de um envio individual (Correos Express ou CTT Expresso)
 */
export async function syncShipmentTrackingAction(trackingNumber: string, shipmentId?: string) {
  const ctx = await requireUser()
  const res = await syncShipmentTracking(
    { trackingNumber, shipmentId },
    {
      skipAuth: ctx.role !== "client",
      userRole: ctx.role,
      clientId: ctx.client_id,
      tenantId: ctx.tenant_id,
    }
  )

  revalidatePath("/ops/envios")
  revalidatePath("/ops")
  revalidatePath("/app/[storeSlug]/envios", "page")

  return res
}

/**
 * Sincroniza todos os envios ativos em lote (Correos Express e CTT Expresso)
 */
export async function syncAllActiveShipmentsTrackingAction() {
  await requireEmployee()

  const supabase = createAdminClient()
  const { data: activeShipments } = await supabase
    .from("shipments")
    .select("id")
    .not("status", "in", '("entregue","cancelado","devolvido")')

  if (!activeShipments || activeShipments.length === 0) {
    return { success: true, count: 0, errors: [] }
  }

  const allIds = activeShipments.map((s: any) => s.id)
  
  // Use existing batch logic for every chunk of 50
  let totalUpdated = 0
  for (let i = 0; i < allIds.length; i += 50) {
    const chunkIds = allIds.slice(i, i + 50)
    const res = await syncActiveShipmentsBatchAction(chunkIds)
    totalUpdated += res.updatedCount
  }

  return { success: true, count: totalUpdated, errors: [] }
}

/**
 * Sincroniza em segundo plano uma lista de envios visíveis ativos (sem bloquear a página)
 */
export async function syncActiveShipmentsBatchAction(shipmentIds: string[]) {
  const ctx = await requireUser()
  const result = await syncAuthorizedShipmentBatch(ctx, shipmentIds)
  if (result.updatedCount > 0) {
    revalidatePath("/ops/envios")
    revalidatePath("/ops")
    revalidatePath("/app", "layout")
    revalidatePath("/app/[storeSlug]/envios", "page")
  }
  return result
}


/**
 * Elimina um envio da base de dados e registos associados
 */
export async function deleteShipmentAction(shipmentId: string) {
  return deleteShipment(shipmentId)
}

/**
 * Cria um envio de devolução (inverte Remetente e Destinatário)
 */
export async function createReturnShipmentAction(originalShipmentId: string, reason?: string) {
  
  const ctx = await requireUser()

  const supabase = createAdminClient()
  try {
    // 1. Obter dados do envio original
    const { data: dbShipments } = await supabase.from("shipments").select("*").or(`id.eq.${originalShipmentId},tracking_number.eq.${originalShipmentId}`).limit(1)
    const original = dbShipments?.[0]
    
    if (!original) {
      return { success: false, error: "Envio original não encontrado." }
    }

    if (ctx.role === "client" && original.client_id !== ctx.client_id) {
      return { success: false, error: "Não autorizado. Envio não pertence à sua conta." }
    }

    const newShipmentId = crypto.randomUUID()
    const newTrackingNumber = `LTK${Math.floor(1000000 + Math.random() * 900000)}`
    const now = new Date().toISOString()

    // Inverter remetente e destinatário
    const returnShipmentData = {
      id: newShipmentId,
      tenant_id: original.tenant_id || (await getTenantId()),
      client_id: original.client_id,
      tracking_number: newTrackingNumber,
      service_type: original.service_type || "Linke Expresso 24H",
      status: "pendente",
      
      // Remetente passa a ser o antigo Destinatário
      sender_name: original.recipient_name || "Cliente Final",
      sender_address: original.recipient_address || "",
      sender_zip3: original.recipient_zip3 || "",
      sender_zip4: original.recipient_zip4 || "",
      sender_phone: original.recipient_phone || "",
      sender_contact_email: original.recipient_contact_email || original.recipient_email || "",
      
      // Destinatário passa a ser o Remetente original (armazém/sede)
      recipient_name: original.sender_name || "Armazém Linke",
      recipient_address: original.sender_address || "",
      recipient_zip3: original.sender_zip3 || "",
      recipient_zip4: original.sender_zip4 || "",
      recipient_phone: original.sender_phone || "",
      recipient_contact_email: original.sender_contact_email || original.sender_email || "",

      buy_price: original.buy_price || 2.85,
      sell_price: original.sell_price || 4.37,
      created_at: now,
      updated_at: now,
    }

    // Inserir na tabela shipments
    await supabase.from("shipments").insert(returnShipmentData)



    // Inserir evento de rastreio inicial da devolução
    await supabase.from("tracking_events").insert({
      shipment_id: newShipmentId,
      event_code: "EMA",
      event_name: "Guia de Devolução Emitida",
      description: `Guia de devolução registada para recolha no remetente (referente à guia original ${original.tracking_number || original.id}).`,
      location: original.recipient_address?.split(",")?.[0] || "Destino Inicial",
      timestamp: now,
    })

    // Atualizar estado do envio original para 'devolvido'
    try {
      await updateShipmentStatusAction(original.id, "devolvido")
    } catch {}

    revalidatePath("/ops/envios")
    revalidatePath("/app/[storeSlug]/envios", "page")
    revalidatePath("/ops")
    revalidatePath("/app", "layout")

    return { 
      success: true, 
      newTrackingNumber, 
      returnShipment: returnShipmentData 
    }
  } catch (err: any) {
    console.error("Erro ao criar devolução:", err)
    return { success: false, error: err?.message || "Erro desconhecido ao criar devolução" }
  }
}

/**
 * Obtém informações públicas seguras de rastreio para partilha com clientes finais.
 * Integra dados unificados do TMS Linke com o rastreio da transportadora (CTT Expresso ou outro provider).
 */
export async function getPublicShipmentTrackingAction(trackingOrId: string) {
  const query = (trackingOrId || "").trim().toUpperCase()
  if (!query) return { success: false, error: "Por favor introduza um número de rastreio ou guia válido." }

  // Public lookups must be exact and bounded; never load every shipment or its labels.
  if (!/^[A-Z0-9-]{7,40}$/.test(query)) {
    return { success: false, error: "Referência de rastreio inválida." }
  }

  const supabase = createAdminClient()
  const dbFilters = [
    `tracking_number.eq.${query}`,
    `carrier_tracking_number.eq.${query}`,
    `ctt_object_id.eq.${query}`,
  ]
  if (isValidUuid(query)) dbFilters.push(`id.eq.${query.toLowerCase()}`)

  let { data: dbRow, error: dbError } = await supabase.from("shipment_metadata")
    .select("details").or(dbFilters.join(",")).limit(1).maybeSingle()
  if (dbError) {
    const fallback = await supabase.from("shipments")
      .select("id,client_id,tracking_number,carrier_tracking_number,carrier_code,ctt_object_id,status,service_type,recipient_name,recipient_address,sender_name,sender_address,created_at,updated_at,weight_kg")
      .or(dbFilters.join(",")).limit(1).maybeSingle()
    dbRow = fallback.data
    dbError = fallback.error
  }
  let shipment: any = dbError ? null : (dbRow?.details || dbRow)



  if (!shipment) {
    return { success: false, error: `Nenhum envio encontrado para a referência "${query}". Verifique o código e tente novamente.` }
  }

  // Obter eventos de rastreio reais — passa o carrier_tracking_number (EQ...) para o fallback
  const carrierTrkForLookup = shipment.carrier_tracking_number || shipment.ctt_object_id || shipment.tracking_number
  const events = await loadShipmentTrackingTimeline(shipment.id, carrierTrkForLookup)

  // Identificar dados do operador / carrier provider (ex: CTT Expresso)
  const carrierCode = shipment.carrier_name || shipment.carrier_code || "ctt"
  const linkeInternalRef = 
    (shipment.reference?.startsWith("LTK") ? shipment.reference : null) ||
    (shipment.tracking_number?.startsWith("LTK") ? shipment.tracking_number : null) ||
    shipment.reference ||
    shipment.tracking_number

  const carrierTrackingNumber = 
    shipment.carrier_tracking_number || 
    shipment.ctt_object_id || 
    (shipment.tracking_number !== linkeInternalRef ? shipment.tracking_number : null)

  const carrierDirectUrl = carrierCode.toLowerCase().includes("ctt") && carrierTrackingNumber
    ? `https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects=${encodeURIComponent(carrierTrackingNumber)}`
    : null

  // Obter localidade do destinatário de forma limpa
  const destinationCity = shipment.recipient_address?.split(",")?.[1]?.trim() || 
                          shipment.recipient_address?.split(",")?.[0]?.trim() || 
                          "Porto"
  
  const senderCity = shipment.sender_address?.split(",")?.[1]?.trim() || 
                     shipment.sender_address?.split(",")?.[0]?.trim() || 
                     "Lisboa"

  return {
    success: true,
    shipment: {
      id: shipment.id,
      trackingNumber: linkeInternalRef || shipment.id.substring(0, 8).toUpperCase(),
      serviceType: shipment.service_type || "CTT Expresso 24H",
      carrierName: carrierCode.toLowerCase().includes("correos") ? "Correos Express" : "CTT Expresso",
      carrierTrackingNumber: carrierTrackingNumber || null,
      carrierDirectUrl,
      status: ["entrada_rede", "recolhido"].includes(shipment.status) ? "em_transito" : (shipment.status || "pendente"),
      createdAt: shipment.created_at,
      updatedAt: shipment.updated_at,
      recipientName: shipment.recipient_name,
      destinationCity,
      senderName: shipment.sender_name,
      senderCity,
      packageCount: shipment.package_count || shipment.volumes_count || 1,
      weightKg: shipment.weight_kg || shipment.declared_weight || 1,
      deliveryDate: shipment.status === "entregue" ? shipment.updated_at : null,
    },
    timeline: events
  }
}





/**
 * Elimina vários envios em massa
 */
export async function deleteShipmentsBulkAction(shipmentIds: string[]) {
  return deleteShipmentsBulk(shipmentIds)
}

/**
 * Trata uma incidência operacional: reagendamento, correção de morada, devolução ou marcação como resolvida
 */
export async function resolveShipmentIncidentAction(params: {
  shipmentId: string
  actionType: "reagendar" | "morada" | "devolver" | "resolvido"
  scheduledDate?: string
  timeWindow?: string
  newAddress?: string
  newZipCode?: string
  newCity?: string
  newPhone?: string
  notes?: string
}) {
  await requireEmployee()
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { shipmentId, actionType, scheduledDate, timeWindow, newAddress, newZipCode, newCity, newPhone, notes } = params

  try {
    let newStatus: "em_distribuicao" | "em_transito" | "devolvido" | "entregue" = "em_distribuicao"
    let statusDescription = ""
    let eventCode = "EMZ"

    if (actionType === "reagendar") {
      newStatus = "em_distribuicao"
      statusDescription = `Reagendamento de entrega para ${scheduledDate || "data a definir"}${timeWindow ? ` (${timeWindow})` : ""}${notes ? `: ${notes}` : ""}`
      eventCode = "EMZ"
    } else if (actionType === "morada") {
      newStatus = "em_distribuicao"
      statusDescription = `Morada/contacto de entrega retificado${newAddress ? ` (${newAddress})` : ""}${notes ? `: ${notes}` : ""}`
      eventCode = "EMF"
    } else if (actionType === "devolver") {
      newStatus = "devolvido"
      statusDescription = `Devolução ao remetente autorizada${notes ? `: ${notes}` : ""}`
      eventCode = "EMM"
    } else {
      newStatus = "em_distribuicao"
      statusDescription = `Incidência resolvida operacionalmente${notes ? `: ${notes}` : ""}`
      eventCode = "EMF"
    }

    // 1. Atualizar na tabela shipments
    const updatePayload: any = {
      status: newStatus,
      ops_substatus: `Resolvido: ${actionType.toUpperCase()}`,
      updated_at: now
    }
    if (newAddress) updatePayload.recipient_address = newAddress
    if (newZipCode) {
      const parts = newZipCode.split("-")
      if (parts[0]) updatePayload.recipient_zip4 = parts[0]
      if (parts[1]) updatePayload.recipient_zip3 = parts[1]
    }
    if (newPhone) updatePayload.recipient_phone = newPhone

    await supabase.from("shipments").update(updatePayload).eq("id", shipmentId)

    // 2. Atualizar em audit_log
    const { data: logs } = await supabase
      .from("audit_log")
      .select("id, details")
      .eq("action", "shipment_data")

    if (logs) {
      for (const item of logs) {
        if (item.details?.id === shipmentId || item.details?.tracking_number === shipmentId) {
          await supabase
            .from("audit_log")
            .update({
              details: {
                ...item.details,
                ...updatePayload,
                status_reason: statusDescription,
                updated_at: now,
              },
            })
            .eq("id", item.id)
        }
      }
    }

    // 3. Inserir tracking event
    await supabase.from("tracking_events").insert({
      tenant_id: (await getTenantId()),
      shipment_id: shipmentId,
      event_code: eventCode,
      description: statusDescription,
      location: "Hub Central - Linke Ops",
      created_at: now,
    })

    revalidatePath("/ops/incidencias")
    revalidatePath("/ops/envios")
    revalidatePath("/ops")
    revalidatePath("/app", "layout")

    return { success: true, message: "Incidência tratada com sucesso" }
  } catch (err: any) {
    console.error("Erro ao resolver incidência:", err)
    return { success: false, error: err?.message || "Erro ao processar resolução" }
  }
}
