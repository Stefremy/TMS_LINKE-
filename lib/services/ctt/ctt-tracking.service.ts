import { CTT_TRACKING_EVENTS, CTT_NON_DELIVERY_REASONS, CTT_SITUATIONS, CTTTrackingEvent } from "./ctt-types"
import { CTTSoapClient } from "./ctt-soap-client"

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

/**
 * Calcula o offset de fuso horário de Portugal continental (Europe/Lisbon) para uma determinada data.
 * Em horário de verão (WEST) retorna "+01:00", em horário de inverno (WET) retorna "+00:00".
 */
export function getLisbonTzOffset(year: number, month: number, day: number): string {
  try {
    const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Lisbon",
      timeZoneName: "shortOffset"
    })
    const parts = formatter.formatToParts(probe)
    const tzPart = parts.find(p => p.type === "timeZoneName")
    if (tzPart && tzPart.value) {
      const match = tzPart.value.match(/GMT([+-]\d+)(?::(\d+))?/)
      if (match) {
        const sign = match[1].startsWith("-") ? "-" : "+"
        const h = Math.abs(parseInt(match[1], 10)).toString().padStart(2, "0")
        const m = (match[2] || "00").padStart(2, "0")
        return `${sign}${h}:${m}`
      }
    }
  } catch {}
  return "+01:00"
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
    let meta: CTTTrackingEvent = CTT_TRACKING_EVENTS[cleanEvent]
    
    // Fallback heurístico para quando usamos o Web Scraper e recebemos texto em vez de códigos
    if (!meta) {
       let tmsStatus: "pendente" | "em_transito" | "em_distribuicao" | "entregue" | "incidencia" | "devolvido" = "em_transito"
       let isTerminal = false
       
       if (cleanEvent.includes("ENTREGUE")) {
         tmsStatus = "entregue"
         isTerminal = true
       } else if (cleanEvent.includes("DEVOLVID") || cleanEvent.includes("DEVOLUÇÃO")) {
         tmsStatus = "devolvido"
         isTerminal = true
       } else if (cleanEvent.includes("DISTRIBUIÇÃO")) {
         tmsStatus = "em_distribuicao"
       } else if (cleanEvent.includes("ANOMALIA") || cleanEvent.includes("FALHA") || cleanEvent.includes("NÃO CONSEGUIDA")) {
         tmsStatus = "incidencia"
       }

       meta = {
         code: cleanEvent.substring(0, 50),
         description: cleanEvent,
         tms_status: tmsStatus,
         is_terminal: isTerminal,
       }
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
   * Consulta o endpoint EventosWS Oficial dos CTT para ler o histórico de rastreio.
   */
  static async fetchRealTrackingEvents(
    trackingNumber: string, 
    credentials: { client_number: string, auth_id: string, contract_number?: string, environment?: string }
  ): Promise<ParsedTrackingEvent[]> {
    try {
      const client = new CTTSoapClient()
      const isProd = credentials.environment === "production"
      const endpoint = isProd 
         ? "http://cttexpressows.ctt.pt/CTTEWSPool/EventosWS.svc"
         : "http://cttexpressows.qa.ctt.pt/CTTEWSPool/EventosWS.svc"

      const bodyXml = `
        <tem:GetEventosObjectos_V3 xmlns:tem="http://tempuri.org/">
          <tem:ID>${CTTSoapClient.escapeXml(credentials.auth_id)}</tem:ID>
          <tem:NObjectos xmlns:arr="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
             <arr:string>${CTTSoapClient.escapeXml(trackingNumber)}</arr:string>
          </tem:NObjectos>
        </tem:GetEventosObjectos_V3>
      `

      const response = await client.callSoap({
        endpoint,
        action: "http://tempuri.org/IEventosWS/GetEventosObjectos_V3",
        soapBodyXml: bodyXml
      })

      const result = response?.GetEventosObjectos_V3Response?.GetEventosObjectos_V3Result

      // Verificar se houve erros ao nível do WCF
      if (result?._erros?.string) {
         const errs = Array.isArray(result._erros.string) ? result._erros.string : [result._erros.string]
         if (errs.length > 0) {
            console.warn("EventosWS retornou erros:", errs)
            // Se o objecto for inválido, devolvemos vazio
            return []
         }
      }

      const objectsData = result?._Objectos?.DadosObjectos_V3BE
      if (!objectsData) return []

      const objList = Array.isArray(objectsData) ? objectsData : [objectsData]
      const objInfo = objList.find((o: any) => o._NObjecto === trackingNumber || o._NRelable === trackingNumber)
      if (!objInfo || !objInfo._Eventos?.DadosEventos_V3BE) return []

      const evtData = objInfo._Eventos.DadosEventos_V3BE
      const evts = Array.isArray(evtData) ? evtData : [evtData]

      return evts.map((evt: any) => {
         const code = evt._CodigoEvento || ""
         const reason = evt._CodigoMotivo || undefined
         const sit = evt._CodigoSituacao || undefined
         let date = undefined
         if (evt._DataEvento) {
           const parts = evt._DataEvento.trim().split(' ')
           if (parts.length === 2) {
             const [d, t] = parts
             const [day, month, year] = d.split('-')
             if (year && month && day) {
               // Obter o offset de fuso horário de Portugal (Europe/Lisbon: +01:00 no verão, +00:00 no inverno)
               const offset = getLisbonTzOffset(parseInt(year, 10), parseInt(month, 10), parseInt(day, 10))
               date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${t}${offset}`
             }
           }
         }
         const loc = evt._DescricaoNoEvento || "Rede CTT"
         return this.parseEvent(code, reason, sit, loc, date)
      })

    } catch (error: any) {
      console.warn("Erro ao ler API EventosWS:", error.message)
      throw new Error(`Erro ao contactar EventosWS CTT: ${error.message}`)
    }
  }
}
