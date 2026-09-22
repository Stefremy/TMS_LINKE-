import { createAdminClient } from "./lib/supabase/server"
import { MoloniClient } from "./lib/moloni/moloni-client"

async function run() {
  const supabase = createAdminClient()
  const { data: mLogs } = await supabase
    .from("audit_log")
    .select("details")
    .eq("action", "moloni_connection_config")
    .order("created_at", { ascending: false })
    .limit(1)

  const moloniConfig = {
    refreshToken: mLogs[0].details.refresh_token,
    companyId: mLogs[0].details.company_id,
  }

  const moloni = new MoloniClient(moloniConfig) as any

  // Pega o ultimo billing_statement
  const { data: stmts } = await supabase.from('audit_log').select('details').eq('action', 'billing_statement').order('created_at', { ascending: false })
  
  let targetStmt = null;
  for (const s of stmts || []) {
      if (s.details?.moloni_document_id && s.details?.total_value === 1.85) {
          targetStmt = s.details;
          break;
      }
  }

  if (!targetStmt) {
    targetStmt = stmts?.find(s => s.details?.moloni_document_id)?.details
  }

  if (!targetStmt) {
      console.log("No invoice found")
      return
  }

  console.log("Target invoice:", targetStmt.moloni_document_id, targetStmt.total_value)

  const invoice = await moloni.request("documents/getOne", { document_id: targetStmt.moloni_document_id })
  console.log("Invoice from moloni type:", invoice?.document_type?.name)
  console.log("Invoice net_value:", invoice?.net_value)
  console.log("Invoice exchange_total_value:", invoice?.exchange_total_value)
  console.log("Invoice open_balance:", invoice?.exchange_open_balance, invoice?.open_balance)
  
}

run().catch(console.error)
