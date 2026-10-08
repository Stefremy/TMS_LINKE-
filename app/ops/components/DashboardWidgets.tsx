"use client"

import React, { useEffect, useState, useRef } from "react"
import { Plus, X, RefreshCw, SlidersHorizontal, TrendingUp, TrendingDown } from "lucide-react"

export interface LinkeMetrics {
  revenue: number
  prevRevenue: number
  growthPercent: number
  profit: number
}

interface StockQuote {
  symbol: string
  label: string
  price: number
  changePercent: number
  currency: string
}

interface DashboardWidgetsProps {
  linkeMetrics?: LinkeMetrics
}

const DEFAULT_SYMBOLS = [
  "^GSPC",
  "^IXIC",
  "^DJI",
  "NVDA",
  "AAPL",
  "TSLA",
  "MSFT",
  "BTC-USD",
  "CTT.LS",
]

export function DashboardWidgets({ linkeMetrics }: DashboardWidgetsProps) {
  const [mounted, setMounted] = useState(false)
  const [time, setTime] = useState<Date | null>(null)
  const [quotes, setQuotes] = useState<StockQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [customSymbols, setCustomSymbols] = useState<string[]>([])
  const [newSymbolInput, setNewSymbolInput] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Clock timer
  useEffect(() => {
    setMounted(true)
    setTime(new Date())
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Load custom symbols from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tms_dashboard_stocks")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setCustomSymbols(parsed)
      }
    } catch {
      // Ignore
    }
  }, [])

  // Fetch official market quotes
  const fetchQuotes = async (symbolsToFetch: string[]) => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const query = symbolsToFetch.join(",")
      const res = await fetch(`/api/market-data?symbols=${encodeURIComponent(query)}`)
      if (!res.ok) throw new Error("Erro ao carregar cotações")
      const data = await res.json()
      if (data?.quotes && Array.isArray(data.quotes)) {
        setQuotes(data.quotes)
      }
    } catch (err: any) {
      console.warn("Error fetching stock quotes:", err)
      setErrorMsg("Falha ao atualizar mercados")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const allSymbols = Array.from(new Set([...DEFAULT_SYMBOLS, ...customSymbols]))
    fetchQuotes(allSymbols)

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchQuotes(allSymbols)
    }, 60000)
    return () => clearInterval(interval)
  }, [customSymbols])

  // Handle outside click for settings popover
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    if (showSettings) {
      document.addEventListener("mousedown", handleOutsideClick)
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [showSettings])

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault()
    const sym = newSymbolInput.trim().toUpperCase()
    if (!sym) return
    if (customSymbols.includes(sym) || DEFAULT_SYMBOLS.includes(sym)) {
      setErrorMsg("Símbolo já existe na lista")
      return
    }

    const updated = [...customSymbols, sym]
    setCustomSymbols(updated)
    try {
      localStorage.setItem("tms_dashboard_stocks", JSON.stringify(updated))
    } catch {}
    setNewSymbolInput("")
  }

  const handleRemoveCustom = (sym: string) => {
    const updated = customSymbols.filter(s => s !== sym)
    setCustomSymbols(updated)
    try {
      localStorage.setItem("tms_dashboard_stocks", JSON.stringify(updated))
    } catch {}
  }

  const handleResetDefaults = () => {
    setCustomSymbols([])
    try {
      localStorage.removeItem("tms_dashboard_stocks")
    } catch {}
  }

  // Clock calculations
  const now = time || new Date()
  const seconds = now.getSeconds()
  const minutes = now.getMinutes()
  const hours = now.getHours()
  const secondDegrees = (seconds / 60) * 360
  const minuteDegrees = ((minutes + seconds / 60) / 60) * 360
  const hourDegrees = (((hours % 12) + minutes / 60) / 12) * 360

  const linkeGrowth = linkeMetrics?.growthPercent ?? 0
  const isLinkePositive = linkeGrowth >= 0

  const renderTickerItems = (keyPrefix: string) => (
    <div key={keyPrefix} className="flex items-center gap-6 shrink-0">
      {/* Live Badge */}
      <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-neutral-400 bg-neutral-100 dark:bg-neutral-800/60 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Mercados
      </span>

      {/* Real Linke Revenue Comparison */}
      <div 
        title={`Receita Período: €${(linkeMetrics?.revenue || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2 })} | Anterior: €${(linkeMetrics?.prevRevenue || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2 })} | Lucro: €${(linkeMetrics?.profit || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`}
        className="flex items-center gap-2 font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs shadow-xs cursor-help transition-transform hover:scale-105"
      >
        <span className="tracking-tight">GO LINKE</span>
        <span className="font-mono text-[11px] bg-white/60 dark:bg-neutral-900/60 px-1.5 py-0.2 rounded border border-emerald-500/20 text-neutral-800 dark:text-neutral-200">
          €{linkeMetrics ? (linkeMetrics.revenue >= 1000 ? `${(linkeMetrics.revenue / 1000).toFixed(1)}k` : linkeMetrics.revenue.toFixed(0)) : "0"}
        </span>
        <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${isLinkePositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
          {isLinkePositive ? "▲ +" : "▼ "}
          {Math.abs(linkeGrowth)}%
        </span>
        <span className="text-xs">{isLinkePositive ? "🚀" : "📊"}</span>
      </div>

      {/* Official Stock Quotes */}
      {quotes.map((q) => {
        const isPositive = q.changePercent >= 0
        const currSymbol = q.currency === "EUR" ? "€" : "$"
        const formattedPrice = typeof q.price === "number"
          ? q.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : q.price

        return (
          <div key={q.symbol} className="flex items-center gap-1.5 text-xs font-medium">
            <span className="font-bold text-[var(--text-secondary)]">{q.label}</span>
            <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
              {currSymbol}{formattedPrice}
            </span>
            <span className={`text-[11px] font-semibold flex items-center ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
              {isPositive ? "▲ +" : "▼ "}
              {Math.abs(q.changePercent).toFixed(2)}%
            </span>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="flex items-center gap-3 relative">
      {/* Cute Analog Clock */}
      <div 
        title={mounted ? now.toLocaleTimeString("pt-PT") : "Relógio"}
        className="relative w-10 h-10 rounded-full bg-[var(--surface-bg)] border-2 border-[var(--border-strong)] shadow-xs flex items-center justify-center shrink-0 cursor-default"
      >
        <div className="absolute w-1.5 h-1.5 bg-neutral-800 dark:bg-neutral-200 rounded-full z-10" />
        
        {/* Hour Hand */}
        <div 
          className="absolute w-0.5 h-2.5 bg-neutral-800 dark:bg-neutral-200 rounded-full origin-bottom"
          style={{ transform: `translateY(-50%) rotate(${hourDegrees}deg)` }}
        />
        {/* Minute Hand */}
        <div 
          className="absolute w-0.5 h-3.5 bg-neutral-600 dark:bg-neutral-400 rounded-full origin-bottom"
          style={{ transform: `translateY(-50%) rotate(${minuteDegrees}deg)` }}
        />
        {/* Second Hand */}
        <div 
          className="absolute w-px h-4 bg-rose-500 origin-bottom"
          style={{ transform: `translateY(-50%) rotate(${secondDegrees}deg)` }}
        />
      </div>

      {/* Stock Ticker Bar */}
      <div className="group relative hidden sm:flex items-center bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-full pl-3 pr-2 py-1 shadow-inner max-w-[480px] overflow-hidden">
        {/* Marquee area */}
        <div className="overflow-hidden w-full">
          <div className="flex animate-[ticker_35s_linear_infinite] group-hover:[animation-play-state:paused] whitespace-nowrap gap-6">
            {renderTickerItems("item1")}
            {renderTickerItems("item2")}
          </div>
        </div>

        {/* Action button to customize stocks */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          title="Adicionar ações ao ticker"
          className="ml-2 p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-full hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Settings Popover */}
      {showSettings && (
        <div 
          ref={popoverRef}
          className="absolute top-12 left-12 z-50 w-72 bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl shadow-xl p-4 text-xs flex flex-col gap-3 backdrop-blur-md"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-500" />
              Mercados no Ticker
            </span>
            <button 
              onClick={() => setShowSettings(false)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleAddSymbol} className="flex gap-1.5">
            <input 
              type="text"
              placeholder="Ex: AMZN, GOOGL, META..."
              value={newSymbolInput}
              onChange={(e) => setNewSymbolInput(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text-primary)] placeholder:text-neutral-400 text-xs uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Adicionar
            </button>
          </form>

          {errorMsg && (
            <p className="text-[11px] text-rose-500 font-medium">{errorMsg}</p>
          )}

          {customSymbols.length > 0 ? (
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pt-1">
              <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                Ações Personalizadas ({customSymbols.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {customSymbols.map((sym) => (
                  <span 
                    key={sym}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-md font-bold text-neutral-700 dark:text-neutral-300"
                  >
                    {sym}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveCustom(sym)}
                      className="text-neutral-400 hover:text-rose-500"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="mt-1 text-left text-[11px] text-rose-500 hover:underline"
              >
                Remover personalizadas e repor padrão
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-neutral-400">
              A mostrar mercados oficiais principais (S&P 500, NASDAQ, DOW, NVDA, AAPL, TSLA, MSFT, BTC, CTT) e o lucro GO LINKE em tempo real.
            </p>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}} />
    </div>
  )
}
