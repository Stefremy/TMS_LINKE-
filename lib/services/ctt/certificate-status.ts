import type { ShipmentRecord } from '../shipments/types'

export type CttCertificateFilter = 'all' | 'open' | 'closed'
export const isCttShipment = (shipment: ShipmentRecord) => ['ctt', 'ctt_expresso'].includes((shipment.carrier_code || '').toLowerCase())
// ops_substatus is the legacy flag (tracking overwrites it); ctt_closed_at is the durable one.
export const isCttClosedRow = (row: { ctt_closed_at?: string | null; ops_substatus?: string | null }) => Boolean(row.ctt_closed_at) || ['manifesto_fechado', 'expedido'].includes(row.ops_substatus || '')
export const hasCttClosure = (shipment: ShipmentRecord) => isCttShipment(shipment) && isCttClosedRow(shipment)
// After the first carrier scan the acceptance certificate has no use any more.
export const canDownloadCttCertificate = (shipment: ShipmentRecord) => hasCttClosure(shipment) && shipment.status === 'pendente'
export const canSelectCttCertificate = (shipment: ShipmentRecord) => isCttShipment(shipment) && shipment.status === 'pendente' && !hasCttClosure(shipment)
export const matchesCttCertificateFilter = (shipment: ShipmentRecord, filter: CttCertificateFilter) => filter === 'all' || (filter === 'closed' ? hasCttClosure(shipment) : canSelectCttCertificate(shipment))
