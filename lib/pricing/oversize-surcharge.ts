import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import type { ParcelPricingDimensions } from "./chargeable-weight"
import { ShipmentPricingError } from "./shipment-pricing-errors"

// Business charge confirmed by Linke; limits from CTT, not an acceptance guarantee.
export const OVERSIZE_FEE_EUR = 69.9
export type ParcelLimitProduct = "domestic" | "europa" | "international"
export function getServiceParcelLimitProduct(service: Partial<ServicoLinke>): ParcelLimitProduct | undefined {
  if (service.carrier_group === "correos" || service.preferred_carrier_name?.toLowerCase().includes("correos")) return undefined
  if (service.parcel_limit_product) return service.parcel_limit_product
  switch (service.webservice_service_code?.trim().toUpperCase()) {
    case "EMSF056.01": case "EMSF057.01": case "ENCF008.01": return "domestic"
    case "ENCF008.02": return "europa"
    case "EMSF001.02": return "international"
    default: return undefined
  }
}
// Sources: https://www.ctt.pt/particulares/enviar/regras-cuidados-envios/limites-de-peso-e-dimensoes
// Internacional: produto_internacional_atributos_por_pais_destino.pdf (May 2025).
// Verified EU rows; do not invent limits for other destinations.
const INTERNATIONAL_BOX_COUNTRIES = new Set("AT BE BG CY CZ DE DK EE FI FR GR HR HU IE IT LT LU LV MT NL PL RO SE SI SK".split(" "))
export function getParcelLimits(service: Partial<ServicoLinke>, country: string) {
  const product = getServiceParcelLimitProduct(service)
  const iso = country.trim().toUpperCase()
  if (product === "domestic") return { maxWeightKg: 30, maxSideCm: 150, maxSumCm: 240, maxGirthCm: null, sidesCm: null }
  if (product === "europa") return { maxWeightKg: iso === "SE" ? 20 : 30, maxSideCm: 150, maxSumCm: null, maxGirthCm: 300, sidesCm: null }
  if (product === "international" && INTERNATIONAL_BOX_COUNTRIES.has(iso)) return { maxWeightKg: 25, maxSideCm: 100, maxSumCm: null, maxGirthCm: null, sidesCm: [100, 80, 80] }
  return null
}

export function calculateOversizeSurcharge(service: Partial<ServicoLinke>, country: string, weightKg: number, parcel?: ParcelPricingDimensions) {
  const limits = getParcelLimits(service, country)
  const empty = { amount: 0, count: 0, items: [] as { name: string; amount: number }[], limits }
  if (!limits && parcel && country && getServiceParcelLimitProduct(service) === "international") {
    throw new ShipmentPricingError("Limites por volume não configurados para este destino internacional. Contacte o suporte.")
  }
  if (!limits || !parcel) return empty
  const count = parcel.volumesCount ?? 1
  const sides = [parcel.lengthCm, parcel.widthCm, parcel.heightCm].sort((a, b) => b - a)
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isSafeInteger(count) || count < 1 || count > 1000 || sides.some(v => !Number.isFinite(v) || v < 0.1)) {
    throw new ShipmentPricingError("Peso, dimensões ou número de volumes inválidos.")
  }
  const dimensional = sides[0] > limits.maxSideCm ||
    (limits.maxSumCm !== null && sides.reduce((a, b) => a + b, 0) > limits.maxSumCm) ||
    (limits.maxGirthCm !== null && sides[0] + 2 * sides[1] + 2 * sides[2] > limits.maxGirthCm) ||
    (limits.sidesCm !== null && sides.some((side, i) => side > limits.sidesCm![i]))
  let weights = parcel.parcelWeightsKg
  if (weights !== undefined && (!Array.isArray(weights) || weights.length !== count || weights.some(w => !Number.isFinite(w) || w <= 0) || Math.abs(weights.reduce((a, b) => a + b, 0) - weightKg) > 0.001)) {
    throw new ShipmentPricingError("Os pesos individuais devem corresponder ao número de volumes e somar o peso total do envio.")
  }
  if (!weights && count === 1) weights = [weightKg]
  if (!dimensional && !weights && weightKg > limits.maxWeightKg) {
    throw new ShipmentPricingError("Indique o peso real de cada volume para calcular a taxa de volumes fora de medida.")
  }
  const affected = dimensional ? count : weights?.filter(w => w > limits.maxWeightKg).length ?? 0
  const amount = Math.round(affected * OVERSIZE_FEE_EUR * 100) / 100
  return { amount, count: affected, limits, items: affected ? [{ name: `Volumes fora de medida/peso (${affected} × 69,90 €)`, amount }] : [] }
}
