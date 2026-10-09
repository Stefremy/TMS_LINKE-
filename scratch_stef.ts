import { config } from "dotenv"
config({ path: ".env.local" })
import { createAdminClient } from "./lib/supabase/server"

async function run() {
  const supabase = createAdminClient()
  const { data: clientLogs } = await supabase.from("audit_log").select("details").eq("action", "client_data")
  const allClients = clientLogs?.map((l: any) => l.details).filter(Boolean) || []
  console.log("All Clients:", allClients.map((c: any) => ({ id: c.id, name: c.name, short_name: c.short_name, code: c.code, billing_type: c.billing_type })))
}
run()
