import type { User } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { cache } from "react"
import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/server"
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

/**
 * Retrieves the current authenticated user and parses their role/context securely.
 */
export async function getTenantId(): Promise<string> {
  const ctx = await getAuthContext()
  return ctx?.tenant_id || LINKE_TENANT_ID
}

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {} // Read-only context
      }
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
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
      user,
      role: 'client',
      tenant_id: metadata.tenant_id || LINKE_TENANT_ID,
      client_id,
      colaborador_id: null,
      permissions: [],
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
    user,
    role,
    tenant_id: tenantId,
    client_id,
    colaborador_id,
    permissions
  }
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
