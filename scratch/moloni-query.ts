import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { getMoloniTokens } from "../app/actions/moloni.ts";
import { MoloniClient } from "../lib/moloni/moloni-client.ts";

async function main() {
  const tokenData = await getMoloniTokens();
  if (!tokenData) {
    console.log("No tokens");
    return;
  }
  const client = new MoloniClient(tokenData.company_id, tokenData.access_token);
  
  try {
    const receipts = await client.request("receipts/getAll", { qty: 1 });
    if (receipts && receipts.length > 0) {
       console.log("Associated documents:", JSON.stringify(receipts[0].associated_documents, null, 2));
    } else {
       console.log("No receipts found.");
    }
  } catch (err) {
    console.error(err);
  }
}

main();
