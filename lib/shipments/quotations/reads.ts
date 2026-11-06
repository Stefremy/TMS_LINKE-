import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { AuthContext } from "@/lib/auth/context"
import { z } from "zod"
import { assertQuotationStaff } from "./access"
import { QUOTATION_ACTION, QUOTATION_READ_ACTION } from "./types"

async function receiptId(ctx: AuthContext, quotationId: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([
    QUOTATION_READ_ACTION, ctx.tenant_id, ctx.user.id, quotationId,
  ])))).slice(0, 16)
  bytes[6] = (bytes[6] & 15) | 128 // UUID version 8: application-defined deterministic identity.
  bytes[8] = (bytes[8] & 63) | 128
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Requests are retained as audit records, including cancelled ones; one receipt per user/request. */
export async function countUnreadQuotations(db: SupabaseClient, ctx: AuthContext) {
  assertQuotationStaff(ctx)
  const [requests, receipts] = await Promise.all([
    db.from("audit_log").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenant_id).eq("action", QUOTATION_ACTION),
    db.from("audit_log").select("id", { count: "exact", head: true }).eq("tenant_id", ctx.tenant_id)
      .eq("action", QUOTATION_READ_ACTION).eq("details->>user_id", ctx.user.id),
  ])
  if (requests.error || receipts.error || requests.count == null || receipts.count == null) throw new Error("Não foi possível contar os pedidos por ler.")
  return Math.max(0, requests.count - receipts.count)
}

/** Read only receipts for the displayed page, using deterministic primary keys. */
export async function readQuotationIds(db: SupabaseClient, ctx: AuthContext, ids: string[]) {
  assertQuotationStaff(ctx)
  if (!ids.length) return new Set<string>()
  const keys = await Promise.all(ids.map(id => receiptId(ctx, id)))
  const { data, error } = await db.from("audit_log").select("id").eq("tenant_id", ctx.tenant_id)
    .eq("action", QUOTATION_READ_ACTION).eq("details->>user_id", ctx.user.id).in("id", keys)
  if (error) throw new Error("Não foi possível consultar os pedidos por ler.")
  const saved = new Set((data || []).map(row => row.id))
  return new Set(ids.filter((_, index) => saved.has(keys[index])))
}

export async function markQuotationRead(db: SupabaseClient, ctx: AuthContext, quotationId: string) {
  assertQuotationStaff(ctx)
  if (!z.uuid().safeParse(quotationId).success) throw new Error("Pedido inválido.")
  const { data: request, error: requestError } = await db.from("audit_log").select("id").eq("id", quotationId)
    .eq("tenant_id", ctx.tenant_id).eq("action", QUOTATION_ACTION).maybeSingle()
  if (requestError || !request) throw new Error("Pedido indisponível ou sem acesso.")
  const id = await receiptId(ctx, quotationId)
  const now = new Date().toISOString()
  const { error } = await db.from("audit_log").insert({ id, tenant_id: ctx.tenant_id, action: QUOTATION_READ_ACTION,
    created_at: now, details: { quotation_id: quotationId, user_id: ctx.user.id, read_at: now } })
  if (error) {
    if (error.code !== "23505") throw new Error("Não foi possível marcar o pedido como lido.")
    const { data, error: receiptError } = await db.from("audit_log").select("id").eq("id", id).eq("tenant_id", ctx.tenant_id)
      .eq("action", QUOTATION_READ_ACTION).eq("details->>user_id", ctx.user.id).eq("details->>quotation_id", quotationId).maybeSingle()
    if (receiptError || !data) throw new Error("Não foi possível confirmar a leitura do pedido.")
  }
  return countUnreadQuotations(db, ctx)
}
