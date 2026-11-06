
import { errorMessage } from "@/lib/errors"
import { CttProvider } from "../carriers/ctt-provider"
import { resolveCttCredentials } from "../carriers/credentials"
import { CTTConnectionCredentials } from "../ctt/ctt-types"
import { NormalizedTrackingEvent, NormalizedTmsStatus, TmsDisplayStatus } from "./types"

/**
 * Consulta a API dos CTT e normaliza todos os eventos no formato comum do TMS LINKE.
 */
export async function fetchCttTrackingEvents(
  trackingNumber: string,
  credentials?: CTTConnectionCredentials
): Promise<{
  success: boolean
  events: NormalizedTrackingEvent[]
  error?: string
}> {
  try {
    const creds = credentials || (await resolveCttCredentials())
    const provider = new CttProvider()
    await provider.initialize(creds)

    const trackResult = await provider.getTracking(trackingNumber)
    if (!trackResult.success || !trackResult.events || trackResult.events.length === 0) {
      return {
        success: false,
        events: [],
        error: trackResult.error || `A CTT não retornou eventos para o tracking: ${trackingNumber}`,
      }
    }

    const events: NormalizedTrackingEvent[] = trackResult.events.map((e) => {
      const rawEvent = e.rawEvent as Partial<import("../ctt/ctt-tracking.service").ParsedTrackingEvent> | undefined
      const rawStatus = (e.status || "em_transito").toLowerCase()
      // Normalizar para o enum PostgreSQL
      const dbStatus: NormalizedTmsStatus =
        rawStatus === "em_transito" ? "entrada_rede" : (rawStatus as NormalizedTmsStatus)

      const displayStatus: TmsDisplayStatus =
        rawStatus === "entrada_rede" ? "em_transito" : (rawStatus as TmsDisplayStatus)

      let description = e.description || "Evento CTT Expresso"
      if (rawEvent?.reasonText) {
        description += ` | Razão: ${rawEvent.reasonText}`
      }
      if (rawEvent?.situationText) {
        description += ` | Situação: ${rawEvent.situationText}`
      }

      return {
        status: dbStatus,
        displayStatus,
        eventCode: e.code || "CTT",
        eventName: rawEvent?.eventName || e.description || "Evento CTT",
        description,
        location: e.location || "Rede CTT Expresso",
        timestamp: e.date || new Date().toISOString(),
        isTerminal: Boolean(e.isFinal),
        isIncidencia: rawStatus === "incidencia" || Boolean(rawEvent?.reasonCode),
        carrierCode: "ctt",
        measurements: rawEvent?.measurements,
        rawEvent: e.rawEvent || e,
      }
    })

    // Ordenar cronologicamente do mais antigo para o mais recente
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return {
      success: true,
      events,
    }
  } catch (err) {
    console.error("[CTT Tracking Sync] Erro:", errorMessage(err) || err)
    return {
      success: false,
      events: [],
      error: errorMessage(err) || "Falha na comunicação com a CTT Expresso",
    }
  }
}
