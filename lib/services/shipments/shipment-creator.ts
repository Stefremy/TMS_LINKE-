import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getAuthContext, requireUser, requireEmployee, getTenantId } from "@/lib/auth/context"
import { calculateShipmentPrice } from "@/lib/pricing/calculate-shipment-price"
import { loadShipmentPricingContext, validateShipmentPricingInput, ShipmentPricingError, ShipmentPricingUnavailableError } from "@/lib/pricing/shipment-pricing-context"
import { resolveCttCredentials } from "@/lib/services/carriers/credentials"
import { CttProvider } from "@/lib/services/carriers/ctt-provider"
import { convertZplToPdfBase64 } from "@/lib/label-utils"
import { loadClientShipmentsForBalance, loadClientStatementsForBalance, payAsYouGoBalance, payAsYouGoRefusal } from "@/lib/billing/client-balance"

export async function createShipment(formData: FormData) {
  
  const ctx = await requireUser()

  const supabase = createAdminClient()
  
  const rawClientId = ctx.role === "client" ? ctx.client_id! : (formData.get("client_id") as string)
  if (rawClientId && ctx.role === "client") {
    const { readPortalAccess } = await import("@/lib/client-portal/suspension")
    const access = await readPortalAccess(ctx.tenant_id, rawClientId).catch(() => null)
    if (access && (access.suspended || access.blocked)) {
      throw new Error("A sua conta encontra-se suspensa para a criação de novos envios. Contacte geral@linke.pt para reativar.")
    }
  }
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

    // Wallet check applies ONLY to pay_as_you_go. Conta corrente clients are invoiced and never touch this logic.
    if (matchedClient.billing_type === "pay_as_you_go") {
      let balance: number
      try {
        const [pastShipments, statements] = await Promise.all([
          loadClientShipmentsForBalance(supabase, ctx.tenant_id, client_id),
          loadClientStatementsForBalance(supabase, ctx.tenant_id, client_id),
        ])
        balance = payAsYouGoBalance(matchedClient.credit_limit, pastShipments, statements)
      } catch {
        throw new ShipmentPricingUnavailableError()
      }
      const refusal = payAsYouGoRefusal(balance, computedSellPrice + computedFuelAmount)
      if (refusal) return { success: false, error: refusal }
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
