import { CTTSoapClient } from "./ctt-soap-client"
import { CTTConnectionCredentials, CTTPickupRequestInput, CTTPickupRequestOutput } from "./ctt-types"
import { DEFAULT_CTT_REQUESTER_PHONE } from "@/lib/pickup-contact"

const CTT_QA_PICKUP_ENDPOINT = "http://cttexpressows.qa.ctt.pt/CTTEWSPool/RecolhasWS.svc"
const CTT_PROD_PICKUP_ENDPOINT = "http://cttexpressows.ctt.pt/CTTEWSPool/RecolhasWS.svc"
const PICKUP_MODEL_NS = "http://schemas.datacontract.org/2004/07/CTTExpressoWS.Models.PickUp"
const INVALID_PICKUP_PHONE_MESSAGE = "O TMS não recebeu um contacto utilizável. Preencha Telefone Principal ou Telemóvel com um número até 15 dígitos. O pedido ainda não foi enviado aos CTT."
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
  const callingCode = country.toUpperCase() === "PT" ? "351" : country.toUpperCase() === "ES" ? "34" : ""
  const normalizeCandidate = (candidate: string) => {
    let digits = candidate.replace(/\D/g, "")
    if (!digits) return ""

    if (callingCode && digits.startsWith(`00${callingCode}`)) {
      digits = digits.slice(callingCode.length + 2)
    } else if (callingCode && digits.startsWith(callingCode) && digits.length >= callingCode.length + 9) {
      digits = digits.slice(callingCode.length)
    }

    // Some address books store the national trunk prefix even though CTT expects
    // the nine-digit national number without it.
    if (digits.length === 10 && digits.startsWith("0")) digits = digits.slice(1)
    return digits.length >= 1 && digits.length <= 15 ? digits : ""
  }

  // First normalize the whole field so punctuation used inside a number (for
  // example 912/345/678) does not split a valid phone into unusable fragments.
  const wholeFieldNumber = normalizeCandidate(phone || "")
  if (wholeFieldNumber) return wholeFieldNumber

  // If the operator entered more than one number, try each alternative.
  const candidates = (phone || "").split(/[\/,;|]|\bou\b/i)
  for (const candidate of candidates) {
    const normalized = normalizeCandidate(candidate)
    if (normalized) return normalized
  }
  return ""
}

function isValidPickupPhone(phone: string, country: string) {
  const normalized = normalizePickupPhone(phone, country)
  // The CTT specification requires a value and caps it at 15 characters; it
  // does not require exactly nine digits. Let CTT validate the number itself.
  return normalized.length >= 1 && normalized.length <= 15
}

function buildNewOfferPickUpXml(creds: CTTConnectionCredentials, input: CTTPickupRequestInput, requestId: string) {
  const esc = CTTSoapClient.escapeXml
  const sender = input.Expedidor
  const contact = sender.Contacto || sender.Nome
  const country = sender.Pais || "PT"
  const mainPhone = normalizePickupPhone(sender.Telefone, country)
  const suppliedMobilePhone = normalizePickupPhone(sender.Telemovel || "", country)
  const mainIsMobile = country.toUpperCase() === "PT" && /^9\d{8}$/.test(mainPhone)
  const mobilePhone = isValidPickupPhone(sender.Telemovel || "", country) ? suppliedMobilePhone : mainIsMobile ? mainPhone : ""
  const pickupPhone = mainIsMobile ? "" : mainPhone
  const requester = input.Solicitante ?? creds.pickup_requester
  const requesterPhone = requester
    ? normalizePickupPhone(requester.phone?.trim() || DEFAULT_CTT_REQUESTER_PHONE, "PT")
    : mainPhone || mobilePhone
  const requesterName = requester?.name || contact
  const requesterEmail = requester ? requester.email : sender.Email
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
              <pick:ContactName>${esc(requesterName)}</pick:ContactName>
              <pick:ContractID>${esc(input.ContractId || creds.contract_number)}</pick:ContractID>
              ${requesterEmail ? `<pick:Email>${esc(requesterEmail)}</pick:Email>` : ""}
              <pick:Phone>${esc(requesterPhone)}</pick:Phone>
              <pick:RequestedBy>${esc(requester?.name || creds.user_id || contact)}</pick:RequestedBy>
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
              ${mobilePhone ? `<pick:MobilePhone>${esc(mobilePhone)}</pick:MobilePhone>` : ""}
              <pick:Name>${esc(sender.Nome)}</pick:Name>
              <pick:Phone>${esc(pickupPhone)}</pick:Phone>
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
    const requester = input.Solicitante ?? creds.pickup_requester
    if (requester && (!requester.name?.trim() || requester.name.length > 50 ||
      !isValidPickupPhone(requester.phone?.trim() || DEFAULT_CTT_REQUESTER_PHONE, "PT") ||
      (requester.email && requester.email.length > 50))) {
      return { Success: false, Errors: ["Confirme os dados do cliente CTT: contacto até 50 caracteres, telefone ou telemóvel preenchido e email até 50 caracteres."] }
    }
    const validPhone = [input.Expedidor.Telefone, input.Expedidor.Telemovel || ""]
      .some(phone => isValidPickupPhone(phone, country))
    if (!validPhone) {
      return {
        Success: false,
        Errors: [INVALID_PICKUP_PHONE_MESSAGE],
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
      const errors = getPickupErrorMessages(result.ErrorList || result.Errors).map(message => {
        if (!/Phone Number is not valid/i.test(message)) return message
        const requester = input.Solicitante ?? creds.pickup_requester
        const contactPhone = requester ? requester.phone?.trim() || DEFAULT_CTT_REQUESTER_PHONE
          : isValidPickupPhone(input.Expedidor.Telefone, country) ? input.Expedidor.Telefone : input.Expedidor.Telemovel || ""
        const contactCountry = requester ? "PT" : country
        const digitCount = normalizePickupPhone(contactPhone, contactCountry).length
        if (/ClientData:/i.test(message) && contactCountry === "PT" && /^9\d{8}$/.test(normalizePickupPhone(contactPhone, contactCountry))) {
          return `Os CTT recusaram o telemóvel no contacto obrigatório do solicitante${requester ? ` (${requester.name})` : ""} (ClientData.Phone). O número foi enviado; esta recusa precisa de confirmação/correção pelos CTT. Resposta CTT: ${message}`
        }
        return `Os CTT recusaram o contacto enviado (${digitCount} dígitos). Resposta CTT: ${message}`
      })
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
