import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getAuthContext, requireUser, requireEmployee, getTenantId } from "@/lib/auth/context"
import { calculateShipmentPrice } from "@/lib/pricing/calculate-shipment-price"
import { loadShipmentPricingContext, validateShipmentPricingInput, ShipmentPricingError, ShipmentPricingUnavailableError } from "@/lib/pricing/shipment-pricing-context"
import { resolveCttCredentials } from "@/lib/services/carriers/credentials"
import { CttProvider } from "@/lib/services/carriers/ctt-provider"
import { convertZplToPdfBase64 } from "@/lib/label-utils"

export async function createShipment(formData: FormData) {
  
  const ctx = await requireUser()

  const supabase = createAdminClient()
  
  const rawClientId = ctx.role === "client" ? ctx.client_id! : (formData.get("client_id") as string)
  let service_type = (formData.get("service_type") as string) || "CTT Expresso 24H"
  
  // Sender
  const sender_name = (formData.get("sender_name") as string) || "Remetente"
  const sender_address = formData.get("sender_address") as string
  const sender_zip = formData.get("sender_zip") as string
  const sender_city = formData.get("sender_city") as string
  
  // Portuguese postal code: "4610-001" → zip4="4610" (4-digit prefix), zip3="001" (3-digit extension)
  const sender_zip4 = sender_zip?.split("-")[0] || sender_zip || ""
  const sender_zip3 = sender_zip?.split("-")[1] || ""

  // Recipient
  const recipient_name = (formData.get("recipient_name") as string) || "Destinatário"
  const recipient_address = formData.get("recipient_address") as string
  const recipient_zip = formData.get("recipient_zip") as string
  const recipient_city = formData.get("recipient_city") as string
  
  // Portuguese postal code: "4610-001" → zip4="4610" (4-digit prefix), zip3="001" (3-digit extension)
  const recipient_zip4 = recipient_zip?.split("-")[0] || recipient_zip || ""
  const recipient_zip3 = recipient_zip?.split("-")[1] || ""

  const client_id = rawClientId
  const shipmentId = crypto.randomUUID()
  const trackingNumber = `LTK${Math.floor(1000000 + Math.random() * 900000)}`
  const now = new Date().toISOString()

  // Lookup client + all Linke tables to compute the correct price
  let computedSellPrice: number
  let computedBuyPrice: number
  let computedFuelAmount = 0
  let computedBasePrice: number
  let computedTierLabel = "Standard"
  const weightKg = Number(formData.get("weight_kg"))

  try {
    validateShipmentPricingInput({ weightKg })
    const { client: matchedClient, service } = await loadShipmentPricingContext(supabase, ctx, client_id, {
      serviceId: (formData.get("service_id") as string) || undefined,
      serviceName: (formData.get("service_type") as string) || undefined,
    })
    service_type = service.name
    
    const recipientCountry = (formData.get("recipient_country") as string) || "PT"
    const priceResult = calculateShipmentPrice(weightKg, { ...matchedClient, default_linke_table_id: service.id },
      [service], recipientCountry, recipient_zip, { requireConfiguredTariff: true })
    computedSellPrice = priceResult.sellPrice
    computedBuyPrice = priceResult.buyPrice
    computedFuelAmount = priceResult.fuelSurchargeAmount || 0
    computedBasePrice = priceResult.basePrice
    computedTierLabel = priceResult.tierLabel || "Standard"

    // SECURITY WALLET CHECK: Block creation if pay_as_you_go client exceeds -2.00€ overdraft
    if (matchedClient.billing_type === "pay_as_you_go") {
      const { data: pastShipments, error: walletError } = await supabase.from("shipments").select("sell_price, fuel_tax_amount, status, billing_statement_id")
        .eq("tenant_id", ctx.tenant_id).eq("client_id", client_id)
      if (walletError) throw new ShipmentPricingUnavailableError()

      const { data: paidStatements } = await supabase
        .from("billing_statements")
        .select("id")
        .eq("tenant_id", ctx.tenant_id)
        .eq("client_id", client_id)
        .not("moloni_receipt_pdf", "is", null)

      const paidSet = new Set((paidStatements || []).map((p: any) => p.id))

      let totalSpent = 0
      ;(pastShipments || []).forEach((s: any) => {
        if (s.billing_statement_id && paidSet.has(s.billing_statement_id)) return
        if (s.status !== "anulado") {
          totalSpent += (Number(s.sell_price || 0) + Number(s.fuel_tax_amount || 0))
        }
      })
      const currentBalance = (Number(matchedClient.credit_limit) || 0) - totalSpent
      const newShipmentCost = Number((computedSellPrice + computedFuelAmount).toFixed(2))
      const projectedBalance = Number((currentBalance - newShipmentCost).toFixed(2))
      const OVERDRAFT_LIMIT = -2.00

      if (projectedBalance < OVERDRAFT_LIMIT) {
        return {
          success: false,
          error: `Saldo Insuficiente: Este envio tem o custo de ${newShipmentCost.toFixed(2)}€, mas o seu saldo atual é de ${currentBalance.toFixed(2)}€. O limite máximo de descoberto autorizado é de -2,00€ (o saldo ficaria em ${projectedBalance.toFixed(2)}€). Por favor, efetue um carregamento para continuar.`
        }
      }
    }
  } catch (pricingErr) {
    return { success: false, error: pricingErr instanceof ShipmentPricingError || pricingErr instanceof ShipmentPricingUnavailableError
      ? pricingErr.message : "Não foi possível validar a tarifa. Tente novamente ou contacte o suporte." }
  }

  const shipmentData = {
    id: shipmentId,
    tenant_id: (await getTenantId()),
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
    buy_price: computedBuyPrice,
    sell_price: computedSellPrice,
    weight_kg: weightKg,
    base_price: computedBasePrice,
    fuel_tax_amount: computedFuelAmount,
    tier_label: computedTierLabel,
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
      tenant_id: (await getTenantId()),
      action: "shipment_data",
      details: shipmentData,
    })
  } catch (err: any) {
    console.warn("Could not save shipment to audit_log:", err?.message)
  }

  // 3. Create package info
  try {
    await supabase.from("packages").insert({
      tenant_id: (await getTenantId()),
      shipment_id: shipmentId,
      weight_g: 1000
    })
  } catch {}

  try {
    revalidatePath("/ops/envios")
    revalidatePath("/ops")
    revalidatePath("/app", "layout")
    revalidatePath("/app/[storeSlug]/envios", "page")
  } catch {}

  return { success: true, id: shipmentId, guia: trackingNumber }
}

export async function dispatchShipment(shipmentId: string) {
  
  await requireEmployee()

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
    const cttCreds = await resolveCttCredentials()
    const cttProvider = new CttProvider()
    await cttProvider.initialize(cttCreds)
    const cttResult = await cttProvider.createShipment({
      reference: shipment.tracking_number || shipment.id.substring(0, 8).toUpperCase(),
      sender: {
        name: shipment.sender_name,
        address: shipment.sender_address,
        zip: shipment.sender_zip4
          ? `${shipment.sender_zip4}-${shipment.sender_zip3 || "001"}`
          : "1000-001",
        city: "Localidade",
        phone: "910000000",
        country: "PT"
      },
      recipient: {
        name: shipment.recipient_name,
        address: shipment.recipient_address,
        zip: shipment.recipient_zip4
          ? `${shipment.recipient_zip4}-${shipment.recipient_zip3 || "001"}`
          : "1000-001",
        city: "Localidade",
        phone: "920000000",
        country: "PT"
      },
      weightKg: 1,
      volumes: 1,
      subProduct: "EMSF056.01"
    })
    return {
      success: cttResult.success,
      error: cttResult.error,
      labelBase64: cttResult.labelBase64 ? await convertZplToPdfBase64(cttResult.labelBase64) : undefined,
      trackingNumber: cttResult.trackingNumber
    }
  } else {
    throw new Error("Service not yet integrated: " + shipment.service_type)
  }
}
