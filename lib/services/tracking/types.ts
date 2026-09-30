export type NormalizedTmsStatus =
  | "pendente"
  | "entrada_rede"
  | "em_distribuicao"
  | "entregue"
  | "incidencia"
  | "devolvido"
  | "cancelado"

export type TmsDisplayStatus =
  | "pendente"
  | "em_transito"
  | "em_distribuicao"
  | "entregue"
  | "incidencia"
  | "devolvido"
  | "cancelado"

export interface NormalizedTrackingEvent {
  status: NormalizedTmsStatus // Valid database enum value for shipments.status ('entrada_rede', etc.)
  displayStatus: TmsDisplayStatus // UI label ('em_transito', etc.)
  eventCode: string
  eventName: string
  description: string
  location: string
  timestamp: string // ISO string
  isTerminal: boolean
  isIncidencia: boolean
  carrierCode: "correos" | "ctt"
  rawEvent?: any
}

export interface TrackingSyncResult {
  success: boolean
  carrier: "correos" | "ctt"
  count: number
  latestStatus?: TmsDisplayStatus
  event?: NormalizedTrackingEvent
  error?: string
}
