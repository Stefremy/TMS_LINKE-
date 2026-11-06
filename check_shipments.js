require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
async function run() {
  const { data: logs } = await supabase.from('audit_log').select('details').eq('action', 'shipment_data').order('created_at', { ascending: false });
  console.log("Audit log shipments:", logs?.map(l => ({id: l.details.id?.substring(0,8), tracking: l.details.tracking_number, price: l.details.sell_price})));
}
run();
