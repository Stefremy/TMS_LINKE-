import { MoloniClient } from "../lib/moloni/moloni-client.ts";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env.local" });

async function check() {
  const c = new MoloniClient(process.env.MOLONI_COMPANY_ID!, process.env.MOLONI_REFRESH_TOKEN!);
  // Let's try to intentionally fail the API with empty associated documents to see the error,
  // or let's try to find an endpoint to get the fields of receipts/insert
}
check();
