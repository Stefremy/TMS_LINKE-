import { timingSafeEqual } from "node:crypto"
import { getAuthContext } from "@/lib/auth/context"
import { canAccessOpsRoute } from "@/lib/auth/permissions"

function safeSecretEqual(expected: string, supplied: string): boolean {
  const expectedBuf = Buffer.from(expected)
  const suppliedBuf = Buffer.from(supplied)
  if (expectedBuf.length !== suppliedBuf.length) return false
  return timingSafeEqual(expectedBuf, suppliedBuf)
}

export async function isCronAuthorized(request: Request): Promise<boolean> {
  const envSecret = process.env.CRON_SECRET?.trim()

  if (envSecret) {
    const authHeader = request.headers.get("authorization")?.trim() || ""
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim()
      if (token && safeSecretEqual(envSecret, token)) return true
    }

    const customHeader = request.headers.get("x-cron-secret")?.trim()
    if (customHeader && safeSecretEqual(envSecret, customHeader)) return true
  }

  // Allow authenticated operations staff with communications permissions (manual UI / dry-run)
  try {
    const ctx = await getAuthContext()
    if (ctx && canAccessOpsRoute(ctx, "/ops/comunicacoes")) {
      return true
    }
  } catch {
    // ignore
  }

  return false
}
