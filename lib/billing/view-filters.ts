import { isDateKey } from './recurring-periods'

export interface BillingViewSelection { startDate: string; endDate: string; grouping: 'grouped' | 'detailed' }
export function billingViewSelection(query: Record<string, string | string[] | undefined>, defaultGrouping: 'grouped' | 'detailed' = 'grouped'): BillingViewSelection {
  const single = (key: string) => {
    const value = query[key]
    if (Array.isArray(value)) throw new Error('Filtro de faturação duplicado.')
    return value || ''
  }
  const startDate = single('from'), endDate = single('to'), grouping = single('grouping') || defaultGrouping
  if ((startDate && !isDateKey(startDate)) || (endDate && !isDateKey(endDate)) || (startDate && endDate && startDate > endDate)) throw new Error('Intervalo de faturação inválido.')
  if (grouping !== 'grouped' && grouping !== 'detailed') throw new Error('Agrupamento de faturação inválido.')
  return { startDate, endDate, grouping }
}
export function billingViewFiltersUrl(selection: BillingViewSelection): string {
  const query = new URLSearchParams({ grouping: selection.grouping })
  if (selection.startDate) query.set('from', selection.startDate)
  if (selection.endDate) query.set('to', selection.endDate)
  return `/ops/configuracao/faturacao?${query.toString()}`
}
