import fs from "fs"
import path from "path"

const envPath = path.resolve(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const idx = line.indexOf("=")
    if (idx > 0) {
      const k = line.slice(0, idx).trim()
      const v = line.slice(idx + 1).trim()
      if (k) process.env[k] = v
    }
  }
}

import { createClient } from "@supabase/supabase-js"

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { data: users, error: uErr } = await sb.auth.admin.listUsers()
  console.log("USERS IN AUTH:")
  console.log(JSON.stringify(users?.users.map(u => ({
    id: u.id,
    email: u.email,
    app_metadata: u.app_metadata,
    user_metadata: u.user_metadata
  })), null, 2))

  const { data: colabs, error: cErr } = await sb.from("colaboradores").select("*")
  console.log("\nCOLABORADORES IN TABLE:")
  console.log(JSON.stringify(colabs, null, 2))
}

run().catch(console.error)
