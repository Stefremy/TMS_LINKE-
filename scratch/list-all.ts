import { createClient } from "@supabase/supabase-js"
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  // Service role - get everything no RLS
  const { data, error } = await supabase
    .from("shipments")
    .select("id, tracking_number, carrier_tracking_number, carrier_code, status")
  
  if (error) { console.error("Error:", error); return }
  
  console.log("Total shipments:", data?.length)
  console.log("All:", data?.map(s => ({ id: s.id.slice(0,8), tn: s.tracking_number, ctn: s.carrier_tracking_number, cc: s.carrier_code, st: s.status })))
}
run()
