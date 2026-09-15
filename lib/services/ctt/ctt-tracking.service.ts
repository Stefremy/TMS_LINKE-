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
   * Consulta a página pública de Track & Trace dos CTT usando Web Scraping
   * (Substituto da API oficial enquanto não existirem credenciais REST)
   */
  static async fetchRealTrackingEvents(
    trackingNumber: string, 
    credentials: { client_number: string, auth_id: string, contract_number?: string, environment?: string }
  ): Promise<ParsedTrackingEvent[]> {
    try {
      const cheerio = await import("cheerio")
      const url = `https://www.ctt.pt/feapl_2/app/open/objectSearch/objectSearch.jspx?objects=${trackingNumber}`
      
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7"
        },
        signal: AbortSignal.timeout(15000)
      })

      if (!res.ok) {
        throw new Error(`Falha HTTP ao contactar CTT: ${res.status}`)
      }

      const html = await res.text()
      const $ = cheerio.load(html)

      // Verificar se dá erro de não encontrado
      const notFoundText = html.toLowerCase()
      if (notFoundText.includes("não foi encontrado") || notFoundText.includes("não devolveu")) {
        return []
      }

      const events: any[] = []

      // Heurística 1: Tabela de Detalhes Clássica (caso exista)
      $("table tr").each((i, el) => {
        const cols = $(el).find("td")
        if (cols.length >= 3) {
          const rawDate = $(cols[0]).text().trim()
          const rawStatus = $(cols[1]).text().trim()
          const rawLocal = $(cols[2]).text().trim()
          
          if (rawDate.match(/\d{4}/) || rawDate.match(/\d{2}\/\d{2}/)) {
             events.push({
                eventCode: rawStatus, // Usamos o texto literal se não tivermos código
                eventDate: rawDate,
                location: rawLocal,
                reasonCode: "",
                situationCode: ""
             })
          }
        }
      })

      // Heurística 2: Nova estrutura de painéis da Timeline CTT (2023+)
      if (events.length === 0) {
        $(".timeline-item, .panel, .evento-linha").each((i, el) => {
          const text = $(el).text().replace(/\s+/g, " ").trim()
          // Extrair data se possível usando Regex (YYYY/MM/DD hh:mm ou DD/MM/YYYY hh:mm)
          const dateMatch = text.match(/(\d{2,4}[-\/]\d{2}[-\/]\d{2,4}\s+\d{2}:\d{2})/)
          const dateStr = dateMatch ? dateMatch[1] : ""
          
          // O status costuma ser o próprio texto limpo da data
          const statusStr = text.replace(dateStr, "").trim()

          if (dateStr || statusStr) {
            events.push({
              eventCode: statusStr.substring(0, 50),
              eventDate: dateStr,
              location: "Rede CTT",
              reasonCode: "",
              situationCode: ""
            })
          }
        })
      }

      if (events.length === 0 && !notFoundText.includes("não foi encontrado")) {
         // Existe a página, não é 404, mas ainda não tem timeline estruturada
         return []
      }

      return events.map((evt) => this.parseEvent(
        evt.eventCode,
        evt.reasonCode,
        evt.situationCode,
        evt.location,
        evt.eventDate
      ))
    } catch (error: any) {
      console.warn("Erro ao fazer scraping do Track & Trace CTT:", error.message)
      throw new Error(`Erro ao contactar portal CTT: ${error.message}`)
    }
  }
}
