require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));

async function run() {
  const { data: stmtLogs } = await supabase.from('audit_log').select('id, details').eq('action', 'billing_statement');
  const target = stmtLogs?.find(l => l.details?.statement_number === 'EXT-2026/09-2178');
  
  if (target) {
    const { error } = await supabase.from('audit_log').delete().eq('id', target.id);
    console.log("Delete error:", error);
    console.log("Extrato apagado com sucesso. Os envios voltarão a estar pendentes.");
  } else {
    console.log("Extrato não encontrado.");
  }
}
run();
