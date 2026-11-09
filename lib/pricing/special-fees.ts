import type { Cliente, ClientSpecialServiceFee } from "@/app/ops/entidades/clientes/types"
import { DEFAULT_STANDARD_SPECIAL_FEES } from "./special-fee-catalogue"
import { isCorreosConfigurationOnly } from "@/lib/services/correos/complementary-services"
import { codDestinationsForFee, isCodFee, codRateForZone, baseCodRate, validateCodRates } from "./cod-destination-rates"

export function inheritStandardSpecialFees(standards: ClientSpecialServiceFee[] = DEFAULT_STANDARD_SPECIAL_FEES) {
  return standards.map(fee => ({ ...fee, use_standard: true }))
}

/** Older explicit rows remain negotiated prices, including zero and disabled flags. */
export function resolveClientSpecialFees(configured?: ClientSpecialServiceFee[], standards: ClientSpecialServiceFee[] = DEFAULT_STANDARD_SPECIAL_FEES) {
  const byCode = new Map((configured || []).map(fee => [fee.special_service_code, fee]))
  const result = standards.map(standard => {
    const custom = byCode.get(standard.special_service_code)
    byCode.delete(standard.special_service_code)
    const override = custom && { ...custom }
    // Older persisted profiles used null for an unset amount. Only fill that
    // legacy gap from a valid standard value; negotiated zero remains explicit.
    for (const field of ["fixed_value", "percentage_value", "min_value"] as const) {
      const fallback = standard[field]
      if (override?.[field] === null && typeof fallback === "number" && Number.isFinite(fallback) && fallback >= 0) {
        override[field] = fallback
      }
    }
    const resolved = override && override.use_standard !== true ? { ...standard, ...override, use_standard: false }
      : { ...standard, use_standard: true }
    if (isCodFee(standard.special_service_code)) {
      resolved.cod_destination_rates = Object.fromEntries(codDestinationsForFee(standard.special_service_code).map(({ code }) => {
        const rate = override?.cod_destination_rates?.[code]
        const negotiated = rate && rate.use_standard !== true ? rate
          : !rate && override && override.use_standard !== true ? baseCodRate(override) : undefined
        return [code, negotiated ? { ...negotiated, use_standard: false } : { ...codRateForZone(standard, code), use_standard: true }]
      }))
    }
    return resolved
  })
  result.push(...[...byCode.values()].map(fee => ({ ...fee, use_standard: false })))
  return result.map(fee => isCorreosConfigurationOnly(fee.special_service_code) ? { ...fee, is_enabled: false } : fee)
}

export function withStandardSpecialFees<T extends Partial<Cliente>>(client: T, standards: ClientSpecialServiceFee[], fuelSurchargePct?: number) {
  return { ...client, pricing: { ...client.pricing, standard_fuel_surcharge_pct: fuelSurchargePct,
    special_services_fees: resolveClientSpecialFees(client.pricing?.special_services_fees, standards) } } as T
}

/** Only commercial values are writable; carrier codes and descriptions stay canonical. */
export function validateStandardSpecialFees(input: unknown, allowNewDefaults = false): ClientSpecialServiceFee[] {
  if (!Array.isArray(input) || !input.length || !allowNewDefaults && input.length !== DEFAULT_STANDARD_SPECIAL_FEES.length) throw new Error("Preencha todas as taxas da tabela standard.")
  const seen = new Set<string>()
  const validated = input.map(raw => {
    if (!raw || typeof raw !== "object") throw new Error("Taxa inválida.")
    const fee = raw as ClientSpecialServiceFee
    const template = DEFAULT_STANDARD_SPECIAL_FEES.find(row => row.special_service_code === fee.special_service_code)
    if (!template || seen.has(fee.special_service_code)) throw new Error("Código de taxa inválido ou repetido.")
    seen.add(fee.special_service_code)
    if (!["fixed", "percentage"].includes(fee.fee_type) || typeof fee.is_enabled !== "boolean") throw new Error("Indique um tipo e estado válidos para cada taxa.")
    const amounts = [fee.fixed_value, fee.percentage_value, fee.min_value]
    if (amounts.some(value => value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))))) {
      throw new Error("As taxas devem ter valores numéricos iguais ou superiores a zero.")
    }
    if (fee.fee_type === "fixed" && fee.fixed_value === undefined || fee.fee_type === "percentage" && fee.percentage_value === undefined) throw new Error("Preencha o valor da taxa.")
    return { ...template, fee_type: fee.fee_type, fixed_value: fee.fixed_value ?? 0,
      percentage_value: fee.percentage_value ?? 0, min_value: fee.min_value ?? 0,
      ...(fee.cod_destination_rates !== undefined ? { cod_destination_rates: validateCodRates(fee.cod_destination_rates, fee.special_service_code) } : {}),
      is_enabled: isCorreosConfigurationOnly(template.special_service_code) ? false : fee.is_enabled }
  })
  return allowNewDefaults ? DEFAULT_STANDARD_SPECIAL_FEES.map(template => validated.find(fee => fee.special_service_code === template.special_service_code) || { ...template }) : validated
}

export function validateClientSpecialFees(input: unknown): ClientSpecialServiceFee[] {
  if (!Array.isArray(input) || input.length > 200) throw new Error("Configuração de taxas do cliente inválida.")
  const seen = new Set<string>()
  return input.map(raw => {
    const fee = raw as ClientSpecialServiceFee
    if (!fee || typeof fee.special_service_code !== "string" || !fee.special_service_code || seen.has(fee.special_service_code)) throw new Error("Existem taxas do cliente inválidas ou repetidas.")
    seen.add(fee.special_service_code)
    if (!["fixed", "percentage"].includes(fee.fee_type) || typeof fee.is_enabled !== "boolean" || fee.use_standard !== undefined && typeof fee.use_standard !== "boolean") throw new Error("Configuração de taxa inválida.")
    if ([fee.fixed_value, fee.percentage_value, fee.min_value].some(value => value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || !Number.isSafeInteger(Math.round(value * 100))))) {
      const name = DEFAULT_STANDARD_SPECIAL_FEES.find(row => row.special_service_code === fee.special_service_code)?.special_service_name || fee.special_service_code
      throw new Error(`A taxa "${name}" deve ter valores numéricos iguais ou superiores a zero. Reveja os suplementos do cliente.`)
    }
    return { ...fee, ...(fee.cod_destination_rates !== undefined ? { cod_destination_rates: validateCodRates(fee.cod_destination_rates, fee.special_service_code, true) } : {}),
      ...(isCorreosConfigurationOnly(fee.special_service_code) ? { is_enabled: false } : {}) }
  })
}
