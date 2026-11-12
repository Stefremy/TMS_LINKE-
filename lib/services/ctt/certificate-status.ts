import type { ShipmentRecord } from '../shipments/types'

export type CttCertificateFilter = 'all' | 'open' | 'closed'
export const isCttShipment = (shipment: ShipmentRecord) => ['ctt', 'ctt_expresso'].includes((shipment.carrier_code || '').toLowerCase())
export const hasCttClosure = (shipment: ShipmentRecord) => isCttShipment(shipment) && ['manifesto_fechado', 'expedido'].includes(shipment.ops_substatus || '')
export const canSelectCttCertificate = (shipment: ShipmentRecord) => isCttShipment(shipment) && shipment.status === 'pendente' && !hasCttClosure(shipment)
export const matchesCttCertificateFilter = (shipment: ShipmentRecord, filter: CttCertificateFilter) => filter === 'all' || (filter === 'closed' ? hasCttClosure(shipment) : canSelectCttCertificate(shipment))
