"use server"

import { requireUser, requireEmployee, type AuthContext } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getClientesAction } from "./clientes"
import { readPortalAccess } from "@/lib/client-portal/suspension"
import { scheduleCttPickupAction } from "./ctt"
import { PICKUP_REQUEST_ACTION, PICKUP_REQUEST_PERMISSION, PICKUP_REQUEST_PAGE_SIZE, pickupRequestSchema, type ClientPickupRequest } from "@/lib/client-pickup-requests"
import { notifyPickupConfirmation } from "@/lib/email/pickup-confirmation"

type SavedRequest = ClientPickupRequest & { created_by: string; processing_by?: string; completed_by?: string }
const uuid = (value: unknown): value is string => typeof value === "string" && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)
const failure = (error: unknown) => ({ success: false as const, error: error instanceof Error ? error.message : "Não foi possível atualizar o pedido de recolha." })
const samePickup = (saved: ClientPickupRequest["pickup"], input: ClientPickupRequest["pickup"]) => Object.entries(input).every(([key, value]) => saved?.[key as keyof typeof saved] === value)
const refresh = () => { revalidatePath("/ops/envios/recolhas"); revalidatePath("/app/[storeSlug]/recolhas", "page") }
const publicRequest = (request: SavedRequest, client = false): ClientPickupRequest => ({
  id: request.id, reference: request.reference, client_id: request.client_id, client_name: request.client_name,
  status: client && request.status === "processing" ? "pending" : request.status, pickup: request.pickup,
  created_at: request.created_at, completed_at: request.completed_at, carrier_reference: request.carrier_reference, carrier_name: request.carrier_name,
})
const query = (db: ReturnType<typeof createAdminClient>, ctx: AuthContext) => db.from("audit_log").select("id,details,created_at").eq("tenant_id", ctx.tenant_id).eq("action", PICKUP_REQUEST_ACTION)
async function confirmationWarning(db: ReturnType<typeof createAdminClient>, ctx: AuthContext, request: SavedRequest) {
  try { await notifyPickupConfirmation(db, ctx.tenant_id, publicRequest(request)); return undefined }
  catch (error) { return `Pedido efetuado. Email de confirmação: ${error instanceof Error ? error.message : "não foi possível enviar. Tente novamente no histórico de pedidos efetuados."}` }
}
async function readRequest(db: ReturnType<typeof createAdminClient>, ctx: AuthContext, id: string) {
  if (!uuid(id)) throw new Error("Pedido inválido.")
  let read = query(db, ctx).eq("id", id)
  if (ctx.role === "client") read = read.eq("details->>client_id", ctx.client_id!)
  const { data, error } = await read.maybeSingle()
  if (error || !data || data.details?.id !== id) throw new Error("Pedido indisponível ou sem acesso.")
  return data.details as SavedRequest
}

/** No carrier call, reservation or shipment is created by this endpoint. */
export async function requestClientPickupAction(input: unknown, requestId: string, selectedClientId?: string) {
  const ctx = await requireUser(PICKUP_REQUEST_PERMISSION)
  try {
    const clientId = ctx.role === "client" ? ctx.client_id : selectedClientId
    if (!uuid(requestId) || !clientId) throw new Error("Selecione uma conta válida para o pedido.")
    const parsed = pickupRequestSchema.safeParse(input)
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Verifique os dados do pedido.")
    const db = createAdminClient()
    const existing = await query(db, ctx).eq("id", requestId).eq("details->>client_id", clientId).maybeSingle()
    if (existing.error) throw new Error("Não foi possível verificar o pedido. Tente novamente com a mesma referência.")
    if (existing.data) {
      if (!samePickup(existing.data.details.pickup, parsed.data)) throw new Error("Esta referência já pertence a outro pedido. Atualize a página.")
      return { success: true as const, request: publicRequest(existing.data.details, ctx.role === "client") }
    }
    const [clients, access] = await Promise.all([getClientesAction(clientId), readPortalAccess(ctx.tenant_id, clientId)])
    const client = clients.find(row => row.id === clientId)
    if (!client || client.is_active === false || access.blocked || access.suspended) throw new Error("Esta conta não pode criar pedidos de recolha. Contacte a equipa Linke.")
    const request: SavedRequest = { id: requestId, reference: `PR-${requestId.replace(/-/g, "").slice(0, 12).toUpperCase()}`, client_id: clientId,
      client_name: client.short_name || client.legal_name || "Cliente", status: "pending", pickup: parsed.data,
      created_at: new Date().toISOString(), created_by: ctx.user.id }
    const saved = await db.from("audit_log").insert({ id: requestId, tenant_id: ctx.tenant_id, action: PICKUP_REQUEST_ACTION, details: request })
    if (saved.error) {
      if (saved.error.code === "23505") {
        const retry = await readRequest(db, ctx, requestId)
        if (retry.client_id === clientId && samePickup(retry.pickup, parsed.data)) return { success: true as const, request: publicRequest(retry, ctx.role === "client") }
      }
      throw new Error("Não foi possível guardar o pedido. Tente novamente com a mesma referência.")
    }
    refresh()
    return { success: true as const, request: publicRequest(request, ctx.role === "client") }
  } catch (error) { return failure(error) }
}

export async function listClientPickupRequestsAction(input: { clientId?: string; pendingOnly?: boolean; page?: number } = {}) {
  const ctx = await requireUser(PICKUP_REQUEST_PERMISSION)
  try {
    const page = input.page ?? 0
    if (!Number.isInteger(page) || page < 0 || page > 10000) throw new Error("Página inválida.")
    const clientId = ctx.role === "client" ? ctx.client_id : input.clientId
    const db = createAdminClient()
    let read = db.from("audit_log").select("id,details,created_at", { count: "exact" }).eq("tenant_id", ctx.tenant_id).eq("action", PICKUP_REQUEST_ACTION)
    if (clientId) read = read.eq("details->>client_id", clientId)
    if (input.pendingOnly) read = read.in("details->>status", ["pending", "processing"])
    const result = await read.order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * PICKUP_REQUEST_PAGE_SIZE, (page + 1) * PICKUP_REQUEST_PAGE_SIZE - 1)
    if (result.error) throw new Error("Não foi possível carregar os pedidos de recolha.")
    return { success: true as const, requests: (result.data || []).map(row => publicRequest(row.details as SavedRequest, ctx.role === "client")), total: result.count || 0, page }
  } catch (error) { return failure(error) }
}

/** Count every outstanding request without downloading customer details or page limits. */
export async function getPendingClientPickupRequestsCountAction() {
  const ctx = await requireEmployee(PICKUP_REQUEST_PERMISSION)
  const { count, error } = await createAdminClient().from("audit_log").select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenant_id).eq("action", PICKUP_REQUEST_ACTION)
    .in("details->>status", ["pending", "processing"])
  if (error || count === null) throw new Error("Não foi possível confirmar os pedidos de recolha pendentes.")
  return count
}

/** Staff can record a request already made through the carrier's portal. */
export async function completeClientPickupRequestAction(id: string, reference: string, carrierName: string) {
  const ctx = await requireEmployee(PICKUP_REQUEST_PERMISSION)
  try {
    if (typeof reference !== "string" || !/^[A-Za-z0-9][A-Za-z0-9./_-]{0,79}$/.test(reference.trim()) || !["CTT Expresso", "Correos Express"].includes(carrierName)) throw new Error("Indique a transportadora e a referência de recolha confirmada.")
    const db = createAdminClient(), request = await readRequest(db, ctx, id)
    if (request.status === "completed") return { success: true as const, request: publicRequest(request), email_warning: await confirmationWarning(db, ctx, request) }
    const next: SavedRequest = { ...request, status: "completed", carrier_reference: reference.trim(), carrier_name: carrierName, completed_at: new Date().toISOString(), completed_by: ctx.user.id }
    const saved = await db.from("audit_log").update({ details: next }).eq("tenant_id", ctx.tenant_id).eq("action", PICKUP_REQUEST_ACTION).eq("id", id).eq("details->>status", request.status).select("id").maybeSingle()
    if (saved.error || !saved.data) throw new Error("O pedido foi atualizado por outro operador ou não foi possível guardar. Atualize a lista.")
    refresh()
    return { success: true as const, request: publicRequest(next), email_warning: await confirmationWarning(db, ctx, next) }
  } catch (error) { return failure(error) }
}

/** Claim once before calling the existing staff-only carrier booking flow. */
export async function scheduleClientPickupRequestAction(id: string, input: Parameters<typeof scheduleCttPickupAction>[0]) {
  const ctx = await requireEmployee(PICKUP_REQUEST_PERMISSION)
  try {
    const db = createAdminClient(), request = await readRequest(db, ctx, id)
    if (request.status !== "pending") throw new Error("Este pedido já está em tratamento ou foi efetuado. Confirme o resultado antes de repetir.")
    const next: SavedRequest = { ...request, status: "processing", processing_by: ctx.user.id }
    const claim = await db.from("audit_log").update({ details: next }).eq("tenant_id", ctx.tenant_id).eq("action", PICKUP_REQUEST_ACTION).eq("id", id).eq("details->>status", "pending").select("id").maybeSingle()
    if (claim.error || !claim.data) throw new Error("Outro operador já iniciou o pedido. Atualize a lista.")
    refresh()
    // A failed/uncertain carrier result stays claimed. An operator must verify it
    // before recording its reference; retrying must never create two bookings.
    const result = await scheduleCttPickupAction({ ...input, client_id: request.client_id, client_request_id: id })
    if (!result.success || !("pickupNumber" in result) || !result.pickupNumber) return { success: false as const, error: `${result.error || "Não foi confirmada uma referência."} Confirme o resultado na transportadora antes de repetir; o pedido mantém-se em tratamento.` }
    const completed = await completeClientPickupRequestAction(id, result.pickupNumber, result.carrier_name)
    return { ...result, ...(completed.success ? { notification_warning: completed.email_warning } : { request_update_warning: `A recolha foi aceite (${result.pickupNumber}), mas o estado do pedido não foi guardado. Use «Marcar efetuado» com esta referência.` }) }
  } catch (error) { return failure(error) }
}

/** Recover email delivery without booking the pickup again or changing its status. */
export async function sendClientPickupConfirmationEmailAction(id: string) {
  const ctx = await requireEmployee(PICKUP_REQUEST_PERMISSION)
  try {
    const db = createAdminClient(), request = await readRequest(db, ctx, id)
    const result = await notifyPickupConfirmation(db, ctx.tenant_id, publicRequest(request))
    return { success: true as const, alreadySent: result.skipped }
  } catch (error) { return failure(error) }
}

/** Explicit staff recovery after checking that the carrier did not create a booking. */
export async function reopenClientPickupRequestAction(id: string, confirmedNoBooking: boolean) {
  const ctx = await requireEmployee(PICKUP_REQUEST_PERMISSION)
  try {
    if (confirmedNoBooking !== true) throw new Error("Confirme primeiro que a transportadora não criou a recolha.")
    const db = createAdminClient(), request = await readRequest(db, ctx, id)
    if (request.status !== "processing") throw new Error("O pedido já não está em tratamento. Atualize a lista.")
    const next = { ...request, status: "pending", reopened_at: new Date().toISOString(), reopened_by: ctx.user.id }
    const saved = await db.from("audit_log").update({ details: next }).eq("tenant_id", ctx.tenant_id).eq("action", PICKUP_REQUEST_ACTION).eq("id", id).eq("details->>status", "processing").select("id").maybeSingle()
    if (saved.error || !saved.data) throw new Error("Não foi possível repor o pedido. Atualize a lista.")
    refresh()
    return { success: true as const }
  } catch (error) { return failure(error) }
}
