import { config } from "dotenv"
config({ path: ".env.local" })
import { createAdminClient } from "./lib/supabase/server"

async function run() {
  const supabase = createAdminClient()
  const { data } = await supabase.from("shipments").select("*").limit(1)
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]))
  }
}
run()
