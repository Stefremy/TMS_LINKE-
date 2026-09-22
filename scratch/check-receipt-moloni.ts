import { createAdminClient } from "@/lib/supabase/server"
import { MoloniClient } from "@/lib/moloni/moloni-client"

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

  const moloni: any = new MoloniClient(moloniConfig)

  const dateNow = new Date().toISOString().split("T")[0]
  const documentSetId = await moloni.getDocumentSet()

  const { data: stmts } = await supabase.from('audit_log').select('details').eq('action', 'billing_statement').order('created_at', { ascending: false })
  
  let targetStmt = null;
  for (const s of stmts || []) {
      if (s.details?.moloni_document_id) {
          targetStmt = s.details;
          break;
      }
  }

  if (!targetStmt) return

  const invoice = await moloni.request("documents/getOne", { document_id: targetStmt.moloni_document_id })
  
  const payload = {
    date: dateNow,
    document_set_id: documentSetId,
    customer_id: invoice.customer_id,
    net_value: Number(targetStmt.total_value), // Try this
    value: Number(targetStmt.total_value), // Try this
    status: 1, 
    payments: [
      {
        payment_method_id: 3, 
        date: dateNow,
        value: Number(targetStmt.total_value),
      }
    ],
    documents: [
      {
        document_id: targetStmt.moloni_document_id,
        value: Number(targetStmt.total_value)
      }
    ]
  };

  try {
    const res = await moloni.request("receipts/insert", payload)
    console.log("Result with net_value:", res)
  } catch(e: any) {
    console.error("Error inserting:", e.message)
  }
}

run().catch(console.error)
