import { NextResponse } from "next/server"
import { CttProvider } from "@/lib/services/carriers/ctt-provider"
import { CorreosShipmentService } from "@/lib/services/correos/correos-shipment.service"
import { resolveCttCredentials, resolveCorreosCredentials } from "@/lib/services/carriers/credentials"

export async function GET() {
  const results: any = { ctt: {}, correos: {} }

  // 1. CTT EXPRESSO
  try {
    const cttCreds = await resolveCttCredentials()
    results.ctt.credentialsFound = !!cttCreds.auth_id

    const cttProvider = new CttProvider()
    await cttProvider.initialize(cttCreds)

    const cttResult = await cttProvider.createShipment({
      reference: "TEST-LNK-" + Math.floor(Math.random() * 100000),
      sender: {
        name: "Remetente Teste",
        address: "Rua do Remetente 123",
        zip: "4430-100", // valid postal code
        city: "Vila Nova de Gaia",
        phone: "910000000",
        country: "PT"
      },
      recipient: {
        name: "Destinatario Teste",
        address: "Avenida da Liberdade",
        zip: "1000-001",
        city: "Lisboa",
        phone: "920000000",
        country: "PT"
      },
      weightKg: 1.5,
      volumes: 1,
      subProduct: "EMSF056.01",
      autoClose: false
    })

    if (cttResult.success) {
      results.ctt.status = "SUCCESS"
      results.ctt.tracking = cttResult.trackingNumber
      results.ctt.hasLabel = !!cttResult.labelBase64
    } else {
      results.ctt.status = "ERROR"
      results.ctt.error = cttResult.error
    }
  } catch (err: any) {
    results.ctt.status = "FATAL"
    results.ctt.error = err.message
  }

  // 2. CORREOS EXPRESS
  try {
    const correosCreds = await resolveCorreosCredentials()
    results.correos.credentialsFound = !!correosCreds.user

    const correosProvider = new CorreosShipmentService()
    const correosResult = await correosProvider.createShipment(correosCreds, {
      ref: "TEST-LNK-CORREOS" + Math.floor(Math.random() * 10000),
      remitente: {
        nombre: "Remetente Teste",
        direccion: "Rua do Remetente 123",
        cpInternacional: "4430100",
        poblacion: "Vila Nova de Gaia",
        telefono: "910000000",
        paisISO: "PT",
        cpNacional: "",
        contacto: "Remetente Teste"
      },
      destinatario: {
        nombre: "Destinatario Teste",
        direccion: "Avenida da Liberdade",
        cpInternacional: "1000001",
        poblacion: "Lisboa",
        telefono: "920000000",
        paisISO: "PT",
        cpNacional: "",
        contacto: "Destinatario Teste"
      },
      kilos: 1.5,
      bultos: 1,
      producto: "63",
      portes: "P",
      tipoEtiqueta: "1"
    })

    results.correos.rawResult = correosResult // Added this so we can inspect the exact payload!

    if (correosResult.codigoRetorno === 0 || (correosResult.codigoRetorno === 404 && correosResult.datosResultado)) {
      results.correos.status = "SUCCESS"
      results.correos.tracking = correosResult.datosResultado
      results.correos.hasLabel = !!correosResult.listaInformacionAdicional?.[0]?.etiquetaPDF
    } else {
      results.correos.status = "ERROR"
      results.correos.error = correosResult.mensajeRetorno
    }
  } catch (err: any) {
    results.correos.status = "FATAL"
    results.correos.error = err.message
  }

  return NextResponse.json(results)
}
