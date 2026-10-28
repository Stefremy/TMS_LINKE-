import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { resolveServiceZoneCode } from "./calculate-shipment-price"
import { ShipmentPricingError } from "./shipment-pricing-errors"

export type VolumetricRule = { divisor: number; zoneDivisors?: Record<string, number> }
export type ParcelPricingDimensions = { lengthCm: number; widthCm: number; heightCm: number; volumesCount?: number; parcelWeightsKg?: number[] }

/** Contract rules are keyed by API product, never by editable marketing names. */
export function getServiceVolumetricRule(service: Partial<ServicoLinke>): VolumetricRule | undefined {
  if (service.volumetric_rule) return service.volumetric_rule
  if (service.carrier_group === "correos" || service.preferred_carrier_name?.toLowerCase().includes("correos")) return undefined
  switch (service.webservice_service_code?.trim().toUpperCase()) {
    case "EMSF056.01": return { divisor: 6000 }
    case "EMSF057.01": return { divisor: 6000, zoneDivisors: { "PT-ILHAS": 3000 } }
    case "EMSF001.02": return { divisor: 5000 }
    case "ENCF008.02": return { divisor: 5000 }
    default: return undefined
  }
}

export function calculateChargeableWeight(weightKg: number, service: ServicoLinke, country: string, postal: string,
  parcel?: ParcelPricingDimensions) {
  return calculateChargeableWeightForZone(weightKg, service, resolveServiceZoneCode(service, country, postal), parcel)
}

export function calculateChargeableWeightForZone(weightKg: number, service: ServicoLinke, zone: string,
  parcel?: ParcelPricingDimensions) {
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new ShipmentPricingError("Peso inválido.")
  const rule = getServiceVolumetricRule(service)
  const divisor = rule ? (rule.zoneDivisors?.[zone] ?? rule.divisor) : null
  if (divisor !== null && (!Number.isFinite(divisor) || divisor <= 0)) throw new ShipmentPricingError("Fator de conversão volumétrica inválido neste serviço.")
  if (parcel) {
    if (![parcel.lengthCm, parcel.widthCm, parcel.heightCm].every(value => Number.isFinite(value) && value >= 0.1)) {
      throw new ShipmentPricingError("Indique comprimento, largura e altura válidos em centímetros.")
    }
    if (!Number.isSafeInteger(parcel.volumesCount ?? 1) || (parcel.volumesCount ?? 1) < 1) throw new ShipmentPricingError("Número de volumes inválido.")
  }
  const volumetricWeightKg = parcel && divisor !== null
    ? parcel.lengthCm * parcel.widthCm * parcel.heightCm * (parcel.volumesCount ?? 1) / divisor : null
  if (volumetricWeightKg !== null && (!Number.isFinite(volumetricWeightKg) || volumetricWeightKg <= 0)) throw new ShipmentPricingError("Dimensões demasiado extensas para calcular a tarifa.")
  return { declaredWeightKg: weightKg, volumetricWeightKg, volumetricDivisor: divisor,
    billableWeightKg: Math.max(weightKg, volumetricWeightKg ?? weightKg) }
}
