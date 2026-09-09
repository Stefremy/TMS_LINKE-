import { XMLParser } from "fast-xml-parser"
import http from "http"
import https from "https"

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
      // Decode XML character references (&#xD; → \r, &#xA; → \n, &amp; → &, etc.)
      // This is critical for CTT ZPL labels which use &#xD; as line separators
      processEntities: true,
      htmlEntities: true,
      // Prevent fast-xml-parser from converting numeric strings to numbers
      // (important for Base64 label strings and postal codes)
      parseTagValue: false,
      parseAttributeValue: false,
    })
  }

  /**
   * Executa um pedido SOAP POST com envelope XML e SOAPAction
   */
  async callSoap(options: SOAPRequestOptions): Promise<any> {
    const { endpoint, action, soapBodyXml, timeoutMs = 20000 } = options

    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/" xmlns:ws="http://schemas.datacontract.org/2004/07/CTTExpressoWS" xmlns:mod="http://schemas.datacontract.org/2004/07/CTTExpressoWS.Models.ShipmentProvider">
  <soapenv:Header/>
  <soapenv:Body>
    ${soapBodyXml}
  </soapenv:Body>
</soapenv:Envelope>`

    return new Promise((resolve, reject) => {
      let url: URL
      try {
        url = new URL(endpoint)
      } catch (err) {
        return reject(new Error(`Endpoint inválido: ${endpoint}`))
      }

      const isHttps = url.protocol === "https:"
      const client = isHttps ? https : http

      const reqOptions: http.RequestOptions | https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": action,
          "Content-Length": Buffer.byteLength(envelope, "utf8"),
          "User-Agent": "TMS-Linke-CTT-Client/1.0",
        },
        timeout: timeoutMs,
      }

      if (isHttps) {
        (reqOptions as https.RequestOptions).rejectUnauthorized = false
      }

      const req = client.request(reqOptions, (res) => {
        let rawData = ""
        res.setEncoding("utf8")
        res.on("data", (chunk) => {
          rawData += chunk
        })
        res.on("end", () => {
          try {
            const parsed = this.parser.parse(rawData)

            // Verificar se o SOAP devolveu Fault
            const fault = parsed?.Envelope?.Body?.Fault
            if (fault) {
              const faultString = fault.faultstring || fault.detail?.ExceptionDetail?.Message || fault.detail || "Erro SOAP retornado pelo servidor CTT"
              return reject(new Error(`[SOAP Fault] ${faultString}`))
            }

            resolve(parsed?.Envelope?.Body || parsed)
          } catch (parseErr: any) {
            if (res.statusCode && res.statusCode >= 400) {
              return reject(new Error(`Erro HTTP ${res.statusCode} do servidor CTT: ${rawData.slice(0, 300)}`))
            }
            reject(new Error(`Falha ao processar resposta XML da CTT: ${parseErr.message}`))
          }
        })
      })

      req.on("timeout", () => {
        req.destroy()
        reject(new Error(`Tempo limite excedido (${timeoutMs}ms) ao contactar CTT Web Service (${url.hostname})`))
      })

      req.on("error", (err) => {
        reject(new Error(`Erro de rede ao contactar CTT (${url.hostname}): ${err.message}`))
      })

      req.write(envelope, "utf8")
      req.end()
    })
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

