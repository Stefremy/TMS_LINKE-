import { getCttCredentials } from "../app/actions/ctt"
import { getCttWsdlPath } from "../lib/services/ctt/ctt-soap-client"
import * as soap from "soap"

async function run() {
  const creds = await getCttCredentials()
  if (!creds || !creds.username) {
    console.log("No auth")
    return
  }

  const client = await soap.createClientAsync(getCttWsdlPath())
  client.addSoapHeader({
    Security: {
      UsernameToken: {
        Username: creds.username,
        Password: creds.password
      }
    }
  }, 'Security', 'http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd', '')

  const testEnum = async (enumVal: number, name: string) => {
    try {
      const payload = {
        clientReference: "TEST-123",
        subProduct: "EMSF056.01",
        sender: {
          Name: "Teste",
          Address: "Rua A",
          PostalCode: "4000-001",
          City: "Porto",
          Country: "PT"
        },
        receiver: {
          Name: "Teste",
          Address: "Rua B",
          PostalCode: "1000-001",
          City: "Lisboa",
          Country: "PT",
          Phone: "910000000"
        },
        shipment: {
          ClientReference: "TEST-123",
          Weight: 1000,
          Quantity: 1
        },
        specialServices: [{ SpecialServiceType: enumVal }]
      }
      
      const [result] = await client.CreateShipmentAsync({ Input: payload })
      console.log(`[${name} / ${enumVal}] -> SUCCESS (${result.Status})`)
    } catch (e: any) {
      console.log(`[${name} / ${enumVal}] -> ERROR (${e.message.split('\n')[0]})`)
    }
  }

  console.log("--- TESTANDO SERVIÇOS ESPECIAIS CTT (Subproduto EMSF056.01) ---")
  await testEnum(2, "Cobrança (COD)")
  await testEnum(4, "Sábado")
  await testEnum(5, "Guia Assinada")
  await testEnum(6, "Seguro")
  await testEnum(7, "Frágil")
  await testEnum(14, "SMS")
  await testEnum(18, "Ponto CTT")
}

run()
