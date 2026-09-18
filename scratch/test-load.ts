import { getShipmentTrackingTimelineAction } from "../app/actions/shipments"
async function run() {
  const events = await getShipmentTrackingTimelineAction("bc6ece40-f691-4bb0-907d-181d6c090849")
  console.log("Returned events length:", events?.length)
  console.log("Events:", events)
}
run()
