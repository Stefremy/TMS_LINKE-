/**
 * Shared carrier credential helpers.
 * Importable from both server actions AND lib/ services without crossing action boundaries.
 */
import { createAdminClient } from "@/lib/supabase/server"
import { getTenantId } from "@/lib/auth/context"
import { CTTConnectionCredentials } from "@/lib/services/ctt/ctt-types"
import { CorreosCredentials } from "@/lib/services/correos/types"

// ─── CTT ────────────────────────────────────────────────────────────────────

let cttCredentialsCache: CTTConnectionCredentials | null = null
let cttCredentialsCacheTime = 0

export async function resolveCttCredentials(connectionId?: string): Promise<CTTConnectionCredentials> {
  if (!connectionId && cttCredentialsCache && Date.now() - cttCredentialsCacheTime < 60000) {
    return cttCredentialsCache
  }

  const supabase = createAdminClient()
  let result: CTTConnectionCredentials | null = null

  try {
    let query = supabase
      .from("carrier_connections")
      .select("*")
      .eq("tenant_id", (await getTenantId()))
      
    if (connectionId) {
      query = query.eq("id", connectionId)
    } else {
      query = query.eq("carrier_code", "ctt_expresso")
    }

    const { data: conn } = await query.single()

    if (conn) {
      result = {
        contract_number: conn.contract_number,
        client_number: conn.client_id,
        auth_id: conn.auth_id,
        user_id: conn.user_id || undefined,
        distribution_channel: conn.distribution_channel || 99,
        environment: (conn.environment as "qa" | "production") || "production",
        default_subproduct: conn.default_subproduct || "EMSF056.01",
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
        .limit(10) // Limit to avoid fetching thousands of unrelated logs

    // CRITICAL: filter by carrier_code to avoid picking up Correos/other configs
    const cttLog = logs?.find((l: any) => l.details?.carrier_code === "ctt_expresso")
    if (cttLog?.details) {
      const d = cttLog.details
      result = {
        contract_number: d.contract_number,
        client_number: d.client_id,
        auth_id: d.auth_id,
        user_id: d.user_id || undefined,
        distribution_channel: d.distribution_channel || 99,
        environment: (d.environment as "qa" | "production") || "production",
        default_subproduct: d.default_subproduct || "EMSF056.01",
      }
    }
    } catch {}
  }

  if (!result) {
    result = {
      contract_number: process.env.CTT_CONTRACT_ID || "",
      client_number: process.env.CTT_CLIENT_ID || "",
      auth_id: process.env.CTT_AUTHENTICATION_ID || "",
      user_id: process.env.CTT_USER_ID || undefined,
      distribution_channel: Number(process.env.CTT_DISTRIBUTION_CHANNEL) || 99,
      environment: (process.env.CTT_ENVIRONMENT as "qa" | "production") || "production",
      default_subproduct: process.env.CTT_DEFAULT_SUBPRODUCT || "EMSF056.01",
    }
  }
  
  if (!connectionId) {
    cttCredentialsCache = result
    cttCredentialsCacheTime = Date.now()
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
