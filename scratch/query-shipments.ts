import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data } = await supabase.from("shipments").select("id, tracking_number, base_price, fuel_tax_amount, special_fees_amount, sell_price").limit(5).order("created_at", { ascending: false })
  console.log(JSON.stringify(data, null, 2))
}

run()
