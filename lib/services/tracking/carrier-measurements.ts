export type MeasurementUnit = 'kg' | 'cm' | null
export type CarrierReading = { value: number; unit: MeasurementUnit }
export type CarrierMeasurements = {
  source: 'ctt_events_v3' | 'correos_tracking'
  weight?: CarrierReading
  volumetricWeight?: CarrierReading
  volume?: CarrierReading
  length?: CarrierReading
  width?: CarrierReading
  height?: CarrierReading
}
export type SavedCarrierMeasurements = {
  shipment_id: string
  carrier: 'ctt' | 'correos'
  measurements: CarrierMeasurements
  event_code: string
  event_timestamp: string
  retrieved_at: string
}
export type ShipmentMeasurementsSummary = {
  carrier: 'ctt' | 'correos'
  declared: { weightKg: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null }
  weightAdjustment?: import('@/lib/billing/carrier-weight-pricing').WeightAdjustmentResult
  billingWeightKg?: number | null
  observations: SavedCarrierMeasurements[]
}

export function positiveMeasurement(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const cleaned = String(value).trim().replace(',', '.')
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(cleaned)) return null
  const number = Number(cleaned)
  return Number.isFinite(number) && number > 0 ? number : null
}

function reading(value: unknown, unit: MeasurementUnit): CarrierReading | undefined {
  const number = positiveMeasurement(value)
  return number === null ? undefined : { value: number, unit }
}

function nonEmpty(data: CarrierMeasurements): CarrierMeasurements | undefined {
  return Object.values(data).some(value => typeof value === 'object') ? data : undefined
}

/** The V3 WSDL names the fields but does not specify their units. Keep the
 * returned values verbatim until CTT confirms units; never guess g/kg or mm/cm. */
export function parseCttMeasurements(event: Record<string, unknown>): CarrierMeasurements | undefined {
  if (event._Valido != null && String(event._Valido).trim() !== '1') return undefined
  return nonEmpty({
    source: 'ctt_events_v3',
    weight: reading(event._PesoReal, null),
    volumetricWeight: reading(event._PesoVolumetrico, null),
    length: reading(event._Comprimento, null),
    width: reading(event._Largura, null),
    height: reading(event._Altura, null),
  })
}

/** Correos' tracking payload also contains declared shipment data. Do not call
 * kilos/alto/largo/ancho a certified weighing, nor interpret volumen as kg. */
export function parseCorreosMeasurements(result: Record<string, unknown>): CarrierMeasurements | undefined {
  return nonEmpty({
    source: 'correos_tracking',
    weight: reading(result.kilos, 'kg'),
    volume: reading(result.volumen, null),
    length: reading(result.largo, null),
    width: reading(result.ancho, null),
    height: reading(result.alto, null),
  })
}

export function formatCarrierReading(value: CarrierReading | undefined): string {
  if (!value) return 'Não comunicado'
  const number = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 3 }).format(value.value)
  return value.unit ? `${number} ${value.unit}` : `${number} (unidade não indicada)`
}

export function latestCarrierReadings(observations: SavedCarrierMeasurements[]): CarrierMeasurements | null {
  // Each field can be absent in a later response. A missing/zero field must not
  // erase an earlier positive reading. Never combine different carriers.
  const sorted = [...observations].sort((a, b) => b.retrieved_at.localeCompare(a.retrieved_at))
  if (!sorted.length) return null
  const result: CarrierMeasurements = { source: sorted[0].measurements.source }
  for (const observation of sorted) {
    if (observation.measurements.source !== result.source) continue
    for (const key of ['weight', 'volumetricWeight', 'volume', 'length', 'width', 'height'] as const) {
      if (!result[key] && observation.measurements[key]) result[key] = observation.measurements[key]
    }
  }
  return result
}
