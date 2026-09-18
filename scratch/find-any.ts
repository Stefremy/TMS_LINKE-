import { createClient } from "@supabase/supabase-js"
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data } = await supabase.from("shipments").select("*")
  const match = data?.filter(s => JSON.stringify(s).includes("LTK7D7B1884"))
  console.log("Shipments containing LTK7D7B1884:", match)
}
run()
