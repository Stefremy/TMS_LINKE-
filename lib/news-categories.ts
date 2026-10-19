export const NEWS_CATEGORIES = [
  { id: "geral", label: "Geral", subtitle: "Logística e transportes ibéricos", query: "logistica transportes portugal" },
  { id: "portugal", label: "Portugal", subtitle: "Notícias nacionais de Portugal", topic: "NATION" },
  { id: "ctt", label: "CTT / Encomendas", subtitle: "Transportadoras e entregas", query: "ctt correos expresso logistica encomendas" },
  { id: "combustivel", label: "Combustíveis", subtitle: "Combustíveis e custos de transporte", query: "combustiveis gasoleo transportes frota portugal" },
  { id: "mercados", label: "Mercados", subtitle: "Bolsa, ações, ETFs e empresas", query: '("bolsa de valores" OR "bolsa de Lisboa" OR "Wall Street" OR "S&P 500" OR Nasdaq OR ETF OR "mercados financeiros" OR "ações de empresas") -"Bolsa Família" -"bolsas de estudo" when:7d' },
] as const

export type NewsCategory = typeof NEWS_CATEGORIES[number]["id"]
export interface NewsItem { id: string; title: string; source: string; link: string; pubDate: string; timeAgo: string }

export function newsCategory(value: string | null) {
  return NEWS_CATEGORIES.find(category => category.id === value) || NEWS_CATEGORIES[0]
}
