import { CTTSoapClient } from "../lib/services/ctt/ctt-soap-client"

async function testTracking() {
  const client = new CTTSoapClient()
  const bodyXml = `
    <tem:GetEventosObjectos_V3 xmlns:tem="http://tempuri.org/">
      <tem:ID>${process.env.CTT_AUTHENTICATION_ID}</tem:ID>
      <tem:NObjectos xmlns:arr="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
         <arr:string>EQ418727568PT</arr:string>
      </tem:NObjectos>
    </tem:GetEventosObjectos_V3>
  `
  const response = await client.callSoap({
    endpoint: "http://cttexpressows.ctt.pt/CTTEWSPool/EventosWS.svc",
    action: "http://tempuri.org/IEventosWS/GetEventosObjectos_V3",
    soapBodyXml: bodyXml
  })
  console.log(JSON.stringify(response?.GetEventosObjectos_V3Response?.GetEventosObjectos_V3Result?._Objectos?.DadosObjectos_V3BE?._Eventos?.DadosEventos_V3BE, null, 2))
}

testTracking().catch(console.error)

testTracking().catch(console.error)
