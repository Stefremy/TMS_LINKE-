import { positiveMeasurement, latestCarrierReadings, type ShipmentMeasurementsSummary } from '../tracking/carrier-measurements'

export type CarrierWeightSummary = {
  value: number
  unit: 'kg' | 'g' | null
  carrier: 'ctt' | 'correos'
  retrievedAt: string | null
}
export type ParcelSummary = {
  declaredWeightKg: number | null
  volumeCount: number | null
  carrierWeight: CarrierWeightSummary | null
}

export function carrierWeightSummary(carrier: 'ctt' | 'correos', measurements: unknown, retrievedAt: unknown): CarrierWeightSummary | null {
  if (!measurements || typeof measurements !== 'object') return null
  const data = measurements as { source?: string; weight?: { value?: unknown; unit?: unknown } }
  if (data.source !== (carrier === 'ctt' ? 'ctt_events_v3' : 'correos_tracking')) return null
  const value = positiveMeasurement(data.weight?.value)
  const unit = data.weight?.unit
  if (value === null || (unit != null && unit !== 'kg' && unit !== 'g')) return null
  return { value, unit: unit ?? null, carrier,
    retrievedAt: typeof retrievedAt === 'string' && Number.isFinite(Date.parse(retrievedAt)) ? retrievedAt : null }
}

export function parcelSummaryFromDetail(data: ShipmentMeasurementsSummary, previous?: ParcelSummary | null): ParcelSummary {
  const measurements = latestCarrierReadings(data.observations)
  return {
    declaredWeightKg: data.declared.weightKg,
    volumeCount: previous?.volumeCount ?? null,
    carrierWeight: carrierWeightSummary(data.carrier, measurements, data.observations[0]?.retrieved_at),
  }
}

export function formatDeclaredWeight(weight?: number | null): string {
  return weight && weight > 0 ? `${new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(weight)} kg` : 'Peso não registado'
}

export function formatListCarrierWeight(weight?: CarrierWeightSummary | null): { text: string; title: string } | null {
  if (!weight || !positiveMeasurement(weight.value)) return null
  const value = weight.unit === 'g' ? weight.value / 1000 : weight.value
  const number = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: weight.unit ? 2 : 0, maximumFractionDigits: 3 }).format(value)
  const label = weight.carrier === 'ctt' ? 'Real CTT' : 'Peso Correos'
  const text = weight.unit ? `${label}: ${number} kg` : `${label}: ${number}`
  const date = weight.retrievedAt ? ` Dados obtidos em ${new Date(weight.retrievedAt).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' })}.` : ''
  return { text, title: (weight.carrier === 'ctt'
    ? 'Peso real comunicado pelos CTT. A unidade só é convertida quando está confirmada.'
    : 'Peso comunicado pela Correos Express; a API não confirma se resulta de pesagem física.') + date }
}
