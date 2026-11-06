import type { ParcelSummary } from './parcel-summary'
import type { CarrierLabel } from './label-bundle'
import type { CTTCompleteShipmentOutput, CTTDocumentData } from '../ctt/ctt-types'
import type { pickupDateDisplay } from './shipment-pickup-dates'

/** Native shipment columns plus the optional, persisted operational snapshot. */
export interface ShipmentRecord {
  id: string
  created_at: string
  status: string
  tenant_id?: string
  client_id?: string
  updated_at?: string
  tracking_number?: string | null
  carrier_tracking_number?: string | null
  carrier_object_id?: string | null
  ctt_object_id?: string | null
  reference?: string | null
  carrier_code?: string
  carrier_name?: string
  service_type?: string
  serviceName?: string
  servico?: string
  transportadora?: string
  sender_city?: string
  sender_country?: string
  recipient_zip?: string
  recipient_postal_code?: string
  sender_name?: string
  sender_address?: string
  sender_zip3?: string
  sender_zip4?: string
  sender_phone?: string
  recipient_name?: string
  recipient_address?: string
  recipient_city?: string
  recipient_zip3?: string
  recipient_zip4?: string
  recipient_postal?: string
  recipient_country?: string
  recipient_phone?: string
  recipient_email?: string
  ops_substatus?: string
  sell_price?: number
  buy_price?: number
  base_price?: number
  fuel_tax_amount?: number
  fuel_rate_pct?: number
  special_fees_amount?: number
  special_fees_description?: string
  weight_kg?: number
  volumes_count?: number
  billing_statement_id?: string | null
  ctt_label_base64?: string
  carrier_label_base64?: string
  labelBase64?: string
  rawResponse?: CTTCompleteShipmentOutput
  carrier_labels?: CarrierLabel[]
  ctt_documents?: CTTDocumentData[]
  picked_up_at?: string | null
  parcel_summary?: ParcelSummary | null
  is_return?: boolean | string
  isReturn?: boolean | string
  driver_id?: string
  driver_name?: string
  delivery_date?: string
  expected_delivery_date?: string
  has_label?: boolean
  rawId?: string
  rawShipment?: ShipmentRecord
  trk?: ShipmentListRow["trk"]
  value?: ShipmentListRow["value"]
  package?: ShipmentListRow["package"]
  is_invoiced?: boolean
  invoiced?: boolean
  total_price?: number
  package_count?: number
  sender_postal_code?: string
  provider?: string
  weight?: number
  volume?: number
  volumes?: number
  goods_description?: string
  ctt_manifest_pdf?: string
  declared_weight?: number
  cod_value?: number
  cod_amount?: number
  insured_value?: number
  is_cod?: boolean
  is_insurance?: boolean
  is_fragil?: boolean
  is_sms_notification?: boolean
  payment_status?: string
  billing_type?: "pay_as_you_go" | "conta_corrente"
  recipient_contact_email?: string
  carrier?: string
  status_reason?: string
  sender?: ShipmentListRow["sender"]
  recipient?: ShipmentListRow["recipient"]
}

export interface ShipmentTimelineEvent {
  id?: string
  eventCode: string
  eventName: string
  description: string
  location: string
  title?: string
  date?: string
  timestamp: string
  tmsStatus?: string
  isTerminal?: boolean
  isIncidencia?: boolean
}

/** Display cells produced by the Ops shipment and pickup list pages. */
export interface ShipmentListRow {
  is_invoiced?: boolean
  rawId: string
  rawShipment: ShipmentRecord
  billing_statement_id?: string | null
  parcel_summary?: ParcelSummary | null
  trk: { id: string; date: string; ref?: string | null; carrierRef?: string; carrierName?: string; tag: string }
  sender: { name: string; flag: string; zip: string; city: string; phone: string }
  recipient: { name: string; flag: string; zip: string; city: string; phone: string }
  service: { code: string; name?: string; bgColor: string; textColor: string }
  package: { count: string; weight: string }
  delivery: { date: string; time: string }
  pickup?: ReturnType<typeof pickupDateDisplay>
  status: { label: string; raw?: string; subCode: string; color: string; dotColor?: string }
  value: { amount: string; diff: string; diffColor: string; ref: string }
}

export type ShipmentDrawerRecord = Omit<ShipmentRecord, "status"> & { status: string | ShipmentListRow["status"] }
