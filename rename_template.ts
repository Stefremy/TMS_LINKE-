import { config } from "dotenv"
config({ path: ".env.local" })
import { createAdminClient } from "./lib/supabase/server"

async function run() {
  const supabase = createAdminClient()
  
  const { error } = await supabase.from("email_templates").update({
    name: "Novo envio criado (tracking)"
  }).eq("id", "tracking")
  
  if (error) {
    console.error("Error updating", error)
  } else {
    console.log("Updated tracking template name")
  }
}
run()
