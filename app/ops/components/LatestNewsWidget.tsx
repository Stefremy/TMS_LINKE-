"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Newspaper, ArrowUpRight, RefreshCw, Clock, TrendingUp, AlertCircle } from "lucide-react"
import { NEWS_CATEGORIES, type NewsCategory, type NewsItem } from "@/lib/news-categories"

const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000
function isDaytime() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Lisbon" }).format(new Date()))
  return hour >= 7 && hour < 22
}

export function LatestNewsWidget() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<NewsCategory>("geral")
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const lastFetch = useRef(0)
  const requestVersion = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)
  const selectedCategory = NEWS_CATEGORIES.find(item => item.id === category)!

  const cancelRequest = useCallback(() => activeRequest.current?.abort(), [])
  const fetchNews = useCallback(async (cat: NewsCategory) => {
    const version = ++requestVersion.current
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    try {
      const res = await fetch(`/api/news?category=${cat}`, { signal: controller.signal })
      if (!res.ok) throw new Error("Feed indisponível")
      const data = await res.json()
      if (controller.signal.aborted || version !== requestVersion.current) return
      if (!Array.isArray(data.items)) throw new Error("Feed inválido")
      setNews(data.items)
      setFetchedAt(typeof data.fetchedAt === "string" ? data.fetchedAt : null)
      setStale(data.stale === true)
      lastFetch.current = Date.now()
    } catch {
      if (!controller.signal.aborted && version === requestVersion.current) {
        setError("Não foi possível atualizar as notícias. Tente novamente mais tarde.")
        setStale(true)
      }
    } finally {
      if (!controller.signal.aborted && version === requestVersion.current) { setLoading(false); setRefreshing(false) }
    }
  }, [])

  const refreshNews = useCallback(() => {
    setError(null); setRefreshing(true); void fetchNews(category)
  }, [category, fetchNews])
  const changeCategory = (next: NewsCategory) => {
    if (next === category) return
    cancelRequest()
    setLoading(true); setRefreshing(false); setError(null); setNews([]); setFetchedAt(null); setStale(false); setCategory(next)
  }

  useEffect(() => {
    let disposed = false
    queueMicrotask(() => { if (!disposed) void fetchNews(category) })
    return () => { disposed = true; cancelRequest() }
  }, [category, fetchNews, cancelRequest])

  useEffect(() => {
    const interval = setInterval(() => { if (isDaytime()) refreshNews() }, REFRESH_INTERVAL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch.current >= REFRESH_INTERVAL_MS && isDaytime()) refreshNews()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible) }
  }, [refreshNews])

  return <section aria-label="Notícias e atualizações" className="flex min-w-0 flex-col gap-3 py-4">
    <div className="relative mb-1 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 pr-8 sm:pr-0">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${category === "mercados" ? "border-[#155EEF] bg-[#155EEF] text-white" : "border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)]"}`}>
          {category === "mercados" ? <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" /> : <Newspaper aria-hidden="true" className="h-3.5 w-3.5" />}
        </div>
        <div><h4 className="text-sm font-semibold leading-tight text-[var(--text-primary)]">Notícias &amp; Atualizações</h4>
          <p className="mt-0.5 text-[10px] leading-tight text-[var(--text-tertiary)]">{selectedCategory.subtitle}</p></div>
      </div>
      <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 sm:w-auto">
        <div aria-label="Categoria de notícias" className="flex flex-wrap gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-0.5 text-[10px]">
          {NEWS_CATEGORIES.map(item => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => changeCategory(item.id)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#155EEF] ${category === item.id ? "bg-[#155EEF] text-white shadow-sm" : "text-[var(--text-secondary)] hover:bg-[var(--surface-bg)] hover:text-[var(--text-primary)]"}`}>
            {item.id === "mercados" && <TrendingUp aria-hidden="true" className="h-3 w-3" />}{item.label}
          </button>)}
        </div>
        <button type="button" onClick={refreshNews} disabled={loading || refreshing} title="Atualizar notícias" aria-label="Atualizar notícias"
          className="absolute right-0 top-0 rounded-lg p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] disabled:opacity-50 sm:static">
          <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>

    {!loading && (error || stale) && <p role="status" className="flex items-start gap-1.5 text-[10px] text-[var(--text-secondary)]"><AlertCircle aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 text-[#B45309]" />{error || "Não foi possível atualizar. A mostrar as notícias da última consulta disponível."}</p>}

    <div aria-busy={loading} className="custom-scrollbar max-h-[195px] flex-1 space-y-2 overflow-y-auto pr-1">
      {loading ? <div className="space-y-2 py-1" aria-label="A carregar notícias">{[1, 2, 3].map(i => <div key={i} className="flex animate-pulse flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3"><div className="h-2 w-20 rounded bg-[var(--border-subtle)]" /><div className="h-3 w-5/6 rounded bg-[var(--border-subtle)]" /></div>)}</div>
        : !news.length ? <p className="py-6 text-center text-xs text-[var(--text-tertiary)]">{error ? "Use o botão atualizar para tentar novamente." : "Nenhuma notícia encontrada de momento."}</p>
        : news.slice(0, 5).map(item => <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer" className="group block rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-3 shadow-2xs transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]">
          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-[var(--text-tertiary)]">
            <div className="flex min-w-0 items-center gap-1.5"><span className="truncate font-semibold text-[var(--text-secondary)]">{item.source}</span><span>·</span><span className="flex shrink-0 items-center gap-0.5"><Clock aria-hidden="true" className="h-2.5 w-2.5" />{item.timeAgo}</span></div>
            <ArrowUpRight aria-hidden="true" className="h-3 w-3 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
          <h5 className="line-clamp-2 text-[11.5px] font-medium leading-snug text-[var(--text-primary)]">{item.title}</h5>
        </a>)}
    </div>
    {!loading && fetchedAt && <p className="text-[10px] text-[var(--text-tertiary)]">Google Notícias · {stale ? "Última consulta" : "Consultado"} em {new Date(fetchedAt).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Lisbon" })} · Atualização a cada 3h, 07h–22h (Lisboa)</p>}
  </section>
}
