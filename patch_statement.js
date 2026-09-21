const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rcifuhiwemwlatgserva.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjaWZ1aGl3ZW13bGF0Z3NlcnZhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODc5NTk4MiwiZXhwIjoyMTA0MzcxOTgyfQ.Io7GrzqBKqn6w9Y7JgT7XKP-7ugL5yD4L01n8NMreu0');

async function run() {
  const { data: stmtLogs } = await supabase.from('audit_log').select('*').eq('action', 'billing_statement');
  const target = stmtLogs?.find(l => l.details?.statement_number === 'EXT-2026/09-2178');
  if (!target) { console.log('Statement not found'); return; }

  const shipmentIds = target.details.shipment_ids || [];
  
  // get missing shipment from audit_log
  const { data: missingLog } = await supabase.from('audit_log').select('details, created_at').eq('action', 'shipment_data');
  const allShipments = missingLog.map(l => ({...l.details, created_at: l.created_at}));
  
  const targetShipments = allShipments.filter(s => shipmentIds.includes(s.id)).map(s => ({
    id: s.id,
    tracking_number: s.tracking_number,
    reference: s.reference,
    service_type: s.service_type,
    sell_price: Number(s.sell_price || 0),
    created_at: s.created_at,
    recipient_name: s.recipient_name,
    recipient_city: s.recipient_city
  }));

  target.details.shipments = targetShipments;
  target.details.shipments_count = targetShipments.length;
  target.details.total_value = targetShipments.reduce((acc, s) => acc + s.sell_price, 0);

  const { error } = await supabase.from('audit_log').update({ details: target.details }).eq('id', target.id);
  console.log("Update Error:", error);
  console.log("Updated statement shipments count:", target.details.shipments_count, "Total Value:", target.details.total_value);
}
run();
