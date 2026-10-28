import "server-only"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { DEFAULT_COLABORADORES } from "@/app/ops/entidades/colaboradores/types"

export function normalizeInvitationEmail(value: string): string {
  if (typeof value !== "string") throw new Error("Indique um email válido para o cliente.")
  const email = value.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Indique um email válido para o cliente.")
  }
  return email
}

/** Access must refer to a persisted, active store in the administrator's company. */
export async function loadInvitationStore(db: SupabaseClient, clientId: string, tenantId: string) {
  if (!clientId || !tenantId) throw new Error("Loja inválida.")
  const { data: store, error } = await db.from("clients").select("id, name")
    .eq("tenant_id", tenantId).eq("id", clientId).maybeSingle()
  if (error || !store) throw new Error("Não foi possível verificar a loja.")
  const { data: deleted, error: deletedError } = await db.from("audit_log").select("id")
    .eq("tenant_id", tenantId).eq("action", "deleted_client").eq("details->>id", clientId).limit(1).maybeSingle()
  const { data: profile, error: profileError } = await db.from("audit_log").select("details")
    .eq("tenant_id", tenantId).eq("action", "client_data").eq("details->>id", clientId)
    .order("created_at", { ascending: false }).order("id").limit(1).maybeSingle()
  if (deletedError || profileError || deleted || !profile?.details || profile.details.is_active === false) {
    throw new Error("A loja precisa de estar gravada e ativa para configurar o acesso.")
  }
  return { id: store.id as string, name: String(profile?.details?.short_name || store.name || "Loja"),
    email: typeof profile.details.email === "string" ? profile.details.email.trim().toLowerCase() : "" }
}

export async function assertClientEmail(db: SupabaseClient, email: string) {
  if (DEFAULT_COLABORADORES.some(c => c.email?.toLowerCase() === email)) {
    throw new Error("Este email pertence à equipa. Use um email próprio do cliente.")
  }
  // Escape wildcards: the comparison must match exactly, ignoring case.
  const escapedEmail = email.replace(/[\\%_]/g, "\\$&")
  const { data: staff, error } = await db.from("colaboradores").select("id")
    .ilike("email", escapedEmail).limit(1).maybeSingle()
  // This deployment persists staff profiles in audit_log until the dedicated
  // registry is available. Only a confirmed missing table permits that fallback.
  const missingRegistry = error && ["PGRST205", "42P01"].includes(error.code)
    && error.message.includes("colaboradores")
  if (error && !missingRegistry) throw new Error("Não foi possível verificar o email de acesso.")
  if (staff) throw new Error("Este email pertence à equipa. Use um email próprio do cliente.")
  const { data: recordedStaff, error: auditError } = await db.from("audit_log").select("id")
    .in("action", ["colaborador_created", "colaborador_updated", "colaborador_credentials_updated"])
    .ilike("details->>email", escapedEmail).limit(1).maybeSingle()
  if (auditError) throw new Error("Não foi possível verificar o email de acesso.")
  if (recordedStaff) throw new Error("Este email pertence à equipa. Use um email próprio do cliente.")
}

export function assertBoundClient(user: User, clientId: string, tenantId: string) {
  const metadata = user.app_metadata
  if (metadata.role !== "client" || metadata.client_id !== clientId || metadata.colaborador_id
    || (metadata.tenant_id && metadata.tenant_id !== tenantId)) {
    throw new Error("Este email já tem outro acesso. Use um email próprio desta loja.")
  }
}

export async function findClientUser(db: SupabaseClient, email: string, clientId: string, tenantId: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data) throw new Error("Não foi possível verificar o acesso do cliente.")
    const user = data.users.find(u => u.email?.toLowerCase() === email)
    if (user) { assertBoundClient(user, clientId, tenantId); return user }
    if (data.users.length < 1000) return null
  }
}

export function invitationConfig() {
  const configuredOrigin = process.env.CLIENT_PORTAL_ORIGIN?.trim()
  let url: URL
  try { url = new URL(configuredOrigin || "") } catch { throw new Error("Configure o endereço público do portal antes de enviar convites.") }
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname)
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password
    || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("O endereço do portal deve ser uma origem HTTPS válida, sem caminhos.")
  }
  if (!process.env.RESEND_API_KEY || !process.env.STORE_FROM_EMAIL?.trim()) {
    throw new Error("Configure o serviço de email e um remetente verificado antes de enviar convites.")
  }
  return { origin: url.origin, from: process.env.STORE_FROM_EMAIL.trim() }
}

export function invitationEmail(storeName: string, link: string) {
  const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1a3028;padding:32px">
    <h1 style="font-size:24px">Bem-vindo à Área do Cliente Linke</h1>
    <p>O acesso à loja <strong>${escape(storeName)}</strong> está preparado.</p>
    <p>Escolha a sua palavra-passe para entrar e começar a criar envios.</p>
    <p style="margin:28px 0"><a href="${escape(link)}" style="background:#126b4a;color:white;padding:14px 22px;border-radius:8px;text-decoration:none">Definir palavra-passe</a></p>
    <p>Depois, entre com este email e a palavra-passe que escolheu.</p>
    <p style="font-size:12px;color:#64756a">Este link é pessoal, tem validade limitada e só pode ser utilizado uma vez. Se expirar, peça um novo convite à equipa Linke. Se não esperava este convite, ignore este email.</p>
  </div>`
}

export function validPasswordSetup(value: unknown): value is { token_hash: string; type: "invite" | "recovery"; password: string; confirmation: string } {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return typeof v.token_hash === "string" && /^[a-f0-9]{40,128}$/i.test(v.token_hash)
    && (v.type === "invite" || v.type === "recovery")
    && typeof v.password === "string" && v.password.length >= 12 && v.password.length <= 128
    && v.password === v.confirmation
}
