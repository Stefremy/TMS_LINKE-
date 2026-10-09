import { config } from "dotenv"
config({ path: ".env.local" })
import { createAdminClient } from "./lib/supabase/server"
import * as fs from "fs"

async function run() {
  const supabase = createAdminClient()
  const fileBuffer = fs.readFileSync("public/Linke-logo.png")
  const { data, error } = await supabase.storage.from("avatars").upload("Linke-logo.png", fileBuffer, {
    upsert: true,
    contentType: 'image/png'
  })
  if (error) {
    console.error(error)
  } else {
    console.log("Uploaded!", data)
  }
}
run()
