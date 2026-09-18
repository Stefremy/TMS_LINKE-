import { createClient } from "@supabase/supabase-js"
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data } = await supabase
    .from("shipments")
    .select("id, tracking_number, carrier_tracking_number, ctt_label_base64, ctt_object_id")
    .eq("id", "bc6ece40-f691-4bb0-907d-181d6c090849")
    .single()
  
  console.log("id:", data?.id)
  console.log("tracking_number:", data?.tracking_number)
  console.log("carrier_tracking_number:", data?.carrier_tracking_number)
  console.log("ctt_object_id:", data?.ctt_object_id)
  // Check if label has LTK ref
  const label = data?.ctt_label_base64 || ""
  const match = label.match(/LTK\w+/i)
  console.log("LTK ref in label:", match?.[0])
}
run()
