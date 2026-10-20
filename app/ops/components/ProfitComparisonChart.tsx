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
import { TrendingUp, TrendingDown, Calendar } from "lucide-react"

type ChartData = {
  day: number
  actual: number | null
  prev1: number | null
  prev2: number | null
  prev3: number | null
}

const SERIES_COLORS = {
  actual: "#155EEF", // Azul para o mês atual (Outubro)
  prev1: "#008A4B",  // Verde para o mês anterior (Setembro)
  prev2: "#FA8072",
  prev3: "#007F8B",
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
    { key: "actual", name: getMonthName(0), color: SERIES_COLORS.actual, total: stats?.currentTotal },
    { key: "prev1", name: getMonthName(1), color: SERIES_COLORS.prev1, total: stats?.totalPrev1 },
    { key: "prev2", name: getMonthName(2), color: SERIES_COLORS.prev2, total: stats?.totalPrev2 },
    { key: "prev3", name: getMonthName(3), color: SERIES_COLORS.prev3, total: stats?.totalPrev3 },
  ]

  // Custom high-end tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    return (
      <div className="bg-[var(--surface-bg)] border border-[var(--border-strong)] rounded-lg shadow-md p-3 text-xs min-w-[210px]">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
          <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5 text-xs">
            <Calendar className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            Dia {label} de {getMonthName(0)}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] font-medium">
            Acumulado
          </span>
        </div>

        <div className="space-y-1.5">
          {payload.map((item: any, idx: number) => {
            const series = seriesMeta.find(s => s.name === item.name)
            const color = series?.color || item.color || "#00865f"
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
    <div className="bg-[var(--surface-bg)] rounded-lg border border-[var(--border-subtle)] p-5 sm:p-6 flex flex-col justify-between">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-6 h-6 rounded-md bg-[var(--surface-muted)] text-[var(--text-secondary)] flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5" strokeWidth={1.75} />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-tight">
              Lucro acumulado
            </h3>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] pl-8">
            Período atual e três meses anteriores
          </p>
        </div>

        {/* Executive KPI Pill */}
        {stats && (
          <div className="flex items-center gap-2 self-start sm:self-auto bg-[var(--surface-muted)] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)]">
            <div className="flex flex-col text-right">
              <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                Acumulado até dia {stats.currentDay}
              </span>
              <span className="font-mono font-bold text-sm text-[var(--text-primary)] tabular-nums">
                {stats.currentTotal.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
              </span>
            </div>

            <div className={`flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-md ${
              isPositiveGrowth 
                ? "text-[var(--status-success)]"
                : "text-[var(--status-danger)]"
            }`}>
              {isPositiveGrowth ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{isPositiveGrowth ? "+" : "−"}{Math.abs(stats.diff).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</span>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Legend Bar */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 sm:gap-4 text-xs mb-4 pt-1">
        {seriesMeta.map((s) => {
          const isVisible = visibleSeries[s.key]
          const labelColor = isVisible ? (s.key === "prev2" ? "#54241F" : "#ffffff") : "var(--text-tertiary)"
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSeries(s.key)}
              onMouseEnter={() => setHoveredSeries(s.key)}
              onMouseLeave={() => setHoveredSeries(null)}
              aria-pressed={isVisible}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors text-xs font-bold cursor-pointer ${
                isVisible 
                  ? "text-white shadow-2xs hover:brightness-110"
                  : "opacity-40 bg-transparent border-dashed border-[var(--border-subtle)]"
              }`}
              style={{
                borderColor: isVisible ? s.color : undefined,
                backgroundColor: isVisible ? s.color : undefined,
              }}
              title={`Clique para ${isVisible ? "ocultar" : "mostrar"} a curva de ${s.name}`}
            >
              <span
                className="w-4 h-0.5 rounded-full shrink-0"
                style={{ backgroundColor: isVisible ? labelColor : s.color }}
              />
              <span style={{ color: labelColor }} className="font-bold text-xs">
                {s.name}
              </span>
              {s.total !== undefined && (
                <span style={{ color: labelColor }} className="font-mono text-[11px] font-bold tabular-nums">
                  ({(s.total >= 1000 ? `${(s.total / 1000).toFixed(1)}k` : s.total.toFixed(0))}€)
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="min-h-72 flex-1 w-full text-xs relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid 
              strokeDasharray="2 4"
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

            {visibleSeries.actual && (
              <Area
                type="monotone"
                name={getMonthName(0)}
                dataKey="actual"
                stroke={SERIES_COLORS.actual}
                strokeWidth={hoveredSeries === "actual" ? 2.5 : 2.25}
                fill={SERIES_COLORS.actual}
                fillOpacity={0.06}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: SERIES_COLORS.actual,
                  stroke: "var(--surface-bg)",
                  strokeWidth: 1.5,
                }}
              />
            )}

            {visibleSeries.prev1 && (
              <Line
                type="monotone"
                name={getMonthName(1)}
                dataKey="prev1"
                stroke={SERIES_COLORS.prev1}
                strokeWidth={hoveredSeries === "prev1" ? 2.5 : 2.2}
                strokeOpacity={hoveredSeries && hoveredSeries !== "prev1" ? 0.4 : 1}
                dot={false}
                activeDot={{ r: 3.5, fill: SERIES_COLORS.prev1, stroke: "var(--surface-bg)", strokeWidth: 1.5 }}
              />
            )}

            {visibleSeries.prev2 && (
              <Line
                type="monotone"
                name={getMonthName(2)}
                dataKey="prev2"
                stroke={SERIES_COLORS.prev2}
                strokeWidth={hoveredSeries === "prev2" ? 2.5 : 2.2}
                strokeDasharray="4 4"
                strokeOpacity={hoveredSeries && hoveredSeries !== "prev2" ? 0.4 : 1}
                dot={false}
                activeDot={{ r: 3.5, fill: SERIES_COLORS.prev2, stroke: "var(--surface-bg)", strokeWidth: 1.5 }}
              />
            )}

            {visibleSeries.prev3 && (
              <Line
                type="monotone"
                name={getMonthName(3)}
                dataKey="prev3"
                stroke={SERIES_COLORS.prev3}
                strokeWidth={hoveredSeries === "prev3" ? 2.5 : 2.2}
                strokeDasharray="2 3"
                strokeOpacity={hoveredSeries && hoveredSeries !== "prev3" ? 0.4 : 1}
                dot={false}
                activeDot={{ r: 3.5, fill: SERIES_COLORS.prev3, stroke: "var(--surface-bg)", strokeWidth: 1.5 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Subtle comparison footer summary cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 mt-3 border-t border-[var(--border-subtle)]">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
              {getMonthName(0)} · atual
            </span>
            <span className="font-mono font-semibold text-xs text-[var(--text-primary)] tabular-nums">
              {stats.currentTotal.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
              {getMonthName(1)} · total
            </span>
            <span className="font-mono font-medium text-xs text-[var(--text-secondary)] tabular-nums">
              {stats.totalPrev1.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
              {getMonthName(2)} · total
            </span>
            <span className="font-mono font-medium text-xs text-[var(--text-secondary)] tabular-nums">
              {stats.totalPrev2.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
              {getMonthName(3)} · total
            </span>
            <span className="font-mono font-medium text-xs text-[var(--text-secondary)] tabular-nums">
              {stats.totalPrev3.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
