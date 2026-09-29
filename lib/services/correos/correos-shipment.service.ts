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

    // Helper to format PT zip code as XXXX-XXX
    const formatPTZip = (zip: string) => {
      const clean = (zip || "").replace(/\D/g, "")
      return clean.length === 7 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : zip
    }

    // For Portugal, send the full postal code (e.g. 4800-019)
    const rawCpRtePT = (input.remitente.cpInternacional || input.remitente.cpNacional || "").trim() || "4000-001"
    const rawCpDestPT = (input.destinatario.cpInternacional || input.destinatario.cpNacional || "").trim() || "1000-001"
    
    const cpRtePT = isRemitentePT ? formatPTZip(rawCpRtePT) : rawCpRtePT
    const cpDestPT = isDestinatarioPT ? formatPTZip(rawCpDestPT) : rawCpDestPT

    // We no longer need to prepend the postal code to poblacion.
    // Correos Express treats Portugal as "National" (Iberia), so we must pass the 7-digit postal code
    // in `codPosNac` (without hyphens) and leave `codPosInt` empty. Their system will then correctly
    // format the label (e.g., "4800" routing zone and "019-BRAGA" sub-zone).
    const formattedPobDest = input.destinatario.poblacion.slice(0, 40)
    const formattedPobRte = input.remitente.poblacion.slice(0, 40)

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
      dirRte: isRemitentePT ? `${input.remitente.direccion} - CP: ${cpRtePT}`.slice(0, 100) : input.remitente.direccion,
      pobRte: formattedPobRte,
      codPosNacRte: input.remitente.paisISO === "ES" ? (input.remitente.cpNacional || "") : "",
      paisISORte: input.remitente.paisISO,
      codPosIntRte: cpRtePT,
      contacRte: input.remitente.contacto || input.remitente.nombre || "",
      telefRte: input.remitente.telefono || "",
      emailRte: input.remitente.email || "",
      
      nomDest: input.destinatario.nombre,
      nifDest: input.destinatario.nif || "",
      dirDest: isDestinatarioPT ? `${input.destinatario.direccion} - CP: ${cpDestPT}`.slice(0, 100) : input.destinatario.direccion,
      pobDest: formattedPobDest,
      codPosNacDest: input.destinatario.paisISO === "ES" ? (input.destinatario.cpNacional || "") : "",
      paisISODest: input.destinatario.paisISO,
      codPosIntDest: cpDestPT,
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
