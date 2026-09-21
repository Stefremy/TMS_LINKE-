const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rcifuhiwemwlatgserva.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjaWZ1aGl3ZW13bGF0Z3NlcnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc5NTk4MiwiZXhwIjoyMTA0MzcxOTgyfQ.Io7GrzqBKqn6w9Y7JgT7XKP-7ugL5yD4L01n8NMreu0');
async function run() {
  const { data: logs } = await supabase.from("audit_log").select("details, created_at").eq("action", "shipment_data").order("created_at", { ascending: false });
  const clientLogs = logs.filter(l => l.details.client_id === 'b79cab49-629a-49f1-99c6-ef711e040cf7');
  console.log(clientLogs.map(l => ({id: l.details.id.substring(0,8), created: l.created_at, status: l.details.status})));
}
run();
