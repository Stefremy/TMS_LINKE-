"use server"

import { revalidatePath } from "next/cache"
import { requireEmployee, requireUser } from "@/lib/auth/context"
import { canSendClientMessages } from "@/lib/client-messages/types"
import { createAdminClient } from "@/lib/supabase/server"
import { SUPPORT_CATEGORIES, type SupportRequest, type SupportRequestInput, type SupportStatus } from "@/lib/support-requests/types"

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const text = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\0/g, "").trim().slice(0, max) : ""

/** Client portal "Suporte dedicado": stored as an audit_log event and shown in Ops > Mensagens > Pedidos de apoio. */
export async function createSupportRequestAction(input: SupportRequestInput): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const ctx = await requireUser()
  // Clients can only open requests for their own store; staff viewing a store portal act on that store.
  const clientId = ctx.role === "client" ? ctx.client_id : input?.clientId
  if (!clientId || !uuid.test(clientId)) return { success: false, error: "Não foi possível identificar a loja." }
  const category = SUPPORT_CATEGORIES.some(item => item.id === input?.category) ? input.category : null
  const subject = text(input?.subject, 120)
  const description = text(input?.description, 3000)
  const issueDate = /^\d{4}-\d{2}-\d{2}$/.test(input?.issueDate || "") ? input.issueDate : ""
  if (!category) return { success: false, error: "Escolha o tipo de pedido." }
  if (subject.length < 3) return { success: false, error: "Indique um assunto." }
  if (description.length < 10) return { success: false, error: "Descreva o problema com pelo menos 10 caracteres." }
  if (issueDate && issueDate > new Date().toISOString().slice(0, 10)) return { success: false, error: "A data do problema não pode ser no futuro." }

  const db = createAdminClient()
  const { data: client } = await db.from("clients").select("id").eq("tenant_id", ctx.tenant_id).eq("id", clientId).maybeSingle()
  if (!client) return { success: false, error: "Não foi possível identificar a loja." }
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await db.from("audit_log").select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenant_id).eq("action", "support_request").eq("details->>client_id", clientId).gte("created_at", since)
  if ((count ?? 0) >= 10) return { success: false, error: "Já enviou vários pedidos na última hora. Aguarde a resposta da equipa Linke." }

  const { data, error } = await db.from("audit_log").insert({
    tenant_id: ctx.tenant_id, action: "support_request",
    details: {
      client_id: clientId, category, subject, issue_date: issueDate, shipment_ref: text(input?.shipmentRef, 100),
      description, contact: text(input?.contact, 120), user_id: ctx.user.id, user_email: ctx.user.email ?? null,
    },
  }).select("id").single()
  if (error || !data) return { success: false, error: "Não foi possível enviar o pedido. Tente novamente." }
  try { revalidatePath("/ops/mensagens") } catch { /* the request is saved either way */ }
  return { success: true, id: String(data.id) }
}

async function requireSupportStaff() {
  const ctx = await requireEmployee()
  if (!canSendClientMessages(ctx)) throw new Error("Sem acesso aos pedidos de apoio.")
  return ctx
}

export async function listSupportRequestsAction(): Promise<SupportRequest[]> {
  const ctx = await requireSupportStaff()
  const db = createAdminClient()
  const [requests, statuses] = await Promise.all([
    db.from("audit_log").select("id, created_at, details").eq("tenant_id", ctx.tenant_id).eq("action", "support_request").order("created_at", { ascending: false }).limit(300),
    db.from("audit_log").select("created_at, details").eq("tenant_id", ctx.tenant_id).eq("action", "support_request_status").order("created_at", { ascending: true }).limit(2000),
  ])
  if (requests.error) throw new Error("Não foi possível carregar os pedidos de apoio.")
  const latest = new Map<string, { status: SupportStatus; at: string }>()
  for (const row of statuses.data ?? []) {
    const id = row.details?.request_id, status = row.details?.status
    if (typeof id === "string" && ["aberto", "em_curso", "resolvido"].includes(status)) latest.set(id, { status, at: row.created_at })
  }
  return (requests.data ?? []).map(row => {
    const d = row.details ?? {}, state = latest.get(String(row.id))
    return {
      id: String(row.id), clientId: d.client_id, category: d.category, subject: d.subject || "", issueDate: d.issue_date || "",
      shipmentRef: d.shipment_ref || "", description: d.description || "", contact: d.contact || "", createdAt: row.created_at,
      createdByEmail: d.user_email ?? null, status: state?.status ?? "aberto", statusUpdatedAt: state?.at ?? null,
    }
  })
}

/** Requests still "Aberto" (sidebar badge). Returns 0 for staff without access instead of throwing. */
export async function getOpenSupportRequestsCountAction(): Promise<number> {
  const ctx = await requireEmployee()
  if (!canSendClientMessages(ctx)) return 0
  return (await listSupportRequestsAction()).filter(request => request.status === "aberto").length
}

export async function setSupportRequestStatusAction(requestId: string, status: SupportStatus): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireSupportStaff()
  if (!/^\d+$|^[0-9a-f-]{36}$/i.test(requestId || "") || !["aberto", "em_curso", "resolvido"].includes(status)) return { success: false, error: "Pedido inválido." }
  const db = createAdminClient()
  const { data } = await db.from("audit_log").select("id").eq("tenant_id", ctx.tenant_id).eq("action", "support_request").eq("id", requestId).maybeSingle()
  if (!data) return { success: false, error: "Pedido não encontrado." }
  const { error } = await db.from("audit_log").insert({ tenant_id: ctx.tenant_id, action: "support_request_status", details: { request_id: requestId, status, user_id: ctx.user.id } })
  if (error) return { success: false, error: "Não foi possível atualizar o estado." }
  try { revalidatePath("/ops/mensagens") } catch { /* saved */ }
  return { success: true }
}
