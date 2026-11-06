require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
async function run() {
  const { data: logs } = await supabase.from("audit_log").select("details, created_at").eq("action", "shipment_data").order("created_at", { ascending: false });
  const clientLogs = logs.filter(l => l.details.client_id === 'b79cab49-629a-49f1-99c6-ef711e040cf7');
  console.log(clientLogs.map(l => ({id: l.details.id.substring(0,8), created: l.created_at, status: l.details.status})));
}
run();
