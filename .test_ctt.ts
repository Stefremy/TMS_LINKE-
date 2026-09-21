import { CTTPickupService } from "./lib/services/ctt/ctt-pickup.service"

async function testConnection() {
  const ctt = new CTTPickupService()

  console.log("Using ENV credentials.")
  try {
    const produtos = await ctt.getProdutosRecolha({
      auth_id: process.env.CTT_AUTHENTICATION_ID || "",
      client_number: process.env.CTT_CLIENT_ID || "",
      contract_number: process.env.CTT_CONTRACT_ID || "",
      environment: "production",
    })
    console.log("SUCCESS!")
    console.log(`Found ${produtos.length} produtos de recolha.`)
    if (produtos.length > 0) {
      console.log("First 3:", produtos.slice(0, 3))
    }
  } catch (e: any) {
    console.error("FAILED:")
    console.error(e.message)
  }
}

testConnection()
