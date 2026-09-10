"use client"

import * as React from "react"
import { 
  TrendingUp, 
  Search, 
  ArrowUpDown, 
  Filter, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle, 
  Sparkles,
  ArrowUpRight,
  Download
} from "lucide-react"
import { getCarrierLogo } from "@/lib/carrier-logos"
import type { ServicoLinke } from "../types"
import type { Fornecedor } from "@/app/ops/entidades/fornecedores/types"

interface MatrizRentabilidadeTabProps {
  servicos: ServicoLinke[]
  fornecedores: Fornecedor[]
}

interface RentabilidadeRow {
  servicoId: string
  servicoCode: string
  servicoName: string
  carrierName: string
  carrierColor: string
  zoneName: string
  tierLabel: string
  weightMax: number
  costPrice: number
  sellPrice: number
  profitAmount: number
  profitMarginPct: number
  deliveryTime: string
  statusTier: "Ótima" | "Saudável" | "Atenção"
}

export function MatrizRentabilidadeTab({ servicos, fornecedores }: MatrizRentabilidadeTabProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedCarrier, setSelectedCarrier] = React.useState("Todos")
  const [selectedZone, setSelectedZone] = React.useState("Todas")
  const [marginFilter, setMarginFilter] = React.useState<"Todas" | "Alta" | "Media" | "Baixa">("Todas")

  // Flatten all tiers into a single comparison list
  const rows: RentabilidadeRow[] = React.useMemo(() => {
    const list: RentabilidadeRow[] = []

    servicos.forEach((servico) => {
      servico.zones.forEach((zone) => {
        zone.tiers.forEach((tier) => {
          const cost = Number(tier.cost_price || 0)
          const sell = Number(tier.sell_price || 0)
          const profit = sell - cost
          const margin = cost > 0 ? (profit / cost) * 100 : 0

          let statusTier: "Ótima" | "Saudável" | "Atenção" = "Saudável"
          if (margin >= 25) statusTier = "Ótima"
          else if (margin < 18) statusTier = "Atenção"

          list.push({
            servicoId: servico.id,
            servicoCode: servico.code,
            servicoName: servico.name,
            carrierName: servico.preferred_carrier_name,
            carrierColor: servico.color || "#059669",
            zoneName: zone.zone_name,
            tierLabel: tier.label,
            weightMax: tier.weight_max,
            costPrice: cost,
            sellPrice: sell,
            profitAmount: profit,
            profitMarginPct: margin,
            deliveryTime: tier.delivery_time,
            statusTier,
          })
        })
      })
    })

    return list
  }, [servicos])

  // Filter rows
  const filteredRows = rows.filter((r) => {
    const matchesSearch =
      r.servicoName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.servicoCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.carrierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.tierLabel.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCarrier = selectedCarrier === "Todos" || r.carrierName === selectedCarrier
    const matchesZone = selectedZone === "Todas" || r.zoneName === selectedZone

    let matchesMargin = true
    if (marginFilter === "Alta") matchesMargin = r.profitMarginPct >= 25
    if (marginFilter === "Media") matchesMargin = r.profitMarginPct >= 18 && r.profitMarginPct < 25
    if (marginFilter === "Baixa") matchesMargin = r.profitMarginPct < 18

    return matchesSearch && matchesCarrier && matchesZone && matchesMargin
  })

  // Global KPIs for the matrix
  const totalItems = filteredRows.length
  const avgMargin = totalItems > 0 
    ? (filteredRows.reduce((acc, r) => acc + r.profitMarginPct, 0) / totalItems).toFixed(1)
    : "0"
  const totalPotentialProfit = filteredRows.reduce((acc, r) => acc + r.profitAmount, 0).toFixed(2)

  // Unique carriers & zones for filters
  const carriers = ["Todos", ...Array.from(new Set(rows.map((r) => r.carrierName)))]
  const zones = ["Todas", ...Array.from(new Set(rows.map((r) => r.zoneName)))]

  return (
    <div className="space-y-6">
      {/* Top Banner & Strategy Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-xl shadow-sm">
          <span className="text-xs text-emerald-100 font-semibold block">Margem Média Geral</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold">{avgMargin}%</span>
            <span className="text-xs text-emerald-200">Markup Linke</span>
          </div>
          <p className="text-[11px] text-emerald-100/80 mt-1">Rentabilidade média ponderada</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <span className="text-xs text-slate-500 font-semibold block">Escalões Auditados</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-slate-800">{totalItems}</span>
            <span className="text-xs text-slate-400">Pares Custo/PVP</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Distribuídos por serviços e zonas</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <span className="text-xs text-slate-500 font-semibold block">Margem Alta (≥25%)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-emerald-700">
              {rows.filter((r) => r.profitMarginPct >= 25).length}
            </span>
            <span className="text-xs text-emerald-600 font-medium">Escalões</span>
          </div>
          <p className="text-[11px] text-emerald-600/80 mt-1">Excelente contribuição operacional</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <span className="text-xs text-slate-500 font-semibold block">Margem Apertada (&lt;18%)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-extrabold text-amber-600">
              {rows.filter((r) => r.profitMarginPct < 18).length}
            </span>
            <span className="text-xs text-amber-600 font-medium">Sob Análise</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Recomendado reajuste de PVP</p>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3 w-full">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar serviço, escalão, parceiro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
            />
          </div>

          {/* Carrier Selector */}
          <select
            value={selectedCarrier}
            onChange={(e) => setSelectedCarrier(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {carriers.map((c) => (
              <option key={c} value={c}>
                Parceiro: {c}
              </option>
            ))}
          </select>

          {/* Zone Selector */}
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                Zona: {z}
              </option>
            ))}
          </select>

          {/* Margin Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(["Todas", "Alta", "Media", "Baixa"] as const).map((mf) => (
              <button
                key={mf}
                onClick={() => setMarginFilter(mf)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                  marginFilter === mf
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {mf === "Todas" ? "Todas" : mf === "Alta" ? "≥25%" : mf === "Media" ? "18-25%" : "<18%"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-700" />
            <h3 className="font-bold text-sm text-slate-800">
              Matriz Comparativa: Preço de Custo (Parceiro) vs Preço de Venda (Linke)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {filteredRows.length} combinações
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Serviço Linke</th>
                <th className="py-3 px-4">Parceiro Executante</th>
                <th className="py-3 px-4">Zona</th>
                <th className="py-3 px-4">Escalão</th>
                <th className="py-3 px-4 text-right font-bold text-slate-700 bg-slate-100/50">Custo Parceiro (€)</th>
                <th className="py-3 px-4 text-right font-bold text-emerald-800 bg-emerald-50/50">PVP Linke (€)</th>
                <th className="py-3 px-4 text-right font-bold text-emerald-700">Ganho Bruto (€)</th>
                <th className="py-3 px-4 text-center font-bold">Margem (%)</th>
                <th className="py-3 px-4 text-center">Classificação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row, idx) => (
                <tr key={`${row.servicoId}-${row.zoneName}-${row.tierLabel}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: row.carrierColor }}
                      ></span>
                      <span>{row.servicoName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-700">
                    <div className="flex items-center gap-1.5">
                      {getCarrierLogo(row.carrierName) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={getCarrierLogo(row.carrierName)!} 
                          alt={row.carrierName} 
                          className="w-4 h-4 object-contain flex-shrink-0" 
                        />
                      ) : null}
                      <span>{row.carrierName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {row.zoneName}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-800">
                    {row.tierLabel}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700 bg-slate-50/40">
                    {row.costPrice.toFixed(2)}€
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800 bg-emerald-50/30 text-sm">
                    {row.sellPrice.toFixed(2)}€
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                    +{row.profitAmount.toFixed(2)}€
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] ${
                      row.profitMarginPct >= 25
                        ? "bg-emerald-100 text-emerald-800"
                        : row.profitMarginPct >= 18
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      +{row.profitMarginPct.toFixed(0)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                      row.statusTier === "Ótima"
                        ? "text-emerald-700"
                        : row.statusTier === "Saudável"
                        ? "text-blue-700"
                        : "text-amber-700"
                    }`}>
                      {row.statusTier === "Ótima" && <CheckCircle className="w-3 h-3 text-emerald-600" />}
                      {row.statusTier === "Saudável" && <Sparkles className="w-3 h-3 text-blue-600" />}
                      {row.statusTier === "Atenção" && <AlertCircle className="w-3 h-3 text-amber-600" />}
                      {row.statusTier}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredRows.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-sm">
              Nenhum escalão coincide com os filtros selecionados.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
