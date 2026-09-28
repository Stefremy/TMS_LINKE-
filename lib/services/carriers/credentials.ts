/**
 * Shared carrier credential helpers.
 * Importable from both server actions AND lib/ services without crossing action boundaries.
 */
import { createAdminClient } from "@/lib/supabase/server"
import { getTenantId } from "@/lib/auth/context"
import { CTTConnectionCredentials } from "@/lib/services/ctt/ctt-types"
import { CorreosCredentials } from "@/lib/services/correos/types"

// ─── CTT ────────────────────────────────────────────────────────────────────

export async function resolveCttCredentials(connectionId?: string): Promise<CTTConnectionCredentials> {
  const supabase = createAdminClient()

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
      return {
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

  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .eq("action", "carrier_connection_config")
      .order("created_at", { ascending: false })

    // CRITICAL: filter by carrier_code to avoid picking up Correos/other configs
    const cttLog = logs?.find((l: any) => l.details?.carrier_code === "ctt_expresso")
    if (cttLog?.details) {
      const d = cttLog.details
      return {
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

  return {
    contract_number: process.env.CTT_CONTRACT_ID || "300330941",
    client_number: process.env.CTT_CLIENT_ID || "100032458",
    auth_id: process.env.CTT_AUTHENTICATION_ID || "1d7ad9a9-c7bb-43be-9f57-851d1baafb4b",
    user_id: "cea67efe-b547-4be6-87a7-09d287ccf0f6",
    distribution_channel: 99,
    environment: "production",
    default_subproduct: "EMSF056.01",
  }
}

// ─── CORREOS EXPRESS ────────────────────────────────────────────────────────

export async function resolveCorreosCredentials(connectionId?: string): Promise<CorreosCredentials> {
  const supabase = createAdminClient()

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
      return {
        solicitante: conn.client_id,
        codRte: conn.contract_number,
        user: conn.auth_id,
        pass: conn.user_id || "",
        environment: (conn.environment === "qa" ? "test" : conn.environment as "test" | "production") || "production",
      }
    }
  } catch {}

  try {
    const { data: logs } = await supabase
      .from("audit_log")
      .select("*")
      .eq("action", "carrier_connection_config")
      .order("created_at", { ascending: false })

    // CRITICAL: filter by carrier_code to avoid picking up CTT/other configs
    const connLog = logs?.find((l: any) => l.details?.carrier_code === "correos_express")
    if (connLog?.details) {
      const d = connLog.details
      return {
        solicitante: d.client_id,
        codRte: d.contract_number,
        user: d.auth_id,
        pass: d.user_id || "",
        environment: (d.environment === "qa" ? "test" : d.environment as "test" | "production") || "production",
      }
    }
  } catch {}

  // Fallback test credentials
  return {
    solicitante: "1",
    codRte: "555559999",
    user: "WS_GoLinke",
    pass: "l3CtF",
    environment: "test",
  }
}
