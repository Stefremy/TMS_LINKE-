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
   * Consulta a API de Track & Trace real dos CTT para um objeto específico
   */
  static async fetchRealTrackingEvents(trackingNumber: string, credentials: { client_number: string, auth_id: string }): Promise<ParsedTrackingEvent[]> {
    const baseUrl = process.env.CTT_WS_BASE_URL || "https://appserver.ctt.pt"
    const clientId = credentials.client_number
    const authId = credentials.auth_id

    // Se as credenciais não estiverem configuradas, não podemos fazer a chamada real.
    // Lança um erro controlado que será apanhado e mostrado ao utilizador.
    if (!baseUrl || !clientId || !authId) {
      throw new Error("As credenciais da API dos CTT (Base URL, Client ID, Auth ID) não estão configuradas corretamente na base de dados.")
    }

    try {
      // Exemplo de integração REST comum (a ser ajustado conforme o endpoint final exato fornecido pela CTT)
      const response = await fetch(`${baseUrl}/TrackTrace/v1/objects/${encodeURIComponent(trackingNumber)}/events`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "client_id": clientId,
          "authentication_id": authId
        },
      })

      if (!response.ok) {
        throw new Error(`Falha na API dos CTT: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // Assumindo que a resposta traz um array de eventos no formato genérico:
      // { events: [ { eventCode: "EMA", eventDate: "...", location: "..." }, ... ] }
      const eventsList = data.events || data || []

      if (!Array.isArray(eventsList)) {
        throw new Error("Formato de resposta da API de Track & Trace inválido.")
      }

      return eventsList.map((evt: any) => this.parseEvent(
        evt.eventCode || evt.code,
        evt.reasonCode,
        evt.situationCode,
        evt.location || evt.local,
        evt.eventDate || evt.timestamp || evt.date
      ))
    } catch (error: any) {
      throw new Error(`Erro de comunicação com Track & Trace CTT: ${error.message}`)
    }
  }
}
