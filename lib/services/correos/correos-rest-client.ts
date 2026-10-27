import { CorreosCredentials } from "./types"
import * as https from "https"

function formatCmToMetersString(value: unknown): string {
  if (value === undefined || value === null || value === "" || value === "0" || value === 0) {
    return "0"
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "0"
  }
  return (numeric / 100).toFixed(2)
}

function normalizeInternationalPostalCode(paisISO: unknown, rawPostal: unknown): unknown {
  if (typeof rawPostal !== "string") return rawPostal
  const country = typeof paisISO === "string" ? paisISO.trim().toUpperCase() : ""
  if (!country || country === "PT" || country === "ES") return rawPostal
  return rawPostal
    .trim()
    .replace(/^[A-Z]{1,2}[-\s]+(?=\d)/i, "")
    .replace(/[\s-]+/g, "")
    .slice(0, 7)
}

function normalizeGrabacionEnvioWireBody(endpoint: string, body: Record<string, any>): Record<string, any> {
  if (!endpoint.includes("grabacionEnvio") || !body || typeof body !== "object") {
    return body
  }
  const wireBody: Record<string, any> = {
    ...body,
    codPosIntDest: normalizeInternationalPostalCode(body.paisISODest, body.codPosIntDest),
    telefRte: String(body.telefRte || "").replace(/\D/g, "").slice(0, 15) || "910000000",
    telefDest: String(body.telefDest || "").replace(/\D/g, "").slice(0, 15) || "920000000",
  }
  if (Array.isArray(body.listaBultos)) {
    wireBody.listaBultos = body.listaBultos.map((bulto: Record<string, any>) => ({
      ...bulto,
      volumen: bulto?.volumen ? String(bulto.volumen) : "0",
      alto: formatCmToMetersString(bulto?.alto),
      largo: formatCmToMetersString(bulto?.largo),
      ancho: formatCmToMetersString(bulto?.ancho),
    }))
  }
  return wireBody
}

export class CorreosRestClient {
  /**
   * Faz uma chamada genérica à API REST da Correos Express.
   * Valida credenciais e injeta o header de Basic Auth.
   */
  async request<T>(
    endpoint: string,
    credentials: Omit<CorreosCredentials, "environment" | "solicitante" | "codRte">,
    body: Record<string, any>,
    timeoutMs?: number
  ): Promise<T> {
    const authString = `${credentials.user}:${credentials.pass}`
    const authBase64 = Buffer.from(authString).toString("base64")

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Basic ${authBase64}`,
    }

    // The test environment of Correos Express has a self-signed certificate chain.
    const isTestEnv = endpoint.includes("test.cexpr.es")
    const wireBody = normalizeGrabacionEnvioWireBody(endpoint, body)

    return new Promise((resolve, reject) => {
      const url = new URL(endpoint)
      const options = {
        method: "POST",
        headers,
        rejectUnauthorized: !isTestEnv, // Pass directly to avoid modifying process.env which causes Turbopack to restart
      }

      const req = https.request(url, options, (res) => {
        let data = ""

        res.on("data", (chunk) => {
          data += chunk
        })

        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data) as T)
            } catch (err) {
              reject(new Error("Failed to parse JSON response"))
            }
          } else {
            reject(new Error(`Correos API Error: ${res.statusCode} ${res.statusMessage}`))
          }
        })
      })

      req.on("error", (error) => {
        console.error("Correos API Request Failed:", error.message)
        reject(error)
      })

      if (timeoutMs) req.setTimeout(timeoutMs, () => req.destroy(new Error('Tempo limite excedido ao contactar a Correos Express.')))

      req.write(JSON.stringify(wireBody))
      req.end()
    })
  }
}
