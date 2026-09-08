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
