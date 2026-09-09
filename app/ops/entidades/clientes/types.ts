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
  special_service_code: string
  special_service_name: string
  api_type_code: number
  fee_type: "percentage" | "fixed" | "discount"
  percentage_value?: number
  fixed_value?: number
  min_value?: number
  description: string
  is_enabled: boolean
}

export interface ClientPricingConfig {
  table_name: string
  fuel_surcharge_pct: number
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

export interface Cliente {
  id: string
  code: string
  short_name: string
  legal_name: string
  color: string
  nif: string
  category: string
  city: string
  address: string
  postal_code: string
  country_code: string
  email: string
  billing_email?: string
  phone: string
  mobile_phone?: string
  manager_name?: string
  billing_agency: string
  payment_terms: string
  iban?: string
  credit_limit?: number
  balance?: string
  assigned_seller?: string
  observations?: string
  is_active: boolean
  created_at: string

  // Preçário & Webservices
  pricing?: ClientPricingConfig
  allowed_webservices?: ClientAllowedWebservice[]
}

export const DEFAULT_CLIENT_CATEGORIES = [
  "Cliente Conta Corrente",
  "Cliente Pré-Pagamento",
  "E-Commerce & Retalho",
  "Revendedor / Transitário",
  "Grande Conta (Key Account)",
]

export const CLIENT_COLOR_OPTIONS = [
  { label: "Verde Esmeralda", value: "#10b981" },
  { label: "Azul Oceano", value: "#0284c7" },
  { label: "Azul Marinho", value: "#1e3a8a" },
  { label: "Roxo / Violeta", value: "#8b5cf6" },
  { label: "Âmbar / Laranja", value: "#f59e0b" },
  { label: "Rosa Magenta", value: "#ec4899" },
  { label: "Vermelho Rubi", value: "#ef4444" },
  { label: "Ciano Turquesa", value: "#06b6d4" },
  { label: "Cinza Grafite", value: "#475569" },
]

/**
 * 1. PRODUTOS & SUB-PRODUTOS DE TRANSPORTE CTT (SubProductId)
 * Contrato: 300330941 | Cliente: 100032458
 * Fonte: Documentação oficial CTT Expresso Web Services
 * Códigos domésticos: ERS24, ERS48, D+1, D+2, D+5 (máx 10 chars)
 */
export const DEFAULT_CTT_SERVICES_PRICING: ClientServicePrice[] = [
  {
    service_code: "ctt_24h",
    service_name: "[Nacional] CTT 24H — Entrega Amanhã",
    subproduct_id: "ERS24",
    category: "Nacional",
    description: "Entrega expresso no dia útil seguinte em todo o território continental.",
    is_enabled: true,
    w_0_1: 3.85,
    w_1_2: 4.25,
    w_2_5: 4.95,
    w_5_10: 6.30,
    w_10_20: 8.95,
    w_20_30: 12.80,
    kg_extra: 0.45,
  },
  {
    service_code: "ctt_48h",
    service_name: "[Nacional] CTT 48H — 2 Dias Úteis",
    subproduct_id: "ERS48",
    category: "Nacional",
    description: "Serviço expresso económico com prazo de entrega em 48 horas úteis.",
    is_enabled: true,
    w_0_1: 3.35,
    w_1_2: 3.75,
    w_2_5: 4.35,
    w_5_10: 5.50,
    w_10_20: 7.80,
    w_20_30: 10.90,
    kg_extra: 0.38,
  },
  {
    service_code: "ctt_d1",
    service_name: "[Nacional] D+1 — Próximo Dia Útil",
    subproduct_id: "D+1",
    category: "Nacional",
    description: "Entrega no dia útil seguinte — código alternativo ao ERS24.",
    is_enabled: true,
    w_0_1: 3.85,
    w_1_2: 4.25,
    w_2_5: 4.95,
    w_5_10: 6.30,
    w_10_20: 8.95,
    w_20_30: 12.80,
    kg_extra: 0.45,
  },
  {
    service_code: "ctt_d2",
    service_name: "[Nacional] D+2 — Dois Dias Úteis",
    subproduct_id: "D+2",
    category: "Nacional",
    description: "Entrega em 2 dias úteis — código alternativo ao ERS48.",
    is_enabled: true,
    w_0_1: 3.35,
    w_1_2: 3.75,
    w_2_5: 4.35,
    w_5_10: 5.50,
    w_10_20: 7.80,
    w_20_30: 10.90,
    kg_extra: 0.38,
  },
  {
    service_code: "ctt_d5",
    service_name: "[Nacional] D+5 — Cinco Dias Úteis",
    subproduct_id: "D+5",
    category: "Nacional",
    description: "Entrega económica em 5 dias úteis para envios não urgentes.",
    is_enabled: true,
    w_0_1: 2.95,
    w_1_2: 3.25,
    w_2_5: 3.85,
    w_5_10: 4.90,
    w_10_20: 6.80,
    w_20_30: 9.20,
    kg_extra: 0.30,
  },
]

/**
 * 2. SERVIÇOS ESPECIAIS E SUPLEMENTARES (SpecialServices)
 */
export const DEFAULT_CTT_SPECIAL_SERVICES_FEES: ClientSpecialServiceFee[] = [
  {
    special_service_code: "cod",
    special_service_name: "AgainstReimbursement (Cobrança / Reembolso - COD)",
    api_type_code: 2,
    fee_type: "percentage",
    percentage_value: 2.0,
    min_value: 1.80,
    description: "Recebimento do valor da mercadoria ou frete no ato de entrega.",
    is_enabled: true,
  },
  {
    special_service_code: "saturday",
    special_service_name: "Saturday (Entrega ao Sábado 10h-14h)",
    api_type_code: 4,
    fee_type: "fixed",
    fixed_value: 8.50,
    description: "Distribuição prioritária ao sábado de manhã.",
    is_enabled: true,
  },
  {
    special_service_code: "return_signed",
    special_service_name: "ReturnDocumentSigned (Guia / Fatura Assinada e Carimbada)",
    api_type_code: 5,
    fee_type: "fixed",
    fixed_value: 2.20,
    description: "Devolução física ou digitalizada do comprovativo assinado pelo destinatário.",
    is_enabled: true,
  },
  {
    special_service_code: "insurance",
    special_service_name: "SpecialInsurance (Seguro Extra de Valor Declarado)",
    api_type_code: 6,
    fee_type: "percentage",
    percentage_value: 1.0,
    min_value: 3.50,
    description: "Cobertura total até ao montante declarado da mercadoria.",
    is_enabled: true,
  },
  {
    special_service_code: "fragil",
    special_service_name: "Fragil (Tratamento Diferenciado Frágil)",
    api_type_code: 7,
    fee_type: "fixed",
    fixed_value: 1.50,
    description: "Acondicionamento e manuseamento prioritário contra quebras.",
    is_enabled: true,
  },
  {
    special_service_code: "delivery_point",
    special_service_name: "DeliveryPoint (Ponto CTT / Cacifo 24H Lockers)",
    api_type_code: 18,
    fee_type: "fixed",
    fixed_value: 0.0,
    description: "Entrega direta em cacifo eletrónico ou posto parceiro da rede CTT.",
    is_enabled: true,
  },
  {
    special_service_code: "time_window",
    special_service_name: "TimeWindow (Janela Horária Agendada de 2h/3h)",
    api_type_code: 22,
    fee_type: "fixed",
    fixed_value: 3.50,
    description: "Agendamento da entrega numa faixa horária definida pelo destinatário.",
    is_enabled: true,
  },
  {
    special_service_code: "sms_tracking",
    special_service_name: "SMS / LiveTracking (Alerta SMS e Seguimento em Tempo Real)",
    api_type_code: 14,
    fee_type: "fixed",
    fixed_value: 0.15,
    description: "Envio de SMS com janela estimada e link de tracking no mapa ao destinatário.",
    is_enabled: true,
  },
  {
    special_service_code: "auth_return",
    special_service_name: "AuthorizeReturn / Back (Logística Inversa de Devoluções)",
    api_type_code: 20,
    fee_type: "fixed",
    fixed_value: 3.85,
    description: "Emissão de guias de retorno autorizadas para trocas de e-commerce.",
    is_enabled: true,
  },
  {
    special_service_code: "second_delivery",
    special_service_name: "SecondScheduledDelivery (2ª Tentativa Agendada)",
    api_type_code: 12,
    fee_type: "fixed",
    fixed_value: 2.50,
    description: "Re-agendamento de segunda passagem após ausência.",
    is_enabled: true,
  },
]

export const DEFAULT_CLIENT_PRICING: ClientPricingConfig = {
  table_name: "Tabela Base CTT & Transportes 2026",
  fuel_surcharge_pct: 12.5,
  discount_pct: 0,
  services_pricing: DEFAULT_CTT_SERVICES_PRICING,
  special_services_fees: DEFAULT_CTT_SPECIAL_SERVICES_FEES,
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
