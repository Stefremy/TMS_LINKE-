import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getAuthContext, requireUser, requireEmployee, getTenantId } from "@/lib/auth/context"
import { captureWeightPricingBasis, type WeightPricingBasis } from "@/lib/billing/carrier-weight-pricing"
import { calculateShipmentPrice } from "@/lib/pricing/calculate-shipment-price"
import { loadShipmentPricingContext, validateShipmentPricingInput, ShipmentPricingError, ShipmentPricingUnavailableError } from "@/lib/pricing/shipment-pricing-context"
import { resolveCttCredentials } from "@/lib/services/carriers/credentials"
import { CttProvider } from "@/lib/services/carriers/ctt-provider"
import { convertZplToPdfBase64 } from "@/lib/label-utils"
import { positiveMeasurement } from "../tracking/carrier-measurements"
import { resolveServiceCarrier } from "@/lib/pricing/calculate-shipment-quote"
import { readCttExportForm, type CttExportDetails } from "../ctt/export-details"
import { getCttRecipientContactError } from "../ctt/recipient-contact"
import { reserveWallet, transitionWallet, type WalletReservation } from "@/lib/billing/wallet"

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
  let weightPricingBasis: WeightPricingBasis
  const weightKg = Number(formData.get("weight_kg"))
  const lengthCm = Number(formData.get('length_cm'))
  const widthCm = Number(formData.get('width_cm'))
  const heightCm = Number(formData.get('height_cm'))
  const volumesCount = Number(formData.get('volumes') || formData.get('package_count') || 1)
  const recipientCountry = String(formData.get('recipient_country') || 'PT').trim().toUpperCase()
  let carrierCode: 'ctt' | 'correos'
  let serviceCode: string | undefined
  let connectionId: string | undefined
  let cttExportDetails: CttExportDetails | undefined
  let reservation: WalletReservation | undefined

  try {
    validateShipmentPricingInput({ weightKg, volumesCount, lengthCm, widthCm, heightCm })
    const { client: matchedClient, service } = await loadShipmentPricingContext(supabase, ctx, client_id, {
      serviceId: (formData.get("service_id") as string) || undefined,
      serviceName: (formData.get("service_type") as string) || undefined,
    })
    service_type = service.name
    carrierCode = resolveServiceCarrier(service)
    serviceCode = service.webservice_service_code
    connectionId = service.webservice_connection_id
    const priceResult = calculateShipmentPrice(weightKg, { ...matchedClient, default_linke_table_id: service.id },
      [service], recipientCountry, recipient_zip, { requireConfiguredTariff: true })
    weightPricingBasis = captureWeightPricingBasis(matchedClient, service, recipientCountry, recipient_zip)
    computedSellPrice = priceResult.sellPrice
    computedBuyPrice = priceResult.buyPrice
    computedFuelAmount = priceResult.fuelSurchargeAmount || 0
    computedBasePrice = priceResult.basePrice
    computedTierLabel = priceResult.tierLabel || "Standard"
    if (carrierCode === 'ctt' && recipientCountry !== 'PT' && formData.get('ctt_export_type')) {
      cttExportDetails = readCttExportForm(formData)
    }

    reservation = await reserveWallet(supabase, ctx.tenant_id, matchedClient.id, shipmentId, computedSellPrice, trackingNumber)

  } catch (pricingErr) {
    return { success: false, error: pricingErr instanceof ShipmentPricingError || pricingErr instanceof ShipmentPricingUnavailableError
      ? pricingErr.message : pricingErr instanceof Error ? pricingErr.message : "Não foi possível validar a tarifa. Tente novamente ou contacte o suporte." }
  }

  const shipmentData = {
    id: shipmentId,
    tenant_id: (await getTenantId()),
    client_id,
    tracking_number: trackingNumber,
    service_type,
    carrier_code: carrierCode,
    webservice_service_code: serviceCode,
    webservice_connection_id: connectionId,
    ctt_export_details: cttExportDetails,
    status: "rascunho",
    sender_name,
    sender_city,
    sender_phone: String(formData.get('sender_phone') || ''),
    sender_email: String(formData.get('sender_email') || ''),
    sender_address: `${sender_address || ""}, ${sender_city || ""}`.trim(),
    sender_zip3,
    sender_zip4,
    recipient_name,
    recipient_city,
    recipient_country: recipientCountry,
    recipient_postal: recipient_zip,
    recipient_phone: String(formData.get('recipient_phone') || ''),
    recipient_email: String(formData.get('recipient_email') || ''),
    recipient_address: `${recipient_address || ""}, ${recipient_city || ""}`.trim(),
    recipient_zip3,
    recipient_zip4,
    buy_price: computedBuyPrice,
    sell_price: computedSellPrice,
    weight_pricing_basis: weightPricingBasis,
    weight_kg: weightKg,
    package_count: volumesCount,
    length_cm: lengthCm,
    width_cm: widthCm,
    height_cm: heightCm,
    base_price: computedBasePrice,
    fuel_tax_amount: computedFuelAmount,
    tier_label: computedTierLabel,
    created_at: now,
    updated_at: now,
  }

  // At least one durable shipment record must exist before reporting success.
  // Declared parcel data belongs to packages.dimensions; pricing snapshots and
  // optional fields stay in audit JSON, not unsupported shipment columns.
  const native = await supabase.from("shipments").insert({
    id: shipmentId, tenant_id: shipmentData.tenant_id, client_id,
    tracking_number: trackingNumber, service_type, carrier_code: carrierCode, status: 'rascunho',
    sender_name, sender_address: shipmentData.sender_address, sender_zip3, sender_zip4,
    recipient_name, recipient_address: shipmentData.recipient_address, recipient_zip3, recipient_zip4,
    buy_price: computedBuyPrice, sell_price: computedSellPrice, created_at: now, updated_at: now,
  })
  const audit = await supabase.from("audit_log").insert({tenant_id: ctx.tenant_id, action: "shipment_data", details: {...shipmentData, billing_type: reservation?.reserved && reservation.kind !== 'credit_limit' ? "pay_as_you_go" : "conta_corrente"}})
  if (native.error && audit.error) {
    if (native.error.code && audit.error.code) {
      await transitionWallet(supabase, reservation, 'reserved', 'released')
      return { success: false, error: "Não foi possível guardar o envio. Nenhum pedido foi enviado à transportadora." }
    }
    return { success: false, error: `A gravação do pedido ${shipmentId} ficou por confirmar. Nenhum pedido foi enviado à transportadora; confirme o saldo reservado antes de repetir.` }
  }
  await transitionWallet(supabase, reservation, 'reserved', 'consumed')

  // 3. Create package info
  let dbWarning: string | undefined
  try {
    const { error } = await supabase.from("packages").insert({
      tenant_id: (await getTenantId()),
      shipment_id: shipmentId,
      weight_g: Math.round(weightKg * 1000),
      dimensions: { length_cm: lengthCm, width_cm: widthCm, height_cm: heightCm, unit: 'cm' },
    })
    if (error) dbWarning = 'O rascunho foi guardado, mas é necessário confirmar a gravação do volume. Não crie outro envio para repetir.'
  } catch { dbWarning = 'O rascunho foi guardado; a gravação do volume ficou por confirmar. Não crie outro envio para repetir.' }

  try {
    revalidatePath("/ops/envios")
    revalidatePath("/ops")
    revalidatePath("/app", "layout")
    revalidatePath("/app/[storeSlug]/envios", "page")
  } catch {}

  return { success: true, id: shipmentId, guia: trackingNumber, dbWarning }
}

export async function dispatchShipment(shipmentId: string) {
  const ctx = await requireEmployee()
  if (!ctx.tenant_id) throw new Error("Conta sem empresa associada.")
  const supabase = createAdminClient()
  const { data: shipment, error } = await supabase
    .from("shipments").select("*").eq("tenant_id", ctx.tenant_id).eq("id", shipmentId).single()
  if (error || !shipment) throw new Error("Envio não encontrado.")
  const [audit, parcels] = await Promise.all([
    supabase.from('audit_log').select('details').eq('tenant_id', ctx.tenant_id)
      .eq('action', 'shipment_data').eq('details->>id', shipment.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('packages').select('weight_g,dimensions').eq('tenant_id', ctx.tenant_id).eq('shipment_id', shipment.id).limit(1001),
  ])
  if (audit.error || parcels.error) throw new Error("Não foi possível confirmar os dados guardados do rascunho.")
  const saved = { ...shipment, ...audit.data?.details, id: shipment.id, tenant_id: ctx.tenant_id, client_id: shipment.client_id }
  if (shipment.carrier_tracking_number || saved.carrier_tracking_number ||
      !['rascunho', 'draft'].includes(shipment.status)) {
    throw new Error("Este envio já foi emitido ou não é um rascunho. Utilize a etiqueta existente; não volte a emitir.")
  }
  const packages = (parcels.data || []) as { weight_g: unknown; dimensions?: {
    unit?: unknown; length_cm?: unknown; width_cm?: unknown; height_cm?: unknown
  } | null }[]
  const weights = packages.map(parcel => positiveMeasurement(parcel.weight_g))
  const grams = weights.length && weights.every(value => value !== null)
    ? weights.reduce<number>((sum, value) => sum + value!, 0) : null
  const dimensions = packages.length === 1 && (!packages[0].dimensions?.unit || packages[0].dimensions.unit === 'cm')
    ? packages[0].dimensions : null
  const weightKg = positiveMeasurement(saved.weight_kg) ?? (grams !== null ? grams / 1000 : null)
  const volumeValue = saved.package_count ?? saved.volumes_count
  const volumes = volumeValue == null ? (packages.length || null) : positiveMeasurement(volumeValue)
  const length = positiveMeasurement(saved.length_cm) ?? positiveMeasurement(dimensions?.length_cm)
  const width = positiveMeasurement(saved.width_cm) ?? positiveMeasurement(dimensions?.width_cm)
  const height = positiveMeasurement(saved.height_cm) ?? positiveMeasurement(dimensions?.height_cm)
  if (weightKg === null || volumes === null || length === null || width === null || height === null || packages.length > 1000) {
    throw new Error("Complete o peso, o número de volumes e as dimensões guardados no rascunho antes de emitir.")
  }
  validateShipmentPricingInput({ weightKg, volumesCount: volumes, lengthCm: length, widthCm: width, heightCm: height })
  const subProduct = saved.webservice_service_code || saved.ctt_subproduct_id || saved.weight_pricing_basis?.service?.webservice_service_code
  if (saved.carrier_code === 'correos' || saved.carrier_code === 'correos_express' || !/^(?:EMS|ENC)F\d+\.\d+$/.test(subProduct || '')) {
    throw new Error("Confirme o serviço CTT associado ao rascunho antes de emitir.")
  }
  const recipientCountry = saved.recipient_country || saved.weight_pricing_basis?.country || 'PT'
  const contactError = getCttRecipientContactError({country:recipientCountry,phone:saved.recipient_phone,email:saved.recipient_email})
  if (contactError) throw new Error(contactError)
  // Legacy draft addresses stored the explicit city after the final comma.
  const cityFromAddress = (city: unknown, address: unknown) => typeof city === 'string' && city.trim()
    ? city.trim() : typeof address === 'string' && address.includes(',') ? address.split(',').at(-1)!.trim() : ''
  const cttCreds = await resolveCttCredentials(saved.webservice_connection_id)
  const cttProvider = new CttProvider()
  await cttProvider.initialize(cttCreds)
  const cttResult = await cttProvider.createShipment({
    reference: shipment.tracking_number || shipment.id.substring(0, 8).toUpperCase(),
    sender: {
      name: saved.sender_name,
      address: saved.sender_address,
      zip: saved.sender_postal || [saved.sender_zip4, saved.sender_zip3].filter(Boolean).join('-'),
      city: cityFromAddress(saved.sender_city, saved.sender_address),
      phone: saved.sender_phone || "",
      email: saved.sender_email,
      country: saved.sender_country || "PT"
    },
    recipient: {
      name: saved.recipient_name,
      address: saved.recipient_address,
      zip: saved.recipient_postal || [saved.recipient_zip4, saved.recipient_zip3].filter(Boolean).join('-'),
      city: cityFromAddress(saved.recipient_city, saved.recipient_address),
      phone: saved.recipient_phone || "",
      email: saved.recipient_email,
      country: recipientCountry
    },
    weightKg,
    volumes,
    dimensionsCm: { length, width, height },
    subProduct,
    cttExportDetails: saved.ctt_export_details,
    observations: saved.observations,
  })
  const labelBase64 = cttResult.labelBase64 ? await convertZplToPdfBase64(cttResult.labelBase64) : undefined
  let dbWarning: string | undefined
  if (cttResult.success) {
    const now = new Date().toISOString()
    try {
      const update = await supabase.from('shipments').update({ carrier_tracking_number: cttResult.trackingNumber,
        carrier_code: 'ctt', status: 'pendente', updated_at: now }).eq('tenant_id', ctx.tenant_id).eq('id', shipment.id)
      const log = await supabase.from('audit_log').insert({ tenant_id: ctx.tenant_id, action: 'shipment_data', created_at: now,
        details: { ...saved, carrier_tracking_number: cttResult.trackingNumber, carrier_code: 'ctt', status: 'pendente',
          ctt_label_base64: labelBase64, weight_kg: weightKg, package_count: volumes, length_cm: length, width_cm: width, height_cm: height } })
      if (update.error || log.error) throw new Error('Persistência por confirmar')
    } catch {
      dbWarning = 'Os CTT aceitaram o envio, mas a gravação ficou por confirmar. Não volte a emitir; confirme o rastreio e a etiqueta.'
    }
  }
  return {
    success: cttResult.success,
    error: cttResult.error,
    labelBase64,
    trackingNumber: cttResult.trackingNumber,
    dbWarning,
  }
}
