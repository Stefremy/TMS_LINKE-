export interface PriceTierLinke {
  id: string
  label: string
  weight_max: number
  cost_price: number // Preço que o parceiro nos cobra (€)
  margin_pct: number // Margem / Markup (%)
  sell_price: number // Preço imposto pela Linke ao cliente (€)
  delivery_time: string
  enabled: boolean
}

export interface ZonePriceMatrix {
  zone_code: string
  zone_name: string
  tiers: PriceTierLinke[]
}

export interface ServicoLinke {
  id: string
  code: string
  name: string
  description: string
  category: "Nacional" | "Ibérico" | "Ilhas" | "Internacional" | "Especial / Recolhas" | "Ponto / Locky" | "Paletes / Carga"
  color: string
  is_active: boolean
  
  // Perfil Tarifário & Segmentação de Cliente
  pricing_profile: "Standard / Geral" | "VIP / Alto Volume" | "E-Commerce PME" | "Tabela Negociada Cliente"
  target_client_name?: string // Ex: "Cliente Geral", "Grandes Contas (>500 envios/mês)", ou nome de cliente específico
  discount_vs_standard_pct?: number // Desconto concedido por volume vs tabela padrão (%)
  
  // Parceiro transportador associado (informativo)
  preferred_carrier_id: string
  preferred_carrier_name: string
  
  // Conexão Webservice para Emissão Automática de Guias / API
  webservice_connection_id?: string // ID da conexão de Webservice
  webservice_service_code?: string // Código de subproduto na API (ex: EMSF056.01, 19, 48, etc.)
  
  // Tempos de trânsito médios
  transit_time_label: string
  
  // Regra de precificação global do serviço
  global_markup_pct: number
  
  // Destinos permitidos — lista explícita de zone_codes que este serviço cobre.
  // Se vazia ou undefined, todos os destinos com zona configurada são aceites.
  allowed_zones?: string[]

  // Matriz de preços por zona geográfica
  zones: ZonePriceMatrix[]
  
  // Taxas acessórias associadas ao serviço
  fuel_surcharge_pct?: number
  cod_fee_pct?: number
  cod_min_fee?: number
  saturday_fee?: number
  return_guide_fee?: number
  
  // Tabela Base Primordial (OG Vanilla) — Contrato original de referência protegido
  is_primordial?: boolean

  created_at: string
  updated_at?: string
}

export const PRIMORDIAL_SERVICE_CODES = new Set([
  "LK-DD-STD",
  "LK-DB-STD",
  "LK-EQ-STD",
  "LK-MULT-STD",
  "LK-EU-AIR",
  "LK-PONTO",
  "LK-COR-24",
  "LK-COR-ECOM",
  "LK-COR-ISLAS",
  "LK-COR-48",
])

export const PRIMORDIAL_SERVICE_IDS = new Set([
  "srv_linke_dd_std",
  "srv_linke_db_std",
  "srv_linke_eq_std",
  "srv_linke_multiplo_std",
  "srv_linke_europa_air",
  "srv_linke_ponto_ctt",
  "srv_linke_cor_24",
  "srv_linke_cor_48",
  "srv_linke_cor_ecom",
  "srv_linke_cor_islas",
  "b0123d61-f8ca-4238-bec5-0655cd18c102",
  "ff35f836-44fb-4041-a572-17ddea7fff75",
  "1c478f00-0c01-46ef-8865-e913652adc6b",
  "169f5a33-a2ba-4fbd-a416-a27811ec5291",
  "26179d74-c276-4500-8df6-386f76c53503",
  "b58461bb-0cad-4569-81ff-78f2fa85e832",
  "srv_linke_1789055906418",
  "srv_linke_1790600458234",
])

export function isPrimordialServico(servico?: Partial<ServicoLinke> | null): boolean {
  if (!servico) return false
  if (servico.is_primordial === false) return false
  if (servico.is_primordial === true) return true
  if (servico.id && PRIMORDIAL_SERVICE_IDS.has(servico.id)) return true
  if (servico.code && PRIMORDIAL_SERVICE_CODES.has(servico.code.toUpperCase())) return true
  return false
}

export interface ServicosStats {
  totalServicos: number
  servicosAtivos: number
  totalParceiros: number
  margemMediaPct: number
  totalEscaloes: number
}

export interface CotacaoSimulacaoResult {
  servicoId: string
  servicoName: string
  pricingProfile: string
  targetClient: string
  carrierName: string
  carrierColor: string
  zoneName: string
  weight: number
  transitTime: string
  costPrice: number
  sellPrice: number
  marginAmount: number
  marginPct: number
  fuelAmount: number
  finalSellPrice: number
}
