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

async function check() {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .eq("action", "billing_statement")
    .order("created_at", { ascending: false })
    .limit(5)
  
  if (error) {
    console.error(error)
    return
  }
  console.log(JSON.stringify(data.map(d => ({
    id: d.id,
    created_at: d.created_at,
    client: d.details.client_name,
    total_value: d.details.total_value,
    moloni_document_id: d.details.moloni_document_id,
    shipments_count: d.details.shipments?.length,
    shipments: d.details.shipments?.map((s:any) => ({ id: s.id, price: s.sell_price, service: s.service_type }))
  })), null, 2))
}
check()
