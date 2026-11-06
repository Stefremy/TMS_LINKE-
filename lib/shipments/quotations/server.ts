import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { AuthContext } from "@/lib/auth/context"
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions"
import { z } from "zod"
import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import type { ShipmentFormValues } from "@/components/shipments/form/schema"
import { QUOTATION_ACTION, type QuotationPage, type ShipmentQuotation, type StoredQuotation, type QuotationShipment } from "./types"
import { canRequestCorreosQuotation, correosQuotationEstimate, generalCorreosQuotationClient } from "@/lib/services/correos/quotation-pricing"
import { readQuotationIds } from "./reads"
import { QUOTATION_PERMISSIONS } from "./access"
export { QUOTATION_PERMISSIONS } from "./access"

const uuid = z.uuid()
export const quotationUpdateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), amount: z.number().finite().positive().max(1_000_000).refine(v => Number.isSafeInteger(Math.round(v * 100)) && Math.abs(v * 100 - Math.round(v * 100)) < 0.000001), hasIva: z.boolean().optional().default(false), response: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.enum(["review", "accept", "decline", "cancel"]) }),
  z.object({ action: z.literal("complete"), trackingCarrier: z.enum(["correos", "fedex"]).default("correos"), trackingNumber: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9._/-]+$/), buyPrice: z.number().finite().nonnegative().max(1_000_000).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001), response: z.string().trim().max(2000) }),
])

function checkScope(ctx: AuthContext) {
  if (!ctx.user?.id || !ctx.tenant_id || !ctx.role || ctx.role === "client" && !ctx.client_id) throw new Error("Inicie sessão para gerir as cotações.")
  if (ctx.role !== "client" && !QUOTATION_PERMISSIONS.some(p => hasPermission(ctx, p))) throw new Error("Sem permissão para gerir cotações.")
}
function publicQuote(quote: StoredQuotation, ctx: AuthContext): ShipmentQuotation {
  const { requested_by: _requester, requested_by_collaborator_id: _collaborator, requested_by_email, requested_by_role,
    updated_by: _updater, shipment_audit_id: _audit, partner_cost: _cost, booked_by: _booker, internal_notes, ...publicFields } = quote
  void _requester; void _collaborator; void _updater; void _audit; void _cost; void _booker
  return ctx.role === "client" ? publicFields : { ...publicFields, internal_notes, requested_by_email, requested_by_role }
}
function shipmentFields(v: ShipmentFormValues): QuotationShipment {
  return { senderName: v.senderName, senderAddress: v.senderAddress, senderCity: v.senderCity, senderPostal: v.senderPostal, senderPhone: v.senderPhone,
    recipientName: v.recipientName, recipientAddress: v.recipientAddress, recipientCity: v.recipientCity, recipientCountry: v.recipientCountry,
    recipientPostal: v.recipientPostal, recipientPhone: v.recipientPhone, recipientEmail: v.recipientEmail,
    weightKg: v.weightKg, volumesCount: v.volumesCount, lengthCm: v.lengthCm, widthCm: v.widthCm, heightCm: v.heightCm,
    parcelWeightsKg: [...v.parcelWeightsKg], observations: v.observations }
}
function sameRequest(a: StoredQuotation, b: StoredQuotation) {
  // JSONB does not preserve object key order; compare the explicit request fields.
  const sameShipment = (Object.keys(b.shipment) as (keyof QuotationShipment)[]).every(key => {
    const saved = a.shipment[key], requested = b.shipment[key]
    return Array.isArray(requested) ? Array.isArray(saved) && saved.length === requested.length && requested.every((weight, index) => weight === saved[index]) : saved === requested
  })
  return a.client_id === b.client_id && a.service_id === b.service_id && a.requested_by === b.requested_by &&
    sameShipment && a.internal_notes === b.internal_notes && a.requested_transport === b.requested_transport
}

/** An explicit primary key makes a retry idempotent; never upsert a request. */
export async function createQuotation(db: SupabaseClient, ctx: AuthContext, id: string, client: Cliente, service: ServicoLinke, values: ShipmentFormValues, requestedTransport?: "air") {
  checkScope(ctx)
  if (!service || !client || !uuid.safeParse(id).success || ctx.role === "client" && client.id !== ctx.client_id) throw new Error("Pedido de cotação inválido.")
  if (!canRequestCorreosQuotation(service, values.recipientCountry) || values.codValue || values.selectedSpecialServices.length || client.is_active === false) throw new Error("Este pedido não está disponível para cotação internacional.")
  if (values.weightKg > 2000 || values.lengthCm > 500 || values.widthCm > 300 || values.heightCm > 300 || values.parcelWeightsKg.some(w => w > 1000)) throw new Error("O envio excede as dimensões ou o peso físico máximo suportado.")
  if (ctx.role === "client") {
    const { count } = await db.from("audit_log").select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenant_id).eq("action", QUOTATION_ACTION).eq("details->>client_id", client.id)
      .in("details->>status", ["pending", "reviewing"])
    if (count && count >= 20) throw new Error("Atingiu o limite de pedidos de cotação pendentes em análise. Aguarde a resposta da equipa Linke antes de submeter novos pedidos.")
  }
  const estimate = correosQuotationEstimate(requestedTransport === "air" ? generalCorreosQuotationClient(client, service, client.pricing?.standard_fuel_surcharge_pct) : client, service, values.recipientCountry, values.recipientPostal, values.weightKg,
    { lengthCm: values.lengthCm, widthCm: values.widthCm, heightCm: values.heightCm, volumesCount: values.volumesCount,
      parcelWeightsKg: values.parcelWeightsKg.length ? values.parcelWeightsKg : undefined })
  const now = new Date().toISOString()
  const details: StoredQuotation = { id, reference: `COT-${id.replace(/-/g, "").slice(0, 12).toUpperCase()}`,
    client_id: client.id, client_name: client.short_name || client.legal_name, service_id: service.id, service_name: service.name,
    created_at: now, updated_at: now, revision: 0, status: "pending", shipment: shipmentFields(values),
    proposed_price: null, estimated_price: estimate?.totalPrice ?? null, response: "", tracking_number: "", requested_by: ctx.user.id, updated_by: ctx.user.id,
    ...(requestedTransport === "air" ? { requested_transport: "air" as const } : {}),
    ...(ctx.role !== "client" ? { requested_by_role: ctx.role === "admin" ? "admin" as const : "employee" as const,
      requested_by_email: ctx.user.email, requested_by_collaborator_id: ctx.colaborador_id || undefined } : {}),
    ...(ctx.role !== "client" && values.internalNotes ? { internal_notes: values.internalNotes } : {}) }
  const { error } = await db.from("audit_log").insert({ id, tenant_id: ctx.tenant_id, action: QUOTATION_ACTION, details, created_at: now })
  if (!error) return publicQuote(details, ctx)
  if (error.code === "23505") {
    const { data, error: readError } = await db.from("audit_log").select("details").eq("id", id)
      .eq("tenant_id", ctx.tenant_id).eq("action", QUOTATION_ACTION).eq("details->>client_id", client.id).maybeSingle()
    if (!readError && data && sameRequest(data.details as StoredQuotation, details)) return publicQuote(data.details as StoredQuotation, ctx)
    throw new Error("Esta referência já foi utilizada. Consulte as cotações antes de criar outro pedido.")
  }
  throw new Error("Não foi possível guardar o pedido de cotação. Tente novamente com a mesma referência.")
}

export async function listQuotations(db: SupabaseClient, ctx: AuthContext, clientId?: string, cursor?: { at: string; id: string }): Promise<QuotationPage> {
  checkScope(ctx)
  const selectedClient = ctx.role === "client" ? ctx.client_id! : clientId
  if (selectedClient && !uuid.safeParse(selectedClient).success) throw new Error("Cliente inválido.")
  let query = db.from("audit_log").select("id, created_at, details").eq("tenant_id", ctx.tenant_id).eq("action", QUOTATION_ACTION)
  if (selectedClient) query = query.eq("details->>client_id", selectedClient)
  if (cursor) {
    if (!uuid.safeParse(cursor.id).success || !z.iso.datetime({ offset: true }).safeParse(cursor.at).success) throw new Error("Página de cotações inválida.")
    query = query.or(`created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`)
  }
  const { data, error } = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(31)
  if (error) throw new Error("Não foi possível consultar as cotações. Tente novamente.")
  const rows = (data || []).slice(0, 30)
  const last = rows[rows.length - 1]
  const readIds = ctx.role === "client" ? null : await readQuotationIds(db, ctx, rows.map(row => row.id))
  return { requests: rows.map(row => ({ ...publicQuote(row.details as StoredQuotation, ctx), ...(readIds ? { is_unread: !readIds.has(row.id) } : {}) })),
    next: data && data.length > 30 && last ? { at: last.created_at, id: last.id } : null }
}

export async function updateQuotation(db: SupabaseClient, ctx: AuthContext, id: string, revision: number, input: unknown) {
  checkScope(ctx)
  if (!uuid.safeParse(id).success || !Number.isSafeInteger(revision) || revision < 0) throw new Error("Cotação inválida.")
  const parsed = quotationUpdateSchema.safeParse(input)
  if (!parsed.success) throw new Error("Verifique o valor, a resposta e a referência de transporte.")
  const update = parsed.data
  if (update.action === "complete" && update.trackingCarrier === "fedex" && !/^\d{10,34}$/.test(update.trackingNumber)) throw new Error("Indique o número de tracking FedEx, apenas com 10 a 34 algarismos.")
  const customerAction = update.action === "accept" || update.action === "decline"
  if (ctx.role === "client" && !customerAction && update.action !== "cancel") throw new Error("Apenas a equipa pode responder a cotações.")
  if (ctx.role !== "client" && customerAction) throw new Error("A decisão da proposta deve ser registada pelo cliente.")
  if (update.action === "complete" && !hasPermission(ctx, PERMISSIONS.shipments)) throw new Error("Sem permissão para registar a guia e criar o envio faturável.")
  let query = db.from("audit_log").select("details").eq("id", id).eq("tenant_id", ctx.tenant_id).eq("action", QUOTATION_ACTION)
  if (ctx.role === "client") query = query.eq("details->>client_id", ctx.client_id!)
  const { data, error } = await query.maybeSingle()
  if (error || !data) throw new Error("Cotação indisponível ou sem acesso.")
  const current = data.details as StoredQuotation
  if (current.revision !== revision) throw new Error("Esta cotação foi atualizada. Atualize a lista antes de continuar.")
  if (update.action === "accept") {
    const clientId = ctx.role === "client" ? ctx.client_id! : current.client_id
    const { data: accessData } = await db.from("audit_log").select("details")
      .eq("tenant_id", ctx.tenant_id).eq("action", "client_portal_access").eq("details->>id", clientId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle()
    const blocked = accessData?.details?.blocked === true
    const suspended = !blocked && accessData?.details?.suspended === true
    if (blocked || suspended) throw new Error("A sua conta encontra-se suspensa para a criação de novos envios. Contacte o apoio Linke.")
  }
  if (update.action === "accept" || update.action === "complete") {
    const result = await db.rpc("materialize_shipment_quotation", { p_tenant: ctx.tenant_id, p_quote: id, p_revision: revision,
      p_actor: ctx.user.id, p_client: ctx.role === "client" ? ctx.client_id : null, p_action: update.action,
      p_tracking: update.action === "complete" ? update.trackingNumber : null,
      p_buy_price: update.action === "complete" ? update.buyPrice : null,
      p_response: update.action === "complete" ? update.response : null,
      p_tracking_carrier: update.action === "complete" ? update.trackingCarrier : null })
    if (result.error?.code === "PGRST202") throw new Error("Falta aplicar as migrações de envios por cotação e tracking do parceiro no Supabase (20261105190000 e 20261106140000).")
    if (result.error || !result.data) {
      const message = result.error?.message || ""
      if (/^(Saldo ou crédito insuficiente|A wallet não está preparada|O limite de crédito não está preparado)/.test(message)) throw new Error(message)
      throw new Error("Não foi possível confirmar o envio da cotação. Atualize a lista antes de repetir.")
    }
    return publicQuote(result.data as StoredQuotation, ctx)
  }
  const next: StoredQuotation = { ...current, revision: revision + 1, updated_at: new Date().toISOString(), updated_by: ctx.user.id }
  if (update.action === "reply" && ["pending", "reviewing"].includes(current.status)) {
    next.status = "quoted"; next.proposed_price = update.amount; next.has_iva = Boolean(update.hasIva); next.response = update.response
  } else if (update.action === "review" && current.status === "pending") next.status = "reviewing"
  else if (update.action === "decline" && current.status === "quoted") next.status = "declined"
  else if (update.action === "cancel" && ["pending", "reviewing", "quoted"].includes(current.status)) next.status = "cancelled"
  else throw new Error("Esta alteração já não é possível no estado atual da cotação.")
  let save = db.from("audit_log").update({ details: next }).eq("id", id).eq("tenant_id", ctx.tenant_id)
    .eq("action", QUOTATION_ACTION).eq("details->>revision", revision)
  if (ctx.role === "client") save = save.eq("details->>client_id", ctx.client_id!)
  const saved = await save.select("id").maybeSingle()
  if (saved.error || !saved.data) throw new Error("Não foi possível guardar a alteração. Atualize a cotação antes de tentar novamente.")
  return publicQuote(next, ctx)
}
