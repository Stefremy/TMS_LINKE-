import { createAdminClient } from "@/lib/supabase/server"

async function run() {
  const supabase = createAdminClient()
  const { data: stmts } = await supabase.from('audit_log').select('details').eq('action', 'billing_statement').order('created_at', { ascending: false }).limit(5)
  
  for (const s of stmts || []) {
      if (s.details?.moloni_document_id) {
          console.log(`Document ID: ${s.details.moloni_document_id}, isProForma: ${s.details.isProForma}, Value: ${s.details.total_value}`)
      }
  }
}

run().catch(console.error)
