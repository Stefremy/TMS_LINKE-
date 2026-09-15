import { CTT_TRACKING_EVENTS, CTT_NON_DELIVERY_REASONS, CTT_SITUATIONS, CTTTrackingEvent } from "./ctt-types"

export interface ParsedTrackingEvent {
  eventCode: string
  eventName: string
  reasonCode?: string
  reasonText?: string
  situationCode?: string
  situationText?: string
  tmsStatus: "pendente" | "em_transito" | "em_distribuicao" | "entregue" | "incidencia" | "devolvido"
  timestamp: string
  location?: string
  isTerminal: boolean
}

export class CTTTrackingService {
  /**
   * Mapeia um evento CTT bruto para a representação normalizada do TMS LINKE
   */
  static parseEvent(
    eventCode: string,
    reasonCode?: string,
    situationCode?: string,
    location?: string,
    dateStr?: string
  ): ParsedTrackingEvent {
    const cleanEvent = (eventCode || "").toUpperCase().trim()
    const meta: CTTTrackingEvent = CTT_TRACKING_EVENTS[cleanEvent] || {
      code: cleanEvent,
      description: `Evento CTT (${cleanEvent})`,
      tms_status: "em_transito",
      is_terminal: false,
    }

    const reasonText = reasonCode ? CTT_NON_DELIVERY_REASONS[reasonCode] || `Razão ${reasonCode}` : undefined
    const situationText = situationCode ? CTT_SITUATIONS[situationCode] || `Situação ${situationCode}` : undefined

    return {
      eventCode: meta.code,
      eventName: meta.description,
      reasonCode,
      reasonText,
      situationCode,
      situationText,
      tmsStatus: meta.tms_status,
      timestamp: dateStr || new Date().toISOString(),
      location: location || "Rede CTT Expresso",
      isTerminal: meta.is_terminal,
    }
  }

  /**
   * Gera histórico de eventos de rastreio simulados para demonstração e testes locais
   */
  static generateSimulatedTrackingHistory(trackingNumber: string): ParsedTrackingEvent[] {
    const now = new Date()
    const d1 = new Date(now.getTime() - 24 * 3600 * 1000).toISOString()
    const d2 = new Date(now.getTime() - 14 * 3600 * 1000).toISOString()
    const d3 = new Date(now.getTime() - 4 * 3600 * 1000).toISOString()

    return [
      this.parseEvent("EMA", undefined, undefined, "Centro Operacional CTT Lisboa", d1),
      this.parseEvent("EMF", undefined, undefined, "Plataforma Logística Lisboa", d2),
      this.parseEvent("EMZ", undefined, "A", "Centro de Distribuição Destino", d3),
    ]
  }

  /**
   * Consulta a API de Track & Trace real dos CTT via SOAP (SGEE V1.8)
   * Endpoint: CTTShipmentProviderWS.svc - método GetObjectInfo
   */
  static async fetchRealTrackingEvents(
    trackingNumber: string, 
    credentials: { client_number: string, auth_id: string, contract_number?: string, environment?: string }
  ): Promise<ParsedTrackingEvent[]> {
    const clientId = credentials.client_number
    const authId = credentials.auth_id
    const contractId = credentials.contract_number || ""
    const isProd = (credentials.environment || "production") === "production"

    if (!clientId || !authId) {
      throw new Error("As credenciais CTT (Client ID, Auth ID) não estão configuradas na base de dados.")
    }

    // Endpoint SOAP do serviço de tracking CTT (mesmo domínio que o de expedição)
    const endpoint = isProd
      ? "http://cttexpressows.ctt.pt/CTTEWSPool/CTTShipmentProviderWS.svc"
      : "http://cttexpressows.qa.ctt.pt/CTTEWSPool/CTTShipmentProviderWS.svc"

    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

    const soapBody = `
      <tem:GetObjectInfo>
        <tem:AuthorizationData>
          <ws:AuthenticationId>${esc(authId)}</ws:AuthenticationId>
          <ws:ClientId>${esc(clientId)}</ws:ClientId>
          <ws:ContractId>${esc(contractId)}</ws:ContractId>
        </tem:AuthorizationData>
        <tem:ObjectId>${esc(trackingNumber)}</tem:ObjectId>
      </tem:GetObjectInfo>`

    try {
      const { CTTSoapClient } = await import("./ctt-soap-client")
      const soapClient = new CTTSoapClient()
      const result = await soapClient.callSoap({
        endpoint,
        action: "http://tempuri.org/ICTTShipmentProviderWS/GetObjectInfo",
        soapBodyXml: soapBody,
        timeoutMs: 15000,
      })

      // Navegar pela resposta SOAP para encontrar os eventos
      const response = result?.GetObjectInfoResponse || result?.Body?.GetObjectInfoResponse
      const objectInfo = response?.GetObjectInfoResult
      
      if (!objectInfo) {
        // Sem info = encomenda ainda não registada na rede CTT
        return []
      }

      // Extrair eventos da estrutura de resposta
      const eventsList = objectInfo?.Events?.ObjectEvent || objectInfo?.Events || []
      const events = Array.isArray(eventsList) ? eventsList : [eventsList]

      return events.filter(Boolean).map((evt: any) => this.parseEvent(
        evt.EventCode || evt.Code || evt.eventCode,
        evt.ReasonCode || evt.reasonCode,
        evt.SituationCode || evt.situationCode,
        evt.Location || evt.local || evt.Facility,
        evt.EventDate || evt.Date || evt.eventDate
      ))
    } catch (error: any) {
      throw new Error(`Erro SOAP CTT Track & Trace: ${error.message}`)
    }
  }
}
