import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from("shipments")
    .select("*")
    .eq("tracking_number", "LTK1078729")
    .single();

  if (error) {
    console.error("Error finding shipment:", error.message);
  } else {
    console.log("Shipment found:", data.tracking_number, data.status);
    
    // Check tracking events
    const { data: events } = await supabase
      .from("tracking_events")
      .select("*")
      .eq("shipment_id", data.id);
      
    console.log("Tracking events count:", events?.length);
    if (events?.length) {
      console.log("Events:", events.map(e => e.description));
    }
  }
}

main();
