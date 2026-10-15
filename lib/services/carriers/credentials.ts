/**
 * Shared carrier credential helpers.
 * Importable from both server actions AND lib/ services without crossing action boundaries.
 */
import { createAdminClient } from "@/lib/supabase/server"
import { getTenantId } from "@/lib/auth/context"
import { CTTConnectionCredentials } from "@/lib/services/ctt/ctt-types"
import { CorreosCredentials } from "@/lib/services/correos/types"

// ─── CTT ────────────────────────────────────────────────────────────────────

const cttCredentialsCache = new Map<string, { credentials: CTTConnectionCredentials; time: number }>()

export async function resolveCttCredentials(connectionId?: string): Promise<CTTConnectionCredentials> {
  const tenantId = await getTenantId()
  const cacheKey = `${tenantId}:${connectionId || "default"}`
  const cached = cttCredentialsCache.get(cacheKey)
  if (cached && Date.now() - cached.time < 60000) return cached.credentials

  const supabase = createAdminClient()
  let connection: (Partial<CTTConnectionCredentials> & { client_id?: string; is_active?: boolean }) | null = null
  try {
    let query = supabase.from("carrier_connections").select("*").eq("tenant_id", tenantId)
      .in("carrier_code", ["ctt_expresso", "ctt"])
    if (connectionId) query = query.eq("id", connectionId)
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle()
    if (!error) connection = data
  } catch {}

  if (!connection) {
    try {
      const base = () => supabase.from("audit_log").select("details").eq("tenant_id", tenantId)
        .eq("action", "carrier_connection_config").in("details->>carrier_code", ["ctt_expresso", "ctt"])
      let data: { details?: any } | null = null
      if (connectionId) {
        const exact = await base().eq("id", connectionId).order("created_at", { ascending: false }).limit(1).maybeSingle()
        if (!exact.error) data = exact.data
      }
      // The selected id may be stale or point to a record that does not exist here:
      // use the company's configured CTT connection instead of blocking the shipment.
      if (!data) {
        const latest = await base().order("created_at", { ascending: false }).limit(1).maybeSingle()
        if (!latest.error) data = latest.data
      }
      connection = data?.details || null
    } catch {}
  }
  if (connection?.is_active === false) throw new Error("A ligação CTT está desativada.")

  const result: CTTConnectionCredentials = connection ? {
    contract_number: connection.contract_number || "",
    client_number: connection.client_id || connection.client_number || "",
    auth_id: connection.auth_id || "",
    user_id: connection.user_id || undefined,
    distribution_channel: connection.distribution_channel || 99,
    environment: connection.environment === "qa" ? "qa" : "production",
    default_subproduct: connection.default_subproduct || "EMSF056.01",
  } : {
    contract_number: process.env.CTT_CONTRACT_ID || "",
    client_number: process.env.CTT_CLIENT_ID || "",
    auth_id: process.env.CTT_AUTHENTICATION_ID || "",
    user_id: process.env.CTT_USER_ID || undefined,
    distribution_channel: Number(process.env.CTT_DISTRIBUTION_CHANNEL) || 99,
    environment: process.env.CTT_ENVIRONMENT === "qa" ? "qa" : "production",
    default_subproduct: process.env.CTT_DEFAULT_SUBPRODUCT || "EMSF056.01",
  }
  if (result.auth_id && result.client_number && result.contract_number) {
    cttCredentialsCache.set(cacheKey, { credentials: result, time: Date.now() })
  }
  return result
}

// ─── CORREOS EXPRESS ────────────────────────────────────────────────────────

let correosCredentialsCache: CorreosCredentials | null = null
let correosCredentialsCacheTime = 0

export async function resolveCorreosCredentials(connectionId?: string): Promise<CorreosCredentials> {
  if (!connectionId && correosCredentialsCache && Date.now() - correosCredentialsCacheTime < 60000) {
    return correosCredentialsCache
  }

  const supabase = createAdminClient()
  let result: CorreosCredentials | null = null

  try {
    let query = supabase
      .from("carrier_connections")
      .select("*")
      .eq("tenant_id", (await getTenantId()))
      
    if (connectionId) {
      query = query.eq("id", connectionId)
    } else {
      query = query.eq("carrier_code", "correos_express")
    }

    const { data: conn } = await query.single()

    if (conn) {
      result = {
        solicitante: conn.client_id,
        codRte: conn.contract_number,
        user: conn.auth_id,
        pass: conn.user_id || "",
        environment: (conn.environment === "qa" ? "test" : conn.environment as "test" | "production") || "production",
      }
    }
  } catch {}

  if (!result) {
    try {
      const { data: logs } = await supabase
        .from("audit_log")
        .select("*")
        .eq("action", "carrier_connection_config")
        .order("created_at", { ascending: false })
        .limit(10)

      // CRITICAL: filter by carrier_code to avoid picking up CTT/other configs
      const connLog = logs?.find((l: any) => l.details?.carrier_code === "correos_express")
      if (connLog?.details) {
        const d = connLog.details
        result = {
          solicitante: d.client_id,
          codRte: d.contract_number,
          user: d.auth_id,
          pass: d.user_id || "",
          environment: (d.environment === "qa" ? "test" : d.environment as "test" | "production") || "production",
        }
      }
    } catch {}
  }

  if (!result) {
    result = {
      solicitante: process.env.CORREOS_SOLICITANTE || "",
      codRte: process.env.CORREOS_COD_RTE || "",
      user: process.env.CORREOS_USER || "",
      pass: process.env.CORREOS_PASSWORD || "",
      environment: (process.env.CORREOS_ENVIRONMENT as "test" | "production") || "test",
    }
  }

  if (!connectionId) {
    correosCredentialsCache = result
    correosCredentialsCacheTime = Date.now()
  }

  return result
}
