import type { PriceTierLinke } from "@/app/ops/configuracao/servicos/types"

/** Keep storage indexes stable: negotiated customer prices are indexed by tier. */
export function getTierDisplayEntries(tiers: PriceTierLinke[]) {
  return tiers.map((tier, index) => ({ tier, index })).sort((a, b) => {
    const rank = (entry: typeof a) => Number.isFinite(entry.tier.display_order) ? entry.tier.display_order! : entry.index
    return rank(a) - rank(b) || a.index - b.index
  })
}

export function moveTierDisplayOrder(tiers: PriceTierLinke[], fromIndex: number, toIndex: number): PriceTierLinke[] {
  const entries = getTierDisplayEntries(tiers)
  const from = entries.findIndex(entry => entry.index === fromIndex)
  const to = entries.findIndex(entry => entry.index === toIndex)
  if (from < 0 || to < 0 || from === to) return tiers
  const [moved] = entries.splice(from, 1)
  entries.splice(to, 0, moved)
  const positions = new Map(entries.map((entry, index) => [entry.index, index]))
  return tiers.map((tier, index) => ({ ...tier, display_order: positions.get(index)! }))
}


export type ClientTierOrderMap = Record<string, string[]>

export function validateClientTierOrder(value: unknown): ClientTierOrderMap {
  if (value === undefined) return {}
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length > 300) throw new Error("Ordem dos escalões inválida.")
  const result: ClientTierOrderMap = {}
  for (const [key, ids] of Object.entries(value)) {
    if (!key.includes("::") || key.length > 240 || !Array.isArray(ids) || ids.length > 100 || new Set(ids).size !== ids.length
      || ids.some(id => typeof id !== "string" || !id || id.length > 120)) throw new Error("Ordem dos escalões inválida.")
    result[key] = [...ids]
  }
  return result
}

/** Preserve storage indexes and price inheritance; only the editor's display changes. */
export function applyClientTierOrder(tiers: PriceTierLinke[], ids?: string[]): PriceTierLinke[] {
  if (!ids) return tiers
  const ranks = new Map(ids.map((id, index) => [id, index]))
  const fallback = new Map(getTierDisplayEntries(tiers).map((entry, index) => [entry.tier.id, index]))
  return tiers.map(tier => ({ ...tier, display_order: ranks.get(tier.id) ?? ids.length + fallback.get(tier.id)! }))
}
