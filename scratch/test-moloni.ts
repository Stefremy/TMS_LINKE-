import { MoloniClient } from "../lib/moloni/moloni-client"
import { createAdminClient } from "../lib/supabase/server"

async function run() {
  const mLogs = await createAdminClient().from("audit_log").select("details").eq("action", "moloni_connection_config").order("created_at", { ascending: false }).limit(1)
  const config = {
    refreshToken: mLogs.data[0].details.refresh_token,
    companyId: mLogs.data[0].details.company_id,
  }
  const moloni = new MoloniClient(config)
  console.log("Config loaded")

  // Find a pro forma to test
  const res = await moloni['request']('proFormaInvoices/getAll', {})
  console.log("ProFormas:", res.slice(0, 1))
}
run().catch(console.error)
