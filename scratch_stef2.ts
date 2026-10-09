import { config } from "dotenv"
config({ path: ".env.local" })
import { createAdminClient } from "./lib/supabase/server"

async function run() {
  const supabase = createAdminClient()
  const { data: clientLogs } = await supabase.from("audit_log").select("details").eq("action", "client_data")
  const allClients = clientLogs?.map((l: any) => l.details).filter(Boolean) || []
  const stef = allClients.find((c: any) => c.short_name === "Stefano Pereira")

  if (!stef) {
    console.log("Stef not found")
    return
  }

  const { data: allStmts } = await supabase
    .from("audit_log")
    .select("details")
    .eq("action", "billing_statement")
    .filter("details->>client_id", "eq", stef.id)

  const billedIds = new Set<string>()
  allStmts?.forEach((stmt: any) => {
    if (Array.isArray(stmt.details?.shipment_ids)) {
      stmt.details.shipment_ids.forEach((id: string) => billedIds.add(id))
    }
  })

  console.log("Billed IDs count:", billedIds.size)

  const { data: shipments } = await supabase
    .from("shipments")
    .select("id, tracking_number")
    .eq("client_id", stef.id)

  console.log("Total Shipments for Stef:", shipments?.length)

  const unbilled = shipments?.filter((s: any) => !billedIds.has(s.id)) || []
  console.log("Unbilled:", unbilled.length)
}
run()
