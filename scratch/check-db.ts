import { CTTTrackingService } from "../lib/services/ctt/ctt-tracking.service"
import { getCttCredentials } from "../app/actions/ctt"

async function check() {
  const creds = await getCttCredentials()
  const events = await CTTTrackingService.fetchRealTrackingEvents("EQ418727568PT", creds)
  console.log("Events count:", events.length)
}
check()
