import { config } from "dotenv"
config({ path: ".env.local" })
import { createAdminClient } from "./lib/supabase/server"

async function run() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage.listBuckets()
  if (error) {
    console.error(error)
  } else {
    console.log(data.map(b => b.name))
  }
}
run()
