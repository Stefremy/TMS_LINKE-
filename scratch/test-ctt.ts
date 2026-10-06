import { fetchCttTrackingEvents } from "../lib/services/tracking/ctt-tracking-sync"
import { resolveCttCredentials } from "../lib/services/carriers/credentials"
import { CttProvider } from "../lib/services/carriers/ctt-provider"

async function run() {
  const creds = await resolveCttCredentials()
  const provider = new CttProvider()
  await provider.initialize(creds)
  const trackResult = await provider.getTracking("EQ419645919PT")
  console.log("RAW RESULTS:", JSON.stringify(trackResult, null, 2))
}

run().catch(console.error)
