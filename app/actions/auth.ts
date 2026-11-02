"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { listStaffAuthUsers, OWNER_EMAIL, staffEmail } from "@/lib/auth/staff-directory"
import { validateStaffAccess } from "@/lib/auth/permissions"
import { requireAdmin } from "@/lib/auth/context"
import { assertClientEmail, findClientUser, loadInvitationStore, normalizeInvitationEmail } from "@/lib/client-portal/invitations"

export async function setClientPasswordAction(clientId: string, email: string, password?: string) {
  const ctx = await requireAdmin()
  const supabaseAdmin = createAdminClient()
  email = normalizeInvitationEmail(email)
  if (password && (password.length < 12 || password.length > 128)) {
    throw new Error("A palavra-passe deve ter entre 12 e 128 caracteres.")
  }
  await loadInvitationStore(supabaseAdmin, clientId, ctx.tenant_id)
  await assertClientEmail(supabaseAdmin, email)
  const existingUser = await findClientUser(supabaseAdmin, email, clientId, ctx.tenant_id)

  if (existingUser) {
    // Update the existing user's password and metadata
    const updateData: { app_metadata: Record<string, unknown>; password?: string } = {
      app_metadata: { ...existingUser.app_metadata, role: 'client', client_id: clientId, tenant_id: ctx.tenant_id },
    }
    if (password) {
      updateData.password = password
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      updateData
    )

    if (updateError) {
      throw new Error("Não foi possível atualizar a palavra-passe do cliente.")
    }

    return { success: true, message: "Acesso atualizado com sucesso." }
  } else {
    // Create new user
    if (!password) {
      throw new Error("Para criar um novo acesso, tem de definir uma password inicial.")
    }

    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      app_metadata: { role: 'client', client_id: clientId, tenant_id: ctx.tenant_id },
    })

    if (createError) {
      throw new Error("Não foi possível criar o acesso do cliente.")
    }

    return { success: true, message: "Acesso criado com sucesso." }
  }
}

/**
 * Define ou atualiza as credenciais de login e nível de acesso do colaborador no Supabase Auth e TMS Linke
 */
export async function setColaboradorCredentialsAction(
  colaboradorId: string,
  email: string,
  password?: string,
  accessLevel: "Administrador" | "Operacional" | "Comercial / Suporte" = "Operacional",
  permissions: string[] = []
) {
  const ctx = await requireAdmin()
  email = staffEmail(email)
  const effectivePermissions = validateStaffAccess(accessLevel, permissions)
  if (!email.includes("@")) throw new Error("O email de login é obrigatório.")
  if (password && (password.trim().length < 12 || password.trim().length > 128)) throw new Error("A palavra-passe deve ter entre 12 e 128 caracteres.")
  const { getColaboradoresAction, saveColaboradorAction } = await import("./colaboradores")
  const profile = (await getColaboradoresAction()).find(c => c.id === colaboradorId)
  if (!profile) throw new Error("Colaborador não disponível nesta empresa.")
  if (profile.email === OWNER_EMAIL && staffEmail(ctx.user?.email) !== OWNER_EMAIL) throw new Error("As credenciais da conta principal só podem ser alteradas pelo seu titular.")
  if (profile.email === OWNER_EMAIL && (email !== OWNER_EMAIL || accessLevel !== "Administrador")) throw new Error("O acesso da conta principal não pode ser removido.")
  if ((profile.id === ctx.colaborador_id || profile.email === staffEmail(ctx.user?.email)) && accessLevel !== "Administrador") throw new Error("Não pode remover o seu próprio acesso de administrador.")
  const supabaseAdmin = createAdminClient()
  const users = await listStaffAuthUsers(supabaseAdmin)
  const existingUser = users.find(u => u.app_metadata?.colaborador_id === colaboradorId || staffEmail(u.email) === profile.email)
  if (users.some(u => staffEmail(u.email) === email && u.id !== existingUser?.id)) throw new Error("Este email já está associado a outra conta.")
  if (existingUser && (existingUser.app_metadata?.role === "client" || existingUser.app_metadata?.tenant_id && existingUser.app_metadata.tenant_id !== ctx.tenant_id)) throw new Error("Esta conta não pertence aos colaboradores desta empresa.")
  const app_metadata = {
    ...existingUser?.app_metadata, tenant_id: ctx.tenant_id, role: accessLevel === "Administrador" ? "admin" : "employee",
    colaborador_id: colaboradorId, access_level: accessLevel, permissions: effectivePermissions, staff_status: profile.status,
  }
  if (existingUser) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      email, app_metadata, ...(password?.trim() ? { password: password.trim() } : {}),
    })
    if (error) throw new Error("Não foi possível atualizar as credenciais do colaborador.")
  } else {
    if (!password?.trim()) throw new Error("Para criar um novo acesso, é necessário definir uma password inicial.")
    const { error } = await supabaseAdmin.auth.admin.createUser({ email, password: password.trim(), email_confirm: true, app_metadata })
    if (error) throw new Error("Não foi possível criar o acesso do colaborador.")
  }
  const saved = await saveColaboradorAction({ ...profile, email, access_level: accessLevel, permissions: effectivePermissions })
  return { success: true, message: `Acesso configurado com sucesso para ${email}.`, colaborador: saved.colaborador }
}
