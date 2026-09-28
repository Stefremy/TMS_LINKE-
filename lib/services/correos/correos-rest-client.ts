import { CorreosCredentials } from "./types"

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
    // We temporarily disable TLS verification for test endpoints.
    const isTestEnv = endpoint.includes("test.cexpr.es")
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED

    try {
      if (isTestEnv) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })

      if (isTestEnv) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject
      }

      if (!response.ok) {
        throw new Error(`Correos API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data as T
    } catch (error: any) {
      console.error("Correos API Request Failed:", error.message)
      throw error
    }
  }
}
