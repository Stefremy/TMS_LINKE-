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
  
  // Parceiro transportador associado
  preferred_carrier_id: string
  preferred_carrier_name: string
  
  // Tempos de trânsito médios
  transit_time_label: string
  
  // Regra de precificação global do serviço
  global_markup_pct: number
  
  // Matriz de preços por zona geográfica
  zones: ZonePriceMatrix[]
  
  // Taxas acessórias associadas ao serviço
  fuel_surcharge_pct?: number
  cod_fee_pct?: number
  cod_min_fee?: number
  saturday_fee?: number
  return_guide_fee?: number
  
  created_at: string
  updated_at?: string
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
