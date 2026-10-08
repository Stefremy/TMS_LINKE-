import { NextRequest, NextResponse } from "next/server"
import { XMLParser } from "fast-xml-parser"

export const runtime = "nodejs"

interface NewsItem {
  id: string
  title: string
  source: string
  link: string
  pubDate: string
  timeAgo: string
}

// In-memory cache for 5 minutes
const cache = new Map<string, { items: NewsItem[]; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

const FALLBACK_NEWS: NewsItem[] = [
  {
    id: "fb-1",
    title: "CTT e DHL reforçam ligações transfronteiriças na Península Ibérica",
    source: "Transportes & Negócios",
    link: "https://www.ctt.pt",
    pubDate: new Date().toISOString(),
    timeAgo: "há 1h"
  },
  {
    id: "fb-2",
    title: "Preços dos combustíveis: atualização de tarifas e impacto nas frotas rodoviárias",
    source: "Jornal de Negócios",
    link: "https://www.jornaldenegocios.pt",
    pubDate: new Date().toISOString(),
    timeAgo: "há 3h"
  },
  {
    id: "fb-3",
    title: "Setor da logística em Portugal prevê crescimento recorde em envios de e-commerce",
    source: "Dinheiro Vivo",
    link: "https://www.dinheirovivo.pt",
    pubDate: new Date().toISOString(),
    timeAgo: "há 5h"
  },
  {
    id: "fb-4",
    title: "Novas regras alfandegárias e desalfandegamento expresso para trânsito internacional",
    source: "Eco Economia Online",
    link: "https://eco.sapo.pt",
    pubDate: new Date().toISOString(),
    timeAgo: "ontem"
  }
]

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffHours < 1) return "agora mesmo"
    if (diffHours < 24) return `há ${diffHours}h`
    if (diffDays === 1) return "ontem"
    if (diffDays < 7) return `há ${diffDays}d`
    return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })
  } catch {
    return "recente"
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get("category") || "geral"

    let query = "logistica transportes portugal"
    if (category === "ctt") {
      query = "ctt correos expresso logistica encomendas"
    } else if (category === "combustivel") {
      query = "combustiveis gasoleo transportes frota portugal"
    }

    const cached = cache.get(category)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ items: cached.items, cached: true })
    }

    const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-PT&gl=PT&ceid=PT:pt-150`
    const res = await fetch(googleNewsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TMSLinkeNewsBot/1.0)",
      },
      next: { revalidate: 300 }
    })

    if (!res.ok) {
      throw new Error(`Google News returned status ${res.status}`)
    }

    const xml = await res.text()
    const parser = new XMLParser({ ignoreAttributes: false })
    const parsed = parser.parse(xml)
    const rawItems = parsed?.rss?.channel?.item || []
    const itemsList = Array.isArray(rawItems) ? rawItems : [rawItems]

    const items: NewsItem[] = itemsList.slice(0, 8).map((item: any, idx: number) => {
      let title = item.title || ""
      let source = "Notícias"

      if (typeof item.source === "string") {
        source = item.source
      } else if (item.source && item.source["#text"]) {
        source = item.source["#text"]
      } else if (title.includes(" - ")) {
        const parts = title.split(" - ")
        source = parts.pop() || "Notícias"
        title = parts.join(" - ")
      }

      return {
        id: item.guid?.["#text"] || item.guid || `news-${idx}-${Date.now()}`,
        title: title.trim(),
        source: source.trim(),
        link: item.link || "#",
        pubDate: item.pubDate || new Date().toISOString(),
        timeAgo: formatRelativeTime(item.pubDate)
      }
    })

    const finalItems = items.length > 0 ? items : FALLBACK_NEWS

    cache.set(category, { items: finalItems, timestamp: Date.now() })

    return NextResponse.json({ items: finalItems, cached: false })
  } catch (err: any) {
    console.warn("Failed to fetch live news, returning fallback:", err.message)
    return NextResponse.json({ items: FALLBACK_NEWS, cached: false, fallback: true })
  }
}
