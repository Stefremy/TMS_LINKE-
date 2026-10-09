import { config } from "dotenv"
config({ path: ".env.local" })
import { createAdminClient } from "./lib/supabase/server"
import { sendTrackingEmailNotification } from "./lib/email/tracking-notifications"

async function run() {
  const supabase = createAdminClient()
  const { data: shipment } = await supabase
    .from("shipments")
    .select("*")
    .or(`tracking_number.eq.EQ419924604PT,carrier_tracking_number.eq.EQ419924604PT`)
    .single()
    
  if (shipment) {
    console.log("Found shipment:", shipment.id)
    const res = await sendTrackingEmailNotification(shipment.id, "tracking")
    console.log("Result:", res)
  } else {
    console.log("Shipment not found!")
  }
}
run()
