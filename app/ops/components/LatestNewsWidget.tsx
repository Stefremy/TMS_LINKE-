"use client"

import React, { useState, useEffect } from "react"
import { 
  Newspaper, 
  ArrowUpRight, 
  RefreshCw, 
  Clock
} from "lucide-react"

interface NewsItem {
  id: string
  title: string
  source: string
  link: string
  pubDate: string
  timeAgo: string
}

const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000 // 3 hours
const DAYTIME_START = 7  // 07:00
const DAYTIME_END   = 22 // 22:00

function isDaytime() {
  const hour = new Date().getHours()
  return hour >= DAYTIME_START && hour < DAYTIME_END
}

export function LatestNewsWidget() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<"geral" | "ctt" | "combustivel">("geral")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const lastFetchRef = React.useRef<number>(0)

  const fetchNews = async (cat: string, silent = false) => {
    try {
      if (!silent) setLoading(true)
      else setIsRefreshing(true)
      const res = await fetch(`/api/news?category=${cat}&bust=${Date.now()}`)
      if (!res.ok) throw new Error("Erro ao carregar notícias")
      const data = await res.json()
      if (data?.items && Array.isArray(data.items)) {
        setNews(data.items)
        lastFetchRef.current = Date.now()
      }
    } catch (err) {
      console.warn("Failed to fetch news:", err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  // Fetch on mount (always — handles "começo do dia")
  useEffect(() => {
    fetchNews(category)
  }, [category])

  // Auto-refresh every 3h, but only during daytime (07:00–22:00 PT)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isDaytime()) {
        fetchNews(category, true)
      }
    }, REFRESH_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [category])

  // When user returns to tab after being away, re-fetch if >3h passed and it's daytime
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastFetchRef.current
        if (elapsed >= REFRESH_INTERVAL_MS && isDaytime()) {
          fetchNews(category, true)
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [category])

  const handleRefresh = () => {
    fetchNews(category, true)
  }

  return (
    <div className="flex flex-col h-full pt-4 mt-4 border-t border-[var(--border-subtle)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
            <Newspaper className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col">
            <h4 className="text-xs font-bold text-[var(--text-primary)] tracking-tight leading-tight">
              Notícias & Atualizações
            </h4>
            <span className="text-[10px] text-[var(--text-tertiary)] leading-tight">
              Logística e transportes ibéricos
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Subtle Segmented Switcher */}
          <div className="flex bg-[var(--surface-muted)] p-0.5 rounded-lg border border-[var(--border-subtle)] text-[10px]">
            <button
              type="button"
              onClick={() => setCategory("geral")}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                category === "geral" 
                  ? "bg-[var(--surface-bg)] text-[var(--text-primary)] font-semibold shadow-2xs" 
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              Geral
            </button>
            <button
              type="button"
              onClick={() => setCategory("ctt")}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                category === "ctt" 
                  ? "bg-[var(--surface-bg)] text-[var(--text-primary)] font-semibold shadow-2xs" 
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              CTT / Encomendas
            </button>
            <button
              type="button"
              onClick={() => setCategory("combustivel")}
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                category === "combustivel" 
                  ? "bg-[var(--surface-bg)] text-[var(--text-primary)] font-semibold shadow-2xs" 
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              Combustíveis
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Atualizar feed"
            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin text-[var(--text-secondary)]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Editorial News Feed */}
      <div className="flex-1 overflow-y-auto max-h-[195px] pr-1 space-y-2 custom-scrollbar">
        {loading ? (
          <div className="space-y-2 py-1">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)]/30 animate-pulse flex flex-col gap-2">
                <div className="flex gap-2 items-center">
                  <div className="h-2 bg-neutral-300 dark:bg-neutral-700 rounded w-20" />
                  <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded w-10" />
                </div>
                <div className="h-3 bg-neutral-300 dark:bg-neutral-700 rounded w-5/6" />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--text-tertiary)]">
            Nenhuma notícia encontrada de momento.
          </div>
        ) : (
          news.slice(0, 5).map((item) => (
            <a
              key={item.id}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group block p-3 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--border-strong)] bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] transition-all duration-150 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--text-tertiary)] mb-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-semibold text-[var(--text-secondary)] tracking-tight truncate">
                    {item.source}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 shrink-0">
                    <Clock className="w-2.5 h-2.5" />
                    {item.timeAgo}
                  </span>
                </div>
                <ArrowUpRight className="w-3 h-3 shrink-0 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>

              <h5 className="text-[11.5px] font-medium text-[var(--text-primary)] leading-snug line-clamp-2">
                {item.title}
              </h5>
            </a>
          ))
        )}
      </div>
    </div>
  )
}
