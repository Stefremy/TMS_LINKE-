const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rcifuhiwemwlatgserva.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjaWZ1aGl3ZW13bGF0Z3NlcnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc5NTk4MiwiZXhwIjoyMTA0MzcxOTgyfQ.Io7GrzqBKqn6w9Y7JgT7XKP-7ugL5yD4L01n8NMreu0');
async function run() {
  const { data: dbShipments } = await supabase.from("shipments").select("*").order("created_at", { ascending: false }).limit(5);
  console.log("DB Shipments:", dbShipments.map(s => ({id: s.id, track: s.tracking_number, client: s.client_id})));
  const { data: logs } = await supabase.from("audit_log").select("details").eq("action", "shipment_data").order("created_at", { ascending: false }).limit(5);
  console.log("Logs:", logs.map(l => ({id: l.details.id, track: l.details.tracking_number, client: l.details.client_id})));
}
run();
