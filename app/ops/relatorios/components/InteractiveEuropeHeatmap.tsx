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
  hubCoords: { x: number; y: number }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 border border-slate-200/90 p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white p-1 rounded-lg border border-slate-200 shadow-2xs text-xs font-semibold">
            <button
              onClick={() => setViewMode("europa")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === "europa"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🌍 Mapa Europeu Interativo
            </button>
            <button
              onClick={() => setViewMode("portugal")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === "portugal"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🇵🇹 Hub Nacional (Continente & Ilhas)
            </button>
          </div>
        </div>

        {/* Heat Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600">
          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Densidade:</span>
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
        <div className="lg:col-span-8 bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[460px]">
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
            <span className="text-slate-400 font-mono text-[11px]">
              Sede: Porto / Felgueiras (41.36°N, 8.19°W)
            </span>
          </div>

          {/* SVG Map Container */}
          <div className="relative z-10 w-full flex-1 flex items-center justify-center py-2">
            {viewMode === "europa" ? (
              <svg
                viewBox="0 0 760 620"
                className="w-full h-auto max-h-[420px] select-none filter drop-shadow-xl"
              >
                <defs>
                  {/* Glowing Filter for selected countries */}
                  <filter id="glow-heat" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>

                  {/* Gradient for transport route lines */}
                  <linearGradient id="route-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
                  </linearGradient>
                </defs>

                <image
                  href="/europe-map.jpg"
                  x="0"
                  y="0"
                  width="760"
                  height="620"
                  preserveAspectRatio="xMidYMid slice"
                  className="opacity-90"
                />

                {/* Interactive Countries Pins/Zones */}
                {destinations.map((dest) => {
                  const isHovered = hoveredCode === dest.code
                  const isSelected = activeCode === dest.code
                  const fill = getIntensityFill(dest.code, isHovered, isSelected)

                  return (
                    <g
                      key={dest.code}
                      onClick={() => setActiveCode(dest.code)}
                      onMouseEnter={() => setHoveredCode(dest.code)}
                      onMouseLeave={() => setHoveredCode(null)}
                      className="cursor-pointer transition-all duration-200"
                    >
                      <circle
                        cx={dest.hubCoords.x}
                        cy={dest.hubCoords.y}
                        r={isSelected ? 16 : isHovered ? 14 : 10}
                        fill={fill}
                        stroke={isSelected ? "#ffffff" : "#0f172a"}
                        strokeWidth={isSelected ? 2 : 1}
                        filter={isSelected ? "url(#glow-heat)" : undefined}
                        className="transition-all duration-200"
                        opacity={0.8}
                      />

                      {/* Country Label (Code) */}
                      <text
                        x={dest.hubCoords.x}
                        y={dest.hubCoords.y + (isSelected ? 3 : 2)}
                        fill="#ffffff"
                        fontSize={isSelected ? "11" : "9"}
                        fontWeight="bold"
                        textAnchor="middle"
                        className="pointer-events-none drop-shadow-md font-sans"
                      >
                        {dest.code}
                      </text>
                    </g>
                  )
                })}

                {/* Active Hub Radiating Routes from Porto (Sede) to Europe */}
                {destinations
                  .filter((d) => d.code !== "PT")
                  .map((d) => {
                    const startX = 90 // Porto / Portugal Hub
                    const startY = 550
                    const endX = d.hubCoords.x
                    const endY = d.hubCoords.y

                    // Quadratic curve midpoint
                    const midX = (startX + endX) / 2
                    const midY = Math.min(startY, endY) - 30

                    const isCurrent = activeCode === d.code || hoveredCode === d.code

                    return (
                      <g key={`route-${d.code}`}>
                        <path
                          d={`M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`}
                          fill="none"
                          stroke={isCurrent ? "#38bdf8" : "#10b981"}
                          strokeWidth={isCurrent ? 2.5 : 1.2}
                          strokeDasharray={isCurrent ? "none" : "4 4"}
                          className={`transition-all duration-300 ${isCurrent ? "opacity-100" : "opacity-40"}`}
                        />

                        {/* Destination Pinpoint Marker */}
                        <circle
                          cx={endX}
                          cy={endY}
                          r={isCurrent ? 6 : 4}
                          fill={isCurrent ? "#38bdf8" : "#10b981"}
                          stroke="#ffffff"
                          strokeWidth="1.5"
                          className="transition-transform"
                        />
                      </g>
                    )
                  })}

                {/* Main Hub Pinpoint: Porto / Sede Linke */}
                <g>
                  <circle cx="90" cy="550" r="10" fill="#10b981" className="animate-ping opacity-40" />
                  <circle cx="90" cy="550" r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                </g>
              </svg>
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
          <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2.5">
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
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header with Flag */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl shadow-xs">{selectedDest.flag}</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {selectedDest.name}
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
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
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Volume Expedido</span>
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {selectedDest.count} <span className="text-xs font-normal text-slate-400">guias</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
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
                <span className="text-slate-600 font-medium">Custo Médio de Envio:</span>
                <span className="font-bold text-slate-900">{selectedDest.avgCost.toFixed(2)} € / guia</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Faturação Estimada na Rota:</span>
                <span className="font-bold text-emerald-700">
                  +{(selectedDest.count * (selectedDest.avgCost * 1.55)).toFixed(2)} €
                </span>
              </div>
            </div>

            {/* Transportadoras Operadoras */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Operadores com Rota Ativa
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedDest.carriers.map((carrier) => (
                  <span
                    key={carrier}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-800 rounded-lg text-xs font-semibold"
                  >
                    <Truck className="w-3 h-3 text-slate-500" />
                    {carrier}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Action Footer */}
          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={() => {
                alert(`Filtrando envios expedidos para ${selectedDest.name}...`)
              }}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-2"
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
                  : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{d.flag}</span>
                <span className="text-[11px] font-bold text-slate-700">{d.percentage}%</span>
              </div>
              <div className="mt-2">
                <span className="text-xs font-bold text-slate-900 block truncate">{d.name.split(" ")[0]}</span>
                <span className="text-[11px] text-slate-500 font-medium">{d.count} guias</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
