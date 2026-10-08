"use client"

import * as React from "react"
import {
  MapPin,
  Truck,
  Clock,
  DollarSign,
  TrendingUp,
  Layers,
  Sparkles,
  Info,
  Maximize2,
  Compass
} from "lucide-react"
import dynamic from "next/dynamic"

const LeafletHeatmap = dynamic(
  () => import("./InteractiveLeafletHeatmap").then((m) => m.InteractiveLeafletHeatmap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[460px] bg-[var(--surface-bg)] rounded-2xl flex items-center justify-center text-[var(--text-tertiary)] text-xs font-semibold">
        A carregar mapa real interativo...
      </div>
    )
  }
)

export interface DestinationItem {
  code: string
  name: string
  flag: string
  count: number
  percentage: number
  avgCost: number
  transitHours: number
  carriers: string[]
  intensity: "muito_alto" | "alto" | "medio" | "baixo"
  lat: number
  lng: number
}

export interface PortugalRegionItem {
  name: string
  code: string
  count: number
  percentage: number
  transitHours: number
  hubCoords: { x: number; y: number }
}

interface InteractiveEuropeHeatmapProps {
  destinations: DestinationItem[]
  portugalRegions: PortugalRegionItem[]
  totalShipments: number
}



export function InteractiveEuropeHeatmap({
  destinations,
  portugalRegions,
  totalShipments,
}: InteractiveEuropeHeatmapProps) {
  const [activeCode, setActiveCode] = React.useState<string>("PT")
  const [hoveredCode, setHoveredCode] = React.useState<string | null>(null)
  const [viewMode, setViewMode] = React.useState<"europa" | "portugal">("europa")

  // Selected item
  const selectedDest = destinations.find((d) => d.code === (hoveredCode || activeCode)) || destinations[0]

  // Color mapping based on intensity
  const getIntensityFill = (code: string, isHovered: boolean, isSelected: boolean) => {
    const item = destinations.find((d) => d.code === code)
    if (!item) return isHovered ? "#cbd5e1" : "#e2e8f0"

    if (item.intensity === "muito_alto") {
      return isSelected || isHovered ? "#059669" : "#10b981" // vibrant emerald
    }
    if (item.intensity === "alto") {
      return isSelected || isHovered ? "#2563eb" : "#3b82f6" // blue
    }
    if (item.intensity === "medio") {
      return isSelected || isHovered ? "#7c3aed" : "#8b5cf6" // purple
    }
    return isSelected || isHovered ? "#64748b" : "#94a3b8" // slate/subtle
  }

  return (
    <div className="space-y-4">
      {/* Top Toolbar: View switcher & heat indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[var(--surface-muted)] border border-[var(--border-subtle)]/90 p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[var(--surface-bg)] p-1 rounded-lg border border-[var(--border-subtle)] shadow-2xs text-xs font-semibold">
            <button
              onClick={() => setViewMode("europa")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === "europa"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              🌍 Mapa Europeu Interativo
            </button>
            <button
              onClick={() => setViewMode("portugal")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === "portugal"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              🇵🇹 Hub Nacional (Continente & Ilhas)
            </button>
          </div>
        </div>

        {/* Heat Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium text-[var(--text-secondary)]">
          <span className="text-[var(--text-tertiary)] font-semibold uppercase tracking-wider text-[10px]">Densidade:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
            <span>Hub Principal (&gt;50%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs" />
            <span>Alto (10-50%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-xs" />
            <span>Médio (3-10%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shadow-xs" />
            <span>Leve (&lt;3%)</span>
          </div>
        </div>
      </div>

      {/* Main Map Box & Info Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* SVG Interactive Canvas */}
        <div className="lg:col-span-8 bg-[var(--surface-bg)] rounded-2xl border border-slate-800 p-4 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[460px]">
          {/* Subtle Grid / Radar overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

          {/* Map Top Header */}
          <div className="relative z-10 flex items-center justify-between text-white/90 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-mono text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                {viewMode === "europa" ? "ROTA TRANS-EUROPEIA TMS LINKE" : "DISTRIBUIÇÃO CONTINENTE & ILHAS"}
              </span>
            </div>
            <span className="text-[var(--text-tertiary)] font-mono text-[11px]">
              Sede: Porto / Felgueiras (41.36°N, 8.19°W)
            </span>
          </div>

          {/* SVG Map Container */}
          <div className="relative z-10 w-full flex-1 flex items-center justify-center py-2">
            {viewMode === "europa" ? (
              <div className="absolute inset-0 z-0">
                <LeafletHeatmap
                  destinations={destinations}
                  activeCode={activeCode}
                  setActiveCode={setActiveCode}
                  hoveredCode={hoveredCode}
                  setHoveredCode={setHoveredCode}
                />
              </div>
            ) : (
              /* Portugal Detail Map */
              <svg viewBox="0 0 500 560" className="w-full h-auto max-h-[420px] select-none filter drop-shadow-xl">
                <defs>
                  <linearGradient id="pt-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#059669" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>

                {/* Portugal Continental Silhouette */}
                <path
                  d="M 120 70 L 170 70 L 180 130 L 175 220 L 165 310 L 130 420 L 155 450 L 180 440 L 180 480 L 110 480 L 95 380 L 110 240 L 105 130 Z"
                  fill="url(#pt-gradient)"
                  stroke="#34d399"
                  strokeWidth="2"
                />

                {/* Islands Box (Madeira & Açores) */}
                <g className="text-white">
                  <rect x="20" y="320" width="70" height="60" rx="8" fill="#1e293b" stroke="#334155" />
                  <text x="55" y="340" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">AÇORES</text>
                  <circle cx="55" cy="360" r="4" fill="#38bdf8" />

                  <rect x="20" y="400" width="70" height="60" rx="8" fill="#1e293b" stroke="#334155" />
                  <text x="55" y="420" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">MADEIRA</text>
                  <circle cx="55" cy="440" r="4" fill="#38bdf8" />
                </g>

                {/* Portugal Regional Hubs */}
                {portugalRegions.map((reg) => (
                  <g key={reg.code} className="cursor-pointer group">
                    <circle
                      cx={reg.hubCoords.x}
                      cy={reg.hubCoords.y}
                      r={reg.code === "OPO" ? 7 : 5}
                      fill={reg.code === "OPO" ? "#fbbf24" : "#ffffff"}
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                    <text
                      x={reg.hubCoords.x + 10}
                      y={reg.hubCoords.y + 4}
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="bold"
                      className="drop-shadow-md font-sans"
                    >
                      {reg.name.split(" ")[0]} ({reg.percentage}%)
                    </text>
                  </g>
                ))}
              </svg>
            )}
          </div>

          {/* Interactive Hint */}
          <div className="relative z-10 flex items-center justify-between text-[11px] text-[var(--text-tertiary)] border-t border-slate-800/80 pt-2.5">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              Passe o cursor ou clique num país para ver tarifas e transportadoras dedicadas.
            </span>
            <span className="text-emerald-400 font-semibold font-mono">
              Linke Hub Ativo
            </span>
          </div>
        </div>

        {/* Selected Country Details Card */}
        <div className="lg:col-span-4 bg-[var(--surface-bg)] rounded-2xl border border-[var(--border-subtle)] p-5 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header with Flag */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl shadow-xs">{selectedDest.flag}</span>
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] leading-tight">
                    {selectedDest.name}
                  </h3>
                  <span className="text-xs font-mono text-[var(--text-tertiary)]">
                    Código: {selectedDest.code} &bull; Zona Internacional
                  </span>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  selectedDest.intensity === "muito_alto"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : selectedDest.intensity === "alto"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-purple-50 text-purple-700 border border-purple-200"
                }`}
              >
                {selectedDest.percentage}% do Total
              </span>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="p-3 bg-[var(--surface-muted)] border border-[var(--border-subtle)]/80 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium">
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Volume Expedido</span>
                </div>
                <div className="text-xl font-bold text-[var(--text-primary)] mt-1">
                  {selectedDest.count} <span className="text-xs font-normal text-[var(--text-tertiary)]">guias</span>
                </div>
              </div>

              <div className="p-3 bg-[var(--surface-muted)] border border-[var(--border-subtle)]/80 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] font-medium">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>SLA / Trânsito</span>
                </div>
                <div className="text-xl font-bold text-emerald-700 mt-1">
                  ~{selectedDest.transitHours}h
                </div>
              </div>
            </div>

            {/* Cost & Economics */}
            <div className="p-3.5 bg-blue-50/60 border border-blue-100 rounded-xl space-y-2 mb-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] font-medium">Custo Médio de Envio:</span>
                <span className="font-bold text-[var(--text-primary)]">{selectedDest.avgCost.toFixed(2)} € / guia</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] font-medium">Faturação Estimada na Rota:</span>
                <span className="font-bold text-emerald-700">
                  +{(selectedDest.count * (selectedDest.avgCost * 1.55)).toFixed(2)} €
                </span>
              </div>
            </div>

            {/* Transportadoras Operadoras */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider block">
                Operadores com Rota Ativa
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedDest.carriers.map((carrier) => (
                  <span
                    key={carrier}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-lg text-xs font-semibold"
                  >
                    <Truck className="w-3 h-3 text-[var(--text-secondary)]" />
                    {carrier}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Action Footer */}
          <div className="pt-4 border-t border-[var(--border-subtle)] mt-4">
            <button
              onClick={() => {
                alert(`Filtrando envios expedidos para ${selectedDest.name}...`)
              }}
              className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-2"
            >
              <span>Ver Envios para {selectedDest.name}</span>
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Country Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
        {destinations.map((d) => {
          const isActive = d.code === activeCode

          return (
            <div
              key={d.code}
              onClick={() => setActiveCode(d.code)}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                isActive
                  ? "bg-blue-50/70 border-blue-400 ring-2 ring-blue-100 shadow-xs"
                  : "bg-[var(--surface-bg)] border-[var(--border-subtle)] hover:bg-[var(--surface-muted)] hover:border-[var(--border-subtle)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{d.flag}</span>
                <span className="text-[11px] font-bold text-[var(--text-primary)]">{d.percentage}%</span>
              </div>
              <div className="mt-2">
                <span className="text-xs font-bold text-[var(--text-primary)] block truncate">{d.name.split(" ")[0]}</span>
                <span className="text-[11px] text-[var(--text-secondary)] font-medium">{d.count} guias</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
