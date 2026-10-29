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
