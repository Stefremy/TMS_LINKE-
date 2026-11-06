"use server"

import { requireUser } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { emitClientGuiaAction } from "./shipments"
import type { CttExportDetails } from "@/lib/services/ctt/export-details"
import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { shipmentFormSchema, type ShipmentFieldError } from "@/components/shipments/form/schema"
import { shipmentOverrideError } from "@/lib/services/shipments/shipment-form-authorization"
import { loadShipmentPricingContext, loadInternationalAirQuotationContext } from "@/lib/pricing/shipment-pricing-context"
import { resolveServiceCarrier } from "@/lib/pricing/calculate-shipment-quote"
import { getServiceIslandTransportMode, isPortugueseIslandDestination } from "@/lib/services/shipment-service-options"
import { getCttRecipientContactError } from "@/lib/services/ctt/recipient-contact"
import { readCttExportForm } from "@/lib/services/ctt/export-details"
import { requiresCorreosQuotation } from "@/lib/services/correos/shipment-policy"
import { createQuotation, QUOTATION_PERMISSIONS } from "@/lib/shipments/quotations/server"
import { canRequestCorreosQuotation, publicCorreosQuotationReference } from "@/lib/services/correos/quotation-pricing"
import { readPortalAccess } from "@/lib/client-portal/suspension"

const failure = (field: ShipmentFieldError["field"], message: string) => ({ success: false as const, error: message, fieldErrors: [{ field, message }] })

/** Validation adapter only. Dispatch, pricing and wallet reservations stay in emitClientGuiaAction. */
export async function submitShipmentFormAction(input: unknown, clientId?: string, quotationKey?: string) {
  return submitShipment(input, clientId, quotationKey, false)
}

/** Dedicated request endpoint: it cannot dispatch a carrier shipment, even with a forged service. */
export async function requestInternationalAirShipmentAction(input: unknown, clientId?: string, quotationKey?: string) {
  return submitShipment(input, clientId, quotationKey, true)
}

export async function getInternationalAirQuotationReferenceAction(clientId?: string) {
  const ctx = await requireUser(QUOTATION_PERMISSIONS)
  const { client, service } = await loadInternationalAirQuotationContext(createAdminClient(), ctx, ctx.role === "client" ? ctx.client_id : clientId)
  return { service: publicCorreosQuotationReference(service), fuelSurchargePct: client.pricing?.standard_fuel_surcharge_pct }
}

async function submitShipment(input: unknown, clientId: string | undefined, quotationKey: string | undefined, airRequestOnly: boolean) {
  const ctx = await requireUser(airRequestOnly ? QUOTATION_PERMISSIONS : "Emissão e Controlo de Guias CTT")
  const restricted = shipmentOverrideError(ctx.role, input)
  if (restricted) return failure("root", restricted.message)
  const parsed = shipmentFormSchema.safeParse(input)
  if (!parsed.success) return {
    success: false as const, error: "Verifique os campos assinalados.",
    fieldErrors: parsed.error.issues.map(issue => ({ field: (issue.path[0] || "root") as ShipmentFieldError["field"], message: issue.message })),
  }
  const values = parsed.data
  const effectiveClientId = ctx.role === "client" ? ctx.client_id : clientId
  if (!effectiveClientId) return failure("root", "Selecione o cliente do envio.")
  let service: ServicoLinke | undefined, carrier: "ctt" | "correos" | undefined, exportDetails: CttExportDetails | undefined, client: Cliente | undefined
  try {
    const context = airRequestOnly ? await loadInternationalAirQuotationContext(createAdminClient(), ctx, effectiveClientId)
      : await loadShipmentPricingContext(createAdminClient(), ctx, effectiveClientId, { serviceId: values.serviceId })
    service = context.service
    client = context.client
    carrier = resolveServiceCarrier(service)
  } catch { return airRequestOnly ? failure("root", "Não foi possível carregar a referência internacional. Atualize a página para tentar novamente.")
    : failure("serviceId", "O serviço não está disponível para este cliente. Volte a selecionar o serviço.") }
  if (!service || !client || !carrier) return failure("serviceId", "O serviço não está disponível para este cliente. Volte a selecionar o serviço.")
  if (airRequestOnly && (values.serviceId !== service.id || !requiresCorreosQuotation(carrier, values.recipientCountry, service))) return failure("serviceId", "Atualize a tabela de referência e selecione um destino fora de Portugal e Espanha para pedir cotação.")
  if (ctx.role !== "client" && values.carrierOverride && values.carrierOverride !== carrier) return failure("carrierOverride", "Escolha um serviço da transportadora selecionada.")
  if (requiresCorreosQuotation(carrier, values.recipientCountry, service)) {
    if (ctx.role !== "client" && !airRequestOnly) return failure("serviceId", "Faça o pedido em nome do cliente na página Pedido de envio internacional aéreo da respetiva loja.")
    if (values.volumesCount !== 1) return failure("volumesCount", "O pedido de cotação internacional está limitado a 1 volume por envio.")
    if (values.codValue || values.selectedSpecialServices.length) return failure("selectedSpecialServices", "As opções de entrega são acordadas na cotação. A cobrança COD não está disponível para este destino.")
    if (!canRequestCorreosQuotation(service, values.recipientCountry)) return failure("serviceId", "Este serviço não está disponível para pedidos de cotação neste destino.")
    try {
      const access = await readPortalAccess(ctx.tenant_id, effectiveClientId)
      if (client.is_active === false || access.suspended || access.blocked) return failure("root", "Esta conta está suspensa para novos pedidos. Contacte o apoio Linke.")
      const quotation = await createQuotation(createAdminClient(), ctx, quotationKey || "", client, service, values, airRequestOnly ? "air" : undefined)
      return { success: true as const, kind: "quotation" as const, quotation: { id: quotation.id, reference: quotation.reference }, dbWarning: null }
    } catch (error) { return failure("root", error instanceof Error ? error.message : "Não foi possível guardar o pedido de cotação.") }
  }
  if (carrier === "correos" && !values.recipientPhone) return failure("recipientPhone", "Indique o telefone do destinatário para este envio Correos Express.")
  if (carrier === "ctt" && values.recipientCountry !== "PT") {
    const contactError = getCttRecipientContactError({ country: values.recipientCountry, phone: values.recipientPhone, email: values.recipientEmail })
    if (contactError) return failure("recipientEmail", contactError)
    try {
      const data = new FormData()
      for (const [key, value] of Object.entries(values.exportFields)) for (const item of Array.isArray(value) ? value : [value]) data.append(key, item)
      exportDetails = readCttExportForm(data, { country: values.recipientCountry, postalCode: values.recipientPostal, weightKg: values.weightKg })
    } catch (error) { return failure("exportFields", error instanceof Error ? error.message : "Preencha os dados do conteúdo internacional.") }
  }
  const result = await emitClientGuiaAction({
    clientId: effectiveClientId, clientName: values.senderName, senderAddress: values.senderAddress, senderCity: values.senderCity,
    senderPostal: values.senderPostal, senderPhone: values.senderPhone, recipientName: values.recipientName, recipientAddress: values.recipientAddress,
    recipientCity: values.recipientCity, recipientPostal: values.recipientPostal, recipientCountry: values.recipientCountry,
    recipientPhone: values.recipientPhone, recipientEmail: values.recipientEmail, weightKg: values.weightKg, volumesCount: values.volumesCount,
    lengthCm: values.lengthCm, widthCm: values.widthCm, heightCm: values.heightCm, parcelWeightsKg: values.parcelWeightsKg.length ? values.parcelWeightsKg : undefined,
    serviceId: service.id, serviceName: service.name, calculatedPrice: 0,
    islandTransportMode: isPortugueseIslandDestination(values.recipientCountry, values.recipientPostal) ? values.islandTransportMode || getServiceIslandTransportMode(service) : undefined,
    selectedSpecialServices: values.selectedSpecialServices, codValue: values.codValue, observations: values.observations, cttExportDetails: exportDetails,
  })
  if (!result.success) return failure("root", result.error || "Não foi possível emitir o envio.")
  let notesWarning: string | null = null
  if (ctx.role !== "client" && values.internalNotes) {
    try {
      const saved = await createAdminClient().from("audit_log").insert({ tenant_id: ctx.tenant_id, action: "shipment_ops_notes", details: {
        shipment_id: result.id, client_id: effectiveClientId, notes: values.internalNotes, user_id: ctx.user.id,
      } })
      if (saved.error) notesWarning = "O envio foi emitido, mas não foi possível guardar as notas internas. Não repita a emissão."
    } catch { notesWarning = "O envio foi emitido, mas não foi possível guardar as notas internas. Não repita a emissão." }
  }
  return { ...result, success: true as const, kind: "shipment" as const, dbWarning: notesWarning || result.dbWarning }
}
export type ShipmentFormResult = Extract<Awaited<ReturnType<typeof submitShipmentFormAction>>, { success: true; kind: "shipment" }>
