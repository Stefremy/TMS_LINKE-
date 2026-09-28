import { CorreosRestClient } from "./correos-rest-client"
import { CorreosCredentials, CorreosTrackingOutput } from "./types"

const PROD_ENDPOINT = "https://www.cexpr.es/wspsc/apiRestSeguimientoEnviosk8s/json/seguimientoEnvio"
const TEST_ENDPOINT = "https://www.test.cexpr.es/wspsc/apiRestSeguimientoEnviosk8s/json/seguimientoEnvio"

export class CorreosTrackingService {
  private client: CorreosRestClient

  constructor() {
    this.client = new CorreosRestClient()
  }

  private getEndpoint(env: "test" | "production"): string {
    return env === "production" ? PROD_ENDPOINT : TEST_ENDPOINT
  }

  async trackShipment(
    creds: CorreosCredentials,
    trackingNumber: string,
    idioma: string = "PT"
  ): Promise<CorreosTrackingOutput> {
    const endpoint = this.getEndpoint(creds.environment)

    const payload = {
      codigoCliente: creds.codRte,
      dato: trackingNumber,
      idioma,
      gestionCompleta: "S"
    }

    return this.client.request<CorreosTrackingOutput>(endpoint, creds, payload)
  }
}
