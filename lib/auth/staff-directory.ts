import { supportsDatabaseFeature } from "@/lib/supabase/schema-capabilities"
import type { SupabaseClient } from "@supabase/supabase-js"
import { DEFAULT_COLABORADORES, type Colaborador } from "@/app/ops/entidades/colaboradores/types"
import { AVAILABLE_STAFF_PERMISSIONS, isStaffAccessLevel, parsePermissions } from "./permissions"

export const OWNER_EMAIL = "stefano.remy@gmail.com"
export const staffEmail = (value: string | null | undefined) => value?.trim().toLowerCase() || ""
export type StaffAuthUser = {
  id: string; email?: string; created_at?: string
  app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown>
}
const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback

export async function listStaffAuthUsers(db: SupabaseClient): Promise<StaffAuthUser[]> {
  const users: StaffAuthUser[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error("Não foi possível consultar as contas dos colaboradores.")
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
}

/** Both the editor and the current session read the same trusted persisted access. */
export async function loadStaffDirectory(db: SupabaseClient, tenantId: string, users: StaffAuthUser[]) {
  // Client accounts are never staff (skipped below). Without this, an all-client input leaves
  // no candidate ids and the queries further down would load every staff profile instead.
  if (users.length > 0 && users.every(user => user.app_metadata?.role === "client")) return []

  const profiles = new Map<string, Colaborador>()
  const candidateIds = new Set<string>()

  for (const user of users) {
    const metadata = user.app_metadata || {}
    if (metadata.role === "client") continue
    const email = staffEmail(user.email)
    const fallback = DEFAULT_COLABORADORES.find(c => staffEmail(c.email) === email)
    if (!fallback && !["admin", "employee"].includes(text(metadata.role))) continue
    if (metadata.tenant_id && metadata.tenant_id !== tenantId) continue
    const level = metadata.role === "admin" ? "Administrador"
      : isStaffAccessLevel(metadata.access_level) && metadata.access_level !== "Administrador" ? metadata.access_level
      : fallback?.access_level || "Operacional"
    // Preserve historical Auth-only profile IDs, including their deletion events.
    const id = text(metadata.colaborador_id, fallback?.id || `col-${user.id.slice(0, 8)}`)
    profiles.set(id, {
      ...fallback,
      id, code: fallback?.code || `COL-${user.id.slice(0, 8)}`,
      name: fallback?.name || text(user.user_metadata?.name, text(user.user_metadata?.full_name, email.split("@")[0])),
      email, role: fallback?.role || text(user.user_metadata?.role_title, "Colaborador"), department: fallback?.department || "Operações & Logística",
      phone: text(user.user_metadata?.phone, fallback?.phone || ""),
      mobile_phone: text(user.user_metadata?.phone, fallback?.mobile_phone || ""),
      avatar: text(user.user_metadata?.avatar, text(metadata.avatar, fallback?.avatar)) || undefined,
      status: metadata.staff_status === "Inativo" ? "Inativo" : "Ativo",
      access_level: level, permissions: parsePermissions(metadata.permissions ?? fallback?.permissions),
      agency_location: fallback?.agency_location || "", admission_date: fallback?.admission_date || user.created_at?.slice(0, 10) || "",
      avatar_color: fallback?.avatar_color || "#477D68", created_at: user.created_at || "",
      // Server-managed metadata takes precedence over the default fixture.
      ...(metadata.permissions !== undefined ? { permissions: parsePermissions(metadata.permissions) } : {}),
      ...(metadata.access_level !== undefined || metadata.role === "admin" ? { access_level: level } : {}),
      ...(metadata.staff_status === "Inativo" ? { status: "Inativo" as const } : {}),
    })
    candidateIds.add(id)
    if (metadata.colaborador_id && typeof metadata.colaborador_id === "string") candidateIds.add(metadata.colaborador_id)
    if (fallback?.id) candidateIds.add(fallback.id)
    if (user.id) candidateIds.add(`col-${user.id.slice(0, 8)}`)
  }
  const merge = (id: string, fields: Partial<Colaborador>) => {
    const email = staffEmail(fields.email)
    const existingByEmail = email ? [...profiles.values()].find(c => staffEmail(c.email) === email) : undefined
    const previous = profiles.get(id) || existingByEmail
    if (!previous && !fields.name) return
    if (existingByEmail && existingByEmail.id !== id) profiles.delete(existingByEmail.id)
    profiles.set(id, { ...previous, ...fields, id } as Colaborador)
  }
  try {
    if (await supportsDatabaseFeature(db, "colaboradores")) {
      let query = db.from("colaboradores").select("*").eq("tenant_id", tenantId)
      if (candidateIds.size > 0 && users.length <= 10) {
        query = query.in("id", Array.from(candidateIds))
      }
      const { data, error } = await query
      if (!error && data) {
        for (const row of data) {
          merge(row.id, { ...row, permissions: parsePermissions(row.permissions) })
          candidateIds.add(row.id)
        }
      }
    }
  } catch { /* Older installations persist profiles in audit_log. */ }

  const candidateIdList = Array.from(candidateIds).filter(Boolean)
  for (let offset = 0; ; offset += 1000) {
    let query = db.from("audit_log").select("id, action, details, created_at")
      .eq("tenant_id", tenantId)
      .in("action", ["colaborador_created", "colaborador_updated", "colaborador_deleted", "colaborador_credentials_updated"])
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + 999)

    // PERF-001: Only replay audit events for the relevant collaborator IDs instead of scanning the full table
    if (candidateIdList.length > 0) {
      query = query.in("details->>id", candidateIdList)
    }

    const { data: logs, error } = await query
    if (error) throw new Error("Não foi possível consultar os acessos dos colaboradores.")
    for (const log of logs || []) {
      const details = log.details as Partial<Colaborador> & { colaborador_id?: string }
      if (!details || typeof details !== "object") continue
      const id = details.id || details.colaborador_id
      if (!id) continue
      // Do not replay an old event over a more recent table update.
      const previous = profiles.get(id)
      if (previous?.updated_at && log.created_at && Date.parse(previous.updated_at) > Date.parse(log.created_at)) continue
      if (log.action === "colaborador_deleted") { profiles.delete(id); continue }
      merge(id, { ...details, ...(details.permissions !== undefined ? { permissions: parsePermissions(details.permissions) } : {}) })
    }
    if (!logs || logs.length < 1000) break
  }
  return [...profiles.values()].map(profile => ({
    ...profile,
    email: staffEmail(profile.email),
    access_level: staffEmail(profile.email) === OWNER_EMAIL ? "Administrador" as const : profile.access_level,
    permissions: profile.access_level === "Administrador" || staffEmail(profile.email) === OWNER_EMAIL
      ? [...AVAILABLE_STAFF_PERMISSIONS] : parsePermissions(profile.permissions),
  })).sort((a, b) => (a.code || "").localeCompare(b.code || ""))
}
