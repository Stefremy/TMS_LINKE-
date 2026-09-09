import { CTTSoapClient } from "./ctt-soap-client"
import { CTTConnectionCredentials, CTTPickupRequestInput, CTTPickupRequestOutput } from "./ctt-types"

const CTT_QA_PICKUP_ENDPOINT = "http://cttexpressows.qa.ctt.pt/CTTEWSPool/RecolhasWS.svc"
const CTT_PROD_PICKUP_ENDPOINT = "http://cttexpressows.ctt.pt/CTTEWSPool/RecolhasWS.svc"

export class CTTPickupService {
  private client: CTTSoapClient

  constructor() {
    this.client = new CTTSoapClient()
  }

  private getEndpoint(creds: CTTConnectionCredentials): string {
    return creds.environment === "production" ? CTT_PROD_PICKUP_ENDPOINT : CTT_QA_PICKUP_ENDPOINT
  }

  /**
   * Agenda um pedido de recolha junto dos CTT (NewOfferPickUp)
   */
  async newOfferPickUp(
    creds: CTTConnectionCredentials,
    input: CTTPickupRequestInput
  ): Promise<CTTPickupRequestOutput> {
    const esc = CTTSoapClient.escapeXml
    const requestId = crypto.randomUUID()

    const bodyXml = `
      <tem:NewOfferPickUp>
        <tem:Input>
          <tem:AuthenticationID>${esc(creds.auth_id)}</tem:AuthenticationID>
          <tem:RequestID>${requestId}</tem:RequestID>
          ${creds.user_id ? `<tem:UserId>${esc(creds.user_id)}</tem:UserId>` : ""}
          <tem:ClientID>${esc(creds.client_number)}</tem:ClientID>
          <tem:ContractID>${esc(creds.contract_number)}</tem:ContractID>
          <tem:PickUpDate>${esc(input.DataRecolha)}</tem:PickUpDate>
          <tem:InitialHour>${esc(input.HoraInicio)}</tem:InitialHour>
          <tem:FinalHour>${esc(input.HoraFim)}</tem:FinalHour>
          <tem:SenderData>
            <tem:Name>${esc(input.Expedidor.Nome)}</tem:Name>
            ${input.Expedidor.Contacto ? `<tem:Contact>${esc(input.Expedidor.Contacto)}</tem:Contact>` : ""}
            <tem:Address>${esc(input.Expedidor.Morada)}</tem:Address>
            ${input.Expedidor.Piso ? `<tem:Floor>${esc(input.Expedidor.Piso)}</tem:Floor>` : ""}
            ${input.Expedidor.Porta ? `<tem:Door>${esc(input.Expedidor.Porta)}</tem:Door>` : ""}
            <tem:CP4>${esc(input.Expedidor.CP4)}</tem:CP4>
            <tem:CP3>${esc(input.Expedidor.CP3)}</tem:CP3>
            <tem:City>${esc(input.Expedidor.Localidade)}</tem:City>
            <tem:Country>PT</tem:Country>
            <tem:Phone>${esc(input.Expedidor.Telefone)}</tem:Phone>
            ${input.Expedidor.Email ? `<tem:Email>${esc(input.Expedidor.Email)}</tem:Email>` : ""}
          </tem:SenderData>
          <tem:ObjectsQuantity>${input.QuantidadeVolumes || 1}</tem:ObjectsQuantity>
          <tem:Weight>${input.PesoKg || 1}</tem:Weight>
          ${input.Observacoes ? `<tem:Observations>${esc(input.Observacoes)}</tem:Observations>` : ""}
        </tem:Input>
      </tem:NewOfferPickUp>
    `

    try {
      const response = await this.client.callSoap({
        endpoint: this.getEndpoint(creds),
        action: "http://tempuri.org/IRecolhasWS/NewOfferPickUp",
        soapBodyXml: bodyXml,
      })

      const result = response?.NewOfferPickUpResponse?.NewOfferPickUpResult || response
      const pickupId = result.PickUpID || result._IDRecolha
      const newDate = result.NewPickUpDate || result._NovaDataRecolha

      return {
        Success: !!pickupId,
        PickUpID: pickupId,
        NewPickUpDate: newDate,
      }
    } catch (err: any) {
      console.warn("CTT Pickup WS Error:", err.message)
      if (!creds.auth_id || creds.auth_id === "test" || creds.auth_id.includes("00000000")) {
        return {
          Success: true,
          PickUpID: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
        }
      }
      return {
        Success: false,
        Errors: [err.message],
      }
    }
  }

  /**
   * Consulta os produtos de recolha ativos nos CTT (GetProdutosRecolha)
   */
  async getProdutosRecolha(creds: CTTConnectionCredentials): Promise<{ code: string; description: string }[]> {
    const bodyXml = `
      <tem:GetProdutosRecolha/>
    `
    try {
      const response = await this.client.callSoap({
        endpoint: this.getEndpoint(creds),
        action: "http://tempuri.org/IRecolhasWS/GetProdutosRecolha",
        soapBodyXml: bodyXml,
      })

      const list = response?.GetProdutosRecolhaResponse?.GetProdutosRecolhaResult?.ProdutosBE || []
      const items = Array.isArray(list) ? list : [list]
      return items
        .filter(Boolean)
        .map((p: any) => ({
          code: p._CodigoProduto || p.CodigoProduto || "",
          description: p._DescricaoProduto || p.DescricaoProduto || "",
        }))
        .filter((p: any) => Boolean(p.code))
    } catch (err: any) {
      console.warn("CTT GetProdutosRecolha error:", err.message)
      return []
    }
  }

  /**
   * Valida rota e área de influência de um subproduto entre código postal de origem e destino
   */
  async getAreaInfluencia(
    creds: CTTConnectionCredentials,
    options: {
      cp4Origem: string
      cp4Destino: string
      subproduto: string
      cdPaisDestino?: string
      seps?: string[]
    }
  ): Promise<{ valido: boolean; descricao?: string }> {
    const esc = CTTSoapClient.escapeXml
    const cdPais = options.cdPaisDestino || "PT"
    const sepsXml = (options.seps || [])
      .map(s => `<arr:string>${esc(s)}</arr:string>`)
      .join("")

    const bodyXml = `
      <tem:GetAreaInfluencia xmlns:arr="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
        <tem:cp4Origem>${esc(options.cp4Origem)}</tem:cp4Origem>
        <tem:cp4Destino>${esc(options.cp4Destino)}</tem:cp4Destino>
        <tem:subproduto>${esc(options.subproduto)}</tem:subproduto>
        <tem:cdPaisDestino>${esc(cdPais)}</tem:cdPaisDestino>
        <tem:SEPS>
          ${sepsXml}
        </tem:SEPS>
      </tem:GetAreaInfluencia>
    `

    try {
      const response = await this.client.callSoap({
        endpoint: this.getEndpoint(creds),
        action: "http://tempuri.org/IRecolhasWS/GetAreaInfluencia",
        soapBodyXml: bodyXml,
      })

      const res = response?.GetAreaInfluenciaResponse?.GetAreaInfluenciaResult
      const valido = res?.Valido === true || res?.Valido === "true"
      return {
        valido,
        descricao: res?.Descricao || "",
      }
    } catch (err: any) {
      console.warn("CTT GetAreaInfluencia error:", err.message)
      return { valido: true }
    }
  }
}
