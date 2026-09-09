"use server"

import { createAdminClient } from "@/lib/supabase/server"

export async function setClientPasswordAction(clientId: string, email: string, password?: string) {
  const supabaseAdmin = createAdminClient()

  if (!email) {
    throw new Error("O email é obrigatório para o login.")
  }

  // Check if a user with this email already exists
  const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
  
  if (usersError) {
    throw new Error("Erro ao verificar utilizadores: " + usersError.message)
  }

  const existingUser = usersData.users.find((u: any) => u.email === email)

  if (existingUser) {
    // Update the existing user's password and metadata
    const updateData: any = {
      user_metadata: { role: 'client', client_id: clientId },
    }
    if (password) {
      updateData.password = password
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      existingUser.id,
      updateData
    )

    if (updateError) {
      throw new Error("Erro ao atualizar password do cliente: " + updateError.message)
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
      user_metadata: { role: 'client', client_id: clientId }
    })

    if (createError) {
      throw new Error("Erro ao criar acesso do cliente: " + createError.message)
    }

    return { success: true, message: "Acesso criado com sucesso." }
  }
}
