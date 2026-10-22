export type InvoiceKind = 'billing_statement' | 'custom_invoice'
export interface CreditSource { id: string; kind: InvoiceKind }
export interface CreditLine { id: number; productId: number; name: string; summary: string; availableQty: number; price: number; discount: number; exemptionReason: string; taxes: { tax_id: number; value: number; order: number; cumulative: number }[] }
export interface CreditSelection { id: number; qty: number }
export interface CreditPreview { source: CreditSource; clientName: string; invoiceNumber: string; lines: CreditLine[] }
export type CreditState = 'preparing' | 'creating' | 'draft' | 'closing' | 'issued' | 'cancelling' | 'cancelled' | 'review_required'
export interface CreditNote {
  id: string; client_id: string; client_name: string; source: CreditSource; invoice_number: string;
  invoice_document_id: number; company_id: string; customer_id: number; state: CreditState;
  reason: string; date: string; created_at: string; created_by: string; document_id?: number; number?: string;
  net?: number; tax?: number; total?: number; error?: string;
  reference: string; phase?: 'create' | 'close' | 'cancel';
  payload: Record<string, unknown>; lines: { name: string; qty: number; price: number }[];
}
export const CREDIT_STATE_LABELS: Record<CreditState,string> = { preparing:'A preparar',creating:'A preparar no Moloni',draft:'Rascunho',closing:'A emitir',issued:'Emitida',cancelling:'A cancelar rascunho',cancelled:'Rascunho cancelado',review_required:'Por confirmar no Moloni' }
export const creditMoney = (value?: number) => value == null ? '—' : new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(value)
