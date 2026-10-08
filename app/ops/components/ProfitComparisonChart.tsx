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

export function ProfitComparisonChart({ data, targetMonth }: { data: ChartData[], targetMonth?: number }) {
  const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
  const currentMonth = targetMonth !== undefined ? targetMonth : new Date().getMonth()
  const getMonthName = (offset: number) => {
    let m = currentMonth - offset
    while (m < 0) m += 12
    return MONTHS[m]
  }

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
            <Legend 
              verticalAlign="top" 
              height={36} 
              content={() => {
                const items = [
                  { name: getMonthName(0), color: '#10b981' },
                  { name: getMonthName(1), color: '#3b82f6' },
                  { name: getMonthName(2), color: '#f59e0b' },
                  { name: getMonthName(3), color: '#8b5cf6' }
                ];
                return (
                  <div className="flex justify-center gap-5 text-[11px] mb-4">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span style={{ color: item.color }} className="font-semibold">{item.name}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Line type="monotone" name={getMonthName(0)} dataKey="actual" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
            <Line type="monotone" name={getMonthName(1)} dataKey="prev1" stroke="#3b82f6" strokeWidth={2} dot={false} opacity={0.7} />
            <Line type="monotone" name={getMonthName(2)} dataKey="prev2" stroke="#f59e0b" strokeWidth={2} dot={false} opacity={0.5} />
            <Line type="monotone" name={getMonthName(3)} dataKey="prev3" stroke="#8b5cf6" strokeWidth={2} dot={false} opacity={0.3} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
