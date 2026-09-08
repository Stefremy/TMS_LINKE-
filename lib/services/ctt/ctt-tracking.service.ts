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
}
