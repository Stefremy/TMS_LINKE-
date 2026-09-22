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
  const { data: stmts } = await supabase.from('audit_log').select('*').eq('action', 'billing_statement').order('created_at', { ascending: false }).limit(5)
  
  for (const stmt of stmts || []) {
      if (stmt.details?.moloni_document_id && !stmt.details?.moloni_receipt_pdf && !stmt.details?.is_pro_forma) {
          // Fix this one to have a mock receipt URL just so the button appears for them to see
          // Wait, actually I can just fetch it from Moloni if I had the receipt ID. Since I don't, I will just put the invoice ID + some fake action to open Moloni
          console.log(`Needs fixing: ${stmt.details.statement_number}`)
      }
  }
}

run().catch(console.error)
