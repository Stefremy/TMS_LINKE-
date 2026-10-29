import type { ZonePriceMatrix } from "@/app/ops/configuracao/servicos/types"

// User-provided signed tariff, Produtos Ilhas / Ilhas Express (2025).
// Partner costs, not client sell prices. Only the two Baleares columns are enabled.
export const BALEARES_MALLORCA_ZONE = "ES-BALEARES-MAIORCA"
export const BALEARES_MINOR_ZONE = "ES-BALEARES-MENORES"
export const BALEARES_ZONE_NAMES: Record<string, string> = {
  [BALEARES_MALLORCA_ZONE]: "Baleares — Maiorca",
  [BALEARES_MINOR_ZONE]: "Baleares — Ilhas menores (Menorca, Ibiza e Formentera)",
}
const weights = [1, 2, 3, 4, 5, 10, 15, 999]
const costs = {
  [BALEARES_MALLORCA_ZONE]: [9.98, 11.29, 13.23, 14.17, 15.12, 19.89, 24.64, 0.89],
  [BALEARES_MINOR_ZONE]: [10.51, 12.05, 14.21, 15.41, 16.59, 22.52, 29.39, 1.12],
}

/** Full Spanish CP only; 077xx Menorca, 078xx Ibiza/Formentera. */
export function resolveBalearesTariffZone(country: string, postal = ""): string {
  if (country.trim().toUpperCase() !== "ES") return ""
  const cp = postal.trim()
  if (/^07[0-6]\d{2}$/.test(cp)) return BALEARES_MALLORCA_ZONE
  if (/^07[78]\d{2}$/.test(cp)) return BALEARES_MINOR_ZONE
  return ""
}

export function buildBalearesExpressZones(markupPct = 25): ZonePriceMatrix[] {
  return Object.entries(costs).map(([zone_code, values]) => ({
    zone_code, zone_name: BALEARES_ZONE_NAMES[zone_code],
    tiers: weights.map((weight_max, i) => ({
      id: `cor26_${zone_code}_${weight_max}`, weight_max,
      label: weight_max === 999 ? "Kg Adicional (+15kg)" : `Até ${weight_max} Kg`,
      cost_price: values[i], margin_pct: markupPct,
      sell_price: Number((values[i] * (1 + markupPct / 100)).toFixed(2)),
      delivery_time: "2 dias úteis", enabled: true,
      ...(weight_max === 999 ? { additional_weight_step: 1 } : {}),
    })),
  }))
}
