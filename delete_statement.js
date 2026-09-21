const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rcifuhiwemwlatgserva.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjaWZ1aGl3ZW13bGF0Z3NlcnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc5NTk4MiwiZXhwIjoyMTA0MzcxOTgyfQ.Io7GrzqBKqn6w9Y7JgT7XKP-7ugL5yD4L01n8NMreu0');

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
