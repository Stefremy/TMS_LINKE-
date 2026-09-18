import { createClient } from "@supabase/supabase-js"
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  // Get all shipments and check columns
  const { data, error } = await supabase
    .from("shipments")
    .select("*")
    .limit(3)
  
  if (error) { console.error(error); return }
  
  // Print column names
  console.log("Columns:", Object.keys(data?.[0] || {}))
  
  // Check if any shipment has LTK7D7B1884 in any value
  const { data: all } = await supabase.from("shipments").select("id, tracking_number, reference, carrier_tracking_number, ctt_object_id")
  const match = all?.filter(s => JSON.stringify(s).toUpperCase().includes("LTK7D7B1884"))
  console.log("\nMatch for LTK7D7B1884 in any field:", match)
  
  // Print all tracking numbers
  console.log("\nAll tracking numbers:", all?.map(s => ({ id: s.id.slice(0,8), tn: s.tracking_number, ref: s.reference, ctn: s.carrier_tracking_number })))
}
run()
