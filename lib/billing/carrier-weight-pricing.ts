import type { Cliente } from '@/app/ops/entidades/clientes/types'
import type { ServicoLinke } from '@/app/ops/configuracao/servicos/types'
import { calculateShipmentPrice, findExactZone, resolveServiceZoneCode, resolveZoneTierOverrides } from '@/lib/pricing/calculate-shipment-price'
import type { CarrierReading } from '@/lib/services/tracking/carrier-measurements'

export type WeightPricingBasis = {
  version: 1; country: string; postal: string; service: ServicoLinke; client: Partial<Cliente>
  volumetricWeightKg?: number
  volumetricDivisor?: number
}
export type WeightAdjustmentResult = {
  status: 'disabled' | 'review_required' | 'unchanged' | 'adjusted' | 'locked' | 'unavailable'
  message: string; previousWeightKg?: number; weightKg?: number; previousPrice?: number; price?: number; difference?: number
  /** Tier labels before/after, the shipment VAT rate and whether the difference came out of the prepaid wallet. */
  previousTier?: string | null; tier?: string | null; vatPct?: number; prepaid?: boolean
  /** Which carrier reading set the charged weight. */
  chargedBy?: 'real' | 'volumetric'
}

/** Freeze only the selected tariff zone, overrides and fuel rate, never credentials or personal data. */
export function captureWeightPricingBasis(client: Partial<Cliente>, service: ServicoLinke, country: string, postal: string,
  weight?: { volumetricWeightKg: number | null; volumetricDivisor: number | null }): WeightPricingBasis {
  const zone = findExactZone(service.zones, resolveServiceZoneCode(service, country, postal))
  if (!zone) throw new Error('Zona tarifária não encontrada.')
  const customTiers = resolveZoneTierOverrides(client.pricing?.service_weight_tiers, service, zone.zone_code)
  const overrides = resolveZoneTierOverrides(client.custom_tier_overrides, service, zone.zone_code)
  return structuredClone({ version: 1, country, postal,
    ...(weight?.volumetricWeightKg != null ? { volumetricWeightKg: weight.volumetricWeightKg, volumetricDivisor: weight.volumetricDivisor } : {}),
    service: { id: service.id, name: service.name, code: service.code, webservice_service_code: service.webservice_service_code,
      is_active: true, zones: [zone], allowed_zones: [zone.zone_code],
      fuel_surcharge_pct: client.pricing?.standard_fuel_surcharge_pct ?? service.fuel_surcharge_pct ?? client.pricing?.fuel_surcharge_pct ?? 12.5 },
    client: { default_linke_table_id: service.id,
      ...(customTiers ? { pricing: { service_weight_tiers: { [`${service.id}::${zone.zone_code}`]: customTiers } } } : {}), ...(overrides ? { custom_tier_overrides: { [service.id]: overrides } } : {}) },
  }) as WeightPricingBasis
}

export function weightInKg(reading: CarrierReading | undefined, cttUnit?: string): number | null {
  if (!reading || !Number.isFinite(reading.value) || reading.value <= 0) return null
  const unit = reading.unit ?? cttUnit
  const kg = unit === 'kg' ? reading.value : unit === 'g' ? reading.value / 1000 : null
  return kg !== null && Number.isFinite(kg) && kg > 0 ? kg : null
}
/** Carrier dimension in cm. Unknown units are never guessed (same rule as weights). */
export function lengthInCm(reading: CarrierReading | undefined, configuredUnit?: string): number | null {
  if (!reading || !Number.isFinite(reading.value) || reading.value <= 0) return null
  const unit = reading.unit ?? configuredUnit
  const cm = unit === 'cm' ? reading.value : unit === 'mm' ? reading.value / 10 : unit === 'm' ? reading.value * 100 : null
  return cm !== null && Number.isFinite(cm) && cm > 0 ? cm : null
}

/**
 * Volumetric weight from the dimensions the carrier measured, with the divisor frozen when the shipment
 * was priced. Only where the original tariff already charged volumetric weight and never on PT-CONT
 * (carriers do not measure mainland parcels). Returns null when it cannot be established safely.
 */
export function carrierVolumetricKg(measured: { length?: CarrierReading; width?: CarrierReading; height?: CarrierReading } | null | undefined,
  basis: WeightPricingBasis | undefined, configuredUnit?: string): number | null {
  const divisor = basis?.volumetricDivisor
  const zone = basis?.service?.zones?.[0]?.zone_code
  if (!divisor || !Number.isFinite(divisor) || divisor <= 0 || !zone || zone === 'PT-CONT') return null
  const dims = [measured?.length, measured?.width, measured?.height].map(reading => lengthInCm(reading, configuredUnit))
  if (dims.some(value => value === null)) return null
  const kg = Math.round(dims[0]! * dims[1]! * dims[2]! / divisor * 1000) / 1000
  return Number.isFinite(kg) && kg > 0 ? kg : null
}

const cents = (value: unknown) => {
  if (typeof value !== 'number' && typeof value !== 'string' || String(value).trim() === '') throw new Error('Preço anterior inválido.')
  const n = Number(value), c = Math.round(n * 100)
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(c) || Math.abs(n * 100 - c) > 0.00001) throw new Error('Preço anterior inválido.')
  return c
}

/** Only the recorded transport tariff changes. Existing non-weight extras remain intact. */
export function planWeightAdjustment(input: {
  basis: WeightPricingBasis; previousWeightKg: number; weightKg: number; sellPrice: unknown; buyPrice: unknown;
  basePrice: unknown; fuelAmount: unknown; specialAmount: unknown
}) {
  const { basis } = input
  if (!Number.isFinite(input.previousWeightKg) || input.previousWeightKg <= 0 || !Number.isFinite(input.weightKg) || input.weightKg <= 0) throw new Error('Peso anterior ou comunicado inválido.')
  const floor = basis?.volumetricWeightKg ?? 0
  if (!Number.isFinite(floor) || floor < 0) throw new Error('Peso volumétrico original inválido.')
  const previousWeightKg = Math.max(input.previousWeightKg, floor)
  const weightKg = Math.max(input.weightKg, floor)
  if (!basis || basis.version !== 1 || !basis.country || !basis.service || !Number.isFinite(previousWeightKg) || previousWeightKg <= 0 || !Number.isFinite(weightKg) || weightKg <= 0) throw new Error('Falta a base tarifária original para ajustar o envio.')
  const options = { requireConfiguredTariff: true }
  const before = calculateShipmentPrice(previousWeightKg, basis.client, [basis.service], basis.country, basis.postal, options)
  const after = calculateShipmentPrice(weightKg, basis.client, [basis.service], basis.country, basis.postal, options)
  const oldPrice = cents(input.sellPrice), extras = cents(input.specialAmount)
  if (cents(before.basePrice) !== cents(input.basePrice) || cents(before.fuelSurchargeAmount) !== cents(input.fuelAmount) ||
      cents(before.buyPrice) !== cents(input.buyPrice) || cents(before.sellPrice) + extras !== oldPrice) {
    throw new Error('O preço guardado diverge da tarifa original. É necessária revisão no OPS.')
  }
  const newPrice = cents(after.sellPrice) + extras
  // Smaller readings are retained as observations; automatic credits need separate reconciliation.
  if (weightKg <= previousWeightKg || newPrice <= oldPrice) return null
  return { previousWeightKg, weightKg, previousPrice: oldPrice / 100, price: newPrice / 100,
    difference: (newPrice - oldPrice) / 100, buyPrice: after.buyPrice, basePrice: after.basePrice,
    fuelAmount: after.fuelSurchargeAmount, previousTier: before.tierLabel, tier: after.tierLabel,
    fuelRatePct: basis.service.fuel_surcharge_pct ?? basis.client.pricing?.fuel_surcharge_pct ?? 12.5 }
}
