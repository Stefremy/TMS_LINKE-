import "server-only"
import { moloniRedirectUri } from "@/lib/config/public-origins"

export type MoloniAppEnvironment = "test" | "live"

const DEFAULT_CLIENT_ID = "518600300"

/** `MOLONI_TEST_CLIENT_ID` / `MOLONI_LIVE_CLIENT_ID`, falling back to the shared `MOLONI_CLIENT_ID`. */
function variable(name: string, environment?: MoloniAppEnvironment): string | undefined {
  const scoped = environment ? process.env[`MOLONI_${environment.toUpperCase()}_${name}`]?.trim() : undefined
  return scoped || process.env[`MOLONI_${name}`]?.trim() || undefined
}

/**
 * Moloni developer application for one environment. Teste and Produção may use two different
 * applications, each with its own callback URI. A token must always be renewed with the credentials
 * of the application that issued it, so every caller passes the connection's environment.
 * Without environment-specific variables both environments share MOLONI_CLIENT_ID / MOLONI_CLIENT_SECRET.
 */
export function moloniAppCredentials(environment?: MoloniAppEnvironment) {
  const clientId = variable("CLIENT_ID", environment) || DEFAULT_CLIENT_ID
  return {
    clientId,
    clientSecret: variable("CLIENT_SECRET", environment) || "",
    developerId: variable("DEVELOPER_ID", environment) || clientId,
  }
}

/**
 * Callback registered in that environment's Moloni application. `MOLONI_TEST_REDIRECT_URI` /
 * `MOLONI_LIVE_REDIRECT_URI` win (e.g. the test app registered on localhost); otherwise the
 * public Ops origin, or the request origin when no public origin is configured.
 */
export function moloniAppRedirectUri(environment: MoloniAppEnvironment, requestOrigin?: string): string | undefined {
  const explicit = process.env[`MOLONI_${environment.toUpperCase()}_REDIRECT_URI`]?.trim()
  if (explicit) {
    const url = new URL(explicit)
    if (url.pathname !== "/api/moloni/callback" || url.search || url.hash) {
      throw new Error(`MOLONI_${environment.toUpperCase()}_REDIRECT_URI deve terminar em /api/moloni/callback.`)
    }
    return url.toString()
  }
  return moloniRedirectUri(requestOrigin)
}
