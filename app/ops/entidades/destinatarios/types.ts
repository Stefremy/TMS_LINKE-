export interface DestinatarioHistoryItem {
  id: string
  tracking_number: string
  ctt_object_id?: string
  created_at: string
  status: string
  service_type: string
  sell_price?: number
  buy_price?: number
  weight_kg?: number
}

export interface Destinatario {
  id: string
  name: string
  address: string
  postal_code: string
  city: string
  country: string
  phone?: string
  email?: string
  client_id?: string
  client_name: string
  total_shipments: number
  last_shipment_date: string
  last_tracking_number: string
  last_status: string
  shipments_history: DestinatarioHistoryItem[]
}
