import type { ShipmentFormValues } from "@/components/shipments/form/schema"

export const QUOTATION_ACTION = "shipment_quote_request"
export const QUOTATION_READ_ACTION = "shipment_quote_read"
export const QUOTATION_UNREAD_EVENT = "linke:quotation-unread"
export const QUOTATION_STATUSES = {
  pending: "Por tratar", reviewing: "Em análise", quoted: "Proposta recebida",
  accepted: "Envio criado — aguarda guia", declined: "Recusada", completed: "Guia registada no envio", cancelled: "Cancelada",
} as const
export type QuotationStatus = keyof typeof QUOTATION_STATUSES
export type QuotationShipment = Pick<ShipmentFormValues,
  "senderName" | "senderAddress" | "senderCity" | "senderPostal" | "senderPhone" |
  "recipientName" | "recipientAddress" | "recipientCity" | "recipientCountry" | "recipientPostal" |
  "recipientPhone" | "recipientEmail" | "weightKg" | "volumesCount" | "lengthCm" | "widthCm" | "heightCm" |
  "parcelWeightsKg" | "observations">
export type ShipmentQuotation = {
  id: string; reference: string; client_id: string; client_name: string; service_id: string; service_name: string;
  created_at: string; updated_at: string; revision: number; status: QuotationStatus;
  shipment: QuotationShipment; proposed_price: number | null; response: string; requested_transport?: "air";
  requested_by_email?: string; requested_by_role?: "employee" | "admin";
  is_unread?: boolean;
  has_iva?: boolean;
  tracking_number: string; tracking_carrier?: "correos" | "fedex"; estimated_price?: number | null; shipment_id?: string; billing_type?: "conta_corrente" | "pay_as_you_go"; internal_notes?: string;
}
export type StoredQuotation = ShipmentQuotation & { requested_by: string; requested_by_collaborator_id?: string; updated_by: string; shipment_audit_id?: string; partner_cost?: number; booked_by?: string; booked_at?: string; accepted_at?: string }
export type QuotationPage = { requests: ShipmentQuotation[]; next: { at: string; id: string } | null }
