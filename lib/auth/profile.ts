import { cache } from "react"
import { createAdminClient } from "@/lib/supabase/server"
import { getAuthContext } from "@/lib/auth/context"

export type UserProfile = {
  name: string | null
  phone: string | null
  department: string | null
  location: string | null
  avatar_url: string | null
}

/** Reads the current user's profile from the database (never from the auth token). */
export const getMyProfile = cache(async (): Promise<UserProfile | null> => {
  try {
    const ctx = await getAuthContext()
    if (!ctx?.user?.id) return null
    const { data, error } = await createAdminClient()
      .from("user_profiles")
      .select("name, phone, department, location, avatar_url")
      .eq("user_id", ctx.user.id)
      .maybeSingle()
    if (error) return null
    return data
  } catch {
    return null
  }
})
