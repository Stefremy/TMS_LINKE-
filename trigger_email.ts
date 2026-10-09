import { config } from "dotenv"
config({ path: ".env.local" })
import { createAdminClient } from "./lib/supabase/server"
import { sendTrackingEmailNotification } from "./lib/email/tracking-notifications"

async function run() {
  const supabase = createAdminClient()
  const { data: shipment } = await supabase
    .from("shipments")
    .select("*")
    .or(`tracking_number.eq.LTK1282077,carrier_tracking_number.eq.LTK1282077`)
    .single()
    
  if (shipment) {
    console.log("Found shipment:", shipment.id)
    await supabase.from("audit_log").delete().filter("action", "eq", "tracking_email_sent").filter("details->>shipment_id", "eq", shipment.id).filter("details->>type", "eq", "incident")
    const res = await sendTrackingEmailNotification(shipment.id, "incident", { reason: "Morada incompleta ou destinatário ausente na primeira tentativa de entrega.", eventCode: "EMH" })
    console.log("Result:", res)
  } else {
    console.log("Shipment not found!")
  }
}
run()
