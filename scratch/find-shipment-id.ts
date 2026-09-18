import { createClient } from "@supabase/supabase-js"
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data } = await supabase.from("shipments").select("*").ilike("id", "%7d7b1884%")
  console.log("Shipments with ID 7d7b1884:", data)
}
run()
