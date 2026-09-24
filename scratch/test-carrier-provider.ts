import { createAdminClient } from "../lib/supabase/server"
import { CttProvider } from "../lib/services/carriers/ctt-provider"
import { ShipmentInput } from "../lib/services/carriers/types"

async function runTest() {
  console.log("Fetching credentials...")
  const creds = {
    contract_number: process.env.CTT_CONTRACT_ID || "300330941",
    client_number: process.env.CTT_CLIENT_ID || "100032458",
    auth_id: process.env.CTT_AUTHENTICATION_ID || "1d7ad9a9-c7bb-43be-9f57-851d1baafb4b",
    user_id: undefined,
    distribution_channel: 99,
    environment: "production" as any,
    default_subproduct: "EMSF056.01",
  }

  console.log("Initializing provider...")
  const provider = new CttProvider()
  await provider.initialize(creds)

  console.log("Testing validateShipment (Routing Check)...")
  const testInput: ShipmentInput = {
    reference: "TEST-123",
    sender: { name: "Test Sender", address: "Rua A", zip: "1000-001", city: "Lisboa", phone: "910000000" },
    recipient: { name: "Test Recipient", address: "Rua B", zip: "4000-001", city: "Porto", phone: "910000000" },
    weightKg: 1,
    volumes: 1,
    subProduct: "EMSF056.01"
  }

  const valResult = await provider.validateShipment(testInput)
  console.log("Validation Result:", valResult)

  console.log("Testing getTracking (Simulated or Real depending on CTT event WS)...")
  // Using a random tracking number that probably doesn't exist, just to see if we hit the API successfully
  const trackResult = await provider.getTracking("EA123456789PT")
  console.log("Tracking Result Success:", trackResult.success)
  if (trackResult.events) {
    console.log("Event Count:", trackResult.events.length)
  } else {
    console.log("Tracking Error:", trackResult.error)
  }
}

runTest().catch(console.error)
