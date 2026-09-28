import { CorreosRestClient } from "./correos-rest-client"
import { CorreosCredentials, CorreosShipmentInput, CorreosShipmentOutput } from "./types"

const PROD_ENDPOINT = "https://www.cexpr.es/wspsc/apiRestGrabacionEnviok8s/json/grabacionEnvio"
const TEST_ENDPOINT = "https://www.test.cexpr.es/wspsc/apiRestGrabacionEnviok8s/json/grabacionEnvio"

export class CorreosShipmentService {
  private client: CorreosRestClient

  constructor() {
    this.client = new CorreosRestClient()
  }

  private getEndpoint(env: "test" | "production"): string {
    return env === "production" ? PROD_ENDPOINT : TEST_ENDPOINT
  }

  async createShipment(
    creds: CorreosCredentials,
    input: CorreosShipmentInput
  ): Promise<CorreosShipmentOutput> {
    const endpoint = this.getEndpoint(creds.environment)

    const isRemitentePT = input.remitente.paisISO.toUpperCase() === "PT"
    const isDestinatarioPT = input.destinatario.paisISO.toUpperCase() === "PT"

    // Construct the payload mapping to Correos Express spec
    const payload = {
      solicitante: creds.solicitante,
      codRte: creds.codRte,
      
      ref: input.ref || "",
      refCliente: input.refCliente || "",
      fecha: input.fecha || "",
      
      nomRte: input.remitente.nombre,
      nifRte: input.remitente.nif || "",
      dirRte: input.remitente.direccion,
      pobRte: input.remitente.poblacion,
      codPosNacRte: isRemitentePT ? "" : (input.remitente.cpNacional || ""),
      paisISORte: input.remitente.paisISO,
      codPosIntRte: isRemitentePT ? input.remitente.cpInternacional : "",
      contacRte: input.remitente.contacto || "",
      telefRte: input.remitente.telefono || "",
      emailRte: input.remitente.email || "",
      
      nomDest: input.destinatario.nombre,
      nifDest: input.destinatario.nif || "",
      dirDest: input.destinatario.direccion,
      pobDest: input.destinatario.poblacion,
      codPosNacDest: isDestinatarioPT ? "" : (input.destinatario.cpNacional || ""),
      paisISODest: input.destinatario.paisISO,
      codPosIntDest: isDestinatarioPT ? input.destinatario.cpInternacional : "",
      contacDest: input.destinatario.contacto || "",
      telefDest: input.destinatario.telefono || "",
      emailDest: input.destinatario.email || "",
      
      observac: input.observaciones || "",
      numBultos: input.bultos.toString(),
      kilos: input.kilos.toString(),
      volumen: input.volumen || "",
      
      producto: input.producto,
      portes: input.portes,
      reembolso: input.reembolso || "",
      entrSabado: input.entrSabado || "",
      seguro: input.seguro || "",
      
      listaBultos: input.listaBultos || [],
    }

    if (input.tipoEtiqueta) {
      Object.assign(payload, {
        listaInformacionAdicional: [
          {
            tipoEtiqueta: input.tipoEtiqueta,
            etiquetaPDF: ""
          }
        ]
      })
    }

    return this.client.request<CorreosShipmentOutput>(endpoint, creds, payload)
  }
}
