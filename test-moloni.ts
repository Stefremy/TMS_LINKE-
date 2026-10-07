import { MoloniClient } from "./lib/moloni/moloni-client";
import { getTenantId } from "./lib/auth/context";
// We don't have next env here, but we can mock it
import * as dotenv from 'dotenv';
dotenv.config({ path: ".env.local" });

const run = async () => {
    const client = new MoloniClient();
    const sets = await client.request('documentSets/getAll', {});
    console.log(JSON.stringify(sets, null, 2));
}

run().catch(console.error);
