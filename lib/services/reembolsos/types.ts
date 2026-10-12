export interface ReembolsoRawItem {
  lineNumber: number
  carrierTracking: string
  deliveryDate: string
  processingDate: string
  recipientName: string
  recipientAddress: string
  recipientPostalCode: string
  recipientCity: string
  amount: number
  paymentMethod: "Dinheiro" | "Multibanco" | string
  clientReference: string
  additionalInfo: string
  clientNotes: string
}

export type ReconcileStatus = "matched" | "value_mismatch" | "unmatched"

export interface ReembolsoMatchedItem extends ReembolsoRawItem {
  reconcileStatus: ReconcileStatus
  shipmentId?: string
  clientId?: string
  clientName?: string
  clientIban?: string
  expectedCod?: number
  difference?: number
}

export interface ClientReembolsoSummary {
  clientId: string
  clientName: string
  clientIban: string
  clientEmail?: string
  totalAmount: number
  itemsCount: number
  isPaid: boolean
  paidAt?: string
  paymentRef?: string
  items: ReembolsoMatchedItem[]
}

export interface ReembolsoBatch {
  id: string
  filename: string
  carrier: "ctt" | "correos" | string
  carrierAccount?: string
  carrierContract?: string
  destinationIban?: string
  totalItems: number
  totalAmount: number
  matchedCount: number
  unmatchedCount: number
  items: ReembolsoMatchedItem[]
  clientSummaries: ClientReembolsoSummary[]
  created_at: string
}
