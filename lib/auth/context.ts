import type { User } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { cache } from "react"
import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/server"
import { supabasePublicKey } from "@/lib/supabase/public-key"
import { loadStaffDirectory, staffEmail } from "./staff-directory"
import { hasPermission } from "./permissions"
import { enforcePortalSuspension } from '@/lib/client-portal/suspension'

export const LINKE_TENANT_ID = "11111111-1111-1111-1111-111111111111"

export type AuthContext = {
  user: User
  role: "client" | "employee" | "admin" | null
  tenant_id: string
  client_id: string | null
  colaborador_id: string | null
  permissions: string[]
}

export type AuthContextResolution = {
  context: AuthContext | null
  rateLimited: boolean
}

type CookieEntry = { name: string; value: string }
type CapturedCookie = { name: string; value: string; options?: Record<string, unknown> }
type ParsedCookieSession = {
  accessToken: string
  refreshToken: string | null
  expiresAtMs: number | null
}
type VerifiedResolution = {
  user: User | null
  rateLimited: boolean
  capturedCookies: CapturedCookie[]
}

const VERIFIED_USER_CACHE_TTL_MS = 45_000
const RECENT_REFRESH_CACHE_TTL_MS = 15_000
const RATE_LIMIT_COOLDOWN_MS = 15_000
const PROACTIVE_REFRESH_MARGIN_MS = 95_000
const MAX_AUTH_CACHE_SIZE = 500

const verifiedUserCache = new Map<string, { user: User; expiresAtMs: number }>()
const proactivePreserveCache = new Map<string, { user: User; hardExpiresAtMs: number }>()
const recentRefreshCache = new Map<string, { user: User; capturedCookies: CapturedCookie[]; expiresAtMs: number }>()
const rateLimitCooldownCache = new Map<string, number>()
const authResolutionInFlight = new Map<string, Promise<VerifiedResolution>>()

function setBoundedCache<V>(map: Map<string, V>, key: string, value: V) {
  if (map.has(key)) map.delete(key)
  else if (map.size >= MAX_AUTH_CACHE_SIZE) {
    const oldest = map.keys().next().value
    if (oldest !== undefined) map.delete(oldest)
  }
  map.set(key, value)
}

function decodeBase64UrlUtf8(input: string): string | null {
  try {
    const base64 = input.replace(/-/g, "+").replace(/_/g, "/")
    const padLength = (4 - (base64.length % 4)) % 4
    const binary = atob(base64 + "=".repeat(padLength))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function parseSupabaseSessionFromCookies(allCookies: CookieEntry[]): ParsedCookieSession | null {
  const groups = new Map<string, { direct?: string; chunks: Array<{ index: number; value: string }> }>()
  for (const cookie of allCookies) {
    const match = /^(sb-[^-]+-auth-token)(?:\.(\d+))?$/.exec(cookie.name)
    if (!match) continue
    const baseName = match[1]
    const group = groups.get(baseName) || { chunks: [] }
    if (match[2] === undefined) {
      group.direct = cookie.value
    } else {
      group.chunks.push({ index: Number(match[2]), value: cookie.value })
    }
    groups.set(baseName, group)
  }

  for (const group of groups.values()) {
    const raw =
      typeof group.direct === "string" && group.direct.length > 0
        ? group.direct
        : group.chunks.length > 0
          ? group.chunks.sort((a, b) => a.index - b.index).map(chunk => chunk.value).join("")
          : ""
    if (!raw) continue

    const jsonText = raw.startsWith("base64-") ? decodeBase64UrlUtf8(raw.slice(7)) : raw
    if (!jsonText) continue
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>
      if (typeof parsed?.access_token !== "string" || !parsed.access_token) continue

      let expiresAtMs: number | null =
        typeof parsed.expires_at === "number" && Number.isFinite(parsed.expires_at)
          ? parsed.expires_at * 1000
          : null

      if (expiresAtMs === null) {
        const jwtParts = parsed.access_token.split(".")
        if (jwtParts.length === 3) {
          const payloadText = decodeBase64UrlUtf8(jwtParts[1])
          if (payloadText) {
            const payload = JSON.parse(payloadText) as { exp?: unknown }
            if (typeof payload.exp === "number" && Number.isFinite(payload.exp)) {
              expiresAtMs = payload.exp * 1000
            }
          }
        }
      }

      return {
        accessToken: parsed.access_token,
        refreshToken: typeof parsed.refresh_token === "string" && parsed.refresh_token ? parsed.refresh_token : null,
        expiresAtMs,
      }
    } catch {
      continue
    }
  }
  return null
}

async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return value
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")
}

function isAuthRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const record = err as { status?: unknown; code?: unknown; message?: unknown }
  return (
    record.status === 429 ||
    record.code === "over_request_rate_limit" ||
    (typeof record.message === "string" && record.message.toLowerCase().includes("rate limit"))
  )
}

export async function invalidateAuthCacheForCookies(allCookies: CookieEntry[]) {
  const session = parseSupabaseSessionFromCookies(allCookies)
  if (!session) return
  const accessHash = await sha256Hex(session.accessToken)
  verifiedUserCache.delete(accessHash)
  proactivePreserveCache.delete(accessHash)
  const sessionKey = await sha256Hex(session.refreshToken || session.accessToken)
  recentRefreshCache.delete(sessionKey)
  rateLimitCooldownCache.delete(sessionKey)
}

/**
 * Retrieves the current authenticated user and parses their role/context securely.
 */
export async function getTenantId(): Promise<string> {
  const ctx = await getAuthContext()
  return ctx?.tenant_id || LINKE_TENANT_ID
}

export const getAuthContextState = cache(async (): Promise<AuthContextResolution> => {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const cookieOptions = {
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  }
  const applyCookiesToStore = (cookiesToSet: CapturedCookie[]) => {
    const writable = cookieStore as unknown as {
      set?: (name: string, value: string, options?: Record<string, unknown>) => void
    }
    if (typeof writable.set !== "function" || cookiesToSet.length === 0) return
    try {
      for (const { name, value, options } of cookiesToSet) {
        writable.set(name, value, { ...cookieOptions, ...options })
      }
    } catch {
      // Server Components cannot mutate cookies; Route Handlers and Server Actions persist them.
    }
  }

  const parsedSession = parseSupabaseSessionFromCookies(allCookies)
  let user: User | null = null
  let rateLimited = false

  if (parsedSession) {
    const now = Date.now()
    const accessHash = await sha256Hex(parsedSession.accessToken)
    const tokenFarFromExpiry =
      parsedSession.expiresAtMs !== null && parsedSession.expiresAtMs - now > PROACTIVE_REFRESH_MARGIN_MS

    if (tokenFarFromExpiry) {
      const cached = verifiedUserCache.get(accessHash)
      if (cached && cached.expiresAtMs > now) {
        user = cached.user
      }
    }

    if (!user) {
      const sessionKey = await sha256Hex(parsedSession.refreshToken || parsedSession.accessToken)
      const recentRefresh = recentRefreshCache.get(sessionKey)
      if (recentRefresh && recentRefresh.expiresAtMs > now) {
        applyCookiesToStore(recentRefresh.capturedCookies)
        user = recentRefresh.user
      } else {
        const cooldownUntil = rateLimitCooldownCache.get(sessionKey)
        if (cooldownUntil && cooldownUntil > now) {
          const preserved = proactivePreserveCache.get(accessHash)
          if (
            preserved &&
            parsedSession.expiresAtMs !== null &&
            parsedSession.expiresAtMs > now + 5_000 &&
            preserved.hardExpiresAtMs > now + 5_000
          ) {
            user = preserved.user
          } else {
            return { context: null, rateLimited: true }
          }
        } else {
          let pending = authResolutionInFlight.get(sessionKey)
          if (!pending) {
            pending = (async (): Promise<VerifiedResolution> => {
              const capturedCookies: CapturedCookie[] = []
              const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                supabasePublicKey(),
                {
                  cookieOptions,
                  cookies: {
                    getAll() {
                      return allCookies
                    },
                    setAll(cookiesToSet) {
                      capturedCookies.push(...cookiesToSet)
                      applyCookiesToStore(cookiesToSet)
                    },
                  },
                }
              )

              const { data: { user: fetchedUser }, error } = await supabase.auth.getUser()
              const hitRateLimit = isAuthRateLimitError(error)
              const resolvedAt = Date.now()

              if (fetchedUser && !error) {
                if (parsedSession.expiresAtMs !== null) {
                  setBoundedCache(proactivePreserveCache, accessHash, {
                    user: fetchedUser,
                    hardExpiresAtMs: parsedSession.expiresAtMs,
                  })
                  if (parsedSession.expiresAtMs - resolvedAt > PROACTIVE_REFRESH_MARGIN_MS) {
                    setBoundedCache(verifiedUserCache, accessHash, {
                      user: fetchedUser,
                      expiresAtMs: Math.min(
                        resolvedAt + VERIFIED_USER_CACHE_TTL_MS,
                        parsedSession.expiresAtMs - PROACTIVE_REFRESH_MARGIN_MS
                      ),
                    })
                  }
                }
                if (capturedCookies.length > 0) {
                  setBoundedCache(recentRefreshCache, sessionKey, {
                    user: fetchedUser,
                    capturedCookies,
                    expiresAtMs: resolvedAt + RECENT_REFRESH_CACHE_TTL_MS,
                  })
                  const refreshedSession = parseSupabaseSessionFromCookies(capturedCookies)
                  if (refreshedSession?.accessToken && refreshedSession.expiresAtMs !== null) {
                    const refreshedAccessHash = await sha256Hex(refreshedSession.accessToken)
                    setBoundedCache(proactivePreserveCache, refreshedAccessHash, {
                      user: fetchedUser,
                      hardExpiresAtMs: refreshedSession.expiresAtMs,
                    })
                    if (refreshedSession.expiresAtMs - resolvedAt > PROACTIVE_REFRESH_MARGIN_MS) {
                      setBoundedCache(verifiedUserCache, refreshedAccessHash, {
                        user: fetchedUser,
                        expiresAtMs: Math.min(
                          resolvedAt + VERIFIED_USER_CACHE_TTL_MS,
                          refreshedSession.expiresAtMs - PROACTIVE_REFRESH_MARGIN_MS
                        ),
                      })
                    }
                  }
                }
                return { user: fetchedUser, rateLimited: false, capturedCookies }
              }

              if (hitRateLimit) {
                setBoundedCache(rateLimitCooldownCache, sessionKey, resolvedAt + RATE_LIMIT_COOLDOWN_MS)
                const preserved = proactivePreserveCache.get(accessHash)
                if (
                  preserved &&
                  parsedSession.expiresAtMs !== null &&
                  parsedSession.expiresAtMs > resolvedAt + 5_000 &&
                  preserved.hardExpiresAtMs > resolvedAt + 5_000
                ) {
                  return { user: preserved.user, rateLimited: false, capturedCookies }
                }
              }

              return { user: null, rateLimited: hitRateLimit, capturedCookies }
            })().finally(() => {
              authResolutionInFlight.delete(sessionKey)
            })
            authResolutionInFlight.set(sessionKey, pending)
          }

          const resolution = await pending
          if (resolution.capturedCookies.length > 0) {
            applyCookiesToStore(resolution.capturedCookies)
          }
          user = resolution.user
          rateLimited = resolution.rateLimited
        }
      }
    }
  } else {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabasePublicKey(),
      {
        cookies: {
          getAll() {
            return allCookies
          },
          setAll(cookiesToSet) {
            applyCookiesToStore(cookiesToSet)
          },
        },
      }
    )

    const { data: { user: fetchedUser }, error } = await supabase.auth.getUser()
    if (error || !fetchedUser) {
      return { context: null, rateLimited: isAuthRateLimitError(error) }
    }
    user = fetchedUser
  }

  if (!user) {
    return { context: null, rateLimited }
  }

  // Staff permissions come from trusted storage, shared with the employee editor.
  let role: "client" | "employee" | "admin" | null = null;
  let client_id: string | null = null;
  let colaborador_id: string | null = null;
  let permissions: string[] = [];

  const metadata = user.app_metadata || {}

  // Fast path for clients: app_metadata is server-managed and cannot be spoofed by users.
  // Clients are never in colaboradores, so skipping that avoids a slow failing query.
  if (metadata.role === 'client') {
    role = 'client'
    client_id = metadata.client_id || null
    if (!client_id) {
      const supabaseAdmin = createAdminClient()
      const { data: clientUser } = await supabaseAdmin
        .from('client_users')
        .select('client_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (clientUser?.client_id) {
        client_id = clientUser.client_id
      }
    }
    if (client_id) await enforcePortalSuspension(metadata.tenant_id || LINKE_TENANT_ID, client_id)
    return {
      context: {
        user,
        role: 'client',
        tenant_id: metadata.tenant_id || LINKE_TENANT_ID,
        client_id,
        colaborador_id: null,
        permissions: [],
      },
      rateLimited: false,
    }
  }

  const supabaseAdmin = createAdminClient()
  const tenantId = typeof metadata.tenant_id === "string" ? metadata.tenant_id : LINKE_TENANT_ID
  const directory = await loadStaffDirectory(supabaseAdmin, tenantId, [user])
  const profile = directory.find(c => c.id === metadata.colaborador_id || staffEmail(c.email) === staffEmail(user.email))
  if (profile) {
    if (profile.status !== "Inativo") {
      role = profile.access_level === "Administrador" ? "admin" : "employee"
      colaborador_id = profile.id
      permissions = profile.permissions
    }
  } else if (!["admin", "employee"].includes(metadata.role)) {
    const { data: clientUser } = await supabaseAdmin.from("client_users")
      .select("client_id").eq("user_id", user.id).maybeSingle()
    if (clientUser?.client_id) {
      role = "client"
      client_id = clientUser.client_id
    }
  }

  // Check for secure impersonation cookie
  if ((role === 'employee' || role === 'admin')) {
    const impersonatedId = cookieStore.get("impersonated_client_id")?.value
    if (impersonatedId) {
      client_id = impersonatedId
    }
  }

  if (role === 'client' && client_id) await enforcePortalSuspension(LINKE_TENANT_ID, client_id)
  return {
    context: {
      user,
      role,
      tenant_id: tenantId,
      client_id,
      colaborador_id,
      permissions
    },
    rateLimited: false,
  }
})

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  return (await getAuthContextState()).context
})

/**
 * Ensures the caller is authenticated. Redirects to /login if not.
 */
export async function requireUser(staffPermissions?: string | readonly string[]): Promise<AuthContext> {
  const ctx = await getAuthContext()
  if (!ctx || !ctx.role || (ctx.role === 'client' && !ctx.client_id)) {
    redirect("/login")
  }
  if (staffPermissions && ctx.role !== "client") assertStaffPermissions(ctx, staffPermissions)
  return ctx
}

function assertStaffPermissions(ctx: AuthContext, permissions: string | readonly string[]) {
  const required = typeof permissions === "string" ? [permissions] : permissions
  if (!required.some(permission => hasPermission(ctx, permission))) {
    throw new Error(`Acesso negado. Permissão necessária: ${required.join(" ou ")}.`)
  }
}

/**
 * Ensures the caller is an authenticated employee or admin. Redirects if not.
 */
export async function requireEmployee(permissions?: string | readonly string[]): Promise<AuthContext> {
  const ctx = await requireUser()
  if (ctx.role !== 'employee' && ctx.role !== 'admin') {
    redirect("/login")
  }
  if (permissions) assertStaffPermissions(ctx, permissions)
  return ctx
}

/**
 * Ensures the caller is an authenticated employee with a specific permission.
 */
export async function requirePermission(permission: string): Promise<AuthContext> {
  const ctx = await requireEmployee()
  if (!hasPermission(ctx, permission)) {
    throw new Error(`Acesso negado. Permissão necessária: ${permission}.`)
  }
  return ctx
}

/**
 * Ensures the caller has a server-assigned administrator role.
 */
export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireUser()
  if (ctx.role !== 'admin') {
    throw new Error("Acesso restrito. Apenas administradores podem gerir credenciais e níveis de acesso.")
  }
  return ctx
}

/**
 * Ensures the caller has access to the specified client_id.
 * Valid for the actual client, or an employee impersonating the client.
 */
export async function requireClientAccess(targetClientId: string): Promise<AuthContext> {
  const ctx = await requireUser()
  
  if (ctx.role === 'employee' || ctx.role === 'admin') {
    // Employees bypass client ID restrictions if they are operating in the Ops portal
    return ctx
  }

  if (ctx.role !== 'client' || ctx.client_id !== targetClientId) {
    throw new Error("Acesso negado. Não tem permissão para aceder a dados deste cliente.")
  }

  return ctx
}
