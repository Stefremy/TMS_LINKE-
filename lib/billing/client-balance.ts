/**
 * Client balance rules.
 *
 * Two billing models exist and MUST NOT share logic:
 *  - pay_as_you_go  → prepaid wallet (credit_limit holds the topped-up money, shipments debit it).
 *  - conta_corrente → invoiced account (shipments are billed in statements, there is no wallet).
 *
 * Everything here is pure (no I/O) except the explicit loaders, which take a Supabase client
 * and THROW on read failures so callers fail closed instead of treating "unknown" as "paid".
 */

export type BalanceShipment = {
  billing_type?: "conta_corrente" | "pay_as_you_go"
  sell_price?: unknown
  fuel_tax_amount?: unknown
  status?: string | null
  billing_statement_id?: string | null
  created_at?: string | null
}

export type BalanceStatement = {
  id?: string | null
  status?: string | null
  is_pro_forma?: boolean | null
  moloni_document_id?: unknown
  moloni_receipt_id?: unknown
  moloni_receipt_pdf?: unknown
  outstanding_value?: unknown
  total_value?: unknown
}

export const PAY_AS_YOU_GO_OVERDRAFT_LIMIT = -2

const money = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}
const shipmentValue = (s: BalanceShipment) => money(s.sell_price)
const isCancelled = (s: BalanceShipment) => ["anulado", "cancelado", "cancelled", "canceled"].includes((s.status || "").toLowerCase())

/** A statement is settled when it has a receipt or is explicitly paid. */
export function isStatementSettled(stmt: BalanceStatement): boolean {
  return stmt.status === "paid" || Boolean(stmt.moloni_receipt_id || stmt.moloni_receipt_pdf)
}

// ───────────────────────── PAY AS YOU GO (wallet) ─────────────────────────

/** Selling totals already include fuel/extras. A receipt documents payment; it is not a wallet top-up. */
export function payAsYouGoSpent(shipments: BalanceShipment[], _statements: BalanceStatement[], since?: string | null): number {
  // Preserve the caller contract while deliberately ignoring receipt/statement state.
  void _statements
  const start = since ? Date.parse(since) : NaN
  let spent = 0
  for (const s of shipments) {
    if (isCancelled(s) || s.billing_type === "conta_corrente") continue
    // Shipments before the prepaid start belonged to the previous (invoiced) model.
    if (Number.isFinite(start) && s.created_at && Date.parse(s.created_at) < start) continue
    spent += shipmentValue(s)
  }
  return Number(spent.toFixed(2))
}

/** Wallet balance = topped-up money − shipment consumption. May go down to the overdraft limit. */
export function payAsYouGoBalance(creditLimit: unknown, shipments: BalanceShipment[], statements: BalanceStatement[], since?: string | null): number {
  return Number((money(creditLimit) - payAsYouGoSpent(shipments, statements, since)).toFixed(2))
}

/**
 * True when a shipment belongs to the prepaid model: the client is pay_as_you_go and the shipment was
 * created on/after the prepaid start. Such shipments are paid from the wallet (shown as "Pago") and are
 * NEVER invoiced or put on a conta corrente statement; earlier ones stay on the invoiced model.
 */
export function isPrepaidShipment(
  client: { billing_type?: string | null; pay_as_you_go_since?: string | null } | null | undefined,
  shipment: { created_at?: string | null },
): boolean {
  if (client?.billing_type !== "pay_as_you_go") return false
  const start = client.pay_as_you_go_since ? Date.parse(client.pay_as_you_go_since) : NaN
  if (!Number.isFinite(start) || !shipment.created_at) return true
  return Date.parse(shipment.created_at) >= start
}

/** Returns null when the new shipment is allowed, otherwise the user-facing refusal. */
export function payAsYouGoRefusal(balance: number, shipmentCost: number): string | null {
  const cost = Number(shipmentCost.toFixed(2))
  const projected = Number((balance - cost).toFixed(2))
  if (projected >= PAY_AS_YOU_GO_OVERDRAFT_LIMIT) return null
  return `Saldo Insuficiente: Este envio tem o custo de ${cost.toFixed(2)}€, mas o seu saldo atual é de ${balance.toFixed(2)}€. O limite máximo de descoberto autorizado é de -2,00€ (o saldo ficaria em ${projected.toFixed(2)}€). Por favor, efetue um carregamento para continuar.`
}

// ───────────────────────── CONTA CORRENTE (invoiced) ─────────────────────────

/** Amount the client owes: shipments not yet on a statement + issued statements still unpaid. */
export function currentAccountOutstanding(shipments: BalanceShipment[], statements: BalanceStatement[]): number {
  let debt = 0
  for (const s of shipments) {
    if (!s.billing_statement_id && !isCancelled(s)) debt += shipmentValue(s)
  }
  for (const stmt of statements) {
    if (isStatementSettled(stmt)) continue
    const outstanding = money(stmt.outstanding_value ?? stmt.total_value)
    if (stmt.moloni_document_id) debt += outstanding
    else if (!stmt.is_pro_forma) debt += outstanding
  }
  return Number(debt.toFixed(2))
}

// ───────────────────────── Loaders (fail closed) ─────────────────────────

type Db = { from: (table: string) => any }

/** Live shipments of one client. Select only balance-relevant columns to eliminate base64 egress. */
export async function loadClientShipmentsForBalance(db: Db, tenantId: string, clientId: string): Promise<BalanceShipment[]> {
  const { data, error } = await db.from("shipments")
    .select("sell_price, status, billing_statement_id, created_at")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
  if (error) throw new Error("Não foi possível validar o saldo.")
  return (data || []) as BalanceShipment[]
}

/** Statements live in audit_log (the only place with receipts), same source the portal displays. */
export async function loadClientStatementsForBalance(db: Db, tenantId: string, clientId: string): Promise<BalanceStatement[]> {
  const { data, error } = await db.from("audit_log").select("details")
    .eq("tenant_id", tenantId).eq("action", "billing_statement").eq("details->>client_id", clientId)
  if (error) throw new Error("Não foi possível validar o saldo.")
  return (data || []).map((row: { details?: BalanceStatement }) => row.details || {}) as BalanceStatement[]
}
