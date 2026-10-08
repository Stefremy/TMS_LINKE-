"use client"

import React, { useEffect, useState, useRef } from "react"
import { Plus, X, RefreshCw, SlidersHorizontal, TrendingUp, TrendingDown } from "lucide-react"
import { ClockStef } from "./ClockStef"
import { NeumorphicCalculator } from "./NeumorphicCalculator"

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
      {/* LED Live Badge */}
      <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold tracking-widest uppercase text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded shadow-[0_0_8px_rgba(16,185,129,0.3)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] shadow-[0_0_6px_#00FF66] animate-pulse" />
        LIVE LED
      </span>

      {/* Real Linke Revenue LED Comparison */}
      <div 
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
      </div>

      <span className="text-neutral-700 font-mono select-none">|</span>

      {/* Official Stock Quotes with glowing LED styling */}
      {quotes.map((q) => {
        const isPositive = q.changePercent >= 0
        const currSymbol = q.currency === "EUR" ? "€" : "$"
        const formattedPrice = typeof q.price === "number"
          ? q.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : q.price

        return (
          <div key={q.symbol} className="flex items-center gap-1.5 font-mono text-xs">
            <span className="font-bold text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]">
              {q.label}
            </span>
            <span className="text-neutral-300 font-medium">
              {currSymbol}{formattedPrice}
            </span>
            <span className={`font-bold flex items-center text-[11px] ${
              isPositive 
                ? "text-[#00FF66] drop-shadow-[0_0_6px_rgba(0,255,102,0.7)]" 
                : "text-[#FF3838] drop-shadow-[0_0_6px_rgba(255,56,56,0.7)]"
            }`}>
              {isPositive ? "▲" : "▼"}{isPositive ? "+" : ""}{q.changePercent.toFixed(2)}%
            </span>
            <span className="text-neutral-700 font-mono select-none ml-2">|</span>
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
    <div className="flex items-center gap-3 relative">
      {/* Figma 'Clock Stef' (Meridian) Trigger */}
      <div 
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
      </div>

      {/* Digital LED Stock Ticker Bar (Smoother, Slower Scrolling, LED Matrix Style) */}
      <div className="group relative hidden sm:flex items-center bg-[#07080a] dark:bg-[#030405] border border-neutral-800 rounded-lg pl-3 pr-2 py-1.5 shadow-[inset_0_2px_6px_rgba(0,0,0,0.9),0_1px_2px_rgba(255,255,255,0.05)] max-w-[800px] w-full overflow-hidden">
        {/* Subtle LED dot pattern overlay */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "3px 3px"
          }}
        />

        {/* Marquee area with slightly slower, comfortable speed (38s) and seamless loop */}
        <div className="overflow-hidden w-full relative z-10 flex">
          <div className="flex w-max animate-[ticker_38s_linear_infinite] group-hover:[animation-play-state:paused]">
            <div className="flex items-center gap-5 pr-5 shrink-0">
              {renderTickerItems("item1")}
            </div>
            <div className="flex items-center gap-5 pr-5 shrink-0" aria-hidden="true">
              {renderTickerItems("item2")}
            </div>
          </div>
        </div>

        {/* Action button to customize stocks */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          title="Personalizar ações no ticker LED"
          className="ml-2.5 p-1 text-neutral-400 hover:text-emerald-400 rounded hover:bg-neutral-800/80 transition-colors shrink-0 relative z-10"
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
