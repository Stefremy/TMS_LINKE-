import type { ClientSpecialServiceFee } from "@/app/ops/entidades/clientes/types"

export const COD_DESTINATIONS = [
  { code: "PT-CONT", label: "Portugal Continental" },
  { code: "PT-ILHAS", label: "Ilhas portuguesas (Açores e Madeira)" },
  { code: "ES-PENIN", label: "Espanha Peninsular" },
] as const
export type CodDestination = typeof COD_DESTINATIONS[number]["code"]
export type CodRate = NonNullable<NonNullable<ClientSpecialServiceFee["cod_destination_rates"]>[CodDestination]>
export const isCodFee = (code: string) => code === "cod" || code === "correos_cod"

export function baseCodRate(fee: ClientSpecialServiceFee): CodRate {
  return { fee_type: fee.fee_type as CodRate["fee_type"], fixed_value: fee.fixed_value ?? 0,
    percentage_value: fee.percentage_value ?? 0, min_value: fee.min_value ?? 0 }
}

export function codRateForZone(fee: ClientSpecialServiceFee, zone: CodDestination): CodRate {
  return fee.cod_destination_rates?.[zone] ?? baseCodRate(fee)
}

/** Require a complete postal code; Spanish islands and enclaves never use mainland rates. */
export function codDestination(country: string, postal: string): CodDestination | undefined {
  const code = country.trim().toUpperCase(), zip = postal.replace(/\D/g, "")
  if (code === "PT" && /^\d{7}$/.test(zip)) return zip.startsWith("9") ? "PT-ILHAS" : "PT-CONT"
  if (code === "ES" && /^\d{5}$/.test(zip) && !/^(07|35|38|51|52)/.test(zip)) return "ES-PENIN"
}

export function resolveCodFee(fee: ClientSpecialServiceFee, country: string, postal: string): ClientSpecialServiceFee {
  if (!isCodFee(fee.special_service_code)) return fee
  const zone = codDestination(country, postal)
  return zone ? { ...fee, ...codRateForZone(fee, zone) } : fee
}

export function validateCodRates(input: unknown, code: string, client = false): ClientSpecialServiceFee["cod_destination_rates"] {
  if (input === undefined) return undefined
  if (!isCodFee(code) || !input || typeof input !== "object" || Array.isArray(input)) throw new Error("Configuração de cobrança por destino inválida.")
  const rates: NonNullable<ClientSpecialServiceFee["cod_destination_rates"]> = {}
  for (const [zone, value] of Object.entries(input)) {
    if (!COD_DESTINATIONS.some(item => item.code === zone) || !value || typeof value !== "object" || Array.isArray(value)) throw new Error("Zona de cobrança inválida.")
    const rate = value as CodRate
    if (!["fixed", "percentage"].includes(rate.fee_type) || rate.use_standard !== undefined && typeof rate.use_standard !== "boolean"
      || rate.fee_type === "fixed" && rate.fixed_value === undefined || rate.fee_type === "percentage" && rate.percentage_value === undefined
      || [rate.fixed_value, rate.percentage_value, rate.min_value].some(amount => amount !== undefined && (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(amount * 100))))) {
      throw new Error("Indique valores de cobrança por destino válidos, iguais ou superiores a zero.")
    }
    rates[zone as CodDestination] = { fee_type: rate.fee_type, fixed_value: rate.fixed_value ?? 0,
      percentage_value: rate.percentage_value ?? 0, min_value: rate.min_value ?? 0,
      ...(client && rate.use_standard !== undefined ? { use_standard: rate.use_standard } : {}) }
  }
  return rates
}
