"use server"

import { createAdminClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/auth/context"

export async function saveMyProfileAction(input: {
  name: string
  phone: string
  department: string
  location: string
  avatar_url: string | null
}): Promise<{ success: boolean; error?: string }> {
  const ctx = await getAuthContext()
  if (!ctx?.user?.id) return { success: false, error: "Sessão inválida." }

  const avatar = input.avatar_url?.trim() || null
  if (avatar && (!/^https:\/\//.test(avatar) || avatar.length > 500)) {
    return { success: false, error: "URL de avatar inválido." }
  }

  const admin = createAdminClient()
  const { error } = await admin.from("user_profiles").upsert({
    user_id: ctx.user.id,
    name: input.name.trim().slice(0, 120),
    phone: input.phone.trim().slice(0, 40),
    department: input.department.trim().slice(0, 80),
    location: input.location.trim().slice(0, 120),
    avatar_url: avatar,
    updated_at: new Date().toISOString(),
  })
  if (error) {
    return { success: false, error: error.message }
  }

  // Keep the auth token small: drop any legacy avatar stored in user_metadata.
  const legacy = ctx.user.user_metadata || {}
  if (legacy.avatar) {
    const { avatar: _drop, ...rest } = legacy
    await admin.auth.admin.updateUserById(ctx.user.id, { user_metadata: rest })
  }

  return { success: true }
}
