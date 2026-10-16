/** Days after invoice issuance; independent of the customer's billing cycle. */
export function paymentDueDays(override: unknown, fallback: unknown): number {
  const value = override === undefined ? fallback : override
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 365) {
    throw new Error('O prazo para pagar deve ser um número inteiro entre 0 e 365 dias.')
  }
  return value
}

export async function moloniMaturityDateId(moloni: { request: (endpoint: string, payload: object) => Promise<unknown> }, days: number): Promise<number> {
  paymentDueDays(days, 0)
  const maturities = await moloni.request('maturityDates/getAll', {})
  const existing = Array.isArray(maturities) ? maturities.find(m => Number(m.days) === days) : null
  if (existing?.maturity_date_id) return Number(existing.maturity_date_id)
  const created = await moloni.request('maturityDates/insert', {
    name: days === 0 ? 'Pronto Pagamento' : `${days} Dias`, days, associated_discount: 0,
  }) as { valid?: number; maturity_date_id?: number }
  if (created?.valid !== 1 || !created.maturity_date_id) throw new Error('Não foi possível configurar o prazo de vencimento no Moloni.')
  return Number(created.maturity_date_id)
}
