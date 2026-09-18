import { createClient } from "@supabase/supabase-js"
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  // Fetch the shipment we know has the EQ carrier code
  const { data } = await supabase
    .from("shipments")
    .select("id, tracking_number, reference, carrier_tracking_number, ctt_object_id, status")
    .eq("carrier_tracking_number", "EQ418727568PT")
    .single()
  
  console.log("Shipment:", data)
  
  // Also look for LTK7D7B1884 in reference column
  const { data: d2 } = await supabase
    .from("shipments")
    .select("id, tracking_number, reference, carrier_tracking_number, ctt_object_id, status")
    .eq("reference", "LTK7D7B1884")
  
  console.log("By reference LTK7D7B1884:", d2)
}
run()
