export type ReconcileStatus = "ok" | "mismatch" | "undercharged" | "unknown"

export interface ReconcileItem {
  id: string // Tracking / Código do Objeto normalizado
  cttPrice: number // Preço faturado pelo CTT (sem IVA)
  lnkPrice: number // Preço registado no TMS (buy_price ou sell_price)
  diff: number // Diferença: cttPrice - lnkPrice
  status: ReconcileStatus
  cttDate: string // Data do objeto na fatura CTT
  cttDateTs?: number
  shipmentId?: string
  trackingNumber?: string
  carrierTrackingNumber?: string
  clientName?: string
  clientId?: string
  senderName?: string
  recipientName?: string
  serviceType?: string
  weightKg?: number
}

export interface ReconcileStats {
  totalItems: number
  mismatchCount: number // Cobrado a mais pelos CTT
  underchargedCount: number // Cobrado a menos pelos CTT (a favor da Linke)
  unknownCount: number // Não encontrado no TMS (cobrança indevida / desconhecida)
  okCount: number // Preço em exata conformidade
  totalCttBilled: number // Total € faturado CTT
  totalLnkExpected: number // Total € esperado pelo TMS
  totalOverchargedRisk: number // Soma de todas as diferenças cobradas a mais (€ a reclamar)
  totalUnderchargedGain: number // Soma de todas as diferenças cobradas a menos (€ a favor da Linke)
  maxMismatch: number // Maior discrepância individual
  flaggedRate: number // % de envios com problema (mismatch + unknown)
}

export interface ReconcileRunResult {
  runId: string
  executedAt: string
  filename: string
  comparisonMode: "buy_price" | "sell_price"
  dateFilter?: { from?: string; to?: string }
  stats: ReconcileStats
  items: ReconcileItem[]
}

export interface AuditHistoryEntry {
  id: string
  created_at: string
  filename: string
  comparisonMode: string
  stats: ReconcileStats
  totalRows: number
}
