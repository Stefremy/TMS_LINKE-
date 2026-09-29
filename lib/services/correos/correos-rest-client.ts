import { CorreosCredentials } from "./types"
import * as https from "https"

export class CorreosRestClient {
  /**
   * Faz uma chamada genérica à API REST da Correos Express.
   * Valida credenciais e injeta o header de Basic Auth.
   */
  async request<T>(
    endpoint: string,
    credentials: Omit<CorreosCredentials, "environment" | "solicitante" | "codRte">,
    body: Record<string, any>
  ): Promise<T> {
    const authString = `${credentials.user}:${credentials.pass}`
    const authBase64 = Buffer.from(authString).toString("base64")

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Basic ${authBase64}`,
    }

    // The test environment of Correos Express has a self-signed certificate chain.
    const isTestEnv = endpoint.includes("test.cexpr.es")

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

      req.write(JSON.stringify(body))
      req.end()
    })
  }
}
