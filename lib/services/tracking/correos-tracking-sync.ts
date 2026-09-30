import { CorreosTrackingService } from "../correos/correos-tracking.service"
import { resolveCorreosCredentials } from "../carriers/credentials"
import { CorreosCredentials, CorreosTrackingOutput } from "../correos/types"
import { NormalizedTrackingEvent, NormalizedTmsStatus, TmsDisplayStatus } from "./types"

/**
 * Converte data e hora da resposta Correos Express para ISO 8601 UTC.
 * Suporta formatos: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYYMMDD.
 */
export function parseCorreosDateTime(fecha?: string, hora?: string): string {
  if (!fecha) return new Date().toISOString()
  try {
    const cleanFecha = fecha.trim()
    const cleanHora = (hora || "00:00:00").trim()

    let year = 0,
      month = 0,
      day = 0

    if (cleanFecha.includes("/")) {
      const parts = cleanFecha.split("/")
      day = parseInt(parts[0], 10)
      month = parseInt(parts[1], 10) - 1
      year = parseInt(parts[2], 10)
    } else if (cleanFecha.includes("-")) {
      const parts = cleanFecha.split("-")
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10)
        month = parseInt(parts[1], 10) - 1
        day = parseInt(parts[2], 10)
      } else {
        day = parseInt(parts[0], 10)
        month = parseInt(parts[1], 10) - 1
        year = parseInt(parts[2], 10)
      }
    } else if (cleanFecha.length === 8 && /^\d{8}$/.test(cleanFecha)) {
      year = parseInt(cleanFecha.substring(0, 4), 10)
      month = parseInt(cleanFecha.substring(4, 6), 10) - 1
      day = parseInt(cleanFecha.substring(6, 8), 10)
    }

    let hour = 0,
      min = 0,
      sec = 0

    if (cleanHora.includes(":")) {
      const hParts = cleanHora.split(":")
      hour = parseInt(hParts[0], 10) || 0
      min = parseInt(hParts[1], 10) || 0
      sec = parseInt(hParts[2], 10) || 0
    } else if (cleanHora.length === 6 && /^\d{6}$/.test(cleanHora)) {
      hour = parseInt(cleanHora.substring(0, 2), 10) || 0
      min = parseInt(cleanHora.substring(2, 4), 10) || 0
      sec = parseInt(cleanHora.substring(4, 6), 10) || 0
    }

    if (year && !isNaN(day) && !isNaN(month)) {
      const d = new Date(Date.UTC(year, month, day, hour, min, sec))
      if (!isNaN(d.getTime())) return d.toISOString()
    }
  } catch {}

  return new Date().toISOString()
}

/**
 * Mapeia os códigos de estado e incidência da Correos Express para os estados permitidos no TMS LINKE.
 * Nota: 'entrada_rede' é o valor gravado na base de dados Postgres; 'em_transito' é o valor de apresentação.
 */
export function mapCorreosStatus(
  codEstado?: string,
  descEstado?: string,
  codIncEstado?: string,
  descIncEstado?: string
): {
  status: NormalizedTmsStatus
  displayStatus: TmsDisplayStatus
  eventName: string
  isTerminal: boolean
  isIncidencia: boolean
} {
  const code = (codEstado || "").trim()
  const desc = (descEstado || "").toLowerCase().trim()
  const incCode = (codIncEstado || "").trim()
  const incDesc = (descIncEstado || "").trim()

  // Se tiver indicação de incidência ativa
  const hasIncident = Boolean(incCode && incCode !== "0" && incCode !== "00") || desc.includes("incidencia")

  if (hasIncident) {
    return {
      status: "incidencia",
      displayStatus: "incidencia",
      eventName: descEstado || (incDesc ? `Incidência: ${incDesc}` : "Incidência no Envio"),
      isTerminal: false,
      isIncidencia: true,
    }
  }

  switch (code) {
    case "1":
    case "01":
      return {
        status: "pendente",
        displayStatus: "pendente",
        eventName: descEstado || "Envio Registado / Aguarda Receção",
        isTerminal: false,
        isIncidencia: false,
      }
    case "2":
    case "02":
    case "10":
      return {
        status: "entrada_rede",
        displayStatus: "em_transito",
        eventName: descEstado || "Em Trânsito / Recebido na Plataforma",
        isTerminal: false,
        isIncidencia: false,
      }
    case "3":
    case "03":
      return {
        status: "em_distribuicao",
        displayStatus: "em_distribuicao",
        eventName: descEstado || "Em Distribuição (Com o Estafeta)",
        isTerminal: false,
        isIncidencia: false,
      }
    case "4":
    case "04":
      return {
        status: "entregue",
        displayStatus: "entregue",
        eventName: descEstado || "Entregue",
        isTerminal: true,
        isIncidencia: false,
      }
    case "5":
    case "05":
    case "7":
    case "07":
    case "9":
    case "09":
      return {
        status: "incidencia",
        displayStatus: "incidencia",
        eventName: descEstado || "Incidência de Entrega",
        isTerminal: false,
        isIncidencia: true,
      }
    case "6":
    case "06":
      return {
        status: "devolvido",
        displayStatus: "devolvido",
        eventName: descEstado || "Devolvido ao Remetente",
        isTerminal: true,
        isIncidencia: true,
      }
    case "8":
    case "08":
      return {
        status: "cancelado",
        displayStatus: "cancelado",
        eventName: descEstado || "Destruído / Cancelado",
        isTerminal: true,
        isIncidencia: true,
      }
    default: {
      // Heurística textual de contingência
      if (desc.includes("entregad") || desc.includes("delivered")) {
        return {
          status: "entregue",
          displayStatus: "entregue",
          eventName: descEstado || "Entregue",
          isTerminal: true,
          isIncidencia: false,
        }
      }
      if (desc.includes("reparto") || desc.includes("distribui")) {
        return {
          status: "em_distribuicao",
          displayStatus: "em_distribuicao",
          eventName: descEstado || "Em Distribuição",
          isTerminal: false,
          isIncidencia: false,
        }
      }
      if (desc.includes("devuelt") || desc.includes("devolv")) {
        return {
          status: "devolvido",
          displayStatus: "devolvido",
          eventName: descEstado || "Devolvido ao Remetente",
          isTerminal: true,
          isIncidencia: true,
        }
      }
      if (desc.includes("arrastre") || desc.includes("transito") || desc.includes("plataforma") || desc.includes("clasifica")) {
        return {
          status: "entrada_rede",
          displayStatus: "em_transito",
          eventName: descEstado || "Em Trânsito",
          isTerminal: false,
          isIncidencia: false,
        }
      }
      if (desc.includes("recepcion") || desc.includes("tramitacion")) {
        return {
          status: "pendente",
          displayStatus: "pendente",
          eventName: descEstado || "Envio Registado",
          isTerminal: false,
          isIncidencia: false,
        }
      }
      return {
        status: "entrada_rede",
        displayStatus: "em_transito",
        eventName: descEstado || "Em Trânsito",
        isTerminal: false,
        isIncidencia: false,
      }
    }
  }
}

/**
 * Consulta a API Correos Express e normaliza todos os eventos num formato padrão TMS.
 */
export async function fetchCorreosTrackingEvents(
  trackingNumber: string,
  credentials?: CorreosCredentials
): Promise<{
  success: boolean
  events: NormalizedTrackingEvent[]
  rawResponse?: CorreosTrackingOutput
  error?: string
}> {
  try {
    const creds = credentials || (await resolveCorreosCredentials())
    const correosService = new CorreosTrackingService()

    const cleanTracking = trackingNumber.trim()
    const result = await correosService.trackShipment(creds, cleanTracking)

    if (!result) {
      return { success: false, events: [], error: "Sem resposta da API Correos Express" }
    }

    // Se a API indicar erro explícito e não tiver nem estadoEnvios nem codEstado
    if (result.error !== 0 && !result.codEstado && (!result.estadoEnvios || result.estadoEnvios.length === 0)) {
      return {
        success: false,
        events: [],
        rawResponse: result,
        error: `Correos Express: ${result.mensajeError || `Erro ${result.error}`}`,
      }
    }

    const events: NormalizedTrackingEvent[] = []

    // 1. Processar histórico em estadoEnvios (se existir)
    if (result.estadoEnvios && Array.isArray(result.estadoEnvios) && result.estadoEnvios.length > 0) {
      for (const item of result.estadoEnvios) {
        const mapped = mapCorreosStatus(item.codEstado, item.descEstado, item.codIncEstado, item.descIncEstado)
        const timestamp = parseCorreosDateTime(item.fechaEstado, item.horaEstado)
        const delegation = item.nombreDelegacion || item.idDelegacion
        const location = delegation ? `Correos Express (${delegation})` : "Rede Correos Express"

        let description = item.descEstado || mapped.eventName
        if (item.descIncEstado && item.descIncEstado.trim()) {
          description += ` | Incidência: ${item.descIncEstado.trim()}`
        }

        events.push({
          status: mapped.status,
          displayStatus: mapped.displayStatus,
          eventCode: item.codEstado || "CORREOS",
          eventName: mapped.eventName,
          description,
          location,
          timestamp,
          isTerminal: mapped.isTerminal,
          isIncidencia: mapped.isIncidencia,
          carrierCode: "correos",
          rawEvent: item,
        })
      }
    }

    // 2. Se não havia lista de eventos mas há estado atual no topo
    if (events.length === 0 && (result.codEstado || result.descEstado)) {
      const mapped = mapCorreosStatus(result.codEstado, result.descEstado, result.codIncEstado, result.descIncEstado)
      const timestamp = parseCorreosDateTime(result.fechaEstado, result.horaEstado)
      let description = result.descEstado || mapped.eventName
      if (result.descIncEstado && result.descIncEstado.trim()) {
        description += ` | Incidência: ${result.descIncEstado.trim()}`
      }

      events.push({
        status: mapped.status,
        displayStatus: mapped.displayStatus,
        eventCode: result.codEstado || "CORREOS",
        eventName: mapped.eventName,
        description,
        location: "Rede Correos Express",
        timestamp,
        isTerminal: mapped.isTerminal,
        isIncidencia: mapped.isIncidencia,
        carrierCode: "correos",
        rawEvent: result,
      })
    }

    // Ordenar cronologicamente do mais antigo para o mais recente
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return {
      success: true,
      events,
      rawResponse: result,
    }
  } catch (err: any) {
    console.error("[Correos Tracking Sync] Erro:", err?.message || err)
    return {
      success: false,
      events: [],
      error: err?.message || "Falha na comunicação com a Correos Express",
    }
  }
}
