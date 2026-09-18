import { createClient } from "@supabase/supabase-js"
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data } = await supabase.from("shipments").select("*").ilike("tracking_number", "%LTK7D7B1884%")
  console.log("Shipments with LTK7D7B1884:", data)
  const { data: d2 } = await supabase.from("shipments").select("*").ilike("carrier_tracking_number", "%EQ418727568PT%")
  console.log("Shipments with EQ418727568PT:", d2?.map(s => ({ id: s.id, tracking_number: s.tracking_number })))
}
run()
