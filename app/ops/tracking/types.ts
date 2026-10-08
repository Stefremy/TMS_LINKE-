export type ShipmentStatus = "active" | "arriving" | "departed" | "delivered"

export interface ShipmentPickagem {
  id: string
  code: string
  title: string
  locationName: string
  city: string
  postalCode?: string
  lat: number
  lng: number
  timestamp: string
  formattedTime: string
  status: "completed" | "current" | "pending"
  operator?: string
  scannerDevice?: string
  description?: string
  isCurrentPosition?: boolean
}

export interface ShipmentDocumentation {
  guiaNumber: string
  atDocCode: string
  issueDate: string
  senderName: string
  senderVat: string
  senderAddress: string
  recipientName: string
  recipientVat: string
  recipientAddress: string
  goodsDescription: string
  cargoWeightKg: number
  cargoPackages: number
  insuredValueEur: number
}

export interface TrackingShipment {
  id: string
  displayId: string
  trackingNumber: string
  status: ShipmentStatus
  statusLabel: string
  carrier: string
  serviceType: string
  isRealData: boolean
  isDemo?: boolean
  origin: {
    hubName: string
    city: string
    postalCode: string
    address: string
    departureTime: string
    lat: number
    lng: number
  }
  destination: {
    hubName: string
    city: string
    postalCode: string
    address: string
    eta: string
    etaDate: string
    lat: number
    lng: number
  }
  cargo: {
    weightStr: string
    volumeStr: string
    packagesCount: number
    category: string
    clientName: string
  }
  metrics: {
    totalDistanceKm: number
    remainingDistanceKm: number
    remainingTimeStr: string
    lastPickagemLocation: string
    lastPickagemTime: string
    lastPickagemStatus: string
    progressPercent: number
    completedScansCount: number
    totalScansCount: number
  }
  pickagens: ShipmentPickagem[]
  documentation: ShipmentDocumentation
}
