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

    // For Portugal, send the full postal code (e.g. 4800-019)
    const cpRtePT = (input.remitente.cpInternacional || input.remitente.cpNacional || "").trim() || "4000-001"
    const cpDestPT = (input.destinatario.cpInternacional || input.destinatario.cpNacional || "").trim() || "1000-001"

    // Ensure full postal code is included in poblacion so it is printed completely on the label below routing zone
    const formattedPobDest = isDestinatarioPT && cpDestPT && !input.destinatario.poblacion.includes(cpDestPT.slice(0, 4))
      ? `${cpDestPT} ${input.destinatario.poblacion}`.slice(0, 40)
      : input.destinatario.poblacion.slice(0, 40)

    const formattedPobRte = isRemitentePT && cpRtePT && !input.remitente.poblacion.includes(cpRtePT.slice(0, 4))
      ? `${cpRtePT} ${input.remitente.poblacion}`.slice(0, 40)
      : input.remitente.poblacion.slice(0, 40)

    const numBultos = Number(input.bultos) || 1
    const totalKilos = Number(input.kilos) || 1
    const kilosPerBulto = (totalKilos / numBultos).toFixed(3)

    // Correos Express requires at least one bulto in listaBultos to generate shipping labels!
    const listaBultos = input.listaBultos && input.listaBultos.length > 0
      ? input.listaBultos
      : Array.from({ length: numBultos }, (_, i) => ({
          orden: (i + 1).toString(),
          kilos: kilosPerBulto,
          volumen: "0",
          alto: "0",
          largo: "0",
          ancho: "0"
        }))

    // Construct the payload mapping to Correos Express spec
    const payload: Record<string, any> = {
      solicitante: creds.solicitante,
      codRte: creds.codRte,
      
      ref: input.ref || "",
      refCliente: input.refCliente || "",
      fecha: input.fecha || "",
      
      nomRte: input.remitente.nombre,
      nifRte: input.remitente.nif || "",
      dirRte: input.remitente.direccion,
      pobRte: formattedPobRte,
      codPosNacRte: isRemitentePT ? "" : (input.remitente.cpNacional || ""),
      paisISORte: input.remitente.paisISO,
      codPosIntRte: isRemitentePT ? cpRtePT : "",
      contacRte: input.remitente.contacto || input.remitente.nombre || "",
      telefRte: input.remitente.telefono || "",
      emailRte: input.remitente.email || "",
      
      nomDest: input.destinatario.nombre,
      nifDest: input.destinatario.nif || "",
      dirDest: input.destinatario.direccion,
      pobDest: formattedPobDest,
      codPosNacDest: isDestinatarioPT ? "" : (input.destinatario.cpNacional || ""),
      paisISODest: input.destinatario.paisISO,
      codPosIntDest: isDestinatarioPT ? cpDestPT : "",
      contacDest: input.destinatario.contacto || input.destinatario.nombre || "",
      telefDest: input.destinatario.telefono || "",
      emailDest: input.destinatario.email || "",
      
      observac: input.observaciones || "",
      numBultos: numBultos.toString(),
      kilos: totalKilos.toString(),
      volumen: input.volumen || "0",
      
      producto: input.producto,
      portes: input.portes,
      reembolso: input.reembolso || "",
      entrSabado: input.entrSabado || "",
      seguro: input.seguro || "",
      
      listaBultos,
    }

    if (input.tipoEtiqueta) {
      payload.listaInformacionAdicional = [
        {
          tipoEtiqueta: input.tipoEtiqueta,
          etiquetaPDF: "",
          codificacionUnicaB64: "1"
        }
      ]
    }

    return this.client.request<CorreosShipmentOutput>(endpoint, creds, payload)
  }
}
