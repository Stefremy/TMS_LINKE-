import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: mLogs } = await supabase
    .from("audit_log")
    .select("details")
    .eq("action", "moloni_tokens")
    .order("created_at", { ascending: false })
    .limit(1)
    
  if (!mLogs || mLogs.length === 0) return;
  const tokenData = mLogs[0].details;
  
  const payload = {
    company_id: tokenData.company_id,
    date: "2026-09-23",
    document_set_id: 1, // dummy
    customer_id: 1, // dummy
    value: 10,
    associated_documents: [
      {
        document_id: 9999999, // trying document_id
        value: 10
      }
    ]
  };

  const res = await fetch(`https://api.moloni.pt/v1/receipts/insert/?access_token=${tokenData.access_token}&json=true&human_errors=true`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  
  const text = await res.text();
  console.log("With document_id:", text);

  // Try with associated_id
  payload.associated_documents = [ { associated_id: 9999999, value: 10 } as any ];
  const res2 = await fetch(`https://api.moloni.pt/v1/receipts/insert/?access_token=${tokenData.access_token}&json=true&human_errors=true`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  
  const text2 = await res2.text();
  console.log("With associated_id:", text2);
}

main();
