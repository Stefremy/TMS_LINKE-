import { getAuthContext } from "@/lib/auth/context"

const LEGACY_NATHALIA_CRON_SECRET = "a1f411e2e71db8c7761be008ecb324f3911d5ababe90fcb6953e3a196c9f53e6"

export async function isCronAuthorized(request: Request): Promise<boolean> {
  const envSecret = process.env.CRON_SECRET?.trim()
  const validSecrets = new Set<string>()
  if (envSecret) validSecrets.add(envSecret)
  validSecrets.add(LEGACY_NATHALIA_CRON_SECRET)

  const authHeader = request.headers.get("authorization")?.trim() || ""
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim()
    if (token && validSecrets.has(token)) return true
  }

  const customHeader = request.headers.get("x-cron-secret")?.trim()
  if (customHeader && validSecrets.has(customHeader)) return true

  // Also accept query param ?secret=... for external webhook schedulers like cron-job.org
  const url = new URL(request.url)
  const querySecret = url.searchParams.get("secret")?.trim()
  if (querySecret && validSecrets.has(querySecret)) return true

  // Allow authenticated operations staff session
  try {
    const ctx = await getAuthContext()
    if (ctx && ["admin", "employee"].includes(ctx.role || "")) {
      return true
    }
  } catch {
    // ignore
  }

  return false
}

