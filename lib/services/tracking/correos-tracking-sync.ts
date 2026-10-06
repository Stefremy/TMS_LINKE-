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
      // In Spain/Correos Express, date is commonly DDMMAAAA (e.g. 26082026)
      if (cleanFecha.substring(4, 6) === "20" || cleanFecha.substring(4, 6) === "19") {
        day = parseInt(cleanFecha.substring(0, 2), 10)
        month = parseInt(cleanFecha.substring(2, 4), 10) - 1
        year = parseInt(cleanFecha.substring(4, 8), 10)
      } else {
        year = parseInt(cleanFecha.substring(0, 4), 10)
        month = parseInt(cleanFecha.substring(4, 6), 10) - 1
        day = parseInt(cleanFecha.substring(6, 8), 10)
      }
    }

    if (year > 0 && year < 100) {
      year += 2000
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

  // 1. Deteção explícita: CANCELADO / DESTRUÍDO
  if (desc.includes("destruid") || desc.includes("cancelad") || desc.includes("anulad")) {
    return {
      status: "cancelado",
      displayStatus: "cancelado",
      eventName: descEstado || "Cancelado / Destruído",
      isTerminal: true,
      isIncidencia: true,
    }
  }

  // 2. Deteção prioritária: EM DISTRIBUIÇÃO / EN REPARTO
  // Em Correos Express Portugal, o código 8 é "EM DISTRIBUIÇAO" e na Espanha é 3 "EN REPARTO".
  // NUNCA deve ser classificado como cancelado nem como incidência!
  if (
    desc.includes("distribui") ||
    desc.includes("reparto") ||
    code === "3" ||
    code === "03" ||
    code === "8" ||
    code === "08"
  ) {
    const hasSpecificIncident = Boolean(
      (incCode && incCode !== "0" && incCode !== "00" && incCode.toLowerCase() !== "null") ||
      (desc.includes("incidencia") && !desc.includes("distribui") && !desc.includes("reparto"))
    )

    if (hasSpecificIncident) {
      return {
        status: "incidencia",
        displayStatus: "incidencia",
        eventName: descEstado || (incDesc ? `Incidência: ${incDesc}` : "Incidência de Entrega"),
        isTerminal: false,
        isIncidencia: true,
      }
    }

    return {
      status: "em_distribuicao",
      displayStatus: "em_distribuicao",
      eventName: descEstado || "Em Distribuição (Com o Estafeta)",
      isTerminal: false,
      isIncidencia: false,
    }
  }

  // 2. ENTREGUE
  if (
    desc.includes("entregad") ||
    desc.includes("delivered") ||
    desc.includes("entregue") ||
    code === "4" ||
    code === "04"
  ) {
    return {
      status: "entregue",
      displayStatus: "entregue",
      eventName: descEstado || "Entregue",
      isTerminal: true,
      isIncidencia: false,
    }
  }

  // 3. DEVOLVIDO
  if (desc.includes("devuelt") || desc.includes("devolv") || code === "6" || code === "06") {
    return {
      status: "devolvido",
      displayStatus: "devolvido",
      eventName: descEstado || "Devolvido ao Remetente",
      isTerminal: true,
      isIncidencia: true,
    }
  }

  // 4. CANCELADO / DESTRUÍDO
  if (desc.includes("destruid") || desc.includes("cancelad") || desc.includes("anulad")) {
    return {
      status: "cancelado",
      displayStatus: "cancelado",
      eventName: descEstado || "Cancelado / Destruído",
      isTerminal: true,
      isIncidencia: true,
    }
  }

  // 5. INCIDÊNCIA
  const hasIncident = Boolean(
    (incCode && incCode !== "0" && incCode !== "00" && incCode.toLowerCase() !== "null") ||
    desc.includes("incidencia") ||
    code === "5" ||
    code === "05" ||
    code === "7" ||
    code === "07" ||
    code === "9" ||
    code === "09"
  )

  if (hasIncident) {
    return {
      status: "incidencia",
      displayStatus: "incidencia",
      eventName: descEstado || (incDesc ? `Incidência: ${incDesc}` : "Incidência no Envio"),
      isTerminal: false,
      isIncidencia: true,
    }
  }

  // 6. EM TRÂNSITO / EM ARRASTO / RECEBIDO NA PLATAFORMA
  if (
    desc.includes("arrastre") ||
    desc.includes("arrasto") ||
    desc.includes("transito") ||
    desc.includes("plataforma") ||
    desc.includes("clasifica") ||
    code === "2" ||
    code === "02" ||
    code === "10"
  ) {
    return {
      status: "entrada_rede",
      displayStatus: "em_transito",
      eventName: descEstado || "Em Trânsito / Recebido na Plataforma",
      isTerminal: false,
      isIncidencia: false,
    }
  }

  // 7. PENDENTE / PRÉ-REGISTO / SEM RECEPÇÃO
  return {
    status: "pendente",
    displayStatus: "pendente",
    eventName: descEstado || "Envio Registado / Aguarda Receção",
    isTerminal: false,
    isIncidencia: false,
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
