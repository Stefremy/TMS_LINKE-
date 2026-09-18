import { createClient } from "@supabase/supabase-js"
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  // Get the full audit_log entry for the 7d7b1884 shipment
  const { data } = await supabase
    .from("audit_log")
    .select("*")
    .eq("action", "shipment_data")
    .like("details->>id", "7d7b1884%")
    .single()
  
  console.log("Full ID:", data?.details?.id)
  console.log("Full details keys:", Object.keys(data?.details || {}))
  console.log("tracking_number:", data?.details?.tracking_number)
  console.log("reference:", data?.details?.reference)
  console.log("ctt_object_id:", data?.details?.ctt_object_id)
  
  // Check tracking_events for 7d7b1884
  const { data: evts } = await supabase
    .from("tracking_events")
    .select("id, shipment_id, event_code, timestamp")
    .like("shipment_id", "7d7b1884%")
  console.log("\nEvents for 7d7b1884:", evts?.length, evts)
  
  // Check tracking_events for bc6ece40
  const { data: evts2 } = await supabase
    .from("tracking_events")
    .select("id, shipment_id, event_code, timestamp")
    .like("shipment_id", "bc6ece40%")
  console.log("\nEvents for bc6ece40:", evts2?.length)
}
run()
