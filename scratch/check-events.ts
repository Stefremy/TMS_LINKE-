import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { data, error } = await supabase
    .from("tracking_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    console.error("DB Error:", error)
  } else {
    console.log(`Found ${data?.length} recent tracking events.`)
    data?.forEach((d: any) => console.log(d.shipment_id, d.event_code, d.created_at))
  }
}
run()
