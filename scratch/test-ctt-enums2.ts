import { config } from "dotenv"
config({ path: ".env" })
import { getCttCredentials } from "../app/actions/ctt"
import { CTTSoapClient } from "../lib/services/ctt/ctt-soap-client"
import { getCttWsdlPath } from "../lib/services/ctt/ctt-soap-client"

async function run() {
  const creds = await getCttCredentials()
  if (!creds || !creds.username) {
    console.log("No auth")
    return
  }

  const client = new CTTSoapClient()

  const testEnum = async (enumVal: number, name: string) => {
    try {
      const xml = `
      <tem:CreateShipment>
         <tem:Input>
            <mod:ClientReference>TEST-${enumVal}</mod:ClientReference>
            <mod:Receiver>
               <mod:Address>Rua Teste</mod:Address>
               <mod:City>Lisboa</mod:City>
               <mod:Country>PT</mod:Country>
               <mod:Name>Destinatario Teste</mod:Name>
               <mod:Phone>910000000</mod:Phone>
               <mod:PostalCode>1000-001</mod:PostalCode>
            </mod:Receiver>
            <mod:Sender>
               <mod:Address>Sede</mod:Address>
               <mod:City>Porto</mod:City>
               <mod:Country>PT</mod:Country>
               <mod:Name>Remetente Teste</mod:Name>
               <mod:Phone>910000000</mod:Phone>
               <mod:PostalCode>4000-001</mod:PostalCode>
            </mod:Sender>
            <mod:Shipment>
               <mod:ClientReference>TEST-${enumVal}</mod:ClientReference>
               <mod:Quantity>1</mod:Quantity>
               <mod:Weight>1000</mod:Weight>
            </mod:Shipment>
            <mod:SpecialServices>
               <mod:SpecialService>
                  <mod:SpecialServiceType>${enumVal}</mod:SpecialServiceType>
                  ${enumVal === 2 ? '<mod:Value>50.0</mod:Value>' : ''}
               </mod:SpecialService>
            </mod:SpecialServices>
            <mod:SubProduct>EMSF056.01</mod:SubProduct>
         </tem:Input>
      </tem:CreateShipment>`

      const result = await client.callSoap({
        endpoint: "https://ws-ctt.ctt.pt/Dev/ShipmentProvider/ShipmentProvider.svc/basic",
        action: "http://tempuri.org/IShipmentProvider/CreateShipment",
        soapBodyXml: xml
      })
      console.log(`[${name} / ${enumVal}] -> SUCCESS (${JSON.stringify(result).substring(0, 100)})`)
    } catch (e: any) {
      console.log(`[${name} / ${enumVal}] -> ERROR (${e.message.split('\n')[0].substring(0, 150)})`)
    }
  }

  console.log("--- TESTANDO SERVIÇOS ESPECIAIS CTT (Subproduto EMSF056.01) ---")
  await testEnum(2, "Cobrança (COD)")
  await testEnum(4, "Sábado")
  await testEnum(7, "Frágil")
  await testEnum(14, "SMS")
}

run()
