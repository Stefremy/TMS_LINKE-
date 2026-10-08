"use client"

import React from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts"

type ChartData = {
  day: number
  actual: number | null
  prev1: number | null
  prev2: number | null
  prev3: number | null
}

export function ProfitComparisonChart({ data }: { data: ChartData[] }) {
  return (
    <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] p-5 shadow-2xs">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Comparação de Lucro (Últimos 3 Meses)</h3>
        <p className="text-xs text-[var(--text-tertiary)]">Lucro diário acumulado</p>
      </div>
      <div className="h-72 w-full text-xs">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
            <XAxis 
              dataKey="day" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: "var(--text-tertiary)" }} 
              tickFormatter={(val) => `${val}`} 
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: "var(--text-tertiary)" }} 
              tickFormatter={(val) => `${val}€`} 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: "var(--surface-bg)", borderRadius: "8px", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
              labelFormatter={(val) => `Dia ${val}`}
              formatter={(value: any) => [`${Number(value).toFixed(2)}€`, ""]}
            />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            <Line type="monotone" name="Mês Atual" dataKey="actual" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
            <Line type="monotone" name="Mês -1" dataKey="prev1" stroke="#3b82f6" strokeWidth={2} dot={false} opacity={0.7} />
            <Line type="monotone" name="Mês -2" dataKey="prev2" stroke="#f59e0b" strokeWidth={2} dot={false} opacity={0.5} />
            <Line type="monotone" name="Mês -3" dataKey="prev3" stroke="#8b5cf6" strokeWidth={2} dot={false} opacity={0.3} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
