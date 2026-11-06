import type { ClientTierOrderMap } from "@/lib/pricing/tier-display-order"
import type { ClientWeightTierMap } from "@/lib/pricing/client-weight-tiers"
import { DEFAULT_CTT_SPECIAL_SERVICES_FEES } from "@/lib/pricing/special-fee-catalogue"
export { DEFAULT_CTT_SPECIAL_SERVICES_FEES } from "@/lib/pricing/special-fee-catalogue"
import { DEFAULT_CORREOS_SPECIAL_SERVICES_FEES } from "@/lib/services/correos/complementary-services"
export { DEFAULT_CORREOS_SPECIAL_SERVICES_FEES } from "@/lib/services/correos/complementary-services"

export interface ClientPricingRate {
  zone_code: string
  zone_name: string
  w_0_1: number
  w_1_2: number
  w_2_5: number
  w_5_10: number
  w_10_20: number
  w_20_30: number
  kg_extra: number
}

export interface ClientServicePrice {
  service_code: string
  service_name: string
  subproduct_id: string
  category: "Nacional" | "Ilhas" | "Espanha" | "Internacional" | "Postal"
  description: string
  is_enabled: boolean
  w_0_1: number
  w_1_2: number
  w_2_5: number
  w_5_10: number
  w_10_20: number
  w_20_30: number
  kg_extra: number
}

export interface ClientSpecialServiceFee {
  /** True: inherit the company standard; absent on older negotiated rates. */
  use_standard?: boolean
  special_service_code: string
  special_service_name: string
  api_type_code: number
  fee_type: "percentage" | "fixed" | "discount"
  percentage_value?: number
  fixed_value?: number
  min_value?: number
  cod_destination_rates?: Partial<Record<"PT-CONT" | "PT-ILHAS" | "ES-PENIN" | "ES-BALEARES", {
    fee_type: "percentage" | "fixed"
    percentage_value?: number
    fixed_value?: number
    min_value?: number
    use_standard?: boolean
  }>>
  description: string
  is_enabled: boolean
}

export interface ClientPricingConfig {
  service_tier_order?: ClientTierOrderMap
  service_weight_tiers?: ClientWeightTierMap
  table_name: string
  fuel_surcharge_pct: number
  /** Effective tenant standard, supplied by the server on each read. */
  standard_fuel_surcharge_pct?: number
  discount_pct?: number
  rates?: ClientPricingRate[]
  services_pricing: ClientServicePrice[]
  special_services_fees: ClientSpecialServiceFee[]
}

export interface ClientAllowedWebservice {
  id: string
  code: string
  name: string
  provider_name: string
  badge_color: string
  is_enabled: boolean
  is_default?: boolean
  client_custom_code?: string
  available_services: string[]
  allowed_services: string[]
}


export interface CustomTierOverride {
  tier_index: number
  sell_price: number
}

export interface Cliente {
  tenant_id?: string
  name?: string
  plan_type?: string
  id: string
  portal_slug?: string
  code: string
  short_name: string
  legal_name: string
  color: string
  color_mode?: "services" | "manual"
  /** Read-only historical count used for the identifier color. */
  legacy_service_count?: number
  logo_url?: string
  nif: string
  category: string
  /**
   * billing_type controla como o cliente paga pelos serviços:
   * - "conta_corrente": Faturação mensal/quinzenal em lote (Moloni batch invoice)
   * - "pay_as_you_go": Pré-pagamento via Wallet/Stripe (saldo carregado antecipadamente)
   */
  billing_type?: "conta_corrente" | "pay_as_you_go"
  /** ISO date from which shipments consume the prepaid wallet; earlier ones stay on the invoiced model. */
  pay_as_you_go_since?: string
  city: string
  address: string
  postal_code: string
  country_code: string
  billing_same_as_pickup?: boolean
  billing_address?: string
  billing_postal_code?: string
  billing_city?: string
  billing_country_code?: string
  email: string
  billing_email?: string
  phone: string
  mobile_phone?: string
  manager_name?: string
  billing_agency: string
  payment_terms: string
  /** Prazo após emissão da fatura, separado da frequência de faturação. */
  payment_due_days?: number
  iban?: string
  credit_limit?: number
  /** Explicit opt-in for Conta Corrente only; never disables the prepaid wallet. */
  credit_limit_enabled?: boolean
  available_credit?: number
  balance?: string
  assigned_seller?: string
  observations?: string
  portal_access_status?: "active" | "suspended" | "blocked"
  is_active: boolean
  created_at: string

  // Preçário, Serviços Linke & Webservices
  default_linke_table_id?: string
  assigned_linke_service_ids?: string[]
  assigned_linke_profile?: string
  volume_discount_pct?: number
  pricing?: ClientPricingConfig
  allowed_webservices?: ClientAllowedWebservice[]

  // Preços customizados por serviço e zona Linke (por cliente)
  // Chave: `${ServicoLinke.id}::${zone_code}` (ou `ServicoLinke.id` legacy para zones[0]), Valor: array de sell_price por tier index
  custom_tier_overrides?: Record<string, number[]>
}

export const DEFAULT_CLIENT_CATEGORIES = [
  "Cliente Conta Corrente",
  "Cliente Pré-Pagamento",
  "E-Commerce & Retalho",
  "Revendedor / Transitário",
  "Grande Conta (Key Account)",
]

export const CLIENT_COLOR_OPTIONS = [
  { label: "Verde Floresta", value: "#246B45" },
  { label: "Azul Aço", value: "#315D82" },
  { label: "Azul Marinho", value: "#263F63" },
  { label: "Verde Petróleo", value: "#31736F" },
  { label: "Ameixa", value: "#76516D" },
  { label: "Ocre", value: "#9A6B2E" },
  { label: "Vermelho Telha", value: "#A7433B" },
  { label: "Azul Ardósia", value: "#55758A" },
  { label: "Cinza Grafite", value: "#475569" },
]

/**
 * 1. PRODUTOS & SUB-PRODUTOS DE TRANSPORTE CTT (SubProductId)
 * Fonte: CTT RecolhasWS (GetProdutosRecolha) + teste real à API de produção
 * Códigos validados e confirmados (geram guia real):
 * - EMSF056.01: Para Amanhã (24H) — Guia DD
 * - EMSF057.01: Em 2 Dias (48H) — Guia DB
 * - ENCF008.01: Económico / 48 (Continente) — Guia EQ  ← código real (não EMSF058.01)
 * - EMSF010.01: 19 Múltiplo (10+ volumes) — Guia EG
 */
export const DEFAULT_CTT_SERVICES_PRICING: ClientServicePrice[] = [
  {
    service_code: "ctt_dd",
    service_name: "[Nacional] CTT Para Amanhã (24H) — Guia DD",
    subproduct_id: "EMSF056.01",
    category: "Nacional",
    description: "Entrega expresso no dia útil seguinte em todo o território continental. Emissão de Guia DD.",
    is_enabled: true,
    w_0_1: 3.85,
    w_1_2: 4.25,
    w_2_5: 4.25,
    w_5_10: 5.10,
    w_10_20: 6.55,
    w_20_30: 9.35,
    kg_extra: 0.32,
  },
  {
    service_code: "ctt_db",
    service_name: "[Nacional] CTT Em 2 Dias (48H) — Guia DB",
    subproduct_id: "EMSF057.01",
    category: "Nacional",
    description: "Serviço expresso económico com prazo de entrega em 2 dias úteis. Emissão de Guia DB.",
    is_enabled: true,
    w_0_1: 3.50,
    w_1_2: 3.85,
    w_2_5: 3.85,
    w_5_10: 4.60,
    w_10_20: 6.05,
    w_20_30: 8.30,
    kg_extra: 0.28,
  },
  {
    service_code: "ctt_eq",
    service_name: "[Nacional] CTT Económico / 48 (Continente) — Guia EQ",
    subproduct_id: "ENCF008.01",
    category: "Nacional",
    description: "Serviço económico rodoviário com entrega em 48H no continente. Emissão de Guia EQ.",
    is_enabled: true,
    w_0_1: 3.30,
    w_1_2: 3.60,
    w_2_5: 3.60,
    w_5_10: 4.25,
    w_10_20: 5.70,
    w_20_30: 7.70,
    kg_extra: 0.25,
  },
]

/**
 * 2. SERVIÇOS ESPECIAIS E SUPLEMENTARES (SpecialServices)
 */

export const DEFAULT_CLIENT_PRICING: ClientPricingConfig = {
  table_name: "Tabela Base CTT & Transportes 2026",
  fuel_surcharge_pct: 12.5,
  discount_pct: 0,
  services_pricing: DEFAULT_CTT_SERVICES_PRICING,
  special_services_fees: [...DEFAULT_CTT_SPECIAL_SERVICES_FEES, ...DEFAULT_CORREOS_SPECIAL_SERVICES_FEES].map(fee => ({ ...fee, use_standard: true })),
  rates: [
    {
      zone_code: "PT_CONT",
      zone_name: "Portugal Continental",
      w_0_1: 3.85,
      w_1_2: 4.25,
      w_2_5: 4.95,
      w_5_10: 6.30,
      w_10_20: 8.95,
      w_20_30: 12.80,
      kg_extra: 0.45,
    },
    {
      zone_code: "PT_ILHAS",
      zone_name: "Ilhas (Açores & Madeira)",
      w_0_1: 9.80,
      w_1_2: 12.50,
      w_2_5: 16.90,
      w_5_10: 24.50,
      w_10_20: 38.50,
      w_20_30: 52.00,
      kg_extra: 1.85,
    },
    {
      zone_code: "ES_PEN",
      zone_name: "Espanha Peninsular",
      w_0_1: 5.60,
      w_1_2: 6.30,
      w_2_5: 7.90,
      w_5_10: 10.20,
      w_10_20: 14.80,
      w_20_30: 19.80,
      kg_extra: 0.72,
    },
    {
      zone_code: "EU_Z1",
      zone_name: "Europa Zona 1",
      w_0_1: 14.50,
      w_1_2: 18.20,
      w_2_5: 24.50,
      w_5_10: 32.80,
      w_10_20: 48.50,
      w_20_30: 65.00,
      kg_extra: 2.25,
    },
  ],
}

export const SYSTEM_AVAILABLE_WEBSERVICES: ClientAllowedWebservice[] = [
  {
    id: "ws_ctt",
    code: "ctt_expresso",
    name: "CTT Expresso",
    provider_name: "CTT Correios de Portugal",
    badge_color: "#dc2626",
    is_enabled: true,
    is_default: true,
    available_services: [
      "ERS 24 / CTT 24H",
      "ERS 48 / CTT 48H",
      "CTT Múltiplo",
      "CTT 10H / 13H",
      "CTT Ilhas Expresso (Aéreo)",
      "CTT Ilhas Carga (Marítimo)",
      "CTT Hoje (Same-Day)",
      "Rede Postal (D+1, D+2)",
      "CTT Espanha 24H",
      "CTT Europa Classic",
      "CTT Internacional Express",
    ],
    allowed_services: [
      "ERS 24 / CTT 24H",
      "ERS 48 / CTT 48H",
      "CTT Múltiplo",
      "CTT Ilhas Expresso (Aéreo)",
      "CTT Espanha 24H",
    ],
  },
  {
    id: "ws_correos",
    code: "correos_express",
    name: "Correos Express",
    provider_name: "Correos Express Portugal",
    badge_color: "#eab308",
    is_enabled: true,
    is_default: false,
    available_services: ["Paq 24", "Paq Empresa 14h", "Paq Iberia 24h", "Paq Marítimo Ilhas"],
    allowed_services: ["Paq 24", "Paq Iberia 24h"],
  },
  {
    id: "ws_dpd",
    code: "dpd",
    name: "DPD Portugal",
    provider_name: "DPDgroup",
    badge_color: "#b91c1c",
    is_enabled: true,
    is_default: false,
    available_services: ["DPD Classic 24h", "DPD 13:00 Express", "DPD Pickup & Lockers", "DPD Fresh"],
    allowed_services: ["DPD Classic 24h", "DPD Pickup & Lockers"],
  },
  {
    id: "ws_gls",
    code: "gls",
    name: "GLS Portugal",
    provider_name: "General Logistics Systems",
    badge_color: "#1e40af",
    is_enabled: false,
    is_default: false,
    available_services: ["BusinessParcel 24h", "ExpressParcel 10h30", "EuroBusinessParcel", "ParcelShop"],
    allowed_services: ["BusinessParcel 24h", "EuroBusinessParcel"],
  },
  {
    id: "ws_linke_direct",
    code: "linke_direct",
    name: "Linke Frota Dedicada",
    provider_name: "Linke Distribuição & Logística",
    badge_color: "#059669",
    is_enabled: true,
    is_default: false,
    available_services: ["Entrega Dedicada Porto/Guimarães", "Distribuição Noturna Linha Norte", "Carga Completa FTL"],
    allowed_services: ["Entrega Dedicada Porto/Guimarães", "Distribuição Noturna Linha Norte"],
  },
  {
    id: "ws_vasp",
    code: "vasp",
    name: "VASP Expresso",
    provider_name: "VASP Distribuição",
    badge_color: "#0284c7",
    is_enabled: false,
    is_default: false,
    available_services: ["VASP Matinal", "VASP Kiosque / Rede Ponto", "VASP Direct"],
    allowed_services: ["VASP Matinal", "VASP Kiosque / Rede Ponto"],
  },
  {
    id: "ws_ups",
    code: "ups",
    name: "UPS Worldwide",
    provider_name: "United Parcel Service",
    badge_color: "#78350f",
    is_enabled: false,
    is_default: false,
    available_services: ["UPS Standard Europe", "UPS Express Saver", "UPS Worldwide Expedited"],
    allowed_services: ["UPS Standard Europe"],
  },
]
