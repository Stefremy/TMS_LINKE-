import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { MoloniClient } from "@/lib/moloni/moloni-client"

/**
 * Moloni has no separate sandbox host: "test" and "live" are two different companies
 * (and possibly two different Moloni logins) behind the same api.moloni.pt.
 *
 * Storage (audit_log, append-only like the rest of the billing config):
 * - `moloni_connection_config`  one row per authorization / token rotation, tagged with
 *   `details.environment`. Rows without it predate this switch and are the sandbox ("test").
 * - `moloni_environment_switch` the active environment; the latest row wins. None = "test".
 */
export type MoloniEnvironment = "test" | "live"

export const MOLONI_ENVIRONMENT_LABEL: Record<MoloniEnvironment, string> = { test: "Teste", live: "Produção" }

export interface MoloniConnectionInfo {
  environment: MoloniEnvironment
  companyId: string
  companyName?: string
  companyVat?: string
  refreshToken: string
  connectedAt?: string
  /** Deployment variables (legacy bootstrap of the sandbox), not a stored authorization. */
  fromEnvironmentVariables?: boolean
}

type Db = SupabaseClient

/** Shape of a stored `moloni_connection_config` row (untyped JSON in audit_log). */
type StoredConnection = {
  environment?: unknown; company_id?: string | number; company_name?: string; company_vat?: string
  refresh_token?: string; connected_at?: string
}
type StoredRow = { details?: StoredConnection | null; created_at?: string }

export function parseMoloniEnvironment(value: unknown): MoloniEnvironment | null {
  return value === "live" || value === "test" ? value : null
}

/** Environment a stored record belongs to. Untagged records are the original sandbox. */
export function recordEnvironment(details: Record<string, unknown> | null | undefined): MoloniEnvironment {
  return details?.environment === "live" ? "live" : "test"
}

export async function getActiveMoloniEnvironment(db: Db, tenantId: string): Promise<MoloniEnvironment> {
  const { data, error } = await db.from("audit_log").select("details")
    .eq("tenant_id", tenantId).eq("action", "moloni_environment_switch")
    .order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error("Não foi possível confirmar o ambiente Moloni ativo.")
  return parseMoloniEnvironment(data?.details?.environment) || "test"
}

function toInfo(details: StoredConnection, environment: MoloniEnvironment): MoloniConnectionInfo | null {
  if (!details?.company_id || !details?.refresh_token) return null
  return {
    environment,
    companyId: String(details.company_id),
    companyName: details.company_name || undefined,
    companyVat: details.company_vat || undefined,
    refreshToken: String(details.refresh_token),
    connectedAt: details.connected_at || undefined,
  }
}

function envVariablesConnection(): MoloniConnectionInfo | null {
  const companyId = process.env.MOLONI_COMPANY_ID, refreshToken = process.env.MOLONI_REFRESH_TOKEN
  return companyId && refreshToken
    ? { environment: "test", companyId, refreshToken, fromEnvironmentVariables: true }
    : null
}

/** Latest stored authorization for one environment (null when that environment was never connected). */
export async function getMoloniConnection(db: Db, tenantId: string, environment: MoloniEnvironment): Promise<MoloniConnectionInfo | null> {
  const latest = (tagged: boolean) => {
    const query = db.from("audit_log").select("details, created_at")
      .eq("tenant_id", tenantId).eq("action", "moloni_connection_config")
    return (tagged ? query.eq("details->>environment", environment) : query.is("details->>environment", null))
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
  }
  // Untagged rows predate the switch and are the sandbox, so "test" reads both kinds.
  const results = await Promise.all(environment === "live" ? [latest(true)] : [latest(true), latest(false)])
  if (results.some(r => r.error)) throw new Error("Não foi possível consultar a ligação Moloni.")
  const newest = results.map(r => r.data as StoredRow | null)
    .filter((row): row is StoredRow & { details: StoredConnection } => Boolean(row?.details))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0]
  const stored = newest ? toInfo(newest.details, environment) : null
  // Deployment variables only bootstrap the sandbox; a stored authorization always wins.
  return stored || (environment === "test" ? envVariablesConnection() : null)
}

/** Connection used for every NEW document (invoices, waybills, article sync...). */
export async function getActiveMoloniConnection(db: Db, tenantId: string) {
  const environment = await getActiveMoloniEnvironment(db, tenantId)
  return getMoloniConnection(db, tenantId, environment)
}

export function moloniClientFor(connection: MoloniConnectionInfo, tenantId: string) {
  return new MoloniClient({ tenantId, companyId: connection.companyId, refreshToken: connection.refreshToken, environment: connection.environment })
}

/** Client for new documents, or null when the active environment has no connection. */
export async function getActiveMoloniClient(db: Db, tenantId: string) {
  const connection = await getActiveMoloniConnection(db, tenantId)
  return connection ? { connection, moloni: moloniClientFor(connection, tenantId) } : null
}

/**
 * Connection for an EXISTING document: always the company that issued it, never the active one.
 * Documents issued before this switch carry no company and were all issued in the sandbox.
 */
export async function getMoloniConnectionForDocument(db: Db, tenantId: string, document: { moloni_company_id?: unknown } | null | undefined) {
  const companyId = document?.moloni_company_id ? String(document.moloni_company_id) : null
  if (!companyId) return getMoloniConnection(db, tenantId, "test")
  const fromEnv = envVariablesConnection()
  const { data, error } = await db.from("audit_log").select("details")
    .eq("tenant_id", tenantId).eq("action", "moloni_connection_config").eq("details->>company_id", companyId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error("Não foi possível consultar a ligação Moloni.")
  if (data?.details) return toInfo(data.details, recordEnvironment(data.details))
  return fromEnv?.companyId === companyId ? fromEnv : null
}

export async function getMoloniClientForDocument(db: Db, tenantId: string, document: { moloni_company_id?: unknown } | null | undefined) {
  const connection = await getMoloniConnectionForDocument(db, tenantId, document)
  return connection ? { connection, moloni: moloniClientFor(connection, tenantId) } : null
}

/** Fields stamped on every document so later reads (PDF, receipt, credit note) use its own company. */
export function moloniDocumentStamp(connection: MoloniConnectionInfo) {
  return { moloni_company_id: connection.companyId, moloni_environment: connection.environment }
}

/** Saves a new authorization for one environment. Live may never reuse the sandbox company. */
export async function saveMoloniConnection(db: Db, tenantId: string, environment: MoloniEnvironment,
  company: { company_id: number | string; name?: string; vat?: string }, refreshToken: string) {
  const companyId = String(company.company_id)
  const other = await getMoloniConnection(db, tenantId, environment === "live" ? "test" : "live")
  if (other?.companyId === companyId) {
    throw new Error(environment === "live"
      ? "A empresa escolhida é a mesma da ligação de Teste. Ligue a empresa oficial para Produção."
      : "A empresa escolhida é a mesma da ligação de Produção. Ligue a empresa de testes.")
  }
  const { error } = await db.from("audit_log").insert({
    tenant_id: tenantId, action: "moloni_connection_config",
    details: { environment, company_id: companyId, company_name: company.name, company_vat: company.vat,
      refresh_token: refreshToken, connected_at: new Date().toISOString(), source: "authorization" },
  })
  if (error) throw new Error("Não foi possível guardar a ligação Moloni.")
  return companyId
}

/**
 * Picks the company of an authorization, skipping the company already used by the other
 * environment. Test keeps the historical choice (first non-demo company, else the first one);
 * live never picks Moloni's demonstration company.
 */
export async function pickMoloniCompany<T extends { company_id: number; name: string }>(
  db: Db, tenantId: string, companies: T[], environment: MoloniEnvironment,
): Promise<T | null> {
  const other = await getMoloniConnection(db, tenantId, environment === "live" ? "test" : "live")
  const candidates = companies.filter(c => String(c.company_id) !== other?.companyId)
  const isDemo = (c: T) => /demonstra/i.test(c.name || "")
  if (environment === "live") return candidates.find(c => !isDemo(c)) || null
  return candidates.find(c => !isDemo(c)) || candidates[0] || null
}

/** `defaultDocumentSetId` is a per-company Moloni id; every other billing setting is shared. */
export function billingConfigForEnvironment<T extends { defaultDocumentSetId?: number | null }>(
  config: T & { documentSetIdByEnvironment?: Partial<Record<MoloniEnvironment, number | null>> }, environment: MoloniEnvironment,
): T {
  const byEnv = config.documentSetIdByEnvironment || {}
  const documentSetId = environment in byEnv ? byEnv[environment] ?? null
    : environment === "test" ? config.defaultDocumentSetId ?? null : null
  return { ...config, defaultDocumentSetId: documentSetId }
}
