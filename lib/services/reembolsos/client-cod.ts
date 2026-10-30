import { billingDay } from '@/lib/billing/statistics'

export type ClientCodState = 'unconfirmed' | 'statement' | 'paid' | 'review' | 'excluded'
export interface CodShipment {
  id: string; tracking_number?: string | null; carrier_tracking_number?: string | null
  recipient_name?: string | null; carrier_code?: string | null; status?: string | null; created_at: string
  cod_value?: number | string | null; cod_enabled?: boolean
}
export interface CodSettlement {
  carrier?: string
  shipmentId: string; amountCents: number | null; matched: boolean; paid: boolean
  paidAt: string | null; processingDate: string | null; paymentRef: string | null
}
export interface ClientCodRow {
  disputeReason?: string
  cttConfirmed?: boolean
  id: string; tracking: string; carrier: string; shipmentStatus: string; date: string | null
  requestedCents: number | null; statementCents: number | null; state: ClientCodState
  paidAt: string | null; processingDate: string | null; paymentRef: string | null
}
export interface ClientCodOverview { clientId: string; rows: ClientCodRow[]; updatedAt: string }
/** Carrier exports use Portuguese day/month dates; never let Date.parse swap the month and day. */
export function reembolsoDay(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const pt = value.trim().match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/)
  if (pt) return billingDay(`${pt[3]}-${pt[2].padStart(2, '0')}-${pt[1].padStart(2, '0')}`)
  return /^\d{4}-\d{2}-\d{2}(?:$|T)/.test(value) ? billingDay(value) : null
}
export function codCents(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null
  const n = Number(value), cents = Math.round(n * 100)
  return Number.isFinite(n) && n >= 0 && Number.isSafeInteger(cents) ? cents : null
}
export function buildClientCodRows(shipments: CodShipment[], settlements: CodSettlement[]): ClientCodRow[] {
  const grouped = new Map<string, CodSettlement[]>()
  for (const item of settlements) grouped.set(item.shipmentId, [...(grouped.get(item.shipmentId) || []), item])
  const rows: ClientCodRow[] = []
  for (const shipment of shipments) {
    const declared = codCents(shipment.cod_value), evidence = grouped.get(shipment.id) || []
    if (!(declared !== null && declared > 0) && !shipment.cod_enabled) continue
    const requestedCents = declared !== null && declared > 0 ? declared : null
    const excluded = ['rascunho','draft','cancelado','cancelled','canceled','anulado'].includes((shipment.status || '').toLowerCase())
    const amounts = new Set(evidence.map(e => e.amountCents))
    const review = evidence.some(e => !e.matched || e.amountCents === null || e.amountCents <= 0) || amounts.size > 1 || (evidence.length > 0 && requestedCents === null)
      || (requestedCents !== null && evidence.some(e => e.amountCents !== requestedCents))
    // Re-uploading a carrier statement cannot double-count a shipment or undo an existing recorded payout.
    const paid = evidence.find(e => e.paid)
    const first = paid || evidence[0]
    const state: ClientCodState = excluded ? 'excluded' : review ? 'review' : paid ? 'paid' : first ? 'statement' : 'unconfirmed'
    rows.push({ id: shipment.id, tracking: shipment.carrier_tracking_number || shipment.tracking_number || shipment.id,
      carrier: shipment.carrier_code || '', shipmentStatus: shipment.status || '',
      date: billingDay(shipment.created_at), requestedCents, statementCents: !review && first ? first.amountCents : null, state,
      cttConfirmed: evidence.length > 0 && evidence.every(e => /^ctt(?:[ _]expresso)?$/i.test(e.carrier || '')) && !review,
      paidAt: state === 'paid' ? first?.paidAt || null : null, processingDate: first?.processingDate || null,
      paymentRef: state === 'paid' ? first?.paymentRef || null : null })
  }
  return rows
}
/** Collection visibility is separate from the statement-based payout eligibility. */
export function deliveredClientCodRows(rows: ClientCodRow[]): ClientCodRow[] {
  return rows.filter(row => ['entregue', 'entregue_pudo', 'entregue_em_pudo', 'delivered'].includes(row.shipmentStatus.trim().toLowerCase()))
}
export function filterClientCodRows(rows: ClientCodRow[], options: { state: string; search: string; from: string; to: string }): ClientCodRow[] {
  const normalize = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const q = normalize(options.search.trim())
  return rows.filter(r => (options.state === 'all' || r.state === options.state)
    && (!q || normalize(r.tracking).includes(q))
    && (!options.from || Boolean(r.date && r.date >= options.from)) && (!options.to || Boolean(r.date && r.date <= options.to)))
}
export function summarizeClientCod(rows: ClientCodRow[]) {
  const active = rows.filter(r => r.state !== 'excluded')
  return { count: active.length, requestedCents: active.reduce((s,r) => s + (r.requestedCents || 0),0),
    statementCents: active.reduce((s,r) => s + (r.statementCents || 0),0),
    paidCents: active.filter(r => r.state === 'paid').reduce((s,r) => s + (r.statementCents || 0),0),
    missingRequested: active.filter(r => r.requestedCents === null).length,
    unconfirmed: active.filter(r => r.state === 'unconfirmed').length, review: active.filter(r => r.state === 'review').length }
}

export interface CodPayoutRequest {
  id: string; createdAt: string; amountCents: number; shipmentIds: string[]; requestedBy: string
  paidAt?: string; paymentRef?: string; paidBy?: string; paidRecordedAt?: string
  items?: { shipmentId: string; tracking: string; amountCents: number; date: string | null }[]
}
export interface CodDispute { shipmentId: string; reason: string; openedAt: string; openedBy: string; resolvedAt?: string }
/** Historical manual flags are retained for audit only and do not control availability. */
export interface CodPayoutRelease { shipmentId:string; tracking:string; amountCents:number; releasedAt:string; releasedBy:string; revokedAt?:string }
export interface CodPayoutBox { clientId: string; revision: string; requests: CodPayoutRequest[]; disputes?: CodDispute[]; releases?:CodPayoutRelease[] }
/** A recorded payout stays paid; open disputes withhold funds without inventing a payment. */
export function applyCodPayoutRecords(overview: ClientCodOverview, box: CodPayoutBox | null): ClientCodOverview {
  return {...overview,rows:overview.rows.map(row=>{
    const payment=box?.requests.find(request=>request.paidAt && request.shipmentIds.includes(row.id))
    if(payment) return {...row,state:'paid',paidAt:payment.paidAt!,paymentRef:payment.paymentRef || null} as ClientCodRow
    const dispute=box?.disputes?.find(item=>item.shipmentId===row.id && !item.resolvedAt)
    return dispute ? {...row,state:'review',cttConfirmed:false,statementCents:null,disputeReason:dispute.reason} : row
  })}
}
export function payoutRequestState(request: CodPayoutRequest, rows: ClientCodRow[]): 'requested' | 'paid' | 'review' {
  if(request.paidAt) return 'paid'
  const source = request.shipmentIds.map(id => rows.find(row => row.id === id))
  if (source.every(row => row?.state === 'paid' && row.cttConfirmed)) return 'paid'
  if (source.some(row => !row || !row.cttConfirmed || row.state === 'review' || row.state === 'excluded')) return 'review'
  return 'requested'
}
export function clientCodReceivable(overview: ClientCodOverview, box: CodPayoutBox | null) {
  overview=applyCodPayoutRecords(overview,box)
  const requests = box?.requests || []
  const claimed = new Set(requests.flatMap(request => request.shipmentIds))
  const eligible = overview.rows.filter(row => row.state === 'statement' && row.cttConfirmed && row.statementCents !== null && row.statementCents > 0 && !claimed.has(row.id))
  const history = requests.map(request => ({ id:request.id,createdAt:request.createdAt,amountCents:request.amountCents,shipmentIds:request.shipmentIds,paidAt:request.paidAt,paymentRef:request.paymentRef,state: payoutRequestState(request, overview.rows) }))
  const availableCents = eligible.reduce((sum,row) => sum + row.statementCents!, 0)
  if (!Number.isSafeInteger(availableCents)) throw new Error('Não foi possível validar o saldo disponível.')
  return { availableCents, eligible,
    pendingCents: history.filter(request => request.state !== 'paid').reduce((sum,request) => sum + request.amountCents, 0), history,
    pending: history.some(request => request.state !== 'paid') }
}
export function currentCodMonth(today: string) {
  const end = new Date(`${today.slice(0,7)}-01T12:00:00Z`)
  end.setUTCMonth(end.getUTCMonth() + 1, 0)
  return { from: `${today.slice(0,7)}-01`, to: end.toISOString().slice(0,10) }
}
