import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { resolveServiceZoneCode } from "./calculate-shipment-price"
import { ShipmentPricingError } from "./shipment-pricing-errors"

export type VolumetricRule = { divisor: number; zoneDivisors?: Record<string, number>; excludeZones?: string[] }
export type ParcelPricingDimensions = { lengthCm: number; widthCm: number; heightCm: number; volumesCount?: number; parcelWeightsKg?: number[] }

/** Contract rules are keyed by API product, never by editable marketing names. */
export function getServiceVolumetricRule(service?: Partial<ServicoLinke> | null): VolumetricRule | undefined {
  if (!service) return undefined
  if (service.volumetric_rule) return service.volumetric_rule
  const code = service.webservice_service_code?.trim().toUpperCase()
  if (code === "26") return { divisor: 1_000_000 / 167, excludeZones: ["PT-CONT"] }
  const isCorreos = service.carrier_group === "correos" ||
    service.preferred_carrier_name?.toLowerCase().includes("correos") ||
    service.webservice_connection_id === "correos_express" ||
    service.code?.trim().toUpperCase().startsWith("LK-COR")
  if (isCorreos) {
    if (code && (code.startsWith("EMSF") || code.startsWith("ENCF"))) return undefined
    if (code === "90" || code === "91") return { divisor: 5000, excludeZones: ["PT-CONT"] }
    if (code === "79") return { divisor: 6000, zoneDivisors: { "PT-ILHAS": 3000, "ES-ILHAS": 3000 }, excludeZones: ["PT-CONT"] }
    return { divisor: 6000, zoneDivisors: { "PT-ILHAS": 3000 }, excludeZones: ["PT-CONT"] }
  }
  switch (code) {
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
  const excluded = Boolean(zone && rule?.excludeZones?.includes(zone))
  const divisor = rule && !excluded ? (rule.zoneDivisors?.[zone] ?? rule.divisor) : null
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
