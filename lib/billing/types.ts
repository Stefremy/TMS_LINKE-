import type { Cliente } from '@/app/ops/entidades/clientes/types'
import type { ShipmentRecord } from '@/lib/services/shipments/types'
import type { CustomInvoiceItemInput } from '@/app/actions/moloni'

export type MoloniConnection = { companyId: string; refreshToken: string; tenantId?: string }
export interface BillingStatement {
  id: string
  receipt_amount?: number
  audit_id?: string
  client_id: string
  client_name?: string
  client_vat?: string
  client_snapshot?: Partial<Cliente> & { name?: string; vat?: string }
  statement_number: string
  invoice_number?: string
  shipments_count?: number
  created_at: string
  period_start?: string
  period_end?: string
  invoice_date?: string
  due_date?: string
  total_value: number
  status?: string
  is_pro_forma?: boolean
  document_type?: "billing_statement" | "custom_invoice"
  payment_terms?: string
  shipments?: ShipmentRecord[]
  shipment_ids?: string[]
  items?: CustomInvoiceItemInput[]
  moloni_document_id?: number | null
  moloni_document_number?: string | null
  moloni_document_pdf?: string | null
  moloni_receipt_id?: number | string | null
  moloni_receipt_pdf?: string | null
  credit_pending?: boolean
  credited_net?: number
  credited_total?: number
  outstanding_value?: number
  credit_notes?: { id: string; number?: string; total?: number }[]
}
