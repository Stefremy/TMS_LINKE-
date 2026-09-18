import { createClient } from "@supabase/supabase-js"
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
async function run() {
  const { data } = await supabase.from("shipments").select("*").eq("id", "bc6ece40-f691-4bb0-907d-181d6c090849")
  console.log("Shipment bc6ece40:", data)
}
run()
