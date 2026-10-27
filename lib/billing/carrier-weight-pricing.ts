import type { Cliente } from '@/app/ops/entidades/clientes/types'
import type { ServicoLinke } from '@/app/ops/configuracao/servicos/types'
import { calculateShipmentPrice, findExactZone, resolveServiceZoneCode, resolveZoneTierOverrides } from '@/lib/pricing/calculate-shipment-price'
import type { CarrierReading } from '@/lib/services/tracking/carrier-measurements'

export type WeightPricingBasis = {
  version: 1; country: string; postal: string; service: ServicoLinke; client: Partial<Cliente>
}
export type WeightAdjustmentResult = {
  status: 'disabled' | 'review_required' | 'unchanged' | 'adjusted' | 'locked' | 'unavailable'
  message: string; previousWeightKg?: number; weightKg?: number; previousPrice?: number; price?: number; difference?: number
}

/** Freeze only the selected tariff zone, overrides and fuel rate, never credentials or personal data. */
export function captureWeightPricingBasis(client: Partial<Cliente>, service: ServicoLinke, country: string, postal: string): WeightPricingBasis {
  const zone = findExactZone(service.zones, resolveServiceZoneCode(service, country, postal))
  if (!zone) throw new Error('Zona tarifária não encontrada.')
  const overrides = resolveZoneTierOverrides(client.custom_tier_overrides, service, zone.zone_code)
  return structuredClone({ version: 1, country, postal,
    service: { id: service.id, name: service.name, code: service.code, webservice_service_code: service.webservice_service_code,
      is_active: true, zones: [zone], allowed_zones: [zone.zone_code],
      fuel_surcharge_pct: service.fuel_surcharge_pct ?? client.pricing?.fuel_surcharge_pct ?? 12.5 },
    client: { default_linke_table_id: service.id, ...(overrides ? { custom_tier_overrides: { [service.id]: overrides } } : {}) },
  }) as WeightPricingBasis
}

export function weightInKg(reading: CarrierReading | undefined, cttUnit?: string): number | null {
  if (!reading || !Number.isFinite(reading.value) || reading.value <= 0) return null
  const unit = reading.unit ?? cttUnit
  const kg = unit === 'kg' ? reading.value : unit === 'g' ? reading.value / 1000 : null
  return kg !== null && Number.isFinite(kg) && kg > 0 ? kg : null
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
  const { basis, previousWeightKg, weightKg } = input
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
