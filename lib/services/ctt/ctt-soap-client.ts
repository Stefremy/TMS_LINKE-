import { XMLParser, XMLBuilder } from "fast-xml-parser"

export interface SOAPRequestOptions {
  endpoint: string
  action: string
  soapBodyXml: string
  timeoutMs?: number
}

export class CTTSoapClient {
  private parser: XMLParser

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      removeNSPrefix: true,
      textNodeName: "#text",
    })
  }

  /**
   * Executa um pedido SOAP POST com envelope XML e SOAPAction
   */
  async callSoap(options: SOAPRequestOptions): Promise<any> {
    const { endpoint, action, soapBodyXml, timeoutMs = 15000 } = options

    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/" xmlns:ctt="http://schemas.datacontract.org/2004/07/CTTExpressoWS.Models">
  <soapenv:Header/>
  <soapenv:Body>
    ${soapBodyXml}
  </soapenv:Body>
</soapenv:Envelope>`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": action,
        },
        body: envelope,
        signal: controller.signal,
      })

      const xmlText = await response.text()
      const parsed = this.parser.parse(xmlText)

      // Verificar se o SOAP devolveu Fault
      const fault = parsed?.Envelope?.Body?.Fault
      if (fault) {
        const faultString = fault.faultstring || fault.detail || "Erro SOAP retornado pelo servidor CTT"
        throw new Error(`[SOAP Fault] ${faultString}`)
      }

      return parsed?.Envelope?.Body || parsed
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error(`Tempo limite excedido (${timeoutMs}ms) ao contactar CTT Web Service`)
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Helper para escapar caracteres especiais de XML
   */
  static escapeXml(unsafe: string | number | undefined | null): string {
    if (unsafe === undefined || unsafe === null) return ""
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
  }
}
