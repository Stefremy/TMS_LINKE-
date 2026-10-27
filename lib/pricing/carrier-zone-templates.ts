import type { PriceTierLinke, ServicoLinke, ZonePriceMatrix } from "@/app/ops/configuracao/servicos/types"
import { PRIMORDIAL_SERVICE_CODES } from "@/app/ops/configuracao/servicos/types"
import {
  buildOfficialCeTruckZones,
  buildOfficialLinkeInternationalZones,
} from "@/lib/services/geo/international-zones"

/**
 * Normalizes legacy or variant zone codes into the canonical tariff `zone_code`
 * expected by `resolveServiceZoneCode` and `findExactZone`.
 */
export function normalizeServiceZoneCode(rawCode?: string | null): string {
  const clean = (rawCode || "").trim()
  if (!clean) return ""
  const upper = clean.toUpperCase()
  if (upper === "PT-ACORES" || upper === "PT-MADEIRA" || upper === "PT-ILHAS") return "PT-ILHAS"
  if (upper === "PT-CONT") return "PT-CONT"
  if (upper === "ES-PENIN") return "ES-PENIN"
  if (upper === "ES-ILHAS") return "ES-ILHAS"
  if (upper === "EU-Z1" || upper === "EU-1" || upper === "EU 1") return "EU 1"
  if (upper === "EU-Z2" || upper === "EU-2" || upper === "EU 2") return "EU 2"
  if (upper === "EU-Z3" || upper === "EU-3" || upper === "EU 3") return "EU 3"
  if (clean === "Zona 2" || upper === "ZONA 2") return "Zona 2"
  if (clean === "Zona 3" || upper === "ZONA 3") return "Zona 3"
  if (["NA", "SA", "O1", "O2", "A", "INTL", "INTL-AERO", "INTL-MAR", "PT-PONTO"].includes(upper)) {
    return upper
  }
  return clean
}

export const ZONE_DISPLAY_NAMES: Record<string, string> = {
  "PT-CONT": "Portugal Continental",
  "PT-ILHAS": "PT — Ilhas Açores & Madeira",
  "ES-PENIN": "Espanha Peninsular",
  "ES-ILHAS": "Espanha — Ilhas Baleares & Canárias",
  "Zona 2": "Zona 2 — Europa Rodoviário (Guia CE)",
  "Zona 3": "Zona 3 — Europa Rodoviário (Guia CE)",
  "EU 1": "Europa 1 (Ocidental & Central)",
  "EU 2": "Europa 2 (Leste & Bálcãs)",
  "EU 3": "Europa 3 (EFTA & Mediterrâneo)",
  "NA": "América do Norte",
  "SA": "América do Sul & Central",
  "O1": "Oriente 1 (Ásia Pacífico Z1 & Egito)",
  "O2": "Oriente 2 (Médio Oriente, Índia, Oceania & China)",
  "A": "África & Resto do Mundo",
  "INTL-AERO": "Internacional Aéreo",
  "INTL-MAR": "Internacional Marítimo",
  "INTL": "Internacional Geral",
}

/** Concrete zone codes that require an explicit `ZonePriceMatrix` in `service.zones`. */
export const CONCRETE_TARIFF_ZONE_CODES = new Set([
  "PT-CONT",
  "PT-ILHAS",
  "ES-PENIN",
  "ES-ILHAS",
  "Zona 2",
  "Zona 3",
  "EU 1",
  "EU 2",
  "EU 3",
  "NA",
  "SA",
  "O1",
  "O2",
  "A",
])

interface RawTierSpec {
  label: string
  weight_max: number
  cost_price: number
  default_margin_pct: number
  delivery_time: string
  additional_weight_step?: number
}

function materializeTiers(
  prefix: string,
  specs: RawTierSpec[],
  markupPctOverride?: number,
  transitTimeOverride?: string
): PriceTierLinke[] {
  const stamp = Date.now()
  return specs.map((spec, idx) => {
    const margin = Number.isFinite(markupPctOverride) ? Number(markupPctOverride) : spec.default_margin_pct
    const sell = Number((spec.cost_price * (1 + margin / 100)).toFixed(2))
    return {
      id: `${prefix}_${stamp}_${idx}`,
      label: spec.label,
      weight_max: spec.weight_max,
      cost_price: spec.cost_price,
      margin_pct: margin,
      sell_price: sell,
      delivery_time: transitTimeOverride || spec.delivery_time,
      enabled: true,
      ...(spec.additional_weight_step ? { additional_weight_step: spec.additional_weight_step } : {}),
    }
  })
}

// ─── Official CTT Contract Tier Specs ─────────────────────────────────────────
const CTT_DD_PT_CONT: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 2.96, default_margin_pct: 25, delivery_time: "24h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 3.15, default_margin_pct: 25, delivery_time: "24h" },
  { label: "Até 10 Kg", weight_max: 10, cost_price: 3.47, default_margin_pct: 25, delivery_time: "24h" },
  { label: "Até 15 Kg", weight_max: 15, cost_price: 4.21, default_margin_pct: 25, delivery_time: "24h" },
  { label: "Até 20 Kg", weight_max: 20, cost_price: 4.95, default_margin_pct: 25, delivery_time: "24h" },
  { label: "Até 25 Kg", weight_max: 25, cost_price: 5.78, default_margin_pct: 25, delivery_time: "24h" },
  { label: "Até 30 Kg", weight_max: 30, cost_price: 6.54, default_margin_pct: 25, delivery_time: "24h" },
  { label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.21, default_margin_pct: 25, delivery_time: "24h" },
]

const CTT_DD_PT_ILHAS: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 10.33, default_margin_pct: 25, delivery_time: "48-72h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 16.78, default_margin_pct: 25, delivery_time: "48-72h" },
  { label: "Kg Adicional (+5kg)", weight_max: 999, cost_price: 2.51, default_margin_pct: 25, delivery_time: "48-72h" },
]

const CTT_DD_ES_PENIN: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 3.26, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 4.05, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Até 10 Kg", weight_max: 10, cost_price: 5.14, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Até 15 Kg", weight_max: 15, cost_price: 6.12, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Até 20 Kg", weight_max: 20, cost_price: 7.80, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Até 25 Kg", weight_max: 25, cost_price: 8.50, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Até 30 Kg", weight_max: 30, cost_price: 9.82, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.34, default_margin_pct: 25, delivery_time: "24-48h" },
]

const CTT_DB_PT_CONT: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 2.81, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 3.09, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Até 10 Kg", weight_max: 10, cost_price: 3.40, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Até 15 Kg", weight_max: 15, cost_price: 4.13, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Até 20 Kg", weight_max: 20, cost_price: 4.85, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Até 25 Kg", weight_max: 25, cost_price: 5.66, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Até 30 Kg", weight_max: 30, cost_price: 6.41, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.20, default_margin_pct: 25, delivery_time: "48h" },
]

const CTT_DB_PT_ILHAS: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 5.42, default_margin_pct: 20, delivery_time: "72-96h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 7.55, default_margin_pct: 20, delivery_time: "72-96h" },
  { label: "Até 10 Kg", weight_max: 10, cost_price: 9.23, default_margin_pct: 20, delivery_time: "72-96h" },
  { label: "Até 15 Kg", weight_max: 15, cost_price: 13.09, default_margin_pct: 20, delivery_time: "72-96h" },
  { label: "Até 20 Kg", weight_max: 20, cost_price: 16.88, default_margin_pct: 20, delivery_time: "72-96h" },
  { label: "Até 25 Kg", weight_max: 25, cost_price: 20.78, default_margin_pct: 20, delivery_time: "72-96h" },
  { label: "Até 30 Kg", weight_max: 30, cost_price: 24.69, default_margin_pct: 20, delivery_time: "72-96h" },
  { label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 1.13, default_margin_pct: 20, delivery_time: "72-96h" },
]

const CTT_DB_ES_PENIN: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 3.19, default_margin_pct: 28, delivery_time: "48-72h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 3.97, default_margin_pct: 28, delivery_time: "48-72h" },
  { label: "Até 10 Kg", weight_max: 10, cost_price: 5.03, default_margin_pct: 28, delivery_time: "48-72h" },
  { label: "Até 15 Kg", weight_max: 15, cost_price: 6.00, default_margin_pct: 28, delivery_time: "48-72h" },
  { label: "Até 20 Kg", weight_max: 20, cost_price: 7.64, default_margin_pct: 28, delivery_time: "48-72h" },
  { label: "Até 25 Kg", weight_max: 25, cost_price: 8.32, default_margin_pct: 28, delivery_time: "48-72h" },
  { label: "Até 30 Kg", weight_max: 30, cost_price: 9.62, default_margin_pct: 28, delivery_time: "48-72h" },
  { label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.34, default_margin_pct: 28, delivery_time: "48-72h" },
]

const CTT_EQ_PT_CONT: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 2.71, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 2.98, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Até 10 Kg", weight_max: 10, cost_price: 3.28, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Até 15 Kg", weight_max: 15, cost_price: 3.98, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Até 20 Kg", weight_max: 20, cost_price: 4.68, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Até 25 Kg", weight_max: 25, cost_price: 5.46, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Até 30 Kg", weight_max: 30, cost_price: 6.19, default_margin_pct: 25, delivery_time: "48h" },
  { label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.20, default_margin_pct: 25, delivery_time: "48h" },
]

const CTT_MULT_PT_CONT: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 2.85, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 3.04, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Até 10 Kg", weight_max: 10, cost_price: 3.35, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Até 15 Kg", weight_max: 15, cost_price: 4.06, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Até 20 Kg", weight_max: 20, cost_price: 4.78, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Até 25 Kg", weight_max: 25, cost_price: 5.58, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Até 30 Kg", weight_max: 30, cost_price: 6.32, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.21, default_margin_pct: 22, delivery_time: "24h" },
]

// ─── Official Correos Express Contract Tier Specs ─────────────────────────────
const COR_24_PT_CONT: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 2.85, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Até 2 Kg", weight_max: 2, cost_price: 3.15, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 3.75, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Até 10 Kg", weight_max: 10, cost_price: 4.60, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Até 15 Kg", weight_max: 15, cost_price: 5.40, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Até 20 Kg", weight_max: 20, cost_price: 6.20, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Até 30 Kg", weight_max: 30, cost_price: 7.90, default_margin_pct: 22, delivery_time: "24h" },
  { label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.28, default_margin_pct: 22, delivery_time: "24h" },
]

const COR_24_ES_PENIN: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 4.20, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Até 2 Kg", weight_max: 2, cost_price: 4.80, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 5.90, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Até 10 Kg", weight_max: 10, cost_price: 7.50, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Até 15 Kg", weight_max: 15, cost_price: 9.35, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Até 20 Kg", weight_max: 20, cost_price: 11.20, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Até 30 Kg", weight_max: 30, cost_price: 14.90, default_margin_pct: 25, delivery_time: "24-48h" },
  { label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.45, default_margin_pct: 25, delivery_time: "24-48h" },
]

const COR_48_PT_CONT: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 2.65, default_margin_pct: 22, delivery_time: "48h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 3.40, default_margin_pct: 22, delivery_time: "48h" },
  { label: "Até 10 Kg", weight_max: 10, cost_price: 4.15, default_margin_pct: 22, delivery_time: "48h" },
  { label: "Até 20 Kg", weight_max: 20, cost_price: 5.60, default_margin_pct: 22, delivery_time: "48h" },
  { label: "Até 30 Kg", weight_max: 30, cost_price: 7.10, default_margin_pct: 22, delivery_time: "48h" },
  { label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.25, default_margin_pct: 22, delivery_time: "48h" },
]

const COR_48_ES_PENIN: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 3.90, default_margin_pct: 25, delivery_time: "48-72h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 5.20, default_margin_pct: 25, delivery_time: "48-72h" },
  { label: "Até 10 Kg", weight_max: 10, cost_price: 6.80, default_margin_pct: 25, delivery_time: "48-72h" },
  { label: "Até 20 Kg", weight_max: 20, cost_price: 9.90, default_margin_pct: 25, delivery_time: "48-72h" },
  { label: "Até 30 Kg", weight_max: 30, cost_price: 13.50, default_margin_pct: 25, delivery_time: "48-72h" },
  { label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.40, default_margin_pct: 25, delivery_time: "48-72h" },
]

const COR_ECOM_PT_CONT: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 2.75, default_margin_pct: 25, delivery_time: "24h" },
  { label: "Até 2 Kg", weight_max: 2, cost_price: 3.05, default_margin_pct: 25, delivery_time: "24h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 3.60, default_margin_pct: 25, delivery_time: "24h" },
  { label: "Até 10 Kg", weight_max: 10, cost_price: 4.40, default_margin_pct: 25, delivery_time: "24h" },
  { label: "Até 20 Kg", weight_max: 20, cost_price: 5.95, default_margin_pct: 25, delivery_time: "24h" },
  { label: "Até 30 Kg", weight_max: 30, cost_price: 7.60, default_margin_pct: 25, delivery_time: "24h" },
  { label: "Kg Adicional (+30kg)", weight_max: 999, cost_price: 0.26, default_margin_pct: 25, delivery_time: "24h" },
]

const COR_ISLAS_ES_ILHAS: RawTierSpec[] = [
  { label: "Até 1 Kg", weight_max: 1, cost_price: 8.90, default_margin_pct: 25, delivery_time: "48-72h" },
  { label: "Até 2 Kg", weight_max: 2, cost_price: 11.50, default_margin_pct: 25, delivery_time: "48-72h" },
  { label: "Até 5 Kg", weight_max: 5, cost_price: 16.80, default_margin_pct: 25, delivery_time: "48-72h" },
  { label: "Até 10 Kg", weight_max: 10, cost_price: 24.50, default_margin_pct: 25, delivery_time: "48-72h" },
  { label: "Kg Adicional (+10kg)", weight_max: 999, cost_price: 1.80, default_margin_pct: 25, delivery_time: "48-72h" },
]

export interface CarrierSubproductPreset {
  carrier: "ctt" | "correos"
  wsCode: string
  codePrefix: string
  shortTitle: string
  subtitle: string
  category: ServicoLinke["category"]
  transitTimeLabel: string
  fuelSurchargePct: number
  defaultMarkupPct: number
  defaultZones: string[]
}

export const CARRIER_SUBPRODUCT_PRESETS: CarrierSubproductPreset[] = [
  // CTT Expresso
  {
    carrier: "ctt",
    wsCode: "EMSF056.01",
    codePrefix: "LK-DD",
    shortTitle: "24H Encomenda (Guia DD)",
    subtitle: "PT Continental + Ilhas + Espanha Peninsular",
    category: "Nacional",
    transitTimeLabel: "24h",
    fuelSurchargePct: 12.5,
    defaultMarkupPct: 25,
    defaultZones: ["PT-CONT", "PT-ILHAS", "ES-PENIN"],
  },
  {
    carrier: "ctt",
    wsCode: "EMSF057.01",
    codePrefix: "LK-DB",
    shortTitle: "48H Encomenda (Guia DB)",
    subtitle: "PT Continental + Ilhas + Espanha Peninsular",
    category: "Nacional",
    transitTimeLabel: "48h",
    fuelSurchargePct: 12.5,
    defaultMarkupPct: 25,
    defaultZones: ["PT-CONT", "PT-ILHAS", "ES-PENIN"],
  },
  {
    carrier: "ctt",
    wsCode: "ENCF008.01",
    codePrefix: "LK-EQ",
    shortTitle: "Económico 48 (Guia EQ)",
    subtitle: "Portugal Continental económico",
    category: "Nacional",
    transitTimeLabel: "48h",
    fuelSurchargePct: 12.5,
    defaultMarkupPct: 25,
    defaultZones: ["PT-CONT"],
  },
  {
    carrier: "ctt",
    wsCode: "EMSF010.01",
    codePrefix: "LK-MULT",
    shortTitle: "19 Múltiplo (Guia EG)",
    subtitle: "Portugal Continental multi-volumes (10+)",
    category: "Nacional",
    transitTimeLabel: "24h",
    fuelSurchargePct: 12.5,
    defaultMarkupPct: 22,
    defaultZones: ["PT-CONT"],
  },
  {
    carrier: "ctt",
    wsCode: "EMSF001.02",
    codePrefix: "LK-EU",
    shortTitle: "EMS Internacional (Guia EE)",
    subtitle: "Exportação aérea mundial (8 zonas)",
    category: "Internacional",
    transitTimeLabel: "3-7 dias úteis",
    fuelSurchargePct: 8.5,
    defaultMarkupPct: 22,
    defaultZones: ["EU 1", "EU 2", "EU 3", "NA", "SA", "O1", "O2", "A"],
  },
  {
    carrier: "ctt",
    wsCode: "ENCF008.02",
    codePrefix: "LK-CE",
    shortTitle: "EMS Economy (Guia CE)",
    subtitle: "Europa rodoviário (Zona 2 + Zona 3)",
    category: "Internacional",
    transitTimeLabel: "3-5 dias úteis",
    fuelSurchargePct: 8.5,
    defaultMarkupPct: 15,
    defaultZones: ["Zona 2", "Zona 3"],
  },

  // Correos Express
  {
    carrier: "correos",
    wsCode: "61",
    codePrefix: "LK-COR24",
    shortTitle: "Paq 24 (Ibérico)",
    subtitle: "PT Continental + Espanha Peninsular (24h)",
    category: "Ibérico",
    transitTimeLabel: "24h",
    fuelSurchargePct: 11.5,
    defaultMarkupPct: 22,
    defaultZones: ["PT-CONT", "ES-PENIN"],
  },
  {
    carrier: "correos",
    wsCode: "62",
    codePrefix: "LK-COR48",
    shortTitle: "Paq 48 (Ibérico)",
    subtitle: "PT Continental + Espanha Peninsular (48h)",
    category: "Ibérico",
    transitTimeLabel: "48h",
    fuelSurchargePct: 11.5,
    defaultMarkupPct: 22,
    defaultZones: ["PT-CONT", "ES-PENIN"],
  },
  {
    carrier: "correos",
    wsCode: "93",
    codePrefix: "LK-COR",
    shortTitle: "e-Paq 24 B2C",
    subtitle: "Portugal Continental B2C com SMS/Email",
    category: "Nacional",
    transitTimeLabel: "24h",
    fuelSurchargePct: 11.5,
    defaultMarkupPct: 25,
    defaultZones: ["PT-CONT"],
  },
  {
    carrier: "correos",
    wsCode: "63",
    codePrefix: "LK-COR",
    shortTitle: "E-Paq 24 (E-Commerce)",
    subtitle: "Portugal Continental B2C / E-Commerce",
    category: "Nacional",
    transitTimeLabel: "24h",
    fuelSurchargePct: 11.5,
    defaultMarkupPct: 25,
    defaultZones: ["PT-CONT"],
  },
  {
    carrier: "correos",
    wsCode: "66",
    codePrefix: "LK-CORIS",
    shortTitle: "Ilhas Espanholas (Baleares)",
    subtitle: "Ilhas Baleares & Canárias (ES-ILHAS)",
    category: "Ilhas",
    transitTimeLabel: "48-72h",
    fuelSurchargePct: 12.0,
    defaultMarkupPct: 25,
    defaultZones: ["ES-ILHAS"],
  },
  {
    carrier: "correos",
    wsCode: "90",
    codePrefix: "LK-CORINT",
    shortTitle: "Internacional Express",
    subtitle: "Exportação aérea mundial (8 zonas oficiais)",
    category: "Internacional",
    transitTimeLabel: "3-7 dias úteis",
    fuelSurchargePct: 8.5,
    defaultMarkupPct: 22,
    defaultZones: ["EU 1", "EU 2", "EU 3", "NA", "SA", "O1", "O2", "A"],
  },
]

export function getCarrierSubproductPreset(
  carrier: "ctt" | "correos",
  wsCode?: string
): CarrierSubproductPreset | null {
  const code = (wsCode || "").trim()
  return (
    CARRIER_SUBPRODUCT_PRESETS.find((p) => p.carrier === carrier && p.wsCode === code) ||
    CARRIER_SUBPRODUCT_PRESETS.find((p) => p.wsCode === code) ||
    null
  )
}

/**
 * Generates an official contract `ZonePriceMatrix` for any `(carrier, wsCode, zoneCode)` combination
 * so adding or enabling a destination zone always starts with real contracted partner costs.
 */
export function buildContractZoneMatrix(options: {
  carrier: "ctt" | "correos"
  wsCode?: string
  zoneCode: string
  markupPct?: number
  zoneNameOverride?: string
}): ZonePriceMatrix {
  const canonicalCode = normalizeServiceZoneCode(options.zoneCode)
  const ws = (options.wsCode || "").trim()
  const zoneName = options.zoneNameOverride || ZONE_DISPLAY_NAMES[canonicalCode] || canonicalCode

  // 1. CTT Europa Terrestre (Guia CE · Zona 2 / Zona 3)
  if (canonicalCode === "Zona 2" || canonicalCode === "Zona 3") {
    const ceZone = buildOfficialCeTruckZones().find((z) => z.zone_code === canonicalCode)
    if (ceZone) {
      return {
        zone_code: canonicalCode,
        zone_name: options.zoneNameOverride || ceZone.zone_name,
        tiers: ceZone.tiers.map((t, idx) => ({
          ...t,
          id: `ce_${canonicalCode.replace(/\s+/g, "").toLowerCase()}_${Date.now()}_${idx}`,
        })),
      }
    }
  }

  // 2. Official 8 International Air Zones (EU 1..3, NA, SA, O1, O2, A)
  if (["EU 1", "EU 2", "EU 3", "NA", "SA", "O1", "O2", "A"].includes(canonicalCode)) {
    const markup = Number.isFinite(options.markupPct) ? Number(options.markupPct) : 22
    const intlZone = buildOfficialLinkeInternationalZones(markup).find((z) => z.zone_code === canonicalCode)
    if (intlZone) {
      return {
        zone_code: canonicalCode,
        zone_name: options.zoneNameOverride || intlZone.zone_name,
        tiers: intlZone.tiers.map((t, idx) => ({
          ...t,
          id: `intl_${canonicalCode.replace(/\s+/g, "").toLowerCase()}_${Date.now()}_${idx}`,
        })),
      }
    }
  }

  // 3. PT-CONT, PT-ILHAS, ES-PENIN, ES-ILHAS by carrier + subproduct
  if (canonicalCode === "PT-CONT") {
    const specs =
      options.carrier === "correos"
        ? ws === "62"
          ? COR_48_PT_CONT
          : ws === "93" || ws === "63"
          ? COR_ECOM_PT_CONT
          : COR_24_PT_CONT
        : ws === "EMSF057.01"
        ? CTT_DB_PT_CONT
        : ws === "ENCF008.01"
        ? CTT_EQ_PT_CONT
        : ws === "EMSF010.01"
        ? CTT_MULT_PT_CONT
        : CTT_DD_PT_CONT
    return {
      zone_code: "PT-CONT",
      zone_name: zoneName,
      tiers: materializeTiers("ptc", specs, options.markupPct),
    }
  }

  if (canonicalCode === "PT-ILHAS") {
    const specs = ws === "EMSF056.01" ? CTT_DD_PT_ILHAS : CTT_DB_PT_ILHAS
    return {
      zone_code: "PT-ILHAS",
      zone_name: zoneName,
      tiers: materializeTiers("pti", specs, options.markupPct),
    }
  }

  if (canonicalCode === "ES-PENIN") {
    const specs =
      options.carrier === "correos"
        ? ws === "62"
          ? COR_48_ES_PENIN
          : COR_24_ES_PENIN
        : ws === "EMSF057.01"
        ? CTT_DB_ES_PENIN
        : CTT_DD_ES_PENIN
    return {
      zone_code: "ES-PENIN",
      zone_name: zoneName,
      tiers: materializeTiers("esp", specs, options.markupPct),
    }
  }

  if (canonicalCode === "ES-ILHAS") {
    return {
      zone_code: "ES-ILHAS",
      zone_name: zoneName,
      tiers: materializeTiers("esi", COR_ISLAS_ES_ILHAS, options.markupPct),
    }
  }

  // Fallback for generic umbrella codes if explicitly added as a zone
  return {
    zone_code: canonicalCode || "PT-CONT",
    zone_name: zoneName || "Portugal Continental",
    tiers: materializeTiers("gen", CTT_DD_PT_CONT, options.markupPct),
  }
}

/**
 * Builds the complete contracted multi-zone matrix set for a given carrier subproduct.
 */
export function buildSubproductContractZones(
  carrier: "ctt" | "correos",
  wsCode?: string,
  markupPct?: number
): {
  preset: CarrierSubproductPreset | null
  allowedZones: string[]
  zones: ZonePriceMatrix[]
} {
  const preset = getCarrierSubproductPreset(carrier, wsCode)
  const targetZones = preset?.defaultZones || ["PT-CONT"]
  const effectiveMarkup = Number.isFinite(markupPct) ? markupPct : undefined

  const zones = targetZones.map((zoneCode) =>
    buildContractZoneMatrix({
      carrier: preset?.carrier || carrier,
      wsCode: preset?.wsCode || wsCode,
      zoneCode,
      markupPct: effectiveMarkup,
    })
  )

  return {
    preset,
    allowedZones: [...targetZones],
    zones,
  }
}

/**
 * Infers carrier family (`"ctt"` | `"correos"`) from non-redacted or redacted service metadata.
 */
export function detectCarrierGroup(service?: Partial<ServicoLinke> | null): "ctt" | "correos" | undefined {
  if (!service) return undefined
  if (service.carrier_group === "ctt" || service.carrier_group === "correos") {
    return service.carrier_group
  }
  const carrierName = (service.preferred_carrier_name || "").toLowerCase()
  if (carrierName.includes("correos")) return "correos"
  if (carrierName.includes("ctt") || /ers|d\+/.test(carrierName)) return "ctt"

  const wsConn = (service.webservice_connection_id || "").toLowerCase()
  if (wsConn.includes("correos")) return "correos"
  if (wsConn.includes("ctt")) return "ctt"

  const wsCode = (service.webservice_service_code || "").trim().toUpperCase()
  if (["61", "62", "63", "66", "90", "93"].includes(wsCode)) return "correos"
  if (wsCode.startsWith("EM") || wsCode.startsWith("EN")) return "ctt"

  const code = (service.code || "").trim().toUpperCase()
  if (code.startsWith("LK-COR") || code.startsWith("COR-")) return "correos"
  if (/^LK-(CTT|DD|DB|EQ|MULT|EU|CE)/.test(code)) return "ctt"

  const name = (service.name || "").toLowerCase()
  if (name.includes("correos") || /paq\s?(24|48)|e-?paq/.test(name)) return "correos"
  if (
    name.includes("ctt") ||
    /ers|d\+|guia\s+(dd|db|eq|ce|ee)|ems|para amanh|em 2 dias|m[úu]ltiplo|europa terrestre/.test(name)
  ) {
    return "ctt"
  }

  if (
    service.zones &&
    service.zones.length > 0 &&
    service.zones.every((z) => z.zone_code === "Zona 2" || z.zone_code === "Zona 3")
  ) {
    return "ctt"
  }

  return undefined
}

/**
 * Generates a unique, non-primordial, carrier-prefixed `LK-...` code for new custom tables.
 */
export function buildDefaultCustomServiceCode(carrier: "ctt" | "correos", wsCode?: string): string {
  const preset = getCarrierSubproductPreset(carrier, wsCode)
  const prefix = preset?.codePrefix || (carrier === "correos" ? "LK-COR" : "LK-CTT")
  const suffix = Math.floor(100 + Math.random() * 900)
  const candidate = `${prefix}-${suffix}`
  return PRIMORDIAL_SERVICE_CODES.has(candidate.toUpperCase()) ? `${candidate}-C` : candidate
}
