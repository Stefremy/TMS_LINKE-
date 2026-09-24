export interface Address {
  name: string
  address: string
  zip: string
  city: string
  country?: string
  phone: string
  email?: string
  contact?: string
}

export interface ShipmentInput {
  reference: string
  sender: Address
  recipient: Address
  weightKg: number
  volumes: number
  subProduct?: string
  codValue?: number
  isReturn?: boolean
  specialServices?: string[]
  observations?: string
  autoClose?: boolean
}

export interface ShipmentResult {
  success: boolean
  trackingNumber?: string
  carrierShipmentId?: string
  labelBase64?: string
  labelFormat?: 'pdf' | 'zpl' | 'png'
  error?: string
  rawResponse?: any
}

export interface TrackingEvent {
  status: string
  description: string
  date: string // ISO date
  location?: string
  isFinal?: boolean
  code?: string
  rawEvent?: any
}

export interface TrackingResult {
  success: boolean
  events?: TrackingEvent[]
  error?: string
}

export interface PickupInput {
  date: string // YYYY-MM-DD
  startHour: string // HH:mm
  endHour: string // HH:mm
  volumes: number
  weightKg: number
  sender: Address
  observations?: string
}

export interface PickupResult {
  success: boolean
  pickupNumber?: string
  error?: string
}

export interface CarrierProvider {
  /**
   * Initializes the provider with tenant-specific configuration
   */
  initialize(config: any): Promise<void>

  /**
   * Creates a new shipment with the carrier
   */
  createShipment(input: ShipmentInput): Promise<ShipmentResult>

  /**
   * Cancels an existing shipment
   */
  cancelShipment(trackingNumber: string): Promise<{ success: boolean; error?: string }>

  /**
   * Requests a pickup
   */
  createPickup(input: PickupInput): Promise<PickupResult>

  /**
   * Retrieves tracking information
   */
  getTracking(trackingNumber: string): Promise<TrackingResult>

  /**
   * Retrieves the label for an existing shipment
   */
  getLabel(trackingNumber: string): Promise<{ success: boolean; base64?: string; format?: string; error?: string }>

  /**
   * Validates if a shipment is possible (e.g. routing check)
   */
  validateShipment?(input: ShipmentInput): Promise<{ isValid: boolean; error?: string }>
}
