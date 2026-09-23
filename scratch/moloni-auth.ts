import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { MoloniClient } from "../lib/moloni/moloni-client.ts";

async function main() {
  const companyId = process.env.MOLONI_COMPANY_ID;
  const refreshToken = process.env.MOLONI_REFRESH_TOKEN;
  const clientId = process.env.MOLONI_CLIENT_ID;
  const clientSecret = process.env.MOLONI_CLIENT_SECRET;

  const url = `https://api.moloni.pt/v1/grant/?grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}`;
  const res = await fetch(url);
  const json = await res.json();
  
  if (json.access_token) {
    const payload = {
      date: "2026-09-23",
      document_set_id: 956178, // Valid set id from previous test
      customer_id: 1, // Let's use 1 and see if it fails
      status: 0,
      value: 10,
      net_value: 10,
      payments: [{ payment_method_id: 3, date: "2026-09-23", value: 10 }],
      associated_documents: [{ associated_id: 12345, value: 10 }]
    };
    
    const params = new URLSearchParams({ access_token: json.access_token, json: 'true', human_errors: 'true' });
    const p1 = await fetch(`https://api.moloni.pt/v1/receipts/insert/?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: Number(companyId), ...payload })
    });
    console.log("With associated_id:", await p1.text());
    
    const payload2 = {
      ...payload,
      associated_documents: [{ document_id: 12345, value: 10 }]
    };
    const p2 = await fetch(`https://api.moloni.pt/v1/receipts/insert/?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: Number(companyId), ...payload2 })
    });
    console.log("With document_id:", await p2.text());
  }
}

main();
