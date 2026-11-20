/** Days after invoice issuance; independent of the customer's billing cycle. */
export function paymentDueDays(override: unknown, fallback: unknown): number {
  const value = override === undefined ? fallback : override
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 365) {
    throw new Error('O prazo para pagar deve ser um número inteiro entre 0 e 365 dias.')
  }
  return value
}

/** The Moloni user's permission profile does not include this module (e.g. "Prazos de vencimento"). */
export function isMoloniAccessDenied(error: unknown): boolean {
  return /credentials don't allow access|não tem permiss/i.test(error instanceof Error ? error.message : String(error ?? ''))
}

/**
 * Moloni payment-term id for `days`, created when missing. Returns null when the connected Moloni user
 * may not read payment terms: the invoice still carries the correct expiration_date, only the
 * "X Dias" label is left to the customer default. Every other failure still stops the emission.
 */
export async function moloniMaturityDateId(moloni: { request: (endpoint: string, payload: object) => Promise<unknown> }, days: number): Promise<number | null> {
  paymentDueDays(days, 0)
  let maturities: unknown
  try { maturities = await moloni.request('maturityDates/getAll', {}) }
  catch (error) { if (isMoloniAccessDenied(error)) return null; throw error }
  const existing = Array.isArray(maturities) ? maturities.find(m => Number(m.days) === days) : null
  if (existing?.maturity_date_id) return Number(existing.maturity_date_id)
  let created: { valid?: number; maturity_date_id?: number }
  try {
    created = await moloni.request('maturityDates/insert', {
      name: days === 0 ? 'Pronto Pagamento' : `${days} Dias`, days, associated_discount: 0,
    }) as { valid?: number; maturity_date_id?: number }
  } catch (error) { if (isMoloniAccessDenied(error)) return null; throw error }
  if (created?.valid !== 1 || !created.maturity_date_id) throw new Error('Não foi possível configurar o prazo de vencimento no Moloni.')
  return Number(created.maturity_date_id)
}
