require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
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
