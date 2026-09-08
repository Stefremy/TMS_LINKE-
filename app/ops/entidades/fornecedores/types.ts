export interface PriceTier {
  id: string
  enabled: boolean
  weight_max: number
  label: string
  zone: string
  cost_price: number
  margin_pct: number
  sell_price: number
  delivery_time: string
}

export interface ServiceFamily {
  id: string
  name: string
  description: string
  tiers: PriceTier[]
}

export interface SurchargeFee {
  id: string
  code: string
  name: string
  fee_type: "percentage" | "fixed"
  service_scope: string
  zone: string
  min_cost: number
  max_cost: number
  vat_rate: number
  supplier_cost: number
}

export interface VolumetricRule {
  id: string
  zone_code: "PT" | "ES" | "AC" | "MD" | "INT"
  zone_name: string
  service_scope: string
  min_volume: number
  cost_coefficient: number
  sell_coefficient: number
}

export interface SubcontractedVehicle {
  id: string
  plate: string
  designation: string
  category: string
  group: string
  driver: string
  insurance_policy: string
  insurance_expiry: string
  iuc_status: string
  ipo_expiry: string
  status: "Ativo" | "Inativo" | "Manutenção"
}

export interface SubcontractedDriver {
  id: string
  code: string
  name: string
  nif_cc: string
  phone: string
  email: string
  group: string
  qualifications: string
  status: "Ativo" | "Inativo"
}

export interface LedgerEntry {
  id: string
  date: string
  doc_number: string
  supplier_ref: string
  doc_type: "Fatura Fornecedor" | "Nota de Crédito" | "Pagamento"
  total_amount: number
  unpaid_amount: number
  due_date: string
  status: "Pago" | "Pendente" | "Vencido"
}

export interface BranchAddress {
  id: string
  code: string
  name: string
  address: string
  postal_code: string
  city: string
  phone: string
  email: string
  contact_person: string
}

export interface CertificateCompliance {
  id: string
  title: string
  doc_number: string
  issue_date: string
  expiry_date: string
  alert_days: number
  notes: string
  status: "Válido" | "A Expirar" | "Expirado"
}

export interface DocumentAttachment {
  id: string
  name: string
  type: string
  size_kb: number
  upload_date: string
  uploaded_by: string
}

export interface Fornecedor {
  id: string
  code: string
  center_code: string
  short_name: string
  color: string
  legal_name: string
  nif: string
  role: string
  city: string
  email?: string
  phone?: string
  balance: string
  payment_terms: string
  is_active: boolean
  country_code: string
  created_at: string

  // Tab 1: Dados Gerais Adicionais
  category?: string
  is_carrier?: boolean
  is_forwarder?: boolean
  is_own_company?: boolean
  alvara_number?: string
  associated_network?: string
  address?: string
  postal_code?: string
  manager_name?: string
  billing_agency?: string
  retention_rate?: number
  vat_regime?: string
  traffic_email?: string
  mobile_phone?: string
  shipping_address?: {
    use_different: boolean
    address: string
    postal_code: string
    city: string
    contact: string
  }
  iban?: string
  swift?: string
  daily_summary_enabled?: boolean
  daily_summary_email?: string
  owner_company?: string
  authorized_agencies?: string[]
  language_preference?: string
  observations?: string
  sync_external_invoicing?: boolean

  // Tab 2: Tabela de Preços
  global_markup_pct?: number
  price_families?: ServiceFamily[]

  // Tab 3: Taxas Adicionais
  additional_fees?: SurchargeFee[]

  // Tab 4: Volumetrias
  volumetrics?: VolumetricRule[]

  // Tab 5: Viaturas
  vehicles?: SubcontractedVehicle[]

  // Tab 6: Motoristas
  drivers?: SubcontractedDriver[]

  // Tab 7: Conta Corrente
  ledger_entries?: LedgerEntry[]

  // Tab 8: Filiais
  branches?: BranchAddress[]

  // Tab 9: Certificados
  certificates?: CertificateCompliance[]

  // Tab 10: Documentação
  documents?: DocumentAttachment[]
}

export const DEFAULT_PRICE_FAMILIES: ServiceFamily[] = [
  {
    id: "fam_nacionais",
    name: "Nacionais (Continente)",
    description: "Serviço expresso porta-a-porta Portugal Continental 24H",
    tiers: [
      { id: "nac_1", enabled: true, weight_max: 1, label: "Até 1 Kg", zone: "PT Continental", cost_price: 2.85, margin_pct: 20, sell_price: 3.42, delivery_time: "24h" },
      { id: "nac_2", enabled: true, weight_max: 2, label: "Até 2 Kg", zone: "PT Continental", cost_price: 3.15, margin_pct: 20, sell_price: 3.78, delivery_time: "24h" },
      { id: "nac_5", enabled: true, weight_max: 5, label: "Até 5 Kg", zone: "PT Continental", cost_price: 3.75, margin_pct: 20, sell_price: 4.50, delivery_time: "24h" },
      { id: "nac_10", enabled: true, weight_max: 10, label: "Até 10 Kg", zone: "PT Continental", cost_price: 4.60, margin_pct: 20, sell_price: 5.52, delivery_time: "24h" },
      { id: "nac_20", enabled: true, weight_max: 20, label: "Até 20 Kg", zone: "PT Continental", cost_price: 6.20, margin_pct: 20, sell_price: 7.44, delivery_time: "24h" },
      { id: "nac_30", enabled: true, weight_max: 30, label: "Até 30 Kg", zone: "PT Continental", cost_price: 7.90, margin_pct: 20, sell_price: 9.48, delivery_time: "24h" },
      { id: "nac_add", enabled: true, weight_max: 999, label: "Kg Adicional (+30kg)", zone: "PT Continental", cost_price: 0.28, margin_pct: 20, sell_price: 0.34, delivery_time: "24h" },
    ],
  },
  {
    id: "fam_ibericos",
    name: "Ibéricos (Espanha)",
    description: "Serviço ibérico Portugal ↔ Espanha Peninsular 24H/48H",
    tiers: [
      { id: "ib_1", enabled: true, weight_max: 1, label: "Até 1 Kg", zone: "ES Peninsular", cost_price: 4.20, margin_pct: 25, sell_price: 5.25, delivery_time: "24/48h" },
      { id: "ib_2", enabled: true, weight_max: 2, label: "Até 2 Kg", zone: "ES Peninsular", cost_price: 4.80, margin_pct: 25, sell_price: 6.00, delivery_time: "24/48h" },
      { id: "ib_5", enabled: true, weight_max: 5, label: "Até 5 Kg", zone: "ES Peninsular", cost_price: 5.90, margin_pct: 25, sell_price: 7.38, delivery_time: "24/48h" },
      { id: "ib_10", enabled: true, weight_max: 10, label: "Até 10 Kg", zone: "ES Peninsular", cost_price: 7.50, margin_pct: 25, sell_price: 9.38, delivery_time: "24/48h" },
      { id: "ib_20", enabled: true, weight_max: 20, label: "Até 20 Kg", zone: "ES Peninsular", cost_price: 11.20, margin_pct: 25, sell_price: 14.00, delivery_time: "24/48h" },
      { id: "ib_30", enabled: true, weight_max: 30, label: "Até 30 Kg", zone: "ES Peninsular", cost_price: 14.90, margin_pct: 25, sell_price: 18.63, delivery_time: "24/48h" },
      { id: "ib_add", enabled: true, weight_max: 999, label: "Kg Adicional (+30kg)", zone: "ES Peninsular", cost_price: 0.45, margin_pct: 25, sell_price: 0.56, delivery_time: "24/48h" },
    ],
  },
  {
    id: "fam_ilhas",
    name: "Ilhas (Açores & Madeira)",
    description: "Transporte expresso aéreo e marítimo para Regiões Autónomas",
    tiers: [
      { id: "ilh_1", enabled: true, weight_max: 1, label: "Até 1 Kg", zone: "Açores / Madeira", cost_price: 8.50, margin_pct: 20, sell_price: 10.20, delivery_time: "48/72h" },
      { id: "ilh_2", enabled: true, weight_max: 2, label: "Até 2 Kg", zone: "Açores / Madeira", cost_price: 11.20, margin_pct: 20, sell_price: 13.44, delivery_time: "48/72h" },
      { id: "ilh_5", enabled: true, weight_max: 5, label: "Até 5 Kg", zone: "Açores / Madeira", cost_price: 16.80, margin_pct: 20, sell_price: 20.16, delivery_time: "48/72h" },
      { id: "ilh_10", enabled: true, weight_max: 10, label: "Até 10 Kg", zone: "Açores / Madeira", cost_price: 24.50, margin_pct: 20, sell_price: 29.40, delivery_time: "48/72h" },
    ],
  },
  {
    id: "fam_recolhas",
    name: "Recolha (Coletas Fornecedor)",
    description: "Serviço de recolha programada ou pontual de mercadorias",
    tiers: [
      { id: "rec_pont", enabled: true, weight_max: 10, label: "Recolha Pontual (0-10kg)", zone: "PT Geral", cost_price: 2.10, margin_pct: 15, sell_price: 2.42, delivery_time: "Mesmo Dia" },
      { id: "rec_pesada", enabled: true, weight_max: 100, label: "Recolha Carga (>10kg)", zone: "PT Geral", cost_price: 5.50, margin_pct: 15, sell_price: 6.33, delivery_time: "Mesmo Dia" },
    ],
  },
  {
    id: "fam_internacionais",
    name: "Internacionais (Europa)",
    description: "Serviço rodoviário e aéreo internacional Europa",
    tiers: [
      { id: "int_1", enabled: true, weight_max: 1, label: "Até 1 Kg", zone: "Europa Zona 1", cost_price: 12.50, margin_pct: 25, sell_price: 15.63, delivery_time: "3-5 dias" },
      { id: "int_5", enabled: true, weight_max: 5, label: "Até 5 Kg", zone: "Europa Zona 1", cost_price: 18.20, margin_pct: 25, sell_price: 22.75, delivery_time: "3-5 dias" },
      { id: "int_10", enabled: true, weight_max: 10, label: "Até 10 Kg", zone: "Europa Zona 1", cost_price: 26.00, margin_pct: 25, sell_price: 32.50, delivery_time: "3-5 dias" },
    ],
  },
  {
    id: "fam_ctt_vars",
    name: "Variantes CTT / ERS",
    description: "Serviços específicos de entrega em Ponto CTT / Cacifo Locky",
    tiers: [
      { id: "ctt_ponto", enabled: true, weight_max: 5, label: "Entrega em Ponto CTT (0-5kg)", zone: "PT Nacional", cost_price: 2.50, margin_pct: 20, sell_price: 3.00, delivery_time: "24h" },
      { id: "ctt_locky", enabled: true, weight_max: 10, label: "Cacifo 24H Locky (0-10kg)", zone: "PT Nacional", cost_price: 2.65, margin_pct: 20, sell_price: 3.18, delivery_time: "24h" },
    ],
  },
]

export const DEFAULT_ADDITIONAL_FEES: SurchargeFee[] = [
  { id: "fee_cobra", code: "COBRA", name: "Cobrança no Destino (Reembolso / COD)", fee_type: "percentage", service_scope: "Todos os Serviços", zone: "Geral", min_cost: 2.50, max_cost: 45.00, vat_rate: 23, supplier_cost: 2.5 },
  { id: "fee_fuel", code: "FUEL", name: "Taxa de Combustível (Fuel Surcharge)", fee_type: "percentage", service_scope: "Todos os Serviços", zone: "Geral", min_cost: 0, max_cost: 0, vat_rate: 23, supplier_cost: 14.5 },
  { id: "fee_disf", code: "DISF", name: "Fora de Medida / Excesso Dimensões (DISF)", fee_type: "fixed", service_scope: "Nacionais / Ibéricos", zone: "PT / ES", min_cost: 12.00, max_cost: 12.00, vat_rate: 23, supplier_cost: 12.0 },
  { id: "fee_sab", code: "SAB", name: "Entrega ao Sábado", fee_type: "fixed", service_scope: "Nacionais 24H", zone: "PT Continental", min_cost: 15.00, max_cost: 15.00, vat_rate: 23, supplier_cost: 15.0 },
  { id: "fee_ret", code: "RET", name: "Retorno de Guia / Comprovativo Assinado", fee_type: "fixed", service_scope: "Todos os Serviços", zone: "Geral", min_cost: 3.50, max_cost: 3.50, vat_rate: 23, supplier_cost: 3.5 },
  { id: "fee_segunda", code: "SEGUNDA", name: "Segunda Entrega / Reexpedição", fee_type: "fixed", service_scope: "Todos os Serviços", zone: "Geral", min_cost: 2.80, max_cost: 2.80, vat_rate: 23, supplier_cost: 2.8 },
  { id: "fee_peso", code: "PESO", name: "Sobretaxa Volume > 40kg / Não Conforme", fee_type: "fixed", service_scope: "Nacionais", zone: "PT Continental", min_cost: 18.00, max_cost: 18.00, vat_rate: 23, supplier_cost: 18.0 },
]

export const DEFAULT_VOLUMETRICS: VolumetricRule[] = [
  { id: "vol_pt", zone_code: "PT", zone_name: "Portugal Continental", service_scope: "Serviço Expresso 24H", min_volume: 0.001, cost_coefficient: 167, sell_coefficient: 200 },
  { id: "vol_es", zone_code: "ES", zone_name: "Espanha Peninsular", service_scope: "Ibérico 24H/48H", min_volume: 0.001, cost_coefficient: 250, sell_coefficient: 300 },
  { id: "vol_ac", zone_code: "AC", zone_name: "Açores (Região Autónoma)", service_scope: "Aéreo Express", min_volume: 0.001, cost_coefficient: 167, sell_coefficient: 200 },
  { id: "vol_md", zone_code: "MD", zone_name: "Madeira (Região Autónoma)", service_scope: "Aéreo Express", min_volume: 0.001, cost_coefficient: 167, sell_coefficient: 200 },
  { id: "vol_int", zone_code: "INT", zone_name: "Internacional Terrestre/Aéreo", service_scope: "Euro Express", min_volume: 0.005, cost_coefficient: 250, sell_coefficient: 333 },
]

export const DEFAULT_CERTIFICATES: CertificateCompliance[] = [
  { id: "cert_lic", title: "Licença Comunitária / Alvará Transporte", doc_number: "ALV-2024-PT-8891", issue_date: "2024-01-01", expiry_date: "2029-01-01", alert_days: 60, notes: "Alvará de Transporte Público Rodoviário de Mercadorias válido.", status: "Válido" },
  { id: "cert_cmr", title: "Seguro de Mercadorias (CMR)", doc_number: "APOL-LIBERTY-449102", issue_date: "2026-01-01", expiry_date: "2026-12-31", alert_days: 30, notes: "Cobertura até 150.000,00€ por sinistro de mercadorias.", status: "Válido" },
  { id: "cert_rc", title: "Seguro Responsabilidade Civil / Viatura", doc_number: "APOL-FID-77312", issue_date: "2026-01-01", expiry_date: "2026-12-31", alert_days: 30, notes: "Apólice de frota ativa.", status: "Válido" },
  { id: "cert_at", title: "Certidão de Não Dívida Autoridade Tributária (AT)", doc_number: "AT-CERT-2026-99", issue_date: "2026-06-01", expiry_date: "2026-12-01", alert_days: 15, notes: "Situação fiscal regularizada.", status: "Válido" },
  { id: "cert_ss", title: "Certidão de Não Dívida Segurança Social", doc_number: "SS-DECL-2026-44", issue_date: "2026-06-01", expiry_date: "2026-12-01", alert_days: 15, notes: "Situação contributiva regularizada.", status: "Válido" },
]
