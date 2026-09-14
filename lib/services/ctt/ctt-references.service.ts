import { CTTSoapClient } from "./ctt-soap-client"
import { CTTConnectionCredentials } from "./ctt-types"

const CTT_PROD_REFERENCES_ENDPOINT = "http://cttexpressows.ctt.pt/CTTEWSPool/Referenciasws.svc"
const CTT_QA_REFERENCES_ENDPOINT = "http://cttexpressows.qa.ctt.pt/CTTEWSPool/Referenciasws.svc"

export interface CTTPontoEntrega {
  codigo: string
  nome: string
  morada: string
  numero?: string
  codigoPostal: string
  localidade: string
  pais: string
  tipo: "Cacifo Locky 24H" | "Loja CTT" | "Ponto CTT / Parceiro"
  tipoCategoria: "cacifo" | "loja" | "parceiro"
  entidadeId: number
  entidadeNome: string
  latitude?: string
  longitude?: string
  telefone?: string
  email?: string
  horarioFormatado?: string
  horarios?: {
    segunda?: string
    terca?: string
    quarta?: string
    quinta?: string
    sexta?: string
    sabado?: string
    domingo?: string
  }
}

export class CTTReferencesService {
  private client: CTTSoapClient

  constructor() {
    this.client = new CTTSoapClient()
  }

  private getEndpoint(creds: CTTConnectionCredentials): string {
    return creds.environment === "qa" ? CTT_QA_REFERENCES_ENDPOINT : CTT_PROD_REFERENCES_ENDPOINT
  }

  /**
   * Obtém todos os pontos de recolha/entrega CTT Expresso em Portugal
   */
  async getAllDeliveryPointsPT(creds: CTTConnectionCredentials): Promise<CTTPontoEntrega[]> {
    const esc = CTTSoapClient.escapeXml
    const authId = creds.auth_id
    const endpoint = this.getEndpoint(creds)

    const bodyXml = `
      <tem:ObterTodosPontosEntrega>
        <tem:ID>${esc(authId)}</tem:ID>
      </tem:ObterTodosPontosEntrega>
    `

    try {
      const response = await this.client.callSoap({
        endpoint,
        action: "http://tempuri.org/IReferenciasWS/ObterTodosPontosEntrega",
        soapBodyXml: bodyXml,
        timeoutMs: 30000,
      })

      const backing = response?.ObterTodosPontosEntregaResponse?.ObterTodosPontosEntregaResult?._x003C_PontosDeEntrega_x003E_k__BackingField
      const dataset = backing?.diffgram?.DSPontosEntrega?.TBLPontosEntrega

      if (dataset && Array.isArray(dataset)) {
        return dataset.map((p: any) => this.mapRawPointToPontoEntrega(p, "PT"))
      }
      
      if (dataset && typeof dataset === "object") {
        return [this.mapRawPointToPontoEntrega(dataset, "PT")]
      }

      return []
    } catch (error) {
      console.error("[CTTReferencesService] Erro ao obter pontos de entrega PT:", error)
      return []
    }
  }

  /**
   * Obtém todos os pontos de recolha/entrega CTT Express em Espanha
   */
  async getAllDeliveryPointsES(creds: CTTConnectionCredentials): Promise<CTTPontoEntrega[]> {
    const esc = CTTSoapClient.escapeXml
    const authId = creds.auth_id
    const endpoint = this.getEndpoint(creds)

    const bodyXml = `
      <tem:ObterTodosPontosEntregaES>
        <tem:ID>${esc(authId)}</tem:ID>
      </tem:ObterTodosPontosEntregaES>
    `

    try {
      const response = await this.client.callSoap({
        endpoint,
        action: "http://tempuri.org/IReferenciasWS/ObterTodosPontosEntregaES",
        soapBodyXml: bodyXml,
        timeoutMs: 35000,
      })

      const backing = response?.ObterTodosPontosEntregaESResponse?.ObterTodosPontosEntregaESResult?._x003C_PontosDeEntrega_x003E_k__BackingField
      const dataset = backing?.diffgram?.DSPontosEntrega?.TBLPontosEntrega

      if (dataset && Array.isArray(dataset)) {
        return dataset.map((p: any) => this.mapRawPointToPontoEntrega(p, "ES"))
      }
      
      if (dataset && typeof dataset === "object") {
        return [this.mapRawPointToPontoEntrega(dataset, "ES")]
      }

      return []
    } catch (error) {
      console.error("[CTTReferencesService] Erro ao obter pontos de entrega ES:", error)
      return []
    }
  }

  /**
   * Obtém todos os pontos de recolha/entrega CTT Expresso (PT + ES)
   */
  async getAllDeliveryPoints(creds: CTTConnectionCredentials, country: "PT" | "ES" | "ALL" = "ALL"): Promise<CTTPontoEntrega[]> {
    if (country === "PT") {
      return await this.getAllDeliveryPointsPT(creds)
    }
    if (country === "ES") {
      return await this.getAllDeliveryPointsES(creds)
    }

    // Carrega ambos em paralelo
    const [ptsPT, ptsES] = await Promise.all([
      this.getAllDeliveryPointsPT(creds),
      this.getAllDeliveryPointsES(creds),
    ])

    return [...ptsPT, ...ptsES]
  }

  /**
   * Pesquisa pontos de entrega filtrados por localidade, código postal ou entidade
   */
  async getDeliveryPoints(
    creds: CTTConnectionCredentials,
    filters?: { localidade?: string; codigoPostal?: string; entidade?: 1 | 2 | 3 }
  ): Promise<CTTPontoEntrega[]> {
    const esc = CTTSoapClient.escapeXml
    const authId = creds.auth_id
    const endpoint = this.getEndpoint(creds)

    let paramString = ""
    if (filters?.localidade) paramString += `LOCALIDADE:${filters.localidade};`
    if (filters?.codigoPostal) paramString += `CODIGOPOSTAL:${filters.codigoPostal};`
    if (filters?.entidade) paramString += `ENTIDADE:${filters.entidade};`

    const bodyXml = `
      <tem:ObterDadosPontosEntrega>
        <tem:ID>${esc(authId)}</tem:ID>
        <tem:parametros>${esc(paramString)}</tem:parametros>
      </tem:ObterDadosPontosEntrega>
    `

    try {
      const response = await this.client.callSoap({
        endpoint,
        action: "http://tempuri.org/IReferenciasWS/ObterDadosPontosEntrega",
        soapBodyXml: bodyXml,
        timeoutMs: 25000,
      })

      const pontosRaw = response?.ObterDadosPontosEntregaResponse?.ObterDadosPontosEntregaResult?.PontosDeEntrega
      if (pontosRaw && Array.isArray(pontosRaw)) {
        return pontosRaw.map((p: any) => ({
          codigo: p.Codigo || p.ID || p.PuP_x0020_ID || "",
          nome: p.Nome || p.Display_x0020_Name || "",
          morada: p.Morada || p.street_x0020_name || "",
          codigoPostal: p.CodigoPostal || p.postalcode || "",
          localidade: p.Localidade || p.town || "",
          pais: p.Country_x0020_Code || "PT",
          tipo: this.detectPointType(p.Nome || p.Display_x0020_Name || "", p.street_x0020_name || ""),
          tipoCategoria: this.detectCategory(p.Nome || p.Display_x0020_Name || "", p.street_x0020_name || ""),
          entidadeId: Number(p.ID_Entidade) || 1,
          entidadeNome: Number(p.ID_Entidade) === 2 ? "Rede Parceiros / Animática" : "Rede CTT / Lockers",
        }))
      }

      return await this.getAllDeliveryPoints(creds, "ALL")
    } catch {
      return []
    }
  }

  private mapRawPointToPontoEntrega(p: any, defaultCountry: "PT" | "ES" = "PT"): CTTPontoEntrega {
    const nome = String(p.Display_x0020_Name || "").trim()
    const morada = String(p.street_x0020_name || "").trim()
    const tipo = this.detectPointType(nome, morada)
    const tipoCategoria = this.detectCategory(nome, morada)
    const entidadeId = Number(p.ID_Entidade) || 1
    const pais = String(p.Country_x0020_Code || defaultCountry).trim().toUpperCase()

    const formatDayHours = (open1?: string, close1?: string, open2?: string, close2?: string) => {
      const p1 = open1 && close1 && open1.trim() && close1.trim() ? `${open1.trim()}-${close1.trim()}` : ""
      const p2 = open2 && close2 && open2.trim() && close2.trim() ? `${open2.trim()}-${close2.trim()}` : ""
      if (p1 === "00:00-23:59") return "24 Horas"
      if (p1 && p2) return `${p1} / ${p2}`
      if (p1) return p1
      if (p2) return p2
      return "Encerrado"
    }

    const seg = formatDayHours(p.Monday_x0020_Opening_x0020_time_x0020_1, p.Monday_x0020_Closing_x0020_Time_x0020_1, p.Monday_x0020_Opening_x0020_time_x0020_2, p.Monday_x0020_Closing_x0020_Time_x0020_2)
    const ter = formatDayHours(p.Tuesday_x0020_Opening_x0020_time_x0020_1, p.Tuesday_x0020_Closing_x0020_Time_x0020_1, p.Tuesday_x0020_Opening_x0020_time_x0020_2, p.Tuesday_x0020_Closing_x0020_Time_x0020_2)
    const qua = formatDayHours(p.Wednesday_x0020_Opening_x0020_time_x0020_1, p.Wednesday_x0020_Closing_x0020_Time_x0020_1, p.Wednesday_x0020_Opening_x0020_time_x0020_2, p.Wednesday_x0020_Closing_x0020_Time_x0020_2)
    const qui = formatDayHours(p.Thursday_x0020_Opening_x0020_time_x0020_1, p.Thursday_x0020_Closing_x0020_Time_x0020_1, p.Thursday_x0020_Opening_x0020_time_x0020_2, p.Thursday_x0020_Closing_x0020_Time_x0020_2)
    const sex = formatDayHours(p.Friday_x0020_Opening_x0020_time_x0020_1, p.Friday_x0020_Closing_x0020_Time_x0020_1, p.Friday_x0020_Opening_x0020_time_x0020_2, p.Friday_x0020_Closing_x0020_Time_x0020_2)
    const sab = formatDayHours(p.Saturday_x0020_Opening_x0020_Time_x0020_1, p.Saturday_x0020_Closing_x0020_time_x0020_1, p.Saturday_x0020_Opening_x0020_Time_x0020_2, p.Saturday_x0020_Closing_x0020_Time_x0020_2)
    const dom = formatDayHours(p.Sunday_x0020_Opening_x0020_Time_x0020_1, p.Sunday_x0020_Closing_x0020_Time_x0020_1, p.Sunday_x0020_Opening_x0020_Time_x0020_2, p.Sunday_x0020_Closing_x0020_Time_x0020_2)

    let horarioFormatado = seg !== "Encerrado" ? `Seg-Sex: ${seg}` : "Horário sob consulta"
    if (seg === "24 Horas") {
      horarioFormatado = "Disponível 24 Horas / 7 Dias"
    } else if (sab !== "Encerrado") {
      horarioFormatado += ` | Sáb: ${sab}`
    }

    let lat = p.Latitude ? String(p.Latitude).trim().replace(",", ".") : undefined
    let lng = p.Longitude ? String(p.Longitude).trim().replace(",", ".") : undefined

    let entidadeNome = "Rede CTT Expresso"
    if (pais === "ES") {
      entidadeNome = "Rede CTT Express España"
    } else if (entidadeId === 2) {
      entidadeNome = "Rede Parceiros / Animática"
    } else if (tipoCategoria === "cacifo") {
      entidadeNome = "Rede Cacifos Locky"
    }

    return {
      codigo: String(p.PuP_x0020_ID || "").trim(),
      nome,
      morada,
      numero: p.Street_x0020_number ? String(p.Street_x0020_number).trim() : undefined,
      codigoPostal: String(p.postalcode || "").trim(),
      localidade: String(p.town || "").trim(),
      pais,
      tipo,
      tipoCategoria,
      entidadeId,
      entidadeNome,
      latitude: lat,
      longitude: lng,
      telefone: p.phone_x0020_no_x0020_to_x0020_PuP ? String(p.phone_x0020_no_x0020_to_x0020_PuP).trim() : undefined,
      email: p.Email ? String(p.Email).trim() : undefined,
      horarioFormatado,
      horarios: {
        segunda: seg,
        terca: ter,
        quarta: qua,
        quinta: qui,
        sexta: sex,
        sabado: sab,
        domingo: dom,
      }
    }
  }

  private detectPointType(nome: string, morada: string): "Cacifo Locky 24H" | "Loja CTT" | "Ponto CTT / Parceiro" {
    const n = (nome + " " + morada).toLowerCase()
    if (n.includes("cacifo") || n.includes("locky") || n.includes("locker")) {
      return "Cacifo Locky 24H"
    }
    if (n.includes("loja ctt") || n.includes("posto ctt") || (nome.toLowerCase().startsWith("ctt ") && !n.includes("ponto"))) {
      return "Loja CTT"
    }
    return "Ponto CTT / Parceiro"
  }

  private detectCategory(nome: string, morada: string): "cacifo" | "loja" | "parceiro" {
    const n = (nome + " " + morada).toLowerCase()
    if (n.includes("cacifo") || n.includes("locky") || n.includes("locker")) {
      return "cacifo"
    }
    if (n.includes("loja ctt") || n.includes("posto ctt") || (nome.toLowerCase().startsWith("ctt ") && !n.includes("ponto"))) {
      return "loja"
    }
    return "parceiro"
  }
}
