"use server"

import { revalidatePath } from "next/cache"
import { createAdminClient } from "@/lib/supabase/server"
import type { Colaborador } from "@/app/ops/entidades/colaboradores/types"
import { requireAdmin, requireEmployee } from "@/lib/auth/context"
import { listStaffAuthUsers, loadStaffDirectory, OWNER_EMAIL, staffEmail } from "@/lib/auth/staff-directory"
import { hasPermission, PERMISSIONS, PERMISSION_PRESETS, validateStaffAccess } from "@/lib/auth/permissions"

export async function getColaboradoresAction(): Promise<Colaborador[]> {
  const ctx = await requireEmployee()
  if (ctx.role !== "admin" && !hasPermission(ctx, PERMISSIONS.salaries)) throw new Error("Acesso restrito à gestão de colaboradores.")
  const db = createAdminClient()
  const users = await listStaffAuthUsers(db)
  return loadStaffDirectory(db, ctx.tenant_id, users)
}

/**
 * Cria ou atualiza um colaborador
 */
export async function saveColaboradorAction(colaboradorData: Partial<Colaborador> & { name: string; role: string; department: string }) {
  const ctx = await requireAdmin()

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const directory = await getColaboradoresAction()
  const existing = colaboradorData.id ? directory.find(c => c.id === colaboradorData.id) : undefined
  if (colaboradorData.id && !existing) throw new Error("Colaborador não disponível nesta empresa.")
  const accessLevel = colaboradorData.access_level ?? existing?.access_level ?? "Operacional"
  const requestedPermissions = colaboradorData.permissions ?? existing?.permissions ?? PERMISSION_PRESETS[0].permissions
  const permissions = validateStaffAccess(accessLevel, requestedPermissions)
  if (existing?.email === OWNER_EMAIL && (staffEmail(colaboradorData.email || existing.email) !== OWNER_EMAIL || accessLevel !== "Administrador" || colaboradorData.status === "Inativo")) {
    throw new Error("O acesso da conta principal não pode ser removido.")
  }
  if (existing && (existing.id === ctx.colaborador_id || staffEmail(existing.email) === staffEmail(ctx.user?.email)) && (accessLevel !== "Administrador" || colaboradorData.status === "Inativo")) {
    throw new Error("Não pode remover o seu próprio acesso de administrador.")
  }
  const input = { ...existing, ...colaboradorData }
  const id = input.id || `col-${crypto.randomUUID()}`
  const code = input.code || `COL00${Math.floor(Math.random() * 90 + 10)}`

  const fullColaborador: Colaborador = {
    id,
    code,
    name: input.name,
    role: input.role,
    department: input.department,
    email: input.email || `${input.name.toLowerCase().replace(/\s+/g, ".")}@linkelogistics.pt`,
    phone: input.phone || "910000000",
    mobile_phone: input.mobile_phone || input.phone || "910000000",
    nif: input.nif || "",
    status: input.status || "Ativo",
    access_level: accessLevel,
    agency_location: input.agency_location || "Sede - Felgueiras / Guimarães",
    admission_date: input.admission_date || now.slice(0, 10),
    avatar_color: input.avatar_color || "#16a34a",
    avatar: input.avatar || undefined,
    permissions,
    emergency_contact: input.emergency_contact || "",
    notes: input.notes || "",
    created_at: existing?.created_at || input.created_at || now,
    updated_at: now,
  }

  if (!fullColaborador.name.trim() || !fullColaborador.email.includes("@")) throw new Error("Preencha o nome e um email válido.")
  if (!["Ativo", "Inativo", "Férias"].includes(fullColaborador.status)) throw new Error("Estado inválido.")
  if (directory.some(c => c.id !== id && staffEmail(c.email) === staffEmail(fullColaborador.email))) throw new Error("Este email já pertence a outro colaborador.")
  const authUsers = await listStaffAuthUsers(supabase)
  const authUser = authUsers.find(u => u.app_metadata?.colaborador_id === id || staffEmail(u.email) === staffEmail(existing?.email || fullColaborador.email))
  if (authUser && (authUser.app_metadata?.role === "client" || authUser.app_metadata?.tenant_id && authUser.app_metadata.tenant_id !== ctx.tenant_id)) throw new Error("Esta conta não pertence aos colaboradores desta empresa.")
  if (authUsers.some(u => u.id !== authUser?.id && staffEmail(u.email) === staffEmail(fullColaborador.email))) throw new Error("Este email já está associado a outra conta.")
  const { error: auditError } = await supabase.from("audit_log").insert({
    tenant_id: ctx.tenant_id,
    action: existing ? "colaborador_updated" : "colaborador_created",
    details: fullColaborador,
    created_at: now,
  })
  if (auditError) throw new Error("Não foi possível guardar os acessos do colaborador.")
  // Older installations use audit_log when the colaboradores table is unavailable.
  try { await supabase.from("colaboradores").upsert({ ...fullColaborador, tenant_id: ctx.tenant_id }, { onConflict: "id" }) } catch {}

  // Keep the trusted auth fallback aligned too, including ordinary profile edits.
  if (authUser) {
    const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
      email: staffEmail(fullColaborador.email),
      app_metadata: { ...authUser.app_metadata, tenant_id: ctx.tenant_id, colaborador_id: id,
        role: accessLevel === "Administrador" ? "admin" : "employee", access_level: accessLevel,
        permissions, staff_status: fullColaborador.status },
    })
    if (error) throw new Error("Perfil guardado, mas a conta de acesso não foi sincronizada. Tente novamente.")
  }

  revalidatePath("/ops", "layout")
  return { success: true, colaborador: fullColaborador }
}

/** Remove a profile and revoke its staff role. */
export async function deleteColaboradorAction(id: string) {
  const ctx = await requireAdmin()
  const existing = (await getColaboradoresAction()).find(c => c.id === id)
  if (!existing) throw new Error("Colaborador não disponível nesta empresa.")
  if (existing.email === OWNER_EMAIL || existing.id === ctx.colaborador_id || staffEmail(existing.email) === staffEmail(ctx.user?.email)) throw new Error("Não pode eliminar esta conta de administrador.")
  const db = createAdminClient()
  const { error } = await db.from("audit_log").insert({ tenant_id: ctx.tenant_id,
    action: "colaborador_deleted", details: { id }, created_at: new Date().toISOString() })
  if (error) throw new Error("Não foi possível remover o colaborador.")
  try { await db.from("colaboradores").delete().eq("tenant_id", ctx.tenant_id).eq("id", id) } catch {}
  revalidatePath("/ops", "layout")
  return { success: true }
}

export async function toggleColaboradorStatusAction(id: string, status: Colaborador["status"]) {
  await requireAdmin()
  if (!["Ativo", "Inativo", "Férias"].includes(status)) throw new Error("Estado inválido.")
  const existing = (await getColaboradoresAction()).find(c => c.id === id)
  if (!existing) throw new Error("Colaborador não disponível nesta empresa.")
  return saveColaboradorAction({ ...existing, status })
}
