const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rcifuhiwemwlatgserva.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjaWZ1aGl3ZW13bGF0Z3NlcnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc5NTk4MiwiZXhwIjoyMTA0MzcxOTgyfQ.Io7GrzqBKqn6w9Y7JgT7XKP-7ugL5yD4L01n8NMreu0');
async function run() {
  const { data: shipments } = await supabase.from('audit_log').select('details').eq('action', 'shipment_data');
  const clientShipments = shipments?.filter(l => l.details?.client_id === 'b79cab49-629a-49f1-99c6-ef711e040cf7')
                                   .map(l => ({id: l.details.id, tracking: l.details.tracking_number}));
  console.log("Client shipments:", clientShipments);
  
  const { data: statements } = await supabase.from('audit_log').select('details').eq('action', 'billing_statement');
  const invoicedIds = new Set();
  statements?.forEach(s => s.details?.shipment_ids?.forEach(id => invoicedIds.add(id)));
  
  console.log("Invoiced IDs:", Array.from(invoicedIds));
}
run();
