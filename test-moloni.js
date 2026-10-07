require("dotenv").config({ path: ".env.local" });
const fetch = require("node-fetch");
async function run() {
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbRes = await fetch(`${adminUrl}/rest/v1/audit_log?action=eq.moloni_tokens&order=created_at.desc&limit=1`, { headers: { "apikey": adminKey, "Authorization": `Bearer ${adminKey}` } });
  const dbJson = await dbRes.json();
  const token = dbJson[0].details.access_token;
  
  const res = await fetch(`https://api.moloni.pt/v1/documentSets/getAll/?access_token=${token}&json=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_id: process.env.MOLONI_COMPANY_ID })
  });
  console.log(JSON.stringify(await res.json(), null, 2));
}
run();
