
import { errorMessage } from "@/lib/errors"
import { CorreosRestClient } from "./correos-rest-client"
import { CorreosCredentials } from "./types"

const PROD_ENDPOINT = "https://www.cexpr.es/wspsc/apiRestGrabacionRecogidaEnviok8s/json/grabarRecogida"
const TEST_ENDPOINT = "https://www.test.cexpr.es/wspsc/apiRestGrabacionRecogidaEnviok8s/json/grabarRecogida"

export interface CorreosPickupInput {
  date: string // YYYY-MM-DD
  startHour: string // HH:mm
  endHour: string // HH:mm
  volumes: number
  weightKg: number
  heaviestWeightKg?: number
  sender: {
    name: string
    contact?: string
    address: string
    country?: string
    zip: string
    city: string
    phone: string
    email?: string
  }
  observations?: string
}

export interface CorreosPickupOutput {
  success: boolean
  pickupNumber?: string
  error?: string
  rawResponse?: unknown
}

const PROD_CUTOFF_ENDPOINT = "https://www.cexpr.es/wspsc/apiRestGrabacionRecogidaEnviok8s/json/horaCorte"
const TEST_CUTOFF_ENDPOINT = "https://www.test.cexpr.es/wspsc/apiRestGrabacionRecogidaEnviok8s/json/horaCorte"

export type CorreosCutoff = { success: true; cutoff: string; lastCall: string | null } | { success: false; error: string }

export class CorreosPickupService {
  private client: CorreosRestClient

  constructor() {
    this.client = new CorreosRestClient()
  }

  private getEndpoint(env: "test" | "production"): string {
    return env === "production" ? PROD_ENDPOINT : TEST_ENDPOINT
  }

  private formatDateDDMMYYYY(isoDate: string): string {
    const parts = isoDate.split("-")
    if (parts.length === 3) {
      return `${parts[2]}${parts[1]}${parts[0]}`
    }
    const d = new Date(isoDate)
    const day = String(d.getDate()).padStart(2, "0")
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const year = d.getFullYear()
    return `${day}${month}${year}`
  }

  /** Same-day pickup cut-off for a postal code (DC_SP_WS_GrabacionRecogidaRest §4.4 consultarHoraCorte). */
  async getCutoff(creds: CorreosCredentials, postalCode: string, country: string): Promise<CorreosCutoff> {
    const endpoint = creds.environment === "production" ? PROD_CUTOFF_ENDPOINT : TEST_CUTOFF_ENDPOINT
    try {
      const response = await this.client.request<{ horaCorte?: string | null; ultimaLlamada?: string | null; codError?: number; mensError?: string | null }>(
        endpoint, creds, { strCP: postalCode, strPais: country.toUpperCase() }, 8000)
      const valid = (v?: string | null) => typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : null
      const cutoff = valid(response?.horaCorte)
      if (cutoff) return { success: true, cutoff, lastCall: valid(response?.ultimaLlamada) }
      return { success: false, error: response?.mensError || "A Correos não devolveu a hora-limite para este código postal." }
    } catch (err) {
      return { success: false, error: `Não foi possível consultar a Correos Express: ${errorMessage(err)}` }
    }
  }

  async createPickup(
    creds: CorreosCredentials,
    input: CorreosPickupInput
  ): Promise<CorreosPickupOutput> {
    const endpoint = this.getEndpoint(creds.environment)
    const fecha = this.formatDateDDMMYYYY(input.date)

    const isPT = (input.sender.country || "PT").toUpperCase() === "PT"
    const rawZip = (input.sender.zip || "").trim()
    const cleanZip = rawZip.replace(/\D/g, "")
    const formattedPTZip = cleanZip.length === 7 ? `${cleanZip.slice(0, 4)}-${cleanZip.slice(4)}` : rawZip
    const hhmm = (h: string) => (/^\d{4}$/.test(h) ? `${h.slice(0, 2)}:${h.slice(2)}` : h.slice(0, 5))
    const observ = [
      input.observations || "",
      input.volumes > 1 && input.heaviestWeightKg ? `Peso do volume mais pesado: ${input.heaviestWeightKg} kg` : "",
    ].filter(Boolean).join(" | ")

    // Field names and limits per DC_SP_WS_GrabacionRecogidaRest_v01.09 §4.1 (grabarRecogida).
    const payload: Record<string, string> = {
      solicitante: creds.solicitante,
      refRecogida: `LNK${Date.now()}`, // required and must be unique (error 104 on duplicates)
      fechaRecogida: fecha,
      horaDesde1: hhmm(input.startHour),
      horaHasta1: hhmm(input.endHour),
      clienteRecogida: creds.codRte,
      nomRemit: input.sender.name.slice(0, 40),
      dirRecog: (isPT ? `${input.sender.address} - CP: ${formattedPTZip}` : input.sender.address).slice(0, 300),
      poblRecog: input.sender.city.slice(0, 50),
      // shortcut: the docs only define a 5-digit Spanish cpRecog; PT format unconfirmed, ask CEX integration team.
      cpRecog: isPT ? formattedPTZip : rawZip,
      contRecog: (input.sender.contact || input.sender.name).slice(0, 50),
      tlfnoRecog: input.sender.phone.replace(/\D/g, "").slice(0, 20),
      emailRecog: (input.sender.email || "").slice(0, 100),
      observ: observ.slice(0, 300),
      // shortcut: product 63 is the docs' example; confirm the pickup product for this contract with CEX.
      producto: "63",
      kilos: String(input.weightKg || 1),
      bultos: String(input.volumes || 1),
      tipoPortes: "P",
      latente: "0",
    }

    try {
      const response = await this.client.request<{ resultado?: string | number | null; numRecogida?: string | number | null; codError?: number; mensError?: string | null; codigoRetorno?: number; mensajeRetorno?: string }>(endpoint, creds, payload)
      // Only a number issued by Correos counts as booked; never invent one.
      if (String(response?.resultado) === "1" && response?.numRecogida) {
        return {
          success: true,
          pickupNumber: String(response.numRecogida),
          rawResponse: response,
        }
      }

      const code = response?.codError ?? response?.codigoRetorno
      const message = response?.mensError || response?.mensajeRetorno
      return {
        success: false,
        error: message ? `Correos Express (${code ?? "?"}): ${message}` : "Falha ao registar recolha na Correos Express",
        rawResponse: response,
      }
    } catch (err) {
      console.warn("Correos Express Pickup API call:", errorMessage(err))
      return {
        success: false,
        error: `Erro Correos Express: ${errorMessage(err)}`,
      }
    }
  }
}
