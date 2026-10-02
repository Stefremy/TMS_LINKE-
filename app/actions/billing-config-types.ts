export interface BillingConfig {
  // Configuração do Artigo Moloni
  articleReference: string
  articleDesignation: string
  articleSummary: string

  // Formatação das Linhas da Fatura
  includeDestinationInSummary: boolean
  includeCityInSummary: boolean
  includeTrackingInName: boolean
  includeWeightInName: boolean
  includeServiceNameInName: boolean

  // Padrões de Faturação
  defaultGrouping: "detailed" | "grouped"
  defaultVatRate: number
  defaultPaymentDays: number
  defaultDocumentSetId?: number | null
}

export const DEFAULT_BILLING_CONFIG: BillingConfig = {
  articleReference: "LINKE-TMS",
  articleDesignation: "Serviço de Transporte",
  articleSummary: "",
  includeDestinationInSummary: true,
  includeCityInSummary: true,
  includeTrackingInName: true,
  includeWeightInName: true,
  includeServiceNameInName: true,
  defaultGrouping: "detailed",
  defaultVatRate: 23,
  defaultPaymentDays: 30,
  defaultDocumentSetId: null,
}
