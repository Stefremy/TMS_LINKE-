import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const tracking = "EQ418725876PT"
  
  // Update shipments table
  const newDate = new Date(Date.now() - 25 * 3600 * 1000).toISOString()
  
  const { data, error } = await supabase
    .from("shipments")
    .update({ created_at: newDate })
    .eq("tracking_number", tracking)
    .select()
    
  console.log("Shipment updated:", data?.length || 0, error ? error : "")

  // We should also update the audit_log just in case
  const { data: logs } = await supabase
    .from("audit_log")
    .select("*")
    .eq("action", "shipment_data")
    
  if (logs) {
    for (const log of logs) {
      if (log.details?.tracking_number === tracking) {
         await supabase.from("audit_log").update({
           created_at: newDate,
           details: { ...log.details, created_at: newDate }
         }).eq("id", log.id)
         console.log("Updated audit log for", tracking)
      }
    }
  }
}
run()
