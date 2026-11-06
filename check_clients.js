require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));

async function run() {
  const shipmentsMap = new Map();
  const deletedIds = new Set();
  
  const { data: dbShipments } = await supabase.from("shipments").select("*").order("created_at", { ascending: false });
  dbShipments?.forEach(s => {
    const key = s.id || s.tracking_number;
    if (key) {
      shipmentsMap.set(key, s);
    }
  });

  const { data: logs } = await supabase.from("audit_log").select("details, created_at").eq("action", "shipment_data").order("created_at", { ascending: false });
  logs?.forEach(log => {
    const s = log.details;
    if (s) {
      const key = s.id || s.tracking_number;
      if (key) {
        const existing = shipmentsMap.get(key);
        if (existing) {
          shipmentsMap.set(key, { ...existing, ...s, status: existing.status || s.status });
        } else {
          shipmentsMap.set(key, { ...s, created_at: s.created_at || log.created_at });
        }
      }
    }
  });

  const allShipments = Array.from(shipmentsMap.values());

  const { data: statements } = await supabase.from("audit_log").select("details").eq("action", "billing_statement");
  const invoicedIds = new Set();
  statements?.forEach(stmt => {
    if (Array.isArray(stmt.details?.shipment_ids)) {
      stmt.details.shipment_ids.forEach(id => invoicedIds.add(id));
    }
  });

  const clientCounts = {};
  allShipments.forEach(s => {
    const cid = s.client_id || 'unknown';
    if (!clientCounts[cid]) clientCounts[cid] = { total: 0, pending: 0, entregue: 0, pendingEntregue: 0 };
    clientCounts[cid].total++;
    if (s.status === 'entregue') clientCounts[cid].entregue++;
    if (!invoicedIds.has(s.id)) {
      clientCounts[cid].pending++;
      if (s.status === 'entregue') clientCounts[cid].pendingEntregue++;
    }
  });
  console.log(clientCounts);
}
run();
