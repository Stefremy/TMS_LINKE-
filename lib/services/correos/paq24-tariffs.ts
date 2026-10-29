import type { PriceTierLinke, ServicoLinke, ZonePriceMatrix } from "@/app/ops/configuracao/servicos/types"

// User-provided signed Península Ibérica tariff shared by PAQ24 and ePAQ24.
// Spain: Linke's explicitly requested +€0.90 per shipment, embedded in each
// base bracket. The extra-kg rate remains €0.28: never add €0.90 per extra kg.
const weights = [1, 2, 3, 4, 5, 10, 15, 999]
const costsCents = [340, 345, 350, 360, 367, 400, 420, 28]
export const PAQ24_ZONES = ["PT-CONT", "ES-PENIN"]

export function buildPaq24Zone(zoneCode: string, markupPct = 25, previous?: ZonePriceMatrix): ZonePriceMatrix {
  if (!PAQ24_ZONES.includes(zoneCode)) throw new Error("Destino fora da tarifa PAQ24 peninsular.")
  const tiers: PriceTierLinke[] = (previous?.tiers || []).map(tier => ({ ...tier, enabled: false }))
  for (let i = 0; i < weights.length; i++) {
    const max = weights[i]
    const index = tiers.findIndex(tier => tier.weight_max === max)
    const old = index >= 0 ? previous?.tiers[index] : undefined
    const margin = old?.margin_pct ?? markupPct
    const cost = (costsCents[i] + (zoneCode === "ES-PENIN" && max !== 999 ? 90 : 0)) / 100
    const tier: PriceTierLinke = {
      ...old,
      id: old?.id || `cor_paq24_${zoneCode}_${max}`,
      label: max === 999 ? "Kg Adicional (+15kg)" : `Até ${max} Kg`,
      weight_max: max, cost_price: cost, margin_pct: margin,
      sell_price: Number((cost * (1 + margin / 100)).toFixed(2)),
      delivery_time: "24h", enabled: old?.enabled ?? true,
      display_order: i,
      ...(max === 999 ? { additional_weight_step: 1 } : {}),
    }
    // Keep original storage indexes: client negotiated prices are index-based.
    if (index >= 0) tiers[index] = tier
    else tiers.push(tier)
  }
  for (let i = 0; i < tiers.length; i++) {
    if (!weights.includes(tiers[i].weight_max)) tiers[i].display_order = weights.length + i
  }
  return { ...previous, zone_code: zoneCode,
    zone_name: zoneCode === "ES-PENIN" ? "Espanha Peninsular (+0,90 € de custo por envio)" : "Portugal Continental",
    tiers }
}

export function applyPaq24Tariffs(service: ServicoLinke): ServicoLinke {
  if (!["63", "93"].includes(service.webservice_service_code || "")) throw new Error("Produto diferente de PAQ24/ePAQ24.")
  const zones = (service.zones || []).map(zone => PAQ24_ZONES.includes(zone.zone_code)
    ? buildPaq24Zone(zone.zone_code, service.global_markup_pct, zone) : zone)
  for (const code of PAQ24_ZONES) if (!zones.some(zone => zone.zone_code === code)) {
    zones.push(buildPaq24Zone(code, service.global_markup_pct))
  }
  return { ...service, zones, allowed_zones: [...new Set([...(service.allowed_zones || []), ...PAQ24_ZONES])] }
}
