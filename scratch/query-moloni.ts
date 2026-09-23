import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { createClient } from "@supabase/supabase-js";
import { MoloniClient } from "./lib/moloni/moloni-client.ts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: mLogs } = await supabase
    .from("audit_log")
    .select("details")
    .eq("action", "moloni_tokens")
    .order("created_at", { ascending: false })
    .limit(1)

  if (!mLogs || mLogs.length === 0) {
    console.log("No tokens");
    return;
  }
  
  const tokenData = mLogs[0].details;
  const client = new MoloniClient(tokenData.company_id, tokenData.access_token);
  
  try {
    const docTypes = await client.request("documentTypes/getAll", {});
    console.log(JSON.stringify(docTypes.map((dt: any) => ({
      document_type_id: dt.document_type_id,
      name: dt.name,
      saft_code: dt.saft_code
    })), null, 2));
  } catch (err) {
    console.error(err);
  }
}

main();
