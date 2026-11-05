import type { PriceTierLinke } from "@/app/ops/configuracao/servicos/types"

/** Client sale prices only; carrier costs continue to come from the contracted table. */
export type ClientWeightTier = Pick<PriceTierLinke, "id" | "label" | "weight_max" | "sell_price" | "additional_weight_step">
export type ClientWeightTierMap = Record<string, ClientWeightTier[]>

export function validateClientWeightTiers(value: unknown): ClientWeightTierMap {
  if (value === undefined) return {}
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > 300) {
    throw new Error("Escalões personalizados inválidos.")
  }
  const result: ClientWeightTierMap = {}
  for (const [key, rows] of Object.entries(value)) {
    if (!key.includes("::") || key.length > 240 || !Array.isArray(rows) || !rows.length || rows.length > 100) {
      throw new Error("Cada zona deve ter entre 1 e 100 escalões.")
    }
    const ids = new Set<string>(), weights = new Set<number>()
    result[key] = rows.map(row => {
      if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id || row.id.length > 120 || ids.has(row.id)
        || typeof row.label !== "string" || !row.label.trim() || row.label.length > 120
        || typeof row.weight_max !== "number" || !Number.isFinite(row.weight_max) || row.weight_max <= 0 || row.weight_max > 999 || weights.has(row.weight_max)
        || typeof row.sell_price !== "number" || !Number.isFinite(row.sell_price) || row.sell_price <= 0 || !Number.isSafeInteger(Math.round(row.sell_price * 100))
        || row.additional_weight_step !== undefined && (typeof row.additional_weight_step !== "number" || !Number.isFinite(row.additional_weight_step) || row.additional_weight_step <= 0)) {
        throw new Error("Indique um nome, um peso único entre 0 e 999 kg e um preço superior a zero para cada escalão.")
      }
      ids.add(row.id); weights.add(row.weight_max)
      return { id: row.id, label: row.label.trim(), weight_max: row.weight_max, sell_price: row.sell_price,
        ...(row.additional_weight_step !== undefined ? { additional_weight_step: row.additional_weight_step } : {}) }
    })
    if (!rows.some(row => row.weight_max < 999)) throw new Error("Mantenha pelo menos um escalão de peso fixo antes dos quilos adicionais.")
  }
  return result
}

export function materializeClientWeightTiers(base: PriceTierLinke[], prices?: number[]): ClientWeightTier[] {
  return base.flatMap((tier, index) => tier.enabled === false ? [] : [{ id: tier.id, label: tier.label,
    weight_max: tier.weight_max, sell_price: prices?.[index] ?? tier.sell_price,
    ...(tier.additional_weight_step !== undefined ? { additional_weight_step: tier.additional_weight_step }
      : tier.id?.startsWith("intl_") && tier.id.endsWith("_extra") && base.some(row => row.enabled !== false && row.weight_max === 10.5) ? { additional_weight_step: 0.5 } : {}) }])
}

export function clientWeightTierPrice(rows: ClientWeightTier[], weight: number): { price: number; label: string } {
  const tiers = Object.values(validateClientWeightTiers({ "service::zone": rows }))[0].sort((a, b) => a.weight_max - b.weight_max)
  const tier = tiers.find(row => weight <= row.weight_max)
  if (!Number.isFinite(weight) || weight <= 0 || !tier) throw new Error("Não existe um escalão personalizado para este peso. Reveja a tabela do cliente.")
  let price = tier.sell_price
  if (tier.weight_max === 999) {
    const anchor = tiers.filter(row => row.weight_max < 999).at(-1)!
    const step = tier.additional_weight_step ?? 1
    price = anchor.sell_price + Math.ceil((weight - anchor.weight_max) / step) * step * price
  }
  return { price: Number(price.toFixed(2)), label: tier.label }
}

/** Reference amounts at a client threshold, including carrier additional kilograms. */
export function clientTierReference(base: PriceTierLinke[], max: number): { cost: number; standard: number } | undefined {
  const tiers = base.filter(tier => tier.enabled !== false).sort((a, b) => a.weight_max - b.weight_max)
  const tier = tiers.find(row => max <= row.weight_max)
  if (!tier) return undefined
  if (tier.weight_max !== 999 || max === 999) return { cost: tier.cost_price, standard: tier.sell_price }
  const anchor = tiers.filter(row => row.weight_max < 999).at(-1)
  if (!anchor) return undefined
  const step = tier.additional_weight_step ?? (tier.id?.startsWith("intl_") && tier.id.endsWith("_extra") && anchor.weight_max === 10.5 ? 0.5 : 1)
  const extra = Math.ceil((max - anchor.weight_max) / step) * step
  return { cost: Number((anchor.cost_price + extra * tier.cost_price).toFixed(2)), standard: Number((anchor.sell_price + extra * tier.sell_price).toFixed(2)) }
}
