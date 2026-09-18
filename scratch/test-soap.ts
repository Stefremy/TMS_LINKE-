import { CTTSoapClient } from "../lib/services/ctt/ctt-soap-client"

async function testEventosWS() {
  const client = new CTTSoapClient()
  const authId = process.env.CTT_AUTH_ID || 'dummy'
  const trackingNumber = 'EQ418727568PT'
  
  // WSDL indicates GetEventosObjectos requires:
  // <ID>guid</ID>
  // <Objectos><string>EQ418727568PT</string></Objectos>
  // with targetNamespace http://CTTExpresso/EventosWS/
  
  const bodyXml2 = `
    <tem:GetEventosObjectos_V3 xmlns:tem="http://tempuri.org/">
      <tem:ID>${authId}</tem:ID>
      <tem:NObjectos xmlns:arr="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
         <arr:string>${trackingNumber}</arr:string>
      </tem:NObjectos>
    </tem:GetEventosObjectos_V3>
  `
  
  console.log("Sending SOAP to EventosWS...")
  try {
    const response = await client.callSoap({
      endpoint: "http://cttexpressows.ctt.pt/CTTEWSPool/EventosWS.svc",
      action: "http://tempuri.org/IEventosWS/GetEventosObjectos_V3",
      soapBodyXml: bodyXml2
    })
    
    console.log(JSON.stringify(response, null, 2))
  } catch (e: any) {
    console.error("Error", e.message)
    console.error(e)
  }
}

testEventosWS().catch(console.error)
