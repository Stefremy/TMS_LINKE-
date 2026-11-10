import "server-only"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import * as authContext from "@/lib/auth/context"

/** Logout is idempotent: an expired session or provider failure must not trap the browser. */
export async function logoutSession(): Promise<"/login" | "/app/login"> {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  if ("invalidateAuthCacheForCookies" in authContext && typeof authContext.invalidateAuthCacheForCookies === "function") {
    try { await authContext.invalidateAuthCacheForCookies(allCookies) } catch {}
  }
  const source = cookieStore.get("portal_login_source")?.value
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch { /* Remove local credentials even when the session no longer exists. */ }
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0]
  const prefix = `sb-${projectRef}-auth-token`
  for (const cookie of allCookies) {
    if (cookie.name === prefix || cookie.name.startsWith(`${prefix}.`) && /^\d+$/.test(cookie.name.slice(prefix.length + 1))) {
      cookieStore.delete(cookie.name)
    }
  }
  cookieStore.delete("impersonated_client_id")
  cookieStore.delete("portal_login_source")
  return source === "client" ? "/app/login" : "/login"
}
