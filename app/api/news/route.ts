import { NextRequest, NextResponse } from "next/server"
import { XMLParser } from "fast-xml-parser"
import { newsCategory, type NewsCategory, type NewsItem } from "@/lib/news-categories"

export const runtime = "nodejs"

type StoredNews = Omit<NewsItem, "timeAgo">
const cache = new Map<NewsCategory, { items: StoredNews[]; timestamp: number }>()
const CACHE_TTL_MS = 3 * 60 * 60 * 1000

function nodeText(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (value && typeof value === "object" && "#text" in value) return nodeText(value["#text"])
  return ""
}
function relativeTime(date: string): string {
  const timestamp = Date.parse(date)
  if (!Number.isFinite(timestamp)) return "Data indisponível"
  const hours = Math.floor(Math.max(0, Date.now() - timestamp) / 3600000)
  if (hours < 1) return "agora mesmo"
  if (hours < 24) return `há ${hours}h`
  const days = Math.floor(hours / 24)
  return days === 1 ? "ontem" : days < 7 ? `há ${days}d` : new Date(date).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", timeZone: "Europe/Lisbon" })
}
function response(entry: { items: StoredNews[]; timestamp: number }, cached: boolean, stale = false) {
  return NextResponse.json({ items: entry.items.map(item => ({ ...item, timeAgo: relativeTime(item.pubDate) })),
    fetchedAt: new Date(entry.timestamp).toISOString(), cached, stale })
}

export async function GET(req: NextRequest) {
  const category = newsCategory(new URL(req.url).searchParams.get("category"))
  const cached = cache.get(category.id)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return response(cached, true)
  try {
    const locale = "hl=pt-PT&gl=PT&ceid=PT:pt-150"
    const url = "topic" in category
      ? `https://news.google.com/rss/headlines/section/topic/${category.topic}?${locale}`
      : `https://news.google.com/rss/search?q=${encodeURIComponent(category.query)}&${locale}`
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TMSLinkeNewsBot/1.0)" },
      signal: AbortSignal.timeout(10000), next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error("Feed indisponível")
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(await res.text())
    if (parsed?.rss?.channel === undefined || parsed.rss.channel === null) throw new Error("Feed inválido")
    const raw = parsed.rss.channel?.item || []
    const rows: Record<string, unknown>[] = Array.isArray(raw) ? raw : [raw]
    const seen = new Set<string>()
    const items: StoredNews[] = []
    for (const row of rows) {
      let title = nodeText(row.title)
      const link = nodeText(row.link)
      if (!title || seen.has(link)) continue
      try {
        const parsedLink = new URL(link)
        if (!["https:", "http:"].includes(parsedLink.protocol) || parsedLink.username || parsedLink.password) continue
      } catch { continue }
      let source = nodeText(row.source)
      if (!source && title.includes(" - ")) {
        const parts = title.split(" - "); source = parts.pop() || ""; title = parts.join(" - ")
      } else if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -source.length - 3)
      const timestamp = Date.parse(nodeText(row.pubDate))
      items.push({ id: nodeText(row.guid) || link, title, source: source || "Notícias", link,
        pubDate: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "" })
      seen.add(link)
    }
    items.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0))
    const entry = { items: items.slice(0, 8), timestamp: Date.now() }
    cache.set(category.id, entry)
    return response(entry, false)
  } catch {
    // Preserve only real news from the same category, with an explicit stale flag.
    if (cached) return response(cached, true, true)
    return NextResponse.json({ items: [], error: "Não foi possível atualizar as notícias. Tente novamente mais tarde." }, { status: 503 })
  }
}
