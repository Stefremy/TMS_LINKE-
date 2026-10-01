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
import { resolveInternationalZone } from "@/lib/services/geo/international-zones"

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
  /** True when the service explicitly blocks this destination zone */
  isBlocked?: boolean
}

const FALLBACK_SELL_PRICE = 5.50
const FALLBACK_BUY_PRICE = 2.85
const DEFAULT_ZONE = "PT-CONT"

/**
 * Determines the zone code from country code and postal code.
 * PT -> PT-CONT (or PT-ILHAS for islands 9xxx)
 * ES -> ES-PENIN (or ES-ILHAS for Baleares 07xxx, Canárias 35xxx/38xxx, Ceuta 51xxx, Melilla 52xxx)
 * EU -> EU 1, EU 2, EU 3
 * World -> NA, SA, O1, O2, A (via Linke official mapping of ~190 countries)
 */
export function resolveZoneCode(countryCode: string = "PT", postalCode?: string): string {
  const country = (countryCode || "PT").toUpperCase().trim()

  if (country === "PT") {
    // Açores (9500-9999) and Madeira (9000-9499)
    if (postalCode) {
      const clean = postalCode.replace(/\D/g, "")
      if (/^9\d{3}/.test(clean)) {
        return "PT-ILHAS"
      }
    }
    return "PT-CONT"
  }

  if (country === "ES") {
    // Baleares (07xxx), Las Palmas (35xxx), Santa Cruz de Tenerife (38xxx), Ceuta (51xxx), Melilla (52xxx)
    if (postalCode) {
      const clean = postalCode.replace(/\D/g, "").padStart(5, "0")
      if (/^(07|35|38|51|52)/.test(clean)) {
        return "ES-ILHAS"
      }
    }
    return "ES-PENIN"
  }

  // Resolves official Linke international zones (EU 1, EU 2, EU 3, NA, SA, O1, O2, A)
  const intlZone = resolveInternationalZone(country)
  if (intlZone) return intlZone

  if (["FR", "DE", "IT", "NL", "BE", "LU", "MC"].includes(country)) return "EU 1"
  if (["PL", "CZ", "AT", "HU", "RO", "SK", "SI", "IE"].includes(country)) return "EU 2"
  if (["SE", "DK", "FI", "NO", "GR", "HR", "BG", "EE", "LV", "LT"].includes(country)) return "EU 3"

  return "INTL"
}

/**
 * Checks if a destination zone code is authorized by a service's allowed_zones list.
 * If allowed_zones is empty or undefined, all zones are permitted (legacy behavior).
 */
export function isZoneAllowedByService(allowedZones: string[] | undefined, zoneCode: string): boolean {
  if (!allowedZones || allowedZones.length === 0) return true
  if (allowedZones.includes(zoneCode)) return true

  // Equivalences between official Linke codes and legacy codes:
  if (zoneCode === "EU 1" && (allowedZones.includes("EU-Z1") || allowedZones.includes("EU 1"))) return true
  if (zoneCode === "EU-Z1" && (allowedZones.includes("EU 1") || allowedZones.includes("EU-Z1"))) return true
  if (zoneCode === "EU 2" && (allowedZones.includes("EU-Z2") || allowedZones.includes("EU 2"))) return true
  if (zoneCode === "EU-Z2" && (allowedZones.includes("EU 2") || allowedZones.includes("EU-Z2"))) return true
  if (zoneCode === "EU 3" && (allowedZones.includes("EU-Z3") || allowedZones.includes("EU 3"))) return true
  if (zoneCode === "EU-Z3" && (allowedZones.includes("EU 3") || allowedZones.includes("EU-Z3"))) return true

  // Specific allowances:
  // INTL allowed by INTL-AERO or INTL-MAR or INTL or world zones
  if (["INTL", "NA", "SA", "O1", "O2", "A"].includes(zoneCode) && (allowedZones.includes("INTL-AERO") || allowedZones.includes("INTL-MAR") || allowedZones.includes("INTL"))) {
    return true
  }
  // ES-ILHAS (Baleares / Canárias) allowed by INTL-MAR if maritime table
  if (zoneCode === "ES-ILHAS" && (allowedZones.includes("ES-ILHAS") || allowedZones.includes("INTL-MAR"))) {
    return true
  }
  // PT-ILHAS (Açores / Madeira) allowed by INTL-MAR if maritime table
  if (zoneCode === "PT-ILHAS" && (allowedZones.includes("PT-ILHAS") || allowedZones.includes("INTL-MAR"))) {
    return true
  }
  // EU zones allowed if INTL-AERO or INTL is enabled on table
  if ((zoneCode.startsWith("EU") || ["EU 1", "EU 2", "EU 3"].includes(zoneCode)) && (allowedZones.includes("INTL-AERO") || allowedZones.includes("INTL"))) {
    return true
  }

  return false
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
 * Finds the exact matching zone from a service's zones array by zone_code.
 */
function findExactZone(zones: ZonePriceMatrix[], zoneCode: string): ZonePriceMatrix | null {
  if (!zones || zones.length === 0) return null
  return zones.find((z) => z.zone_code === zoneCode) || null
}

/**
 * Resolves which Linke service table to use for a client.
 * Priority:
 *  1. Client's `default_linke_table_id` -> exact match in allServicos
 *  2. Client's `assigned_linke_profile` -> first table with matching pricing_profile
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

// Fallback baseline costs for non-continental shipments when no tariff table exists
const ES_FALLBACK_SELL = 8.50
const ES_FALLBACK_BUY = 5.20
const ILHAS_FALLBACK_SELL = 12.50
const ILHAS_FALLBACK_BUY = 7.80
const INTL_FALLBACK_SELL = 16.00
const INTL_FALLBACK_BUY = 10.50

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
  const clientTable = resolveClientTable(client, allServicos)

  // 1. Try to find the zone in the client's assigned table, verifying allowed_zones
  let effectiveTable: ServicoLinke | null = null
  let zone: ZonePriceMatrix | null = null
  let isDifferentTable = false

  if (clientTable && isZoneAllowedByService(clientTable.allowed_zones, zoneCode)) {
    zone = findExactZone(clientTable.zones, zoneCode)
    if (zone && zone.tiers && zone.tiers.length > 0) {
      effectiveTable = clientTable
    }
  }

  // 2. If client table doesn't cover this zone, search all active tables that allow this zone
  if ((!zone || !zone.tiers || zone.tiers.length === 0) && allServicos && allServicos.length > 0) {
    const alternativeTable = allServicos.find(
      (s) =>
        s.is_active !== false &&
        isZoneAllowedByService(s.allowed_zones, zoneCode) &&
        s.zones?.some((z) => (z.zone_code === zoneCode || (zoneCode.startsWith("EU-") && z.zone_code.startsWith("EU-"))) && z.tiers?.length > 0)
    )
    if (alternativeTable) {
      effectiveTable = alternativeTable
      zone = findExactZone(alternativeTable.zones, zoneCode) ||
             (zoneCode.startsWith("EU-") ? alternativeTable.zones.find((z) => z.zone_code.startsWith("EU-")) : null) || null
      isDifferentTable = true
    }
  }

  // 3. If no allowed table found at all, check if blocked by configuration
  if (!effectiveTable || !zone || !zone.tiers || zone.tiers.length === 0) {
    const isExplicitlyBlocked = clientTable?.allowed_zones && clientTable.allowed_zones.length > 0 && !isZoneAllowedByService(clientTable.allowed_zones, zoneCode)
    if (isExplicitlyBlocked) {
      return {
        sellPrice: 0,
        buyPrice: 0,
        tierLabel: `Destino Bloqueado (${zoneCode})`,
        zoneName: zoneCode,
        fuelSurchargeAmount: 0,
        tableUsed: clientTable.name,
        isFallback: false,
        isBlocked: true,
      }
    }
  }

  // 3. If exact zone is found with valid tiers, calculate price
  if (zone && zone.tiers && zone.tiers.length > 0 && effectiveTable) {
    return calculateFromZone(zone, weightKg, effectiveTable, client, isDifferentTable)
  }

  // 4. Zone NOT found in any configured table:
  // If mainland Portugal (PT-CONT), fallback to standard continental defaults
  if (zoneCode === DEFAULT_ZONE) {
    if (effectiveTable) {
      const fallbackZone = findExactZone(effectiveTable.zones, DEFAULT_ZONE)
      if (fallbackZone && fallbackZone.tiers?.length) {
        return calculateFromZone(fallbackZone, weightKg, effectiveTable, client, true)
      }
    }
    return {
      sellPrice: FALLBACK_SELL_PRICE,
      buyPrice: FALLBACK_BUY_PRICE,
      tierLabel: "Fallback Continental",
      zoneName: "Portugal Continental",
      fuelSurchargeAmount: 0,
      tableUsed: effectiveTable?.name || "Fallback padrão",
      isFallback: true,
    }
  }

  // 5. For Islands, Spain or International: NEVER silently charge continental prices!
  // Return explicit, cost-covering fallback rates flagged with isFallback = true.
  const isIsland = zoneCode === "PT-ILHAS"
  const isSpain = zoneCode === "ES-PENIN"
  const sellPrice = isIsland ? ILHAS_FALLBACK_SELL : isSpain ? ES_FALLBACK_SELL : INTL_FALLBACK_SELL
  const buyPrice = isIsland ? ILHAS_FALLBACK_BUY : isSpain ? ES_FALLBACK_BUY : INTL_FALLBACK_BUY

  return {
    sellPrice,
    buyPrice,
    tierLabel: `Zona ${zoneCode} não configurada`,
    zoneName: isIsland ? "Ilhas (Açores/Madeira)" : isSpain ? "Espanha Peninsular" : `Internacional (${zoneCode})`,
    fuelSurchargeAmount: 0,
    tableUsed: effectiveTable?.name || "Sem tabela compatível",
    isFallback: true,
  }
}

function calculateFromZone(
  zone: ZonePriceMatrix,
  weightKg: number,
  table: ServicoLinke,
  client: Partial<Cliente>,
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
  const fuelPct = (table.fuel_surcharge_pct ?? (client as any).pricing?.fuel_surcharge_pct ?? 12.5) / 100
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
