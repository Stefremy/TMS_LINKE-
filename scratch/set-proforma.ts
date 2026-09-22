import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
let SUPABASE_URL = ""
let SUPABASE_SERVICE_ROLE_KEY = ""
envFile.split("\n").forEach(line => {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) SUPABASE_URL = line.split("=")[1].replace(/["']/g, "")
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) SUPABASE_SERVICE_ROLE_KEY = line.split("=")[1].replace(/["']/g, "")
})

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data: stmts } = await supabase.from('audit_log').select('*').eq('action', 'billing_statement').order('created_at', { ascending: false }).limit(2)
  
  for (const stmt of stmts || []) {
      if (stmt.details?.moloni_document_id) {
          const newDetails = { ...stmt.details, is_pro_forma: true }
          const res = await supabase.from('audit_log').update({ details: newDetails }).eq('id', stmt.id)
          console.log(`Updated statement ${stmt.details.statement_number} to is_pro_forma=true:`, !res.error)
      }
  }
}

run().catch(console.error)
