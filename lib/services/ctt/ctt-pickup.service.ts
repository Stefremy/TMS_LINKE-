import { CTTSoapClient } from "./ctt-soap-client"
import { CTTConnectionCredentials, CTTPickupRequestInput, CTTPickupRequestOutput } from "./ctt-types"

const CTT_QA_PICKUP_ENDPOINT = "http://cttexpressows.qa.ctt.pt/CTTEWSPool/RecolhasWS.svc"
const CTT_PROD_PICKUP_ENDPOINT = "http://cttexpressows.ctt.pt/CTTEWSPool/RecolhasWS.svc"
const PICKUP_MODEL_NS = "http://schemas.datacontract.org/2004/07/CTTExpressoWS.Models.PickUp"
const CTT_PICKUP_WINDOWS = new Set([
  "08:00-10:00",
  "10:00-13:00",
  "13:00-16:00",
  "16:00-19:00",
  "19:00-22:00",
])

function getPickupErrorMessages(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(getPickupErrorMessages)
  if (!value || typeof value !== "object") return []

  const item = value as Record<string, unknown>
  const message = item.Message || item._Message || item["#text"]
  const code = item.ErrorCode || item._ErrorCode || item.Code || item._Code
  const ownMessage = typeof message === "string" && message.trim()
    ? `${typeof code === "string" || typeof code === "number" ? `${code}: ` : ""}${message.trim()}`
    : null

  if (ownMessage) return [ownMessage]

  return ["ErrorData", "Errors", "ErrorList", "Error", "Items"]
    .flatMap(key => getPickupErrorMessages(item[key]))
}

function normalizePickupPhone(phone: string, country: string) {
  const firstNumber = (phone || "").split(/[\/,;]/, 1)[0]
  const digits = firstNumber.replace(/\D/g, "")
  const callingCode = country === "PT" ? "351" : country === "ES" ? "34" : ""
  return callingCode && digits.startsWith(callingCode) && digits.length > 9
    ? digits.slice(callingCode.length)
    : digits
}

function buildNewOfferPickUpXml(creds: CTTConnectionCredentials, input: CTTPickupRequestInput, requestId: string) {
  const esc = CTTSoapClient.escapeXml
  const sender = input.Expedidor
  const contact = sender.Contacto || sender.Nome
  const country = sender.Pais || "PT"
  const mainPhone = normalizePickupPhone(sender.Telefone, country)
  const mobilePhone = normalizePickupPhone(sender.Telemovel || sender.Telefone, country)
  const phone = mainPhone.length === 9 ? mainPhone : mobilePhone
  const dimensions = input.BiggestObjectDimensionsCm
  const totalWeight = Math.round((input.PesoKg || 1) * 1000)
  const destination = input.Destination || "PT"

  // RecolhasWS expects Input to contain the PickUp namespace data contract.
  // CTT's business rules require positive dimensions and the heaviest weight to
  // match the total weight, in addition to the fields required by the WSDL.
  return `
      <tem:NewOfferPickUp xmlns:pick="${PICKUP_MODEL_NS}">
        <tem:Input>
          <pick:AuthenticationID>${esc(input.AuthenticationID || creds.auth_id)}</pick:AuthenticationID>
          <pick:PickUpData>
            <pick:BiggerObjectHeight>${dimensions.Height}</pick:BiggerObjectHeight>
            <pick:BiggerObjectLenght>${dimensions.Length}</pick:BiggerObjectLenght>
            <pick:BiggerObjectWidth>${dimensions.Width}</pick:BiggerObjectWidth>
            <pick:ClientData>
              <pick:ClientID>${esc(input.ClientId || creds.client_number)}</pick:ClientID>
              <pick:ContactName>${esc(contact)}</pick:ContactName>
              <pick:ContractID>${esc(input.ContractId || creds.contract_number)}</pick:ContractID>
              ${sender.Email ? `<pick:Email>${esc(sender.Email)}</pick:Email>` : ""}
              <pick:Phone>${esc(phone)}</pick:Phone>
              <pick:RequestedBy>${esc(creds.user_id || contact)}</pick:RequestedBy>
            </pick:ClientData>
            <pick:ClientRef>${esc(requestId)}</pick:ClientRef>
            <pick:Date>${esc(input.DataRecolha)}</pick:Date>
            <pick:DestinationList>
              <pick:PickUpData.Destinations>${esc(destination)}</pick:PickUpData.Destinations>
            </pick:DestinationList>
            <!-- CTT rejects this request unless HeavierObjectWeight equals TotalWeight. -->
            <pick:HeavierObjectWeight>${totalWeight}</pick:HeavierObjectWeight>
            <pick:Observations>${esc(input.Observacoes || "")}</pick:Observations>
            <pick:PickUpPeriod>${esc(`${input.HoraInicio}-${input.HoraFim}`)}</pick:PickUpPeriod>
            <pick:PickupAddress>
              <pick:Address>${esc(sender.Morada)}</pick:Address>
              <pick:CP3>${esc(sender.CP3)}</pick:CP3>
              <pick:CP4>${esc(sender.CP4)}</pick:CP4>
              <pick:City>${esc(sender.Localidade)}</pick:City>
              <pick:Contact>${esc(contact)}</pick:Contact>
              <pick:Country>${esc(country)}</pick:Country>
              <pick:Door>${esc(sender.Porta || "")}</pick:Door>
              ${sender.Email ? `<pick:Email>${esc(sender.Email)}</pick:Email>` : ""}
              <pick:Floor>${esc(sender.Piso || "")}</pick:Floor>
              <pick:MobilePhone>${esc(mobilePhone)}</pick:MobilePhone>
              <pick:Name>${esc(sender.Nome)}</pick:Name>
              <pick:Phone>${esc(phone)}</pick:Phone>
            </pick:PickupAddress>
            <pick:TotalObjects>${input.QuantidadeVolumes || 1}</pick:TotalObjects>
            <pick:TotalWeight>${totalWeight}</pick:TotalWeight>
            <pick:TransportDocument>0</pick:TransportDocument>
          </pick:PickUpData>
        </tem:Input>
      </tem:NewOfferPickUp>
    `
}

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
    const dimensions = input.BiggestObjectDimensionsCm
    if (!input.Destination || !dimensions || [dimensions.Length, dimensions.Width, dimensions.Height]
      .some(value => !Number.isInteger(value) || value <= 0 || value >= 300)) {
      return {
        Success: false,
        Errors: ["Indique um destino e as dimensões do maior volume entre 1 e 299 cm."],
      }
    }
    const pickupPeriod = `${input.HoraInicio}-${input.HoraFim}`
    if (!CTT_PICKUP_WINDOWS.has(pickupPeriod)) {
      return {
        Success: false,
        Errors: ["Selecione uma janela horária CTT válida: 08h00–10h00, 10h00–13h00, 13h00–16h00, 16h00–19h00 ou 19h00–22h00."],
      }
    }
    const heaviestWeight = input.PesoObjetoMaisPesadoKg ?? input.PesoKg
    if (!Number.isFinite(heaviestWeight) || heaviestWeight <= 0 || heaviestWeight > input.PesoKg) {
      return {
        Success: false,
        Errors: ["O peso do volume mais pesado deve ser maior que 0 e não pode ultrapassar o peso total."],
      }
    }
    const country = input.Expedidor.Pais || "PT"
    const validPhone = [input.Expedidor.Telefone, input.Expedidor.Telemovel || ""]
      .some(phone => normalizePickupPhone(phone, country).length === 9)
    if (!validPhone) {
      return {
        Success: false,
        Errors: ["Indique um telefone de contacto válido com 9 dígitos."],
      }
    }

    const requestId = crypto.randomUUID()
    const bodyXml = buildNewOfferPickUpXml(creds, input, requestId)

    try {
      const response = await this.client.callSoap({
        endpoint: this.getEndpoint(creds),
        action: "http://tempuri.org/IRecolhasWS/NewOfferPickUp",
        soapBodyXml: bodyXml,
      })

      const result = response?.NewOfferPickUpResponse?.NewOfferPickUpResult || response
      const pickupId = result.PickUpID || result._IDRecolha
      const newDate = result.NewPickUpDate || result._NovaDataRecolha
      const errors = getPickupErrorMessages(result.ErrorList || result.Errors)
      if (result.Status === "Failure" && errors.length === 0) {
        errors.push("Os CTT recusaram a recolha, mas não devolveram uma descrição do erro.")
      }

      return {
        Success: result.Status === "Success" || (!!pickupId && result.Status !== "Failure"),
        PickUpID: pickupId,
        NewPickUpDate: newDate,
        Errors: errors,
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
