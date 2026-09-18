import { syncCttTrackingAction } from "../app/actions/ctt"

async function run() {
  const result = await syncCttTrackingAction("EQ418727568PT")
  console.log("Result:", result)
}

run().catch(console.error)
