import { createClient } from "@supabase/supabase-js"
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const { data, error } = await supabase
    .from("audit_log")
    .select("action, created_at, details")
    .eq("action", "shipment_data")
    .order("created_at", { ascending: false })
    .limit(10)
  
  if (error) { console.error(error); return }
  
  console.log(`Found ${data?.length} shipment_data entries`)
  data?.forEach((log, i) => {
    const d = log.details
    console.log(`\n[${i}]`, {
      id: d?.id?.slice(0,8),
      tracking_number: d?.tracking_number,
      reference: d?.reference,
      carrier_tracking: d?.carrier_tracking_number,
      status: d?.status,
    })
  })
}
run()
