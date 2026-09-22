import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
let NEXT_PUBLIC_SUPABASE_URL = ""
let SUPABASE_SERVICE_ROLE_KEY = ""

for (const line of envFile.split("\n")) {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) NEXT_PUBLIC_SUPABASE_URL = line.split("=")[1].trim()
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) SUPABASE_SERVICE_ROLE_KEY = line.split("=")[1].trim()
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
async function run() {
  const { data, error } = await supabase.from('shipments').select('*').limit(1)
  if (data && data.length > 0) {
    console.log(Object.keys(data[0]))
  } else {
    console.log("No data or error", error)
  }
}
run()
