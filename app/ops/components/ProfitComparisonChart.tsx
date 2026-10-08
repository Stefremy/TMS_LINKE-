"use client"

import React, { useState, useMemo } from "react"
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { TrendingUp, TrendingDown, Calendar, Layers, Eye, EyeOff } from "lucide-react"

type ChartData = {
  day: number
  actual: number | null
  prev1: number | null
  prev2: number | null
  prev3: number | null
}

export function ProfitComparisonChart({ data, targetMonth }: { data: ChartData[], targetMonth?: number }) {
  const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ]
  const currentMonth = targetMonth !== undefined ? targetMonth : new Date().getMonth()

  const getMonthName = (offset: number) => {
    let m = currentMonth - offset
    while (m < 0) m += 12
    return MONTHS[m]
  }

  // Interactive line visibility toggles
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({
    actual: true,
    prev1: true,
    prev2: true,
    prev3: true,
  })

  // Hover state to highlight a specific line
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null)

  const toggleSeries = (key: string) => {
    setVisibleSeries(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // Calculate high-level executive statistics
  const stats = useMemo(() => {
    if (!data || data.length === 0) return null

    // Latest actual point
    const latestActualPoint = [...data].reverse().find(d => d.actual !== null && d.actual !== undefined)
    const currentTotal = latestActualPoint?.actual ?? 0
    const currentDay = latestActualPoint?.day ?? 1

    // Previous month total at the exact same day for true apples-to-apples comparison
    const prev1AtSameDay = latestActualPoint?.prev1 ?? 0
    const diff = currentTotal - prev1AtSameDay
    const percentDiff = prev1AtSameDay > 0 ? (diff / prev1AtSameDay) * 100 : 0

    // Full month totals (Day 31 or last available)
    const lastDay = data[data.length - 1]
    const totalPrev1 = lastDay?.prev1 ?? 0
    const totalPrev2 = lastDay?.prev2 ?? 0
    const totalPrev3 = lastDay?.prev3 ?? 0

    return {
      currentTotal,
      currentDay,
      diff,
      percentDiff,
      totalPrev1,
      totalPrev2,
      totalPrev3
    }
  }, [data])

  const seriesMeta = [
    { key: "actual", name: getMonthName(0), color: "#10b981", strokeWidth: 3, total: stats?.currentTotal },
    { key: "prev1", name: getMonthName(1), color: "#3b82f6", strokeWidth: 2, total: stats?.totalPrev1 },
    { key: "prev2", name: getMonthName(2), color: "#f59e0b", strokeWidth: 2, total: stats?.totalPrev2 },
    { key: "prev3", name: getMonthName(3), color: "#8b5cf6", strokeWidth: 2, total: stats?.totalPrev3 },
  ]

  // Custom high-end tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    return (
      <div className="bg-[var(--surface-bg)]/95 backdrop-blur-md border border-[var(--border-strong)] rounded-xl shadow-xl p-3.5 text-xs min-w-[210px] animate-in fade-in duration-150">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
          <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            Dia {label} de {getMonthName(0)}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-mono font-bold">
            Acumulado
          </span>
        </div>

        <div className="space-y-1.5">
          {payload.map((item: any, idx: number) => {
            const series = seriesMeta.find(s => s.name === item.name)
            const color = series?.color || item.color || "#10b981"
            const val = item.value !== null && item.value !== undefined ? Number(item.value) : null

            return (
              <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[var(--text-secondary)] font-medium">
                    {item.name}:
                  </span>
                </div>
                <span className="font-bold text-[var(--text-primary)] font-mono tabular-nums">
                  {val !== null ? `${val.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€` : "—"}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const isPositiveGrowth = (stats?.percentDiff ?? 0) >= 0

  return (
    <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 sm:p-6 shadow-2xs transition-all flex flex-col justify-between">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-tight">
              Comparação de Lucro (Últimos 3 Meses)
            </h3>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] pl-8">
            Lucro diário acumulado • Comparativo homólogo com o mesmo período
          </p>
        </div>

        {/* Executive KPI Pill */}
        {stats && (
          <div className="flex items-center gap-2 self-start sm:self-auto bg-[var(--surface-muted)] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)]">
            <div className="flex flex-col text-right">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-tertiary)]">
                Acumulado (Dia {stats.currentDay})
              </span>
              <span className="font-mono font-bold text-sm text-[var(--text-primary)] tabular-nums">
                {stats.currentTotal.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
              </span>
            </div>

            <div className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-md ${
              isPositiveGrowth 
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20"
            }`}>
              {isPositiveGrowth ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{isPositiveGrowth ? "+" : ""}{stats.percentDiff.toFixed(1)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Legend Bar */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-4 text-xs mb-4 pt-1">
        {seriesMeta.map((s) => {
          const isVisible = visibleSeries[s.key]
          const isHovered = hoveredSeries === s.key

          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSeries(s.key)}
              onMouseEnter={() => setHoveredSeries(s.key)}
              onMouseLeave={() => setHoveredSeries(null)}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-all text-xs font-medium cursor-pointer ${
                isVisible 
                  ? isHovered
                    ? "bg-[var(--surface-muted)] border-[var(--border-strong)] shadow-xs scale-102"
                    : "bg-[var(--surface-bg)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]" 
                  : "opacity-40 bg-transparent border-dashed border-[var(--border-subtle)]"
              }`}
              title={`Clique para ${isVisible ? "ocultar" : "mostrar"} a curva de ${s.name}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs transition-transform"
                style={{ backgroundColor: s.color }}
              />
              <span style={{ color: isVisible ? "var(--text-primary)" : "var(--text-tertiary)" }} className="font-semibold text-[11px]">
                {s.name}
              </span>
              {s.total !== undefined && (
                <span className="font-mono text-[10px] text-[var(--text-tertiary)] tabular-nums">
                  ({(s.total >= 1000 ? `${(s.total / 1000).toFixed(1)}k` : s.total.toFixed(0))}€)
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Modern High-End Chart */}
      <div className="h-72 w-full text-xs relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
            <defs>
              {/* Premium luminous emerald gradient fill for the current active month */}
              <linearGradient id="actualProfitGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="70%" stopColor="#10b981" stopOpacity={0.03} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>

              {/* Prev1 subtle gradient */}
              <linearGradient id="prev1Glow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.10} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid 
              strokeDasharray="4 4" 
              vertical={false} 
              stroke="var(--border-subtle)" 
              strokeOpacity={0.5} 
            />

            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} 
              tickFormatter={(val) => `${val}`} 
              interval={2}
            />

            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} 
              tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k€` : `${val}€`} 
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Current Active Month Area & Line (Emerald) */}
            {visibleSeries.actual && (
              <Area
                type="monotone"
                name={getMonthName(0)}
                dataKey="actual"
                stroke="#10b981"
                strokeWidth={hoveredSeries === "actual" ? 3.5 : 3}
                fill="url(#actualProfitGlow)"
                dot={false}
                activeDot={{
                  r: 6,
                  fill: "#10b981",
                  stroke: "var(--surface-bg)",
                  strokeWidth: 2,
                  className: "filter drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                }}
              />
            )}

            {/* Prev 1 (Previous Month - Blue/Indigo) */}
            {visibleSeries.prev1 && (
              <Area
                type="monotone"
                name={getMonthName(1)}
                dataKey="prev1"
                stroke="#3b82f6"
                strokeWidth={hoveredSeries === "prev1" ? 2.5 : 2}
                fill="url(#prev1Glow)"
                strokeOpacity={hoveredSeries && hoveredSeries !== "prev1" ? 0.3 : 0.85}
                dot={false}
                activeDot={{ r: 4, fill: "#3b82f6", stroke: "var(--surface-bg)", strokeWidth: 2 }}
              />
            )}

            {/* Prev 2 (2 Months Ago - Amber) */}
            {visibleSeries.prev2 && (
              <Line
                type="monotone"
                name={getMonthName(2)}
                dataKey="prev2"
                stroke="#f59e0b"
                strokeWidth={hoveredSeries === "prev2" ? 2.5 : 1.75}
                strokeDasharray="4 4"
                strokeOpacity={hoveredSeries && hoveredSeries !== "prev2" ? 0.25 : 0.65}
                dot={false}
                activeDot={{ r: 4, fill: "#f59e0b", stroke: "var(--surface-bg)", strokeWidth: 2 }}
              />
            )}

            {/* Prev 3 (3 Months Ago - Violet) */}
            {visibleSeries.prev3 && (
              <Line
                type="monotone"
                name={getMonthName(3)}
                dataKey="prev3"
                stroke="#8b5cf6"
                strokeWidth={hoveredSeries === "prev3" ? 2.5 : 1.5}
                strokeDasharray="2 3"
                strokeOpacity={hoveredSeries && hoveredSeries !== "prev3" ? 0.2 : 0.45}
                dot={false}
                activeDot={{ r: 4, fill: "#8b5cf6", stroke: "var(--surface-bg)", strokeWidth: 2 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Subtle comparison footer summary cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 mt-3 border-t border-[var(--border-subtle)]">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              {getMonthName(0)} (Atual)
            </span>
            <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
              {stats.currentTotal.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              {getMonthName(1)} (Total)
            </span>
            <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 tabular-nums">
              {stats.totalPrev1.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              {getMonthName(2)} (Total)
            </span>
            <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400 tabular-nums">
              {stats.totalPrev2.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              {getMonthName(3)} (Total)
            </span>
            <span className="font-mono font-bold text-xs text-purple-600 dark:text-purple-400 tabular-nums">
              {stats.totalPrev3.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
