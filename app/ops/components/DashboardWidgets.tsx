"use client"

import React, { useEffect, useState, useRef } from "react"
import { Plus, X, RefreshCw, SlidersHorizontal, TrendingUp, TrendingDown } from "lucide-react"
import { ClockStef } from "./ClockStef"
import { NeumorphicCalculator } from "./NeumorphicCalculator"
import styles from "./DashboardWidgets.module.css"

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
  showClock?: boolean
  showLinkeMetrics?: boolean
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

export function DashboardWidgets({ linkeMetrics, showClock = true, showLinkeMetrics = true }: DashboardWidgetsProps) {
  const [mounted, setMounted] = useState(false)
  const [time, setTime] = useState<Date | null>(null)
  const [quotes, setQuotes] = useState<StockQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [customSymbols, setCustomSymbols] = useState<string[]>([])
  const [newSymbolInput, setNewSymbolInput] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [showClockModal, setShowClockModal] = useState(false)
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

  const linkeGrowth = linkeMetrics?.growthPercent ?? 0
  const isLinkePositive = linkeGrowth >= 0

  const renderTickerItems = (keyPrefix: string) => (
    <div key={keyPrefix} className="flex items-center gap-5 shrink-0">
      {showLinkeMetrics && (
        <span className="flex items-center gap-1.5 text-[9px] font-medium tracking-wide text-white/70 border-r border-white/25 pr-4">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-success)]" />
          Mercado
        </span>
      )}

      {/* Real Linke Revenue LED Comparison */}
      {showLinkeMetrics && <div
        title={`Receita Período: €${(linkeMetrics?.revenue || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2 })} | Anterior: €${(linkeMetrics?.prevRevenue || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2 })} | Lucro: €${(linkeMetrics?.profit || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}`}
        className="flex items-center gap-1.5 font-mono text-xs px-2 py-0.5 rounded bg-black/60 border border-emerald-500/30 text-emerald-400 cursor-help transition-all hover:border-emerald-400 shadow-[0_0_8px_rgba(0,255,102,0.15)]"
      >
        <span className="font-bold tracking-tight text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]">GO LINKE</span>
        <span className="text-[#00FF66] font-bold drop-shadow-[0_0_6px_rgba(0,255,102,0.6)]">
          €{linkeMetrics ? (linkeMetrics.revenue >= 1000 ? `${(linkeMetrics.revenue / 1000).toFixed(1)}k` : linkeMetrics.revenue.toFixed(0)) : "0"}
        </span>
        <span className={`text-[11px] font-bold flex items-center ${isLinkePositive ? "text-[#00FF66] drop-shadow-[0_0_6px_rgba(0,255,102,0.8)]" : "text-[#FF3838] drop-shadow-[0_0_6px_rgba(255,56,56,0.8)]"}`}>
          {isLinkePositive ? "▲ +" : "▼ "}
          {Math.abs(linkeGrowth)}%
        </span>
      </div>}

      {showLinkeMetrics && <span className="text-white/40 font-mono select-none">|</span>}

      {/* Official Stock Quotes with glowing LED styling */}
      {quotes.map((q) => {
        const isPositive = q.changePercent >= 0
        const currSymbol = q.currency === "EUR" ? "€" : "$"
        const formattedPrice = typeof q.price === "number"
          ? q.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : q.price

        return (
          <div key={q.symbol} className="flex items-center gap-1.5 font-mono text-xs">
          <span className={styles.symbol}>
              {q.label}
            </span>
            <span className={styles.price}>
              {currSymbol}{formattedPrice}
            </span>
            <span className={`font-medium flex items-center text-[11px] ${
              isPositive 
                ? styles.positive
                : styles.negative
            }`}>
              {isPositive ? "▲" : "▼"}{isPositive ? "+" : ""}{q.changePercent.toFixed(2)}%
            </span>
            <span className="text-white/40 font-mono select-none ml-2">|</span>
          </div>
        )
      })}
    </div>
  )

  const now = time || new Date()
  const formattedDigital = mounted 
    ? now.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) 
    : "12:00:00"

  return (
    <div className="flex items-center gap-3 relative w-full min-w-0">
      {/* Figma 'Clock Stef' (Meridian) Trigger */}
      {showClock && <div
        onClick={() => setShowClockModal(true)}
        title="Abrir Relógio Meridian (Clock Stef)"
        className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-white dark:bg-[#111318] border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer group"
      >
        <ClockStef size="compact" />
        <div className="flex flex-col">
          <span className="font-mono text-xs font-semibold tracking-tight text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            {formattedDigital}
          </span>
          <span className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold -mt-0.5">
            MERIDIAN
          </span>
        </div>
      </div>}

      {/* Digital LED Stock Ticker Bar (Smoother, Slower Scrolling, LED Matrix Style) */}
      <div className={`${styles.ticker} group relative flex items-center rounded-lg pl-3 pr-2 py-2 max-w-full w-full overflow-hidden`}>
        {/* Subtle LED dot pattern overlay */}
        <div 
          className={styles.matrix}
          aria-hidden="true"
        />
        <span className={styles.label}><span aria-hidden="true" />BOLSA</span>

        {/* Marquee area with slightly slower, comfortable speed (38s) and seamless loop */}
        <div className={`${styles.viewport} w-full min-w-0 relative z-10 flex`}>
          <div className={`${styles.track} flex w-max`}>
            <div className="flex items-center gap-5 pr-5 shrink-0">
              {renderTickerItems("item1")}
            </div>
            <div className={`${styles.duplicate} flex items-center gap-5 pr-5 shrink-0`} aria-hidden="true">
              {renderTickerItems("item2")}
            </div>
          </div>
        </div>

        {/* Action button to customize stocks */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          title="Personalizar ações no ticker LED"
          aria-label="Personalizar mercados"
          className={`${styles.settingsButton} ml-2.5 p-1 rounded transition-colors shrink-0 relative z-10`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Full Meridian Clock Modal (matching Figma 'clock stef' exactly) */}
      {showClockModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowClockModal(false)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="animate-in zoom-in-95 duration-200"
          >
            <ClockStef size="full" showCloseButton onClose={() => setShowClockModal(false)} />
          </div>
        </div>
      )}

      {/* Settings Popover */}
      {showSettings && (
        <div 
          ref={popoverRef}
          className="absolute top-12 right-0 z-50 w-72 bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-lg shadow-lg p-4 text-xs flex flex-col gap-3"
        >
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              Mercados no Ticker
            </span>
            <button 
              onClick={() => setShowSettings(false)}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
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
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] text-xs uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
              <span className="text-[10px] text-[var(--text-tertiary)] font-semibold uppercase tracking-wider">
                Ações Personalizadas ({customSymbols.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {customSymbols.map((sym) => (
                  <span 
                    key={sym}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--surface-muted)] rounded-md font-bold text-[var(--text-primary)]"
                  >
                    {sym}
                    <button 
                      type="button" 
                      onClick={() => handleRemoveCustom(sym)}
                      className="text-[var(--text-tertiary)] hover:text-rose-500"
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
            <p className="text-[11px] text-[var(--text-tertiary)]">
              A mostrar mercados oficiais principais (S&P 500, NASDAQ, DOW, NVDA, AAPL, TSLA, MSFT, BTC, CTT) e o lucro GO LINKE em tempo real.
            </p>
          )}
        </div>
      )}

    </div>
  )
}
