import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { createAdminClient } from "@/lib/supabase/server"

const LINKE_TENANT_ID = "11111111-1111-1111-1111-111111111111"

export type AuthContext = {
  user: any
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

export async function getAuthContext(): Promise<AuthContext | null> {
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

  // Phase 5: Query the `colaboradores` table directly, preventing user_metadata spoofing.
  let role: "client" | "employee" | "admin" | null = null;
  let client_id: string | null = null;
  let colaborador_id: string | null = null;
  let permissions: string[] = [];

  const supabaseAdmin = createAdminClient()
  
  // 1. Check if the user is an employee in the database
  const { data: colab } = await supabaseAdmin
    .from("colaboradores")
    .select("id, access_level, permissions")
    .eq("email", user.email)
    .single()

  if (colab) {
    role = colab.access_level === 'Administrador' ? 'admin' : 'employee'
    colaborador_id = colab.id
    permissions = Array.isArray(colab.permissions) ? colab.permissions : JSON.parse(colab.permissions || '[]')
  } else {
    // 2. Fall back to app_metadata (secure) or user_metadata (legacy) for clients
    const metadata = user.app_metadata?.role ? user.app_metadata : (user.user_metadata || {})
    role = metadata.role || null
    
    if (role === 'client') {
      client_id = metadata.client_id || null
    } else if (role === 'employee' || role === 'admin') {
      // Legacy fallback for employees not yet in `colaboradores` table
      colaborador_id = metadata.colaborador_id || null
      permissions = metadata.permissions || []
    }
  }

  // Check for secure impersonation cookie
  if ((role === 'employee' || role === 'admin')) {
    const impersonatedId = cookieStore.get("impersonated_client_id")?.value
    if (impersonatedId) {
      client_id = impersonatedId
    }
  }

  return {
    user,
    role,
    tenant_id: LINKE_TENANT_ID,
    client_id,
    colaborador_id,
    permissions
  }
}

/**
 * Ensures the caller is authenticated. Throws if not.
 */
export async function requireUser(): Promise<AuthContext> {
  const ctx = await getAuthContext()
  if (!ctx) {
    throw new Error("Não autorizado. Faça login para continuar.")
  }
  return ctx
}

/**
 * Ensures the caller is an authenticated employee or admin. Throws if not.
 */
export async function requireEmployee(): Promise<AuthContext> {
  const ctx = await requireUser()
  if (ctx.role !== 'employee' && ctx.role !== 'admin') {
    throw new Error("Acesso negado. Apenas colaboradores podem aceder a este recurso.")
  }
  return ctx
}

/**
 * Ensures the caller is an authenticated employee with a specific permission.
 */
export async function requirePermission(permission: string): Promise<AuthContext> {
  const ctx = await requireEmployee()
  if (!ctx.permissions.includes(permission) && ctx.role !== 'admin') {
    throw new Error(`Acesso negado. Permissão necessária: ${permission}.`)
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

  if (ctx.role === 'client' && ctx.client_id !== targetClientId) {
    throw new Error("Acesso negado. Não tem permissão para aceder a dados deste cliente.")
  }

  return ctx
}
