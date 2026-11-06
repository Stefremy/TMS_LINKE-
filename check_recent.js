require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
async function run() {
  const { data: dbShipments } = await supabase.from("shipments").select("*").order("created_at", { ascending: false }).limit(5);
  console.log("DB Shipments:", dbShipments.map(s => ({id: s.id, track: s.tracking_number, client: s.client_id})));
  const { data: logs } = await supabase.from("audit_log").select("details").eq("action", "shipment_data").order("created_at", { ascending: false }).limit(5);
  console.log("Logs:", logs.map(l => ({id: l.details.id, track: l.details.tracking_number, client: l.details.client_id})));
}
run();
