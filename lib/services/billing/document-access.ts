import { getAuthContext } from "@/lib/auth/context"
import { createAdminClient } from "@/lib/supabase/server"

const FINANCE_PERMISSION = "Faturação & Contas Correntes"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Authenticate before service-role access, then scope every lookup to ownership. */
export async function loadFinancialDocument(
  identifier: string,
  action: "billing_statement" | "custom_invoice" | "period_statement" | "credit_note"
) {
  const ctx = await getAuthContext()
  if (!ctx?.user || !ctx.tenant_id || !ctx.role) return null
  if (ctx.role === "client" && !ctx.client_id) return null
  if (ctx.role !== "client" && ctx.role !== "admin" &&
      !(ctx.role === "employee" && (ctx.permissions.includes(FINANCE_PERMISSION) ||
        ctx.permissions.includes("Acesso Total (Super-Admin)")))) return null

  const id = identifier.trim()
  if (!id || id.length > 160 || /[\u0000-\u001f\u007f]/.test(id)) return null

  const supabase = createAdminClient()
  const numberField = action === "credit_note" ? "number" : action === "custom_invoice" ? "invoice_number" : "statement_number"
  const fields = UUID.test(id) ? ["id", "details->>id", `details->>${numberField}`]
    : ["details->>id", `details->>${numberField}`]

  // Separate equality filters avoid interpolating untrusted text into PostgREST .or().
  for (const field of fields) {
    let query = supabase.from("audit_log").select("id, tenant_id, details")
      .eq("tenant_id", ctx.tenant_id).eq("action", action)
    if (ctx.role === "client") query = query.eq("details->>client_id", ctx.client_id)
    query = field === `details->>${numberField}`
      ? query.ilike(field, id.replace(/[\\%_]/g, "\\$&"))
      : query.eq(field, id)
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle()
    if (error) throw new Error("Financial document lookup failed")
    if (data?.details) return { supabase, document: data, ctx }
  }
  return null
}

/** Financial responses, including errors, must never enter shared caches. */
export function financialPdfResponse(body: BodyInit | null, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set("Cache-Control", "private, no-store, max-age=0")
  headers.set("Pragma", "no-cache")
  headers.set("Expires", "0")
  headers.set("Vary", "Cookie, Authorization")
  return new Response(body, { ...init, headers })
}
