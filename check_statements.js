const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rcifuhiwemwlatgserva.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjaWZ1aGl3ZW13bGF0Z3NlcnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc5NTk4MiwiZXhwIjoyMTA0MzcxOTgyfQ.Io7GrzqBKqn6w9Y7JgT7XKP-7ugL5yD4L01n8NMreu0');
async function run() {
  const { data: logs } = await supabase.from("audit_log").select("created_at, details").eq("action", "billing_statement").order("created_at", { ascending: false }).limit(3);
  console.log("Recent statements:", logs.map(l => ({
    id: l.details.id, 
    stmt: l.details.statement_number, 
    shipments_count: l.details.shipments_count,
    shipment_ids: l.details.shipment_ids,
    shipments_array_length: l.details.shipments?.length,
    date: l.created_at
  })));
}
run();
