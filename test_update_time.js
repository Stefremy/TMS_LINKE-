const { createClient } = require("@supabase/supabase-js")
const fs = require("fs")

const envVars = fs.readFileSync(".env.local", "utf8").split('\n').reduce((acc, line) => {
  const parts = line.split('=')
  if (parts.length >= 2) acc[parts[0]] = parts.slice(1).join('=')
  return acc
}, {})

const supabase = createClient(
  envVars["NEXT_PUBLIC_SUPABASE_URL"],
  envVars["SUPABASE_SERVICE_ROLE_KEY"]
)

async function run() {
  const tracking = "EQ418725876PT"
  
  // Set to 25 hours ago to trigger 'Entregue'
  const newDate = new Date(Date.now() - 25 * 3600 * 1000).toISOString()
  
  const { data, error } = await supabase
    .from("shipments")
    .update({ created_at: newDate })
    .eq("tracking_number", tracking)
    .select()
    
  console.log("Shipment updated:", data?.length || 0, error ? error : "")

  const { data: logs } = await supabase
    .from("audit_log")
    .select("*")
    .eq("action", "shipment_data")
    
  if (logs) {
    for (const log of logs) {
      if (log.details?.tracking_number === tracking) {
         await supabase.from("audit_log").update({
           created_at: newDate,
           details: { ...log.details, created_at: newDate }
         }).eq("id", log.id)
         console.log("Updated audit log for", tracking)
      }
    }
  }
}
run()
