const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('audit_log').select('details').eq('action', 'billing_statement').limit(10);
  console.log(JSON.stringify(data?.find(d => d.details.statement_number === 'EXT-2026/09-2178')?.details?.shipments?.[0], null, 2));
}
run();
