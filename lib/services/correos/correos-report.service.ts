import { CorreosRestClient } from "./correos-rest-client"
import type { CorreosCredentials } from "./types"

const PROD_ENDPOINT = "https://www.cexpr.es/wspsc/apiRestGeneracionInformes/json/generarInforme"
const TEST_ENDPOINT = "https://www.test.cexpr.es/wspsc/apiRestGeneracionInformes/json/generarInforme"

export interface CorreosReportOutput {
  codErr: number
  desErr?: string
  result?: string
  listaErrores?: { nEnvio?: string; codError?: string; desErr?: string }[] | null
}

/**
 * Correos Express "Lista de Envíos" PDF (apiRestGeneracionInformes): the document handed to the driver at pickup.
 * Only works while the parcels are still "sin recepción" (before Correos scans them).
 */
export class CorreosReportService {
  private client = new CorreosRestClient()

  async generateShipmentList(creds: CorreosCredentials, input: { date: Date; shipmentNumbers: string[]; logoBase64?: string }): Promise<CorreosReportOutput> {
    const endpoint = creds.environment === "production" ? PROD_ENDPOINT : TEST_ENDPOINT
    const [year, month, day] = input.date.toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" }).split("-")
    return this.client.request<CorreosReportOutput>(endpoint, creds, {
      fecha: `${day}-${month}-${year}`,
      keyclifac: creds.codRte,
      logoCliente: input.logoBase64 || "",
      nEnvios: input.shipmentNumbers,
    }, 30000)
  }
}
