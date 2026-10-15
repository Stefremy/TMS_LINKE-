import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before running this script.");
}
const supabase = createClient(supabaseUrl, serviceRoleKey);
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

