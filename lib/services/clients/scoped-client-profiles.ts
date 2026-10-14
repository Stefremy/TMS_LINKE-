import "server-only"
import { createAdminClient } from "@/lib/supabase/server"

type ClientProfile = {
  id: string
  name?: string
  short_name?: string
  legal_name?: string
  email?: string
  billing_email?: string
  iban?: string
}

/** Persisted client identities only: never use demo records for ownership or bank details. */
export async function loadScopedClientProfiles(
  supabase: ReturnType<typeof createAdminClient>,
  tenantId: string,
  clientIds: string[]
): Promise<Map<string, ClientProfile>> {
  if (!tenantId) throw new Error("Company access is missing")
  const profiles = new Map<string, ClientProfile>()
  const uniqueIds = [...new Set(clientIds.filter(Boolean))]
  for (let offset = 0; offset < uniqueIds.length; offset += 200) {
    const ids = uniqueIds.slice(offset, offset + 200)
    const [clients, logs, deleted] = await Promise.all([
      supabase.from("clients").select("id, name").eq("tenant_id", tenantId).in("id", ids),
      supabase.from("audit_log").select("details").eq("tenant_id", tenantId)
        .eq("action", "client_data").in("details->>id", ids).order("created_at", { ascending: false }),
      supabase.from("audit_log").select("details").eq("tenant_id", tenantId)
        .eq("action", "deleted_client").in("details->>id", ids),
    ])
    if (clients.error || logs.error || deleted.error) throw new Error("Client lookup failed")
    for (const client of clients.data || []) profiles.set(client.id, client)
    const seen = new Set<string>()
    for (const log of logs.data || []) {
      const d = log.details as ClientProfile | null
      if (!d?.id || seen.has(d.id)) continue
      profiles.set(d.id, {
        ...profiles.get(d.id), id: d.id, short_name: d.short_name,
        legal_name: d.legal_name, email: d.email, billing_email: d.billing_email, iban: d.iban,
      })
      seen.add(d.id)
    }
    for (const log of deleted.data || []) {
      if (log.details?.id) profiles.delete(log.details.id)
    }
  }
  return profiles
}
