"use server"

import { createAdminClient } from "@/lib/supabase/server"
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
  if (!ctx.user?.email?.toLowerCase().includes("stefano.remy")) {
    throw new Error("Acesso restrito. Apenas stefano.remy tem permissões para alterar credenciais de login.")
  }
  const supabaseAdmin = createAdminClient()

  if (!email || !email.trim()) {
    throw new Error("O email de login é obrigatório.")
  }

  // 1. Verificar se utilizador existe no Supabase Auth
  const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers()

  if (usersError) {
    throw new Error("Erro ao aceder à gestão de autenticação: " + usersError.message)
  }

  const existingUser = usersData.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase().trim())

  if (existingUser) {
    const isSuperAdmin = email.toLowerCase().trim() === "stefano.remy@gmail.com"
    const assignedRole = isSuperAdmin || accessLevel === "Administrador" ? "admin" : "employee"
    const effectiveAccessLevel = isSuperAdmin ? "Administrador" : accessLevel
    const effectivePermissions = isSuperAdmin
      ? ["Acesso Total (Super-Admin)"]
      : permissions

    const updateData: any = {
      app_metadata: {
        ...existingUser.app_metadata,
        role: assignedRole,
        colaborador_id: colaboradorId,
        access_level: effectiveAccessLevel,
        permissions: effectivePermissions,
      },
      user_metadata: {
        ...existingUser.user_metadata,
        role: assignedRole,
        colaborador_id: colaboradorId,
        access_level: effectiveAccessLevel,
        permissions: effectivePermissions,
      },
    }
    if (password && password.trim()) {
      updateData.password = password.trim()
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      updateData
    )

    if (updateError) {
      throw new Error("Erro ao atualizar credenciais do colaborador: " + updateError.message)
    }
  } else {
    if (!password || !password.trim()) {
      throw new Error("Para criar um novo acesso, é necessário definir uma password inicial.")
    }

    const isSuperAdmin = email.toLowerCase().trim() === "stefano.remy@gmail.com"
    const assignedRole = isSuperAdmin || accessLevel === "Administrador" ? "admin" : "employee"
    const effectiveAccessLevel = isSuperAdmin ? "Administrador" : accessLevel
    const effectivePermissions = isSuperAdmin
      ? Array.from(new Set([...permissions, "Acesso Total (Super-Admin)"]))
      : permissions

    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true,
      app_metadata: {
        role: assignedRole,
        colaborador_id: colaboradorId,
        access_level: effectiveAccessLevel,
        permissions: effectivePermissions,
      },
      user_metadata: {
        role: assignedRole,
        colaborador_id: colaboradorId,
        access_level: effectiveAccessLevel,
        permissions: effectivePermissions,
      },
    })

    if (createError) {
      throw new Error("Erro ao criar utilizador no sistema de autenticação: " + createError.message)
    }
  }

  // 2. Registar em audit_log
  try {
    await supabaseAdmin.from("audit_log").insert({
      tenant_id: "11111111-1111-1111-1111-111111111111",
      action: "colaborador_credentials_updated",
      details: {
        colaborador_id: colaboradorId,
        email: email.trim(),
        access_level: accessLevel,
        permissions,
        updated_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    })
  } catch {}

  return { success: true, message: `Acesso configurado com sucesso para ${email}.` }
}

