/**
 * Server-side shipment price calculator.
 *
 * Resolves the correct sell_price and buy_price for a shipment by:
 *  1. Looking up the client's assigned Linke service table (by default_linke_table_id or pricing_profile)
 *  2. Finding the matching zone (defaults to PT-CONT for domestic)
 *  3. Finding the weight tier that covers the given weight
 *  4. Applying fuel surcharge
 *
 * This is the single source of truth — both the ops form and the client portal
 * must use this to ensure prices stored in the DB are always consistent with
 * the Linke service configuration.
 */

import type { ServicoLinke, PriceTierLinke, ZonePriceMatrix } from "@/app/ops/configuracao/servicos/types"
import type { Cliente } from "@/app/ops/entidades/clientes/types"

export interface PriceResult {
  /** Price charged to the client (Linke's sell price) */
  sellPrice: number
  /** Cost Linke pays to the carrier (partner cost price) */
  buyPrice: number
  /** Human-readable label of the matched tier, e.g. "Até 2 Kg" */
  tierLabel: string
  /** Zone matched, e.g. "Portugal Continental" */
  zoneName: string
  /** Fuel surcharge amount applied */
  fuelSurchargeAmount: number
  /** Name of the Linke service table used */
  tableUsed: string
  /** Whether this result came from the client's specific table or a fallback */
  isFallback: boolean
}

const FALLBACK_SELL_PRICE = 5.50
const FALLBACK_BUY_PRICE = 2.85
const DEFAULT_ZONE = "PT-CONT"

/**
 * Determines the zone code from country code and postal code.
 * PT → PT-CONT (or PT-ILHAS for islands), ES → ES-PENIN, others → INTL
 */
export function resolveZoneCode(countryCode: string = "PT", postalCode?: string): string {
  const country = (countryCode || "PT").toUpperCase()

  if (country === "PT") {
    // Açores (postal codes 9xxx) and Madeira (9xxx) are islands
    if (postalCode && /^9[0-9]{3}/.test(postalCode.replace("-", ""))) {
      return "PT-ILHAS"
    }
    return "PT-CONT"
  }

  if (country === "ES") return "ES-PENIN"
  if (["FR", "DE", "IT", "NL", "BE", "LU"].includes(country)) return "EU-Z1"
  if (["PL", "CZ", "AT", "HU", "RO", "SK", "SI"].includes(country)) return "EU-Z2"
  if (["SE", "DK", "FI", "NO", "GR", "HR", "BG"].includes(country)) return "EU-Z3"
  return "INTL"
}

/**
 * Finds the correct weight tier for a given weight in kg.
 * Tiers are sorted by weight_max ascending; first tier where weightKg <= weight_max wins.
 * The last tier (weight_max: 999) acts as a catch-all.
 */
function findTier(tiers: PriceTierLinke[], weightKg: number): PriceTierLinke | null {
  const enabled = tiers.filter((t) => t.enabled !== false)
  const sorted = [...enabled].sort((a, b) => a.weight_max - b.weight_max)
  return sorted.find((t) => weightKg <= t.weight_max) || sorted[sorted.length - 1] || null
}

/**
 * Finds the best matching zone from a service's zones array.
 * Tries exact match first, then falls back to PT-CONT, then first zone.
 */
function findZone(zones: ZonePriceMatrix[], zoneCode: string): ZonePriceMatrix | null {
  if (!zones || zones.length === 0) return null
  return (
    zones.find((z) => z.zone_code === zoneCode) ||
    zones.find((z) => z.zone_code === DEFAULT_ZONE) ||
    zones[0]
  )
}

/**
 * Resolves which Linke service table to use for a client.
 * Priority:
 *  1. Client's `default_linke_table_id` → exact match in allServicos
 *  2. Client's `assigned_linke_profile` → first table with matching pricing_profile
 *  3. First active Standard table in allServicos
 *  4. First table in allServicos
 */
export function resolveClientTable(
  client: Partial<Cliente>,
  allServicos: ServicoLinke[]
): ServicoLinke | null {
  if (!allServicos || allServicos.length === 0) return null

  const active = allServicos.filter((s) => s.is_active !== false)

  // 1. By explicit assigned table ID
  if (client.default_linke_table_id) {
    const byId = active.find((s) => s.id === client.default_linke_table_id)
    if (byId) return byId
  }

  // 2. By assigned profile
  if (client.assigned_linke_profile) {
    const byProfile = active.find((s) => s.pricing_profile === client.assigned_linke_profile)
    if (byProfile) return byProfile
  }

  // 3. First Standard table
  const standard = active.find((s) => s.pricing_profile === "Standard / Geral")
  if (standard) return standard

  // 4. First available
  return active[0] || null
}

/**
 * Main pricing function — called server-side when creating or pricing a shipment.
 *
 * @param weightKg       - Package weight in kilograms
 * @param client         - Client object (needs default_linke_table_id or assigned_linke_profile)
 * @param allServicos    - All active Linke service tables (from getServicosLinkeAction)
 * @param recipientCountry - Recipient country code (default: "PT")
 * @param recipientPostal  - Recipient postal code (used to distinguish mainland vs islands)
 * @returns PriceResult with sell_price, buy_price, and metadata
 */
export function calculateShipmentPrice(
  weightKg: number,
  client: Partial<Cliente>,
  allServicos: ServicoLinke[],
  recipientCountry: string = "PT",
  recipientPostal?: string
): PriceResult {
  const zoneCode = resolveZoneCode(recipientCountry, recipientPostal)
  const table = resolveClientTable(client, allServicos)

  if (!table) {
    return {
      sellPrice: FALLBACK_SELL_PRICE,
      buyPrice: FALLBACK_BUY_PRICE,
      tierLabel: "Tabela Indisponível",
      zoneName: "Portugal Continental",
      fuelSurchargeAmount: 0,
      tableUsed: "Fallback padrão",
      isFallback: true,
    }
  }

  const zone = findZone(table.zones, zoneCode)

  if (!zone || !zone.tiers || zone.tiers.length === 0) {
    // Zone not found in this table → try PT-CONT as safe fallback
    const fallbackZone = findZone(table.zones, DEFAULT_ZONE)
    if (!fallbackZone) {
      return {
        sellPrice: FALLBACK_SELL_PRICE,
        buyPrice: FALLBACK_BUY_PRICE,
        tierLabel: "Zona não configurada",
        zoneName: zoneCode,
        fuelSurchargeAmount: 0,
        tableUsed: table.name,
        isFallback: true,
      }
    }
    return calculateFromZone(fallbackZone, weightKg, table, true)
  }

  return calculateFromZone(zone, weightKg, table, false)
}

function calculateFromZone(
  zone: ZonePriceMatrix,
  weightKg: number,
  table: ServicoLinke,
  isFallback: boolean
): PriceResult {
  const tier = findTier(zone.tiers, weightKg)

  if (!tier) {
    return {
      sellPrice: FALLBACK_SELL_PRICE,
      buyPrice: FALLBACK_BUY_PRICE,
      tierLabel: "Escalão não encontrado",
      zoneName: zone.zone_name,
      fuelSurchargeAmount: 0,
      tableUsed: table.name,
      isFallback: true,
    }
  }

  const baseSell = Number(tier.sell_price) || Number((tier.cost_price * (1 + (tier.margin_pct || 20) / 100)).toFixed(2))
  const fuelPct = (table.fuel_surcharge_pct || 0) / 100
  const fuelAmount = Number((baseSell * fuelPct).toFixed(2))
  const finalSell = Number((baseSell + fuelAmount).toFixed(2))
  const buyPrice = Number(tier.cost_price) || FALLBACK_BUY_PRICE

  return {
    sellPrice: finalSell,
    buyPrice,
    tierLabel: tier.label,
    zoneName: zone.zone_name,
    fuelSurchargeAmount: fuelAmount,
    tableUsed: table.name,
    isFallback,
  }
}
