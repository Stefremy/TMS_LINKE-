"use client"

import * as React from "react"
import { 
  Building2, 
  Search, 
  Layers, 
  DollarSign, 
  Truck, 
  Box, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowRight,
  ChevronRight,
  Scale
} from "lucide-react"
import { getCarrierLogo } from "@/lib/carrier-logos"
import type { Fornecedor, ServiceFamily, SurchargeFee } from "@/app/ops/entidades/fornecedores/types"

interface TabelasFornecedoresTabProps {
  fornecedores: Fornecedor[]
}

export function TabelasFornecedoresTab({ fornecedores }: TabelasFornecedoresTabProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedCarrierId, setSelectedCarrierId] = React.useState<string>(
    fornecedores[0]?.id || ""
  )
  const [selectedFamilyId, setSelectedFamilyId] = React.useState<string>("")

  const filteredCarriers = fornecedores.filter((f) => {
    return (
      f.short_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.legal_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })

  const currentCarrier = fornecedores.find((f) => f.id === selectedCarrierId) || filteredCarriers[0]
  const priceFamilies = currentCarrier?.price_families || []
  
  const currentFamily = priceFamilies.find((fam) => fam.id === selectedFamilyId) || priceFamilies[0]

  return (
    <div className="space-y-6">
      {/* Top Description Alert */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
            <h3 className="font-bold text-base text-white">
              Tabelas de Custo Contratadas com Transportadores Parceiros
            </h3>
          </div>
          <p className="text-slate-300 text-xs mt-1 max-w-3xl">
            Estes são os preços brutos de compra e condições negociadas com cada parceiro logístico. O TMS Linke utiliza estes custos como base para aplicar o markup e calcular o Preço de Venda Linke aos clientes finais.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-800/80 border border-slate-700 px-3.5 py-2 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Parceiros Ativos</span>
            <span className="text-base font-extrabold text-blue-400">
              {fornecedores.filter(f => f.is_active).length}
            </span>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 px-3.5 py-2 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Tabelas de Custo</span>
            <span className="text-base font-extrabold text-emerald-400">
              {fornecedores.reduce((acc, f) => acc + (f.price_families?.length || 0), 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Carrier Selection & Price Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Carrier List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar parceiro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            />
          </div>

          <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
            {filteredCarriers.map((carrier) => {
              const isSelected = carrier.id === currentCarrier?.id
              const totalFamilies = carrier.price_families?.length || 0
              const carrierLogo = getCarrierLogo(carrier.short_name || carrier.code)

              return (
                <div
                  key={carrier.id}
                  onClick={() => {
                    setSelectedCarrierId(carrier.id)
                    setSelectedFamilyId(carrier.price_families?.[0]?.id || "")
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-50/70 border-blue-500 shadow-sm ring-1 ring-blue-500/30"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {carrierLogo ? (
                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs overflow-hidden flex-shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={carrierLogo} alt={carrier.short_name} className="max-w-full max-h-full object-contain" />
                        </div>
                      ) : (
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-sm flex-shrink-0"
                          style={{ backgroundColor: carrier.color || "#0284c7" }}
                        >
                          {carrier.short_name.substring(0, 3).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-semibold text-sm text-slate-800 leading-tight">
                          {carrier.short_name}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-500">
                          {carrier.code} • NIF: {carrier.nif}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? "text-blue-600 translate-x-0.5" : "text-slate-300"}`} />
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-600">
                      {totalFamilies} {totalFamilies === 1 ? "família de preço" : "famílias de preço"}
                    </span>
                    <span className="font-semibold text-slate-700">
                      Prazo: {carrier.payment_terms}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Side: Carrier Cost Breakdown */}
        <div className="lg:col-span-8 space-y-6">
          {currentCarrier ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              
              {/* Carrier Header */}
              <div className="p-6 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {getCarrierLogo(currentCarrier.short_name || currentCarrier.code) ? (
                    <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 p-2 flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={getCarrierLogo(currentCarrier.short_name || currentCarrier.code)!} 
                        alt={currentCarrier.short_name} 
                        className="max-w-full max-h-full object-contain" 
                      />
                    </div>
                  ) : (
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-sm flex-shrink-0"
                      style={{ backgroundColor: currentCarrier.color || "#0284c7" }}
                    >
                      <Building2 className="w-7 h-7" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        {currentCarrier.short_name}
                      </h2>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded-md">
                        {currentCarrier.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {currentCarrier.legal_name} • {currentCarrier.city}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-400 block font-medium">Margem Base Negociada</span>
                  <span className="text-sm font-bold text-emerald-700">
                    +{currentCarrier.global_markup_pct || 15}% Markup Médio
                  </span>
                </div>
              </div>

              {/* Price Family Selector Pills */}
              <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap mr-2">
                  Família:
                </span>
                {priceFamilies.map((fam) => {
                  const isFamSelected = fam.id === currentFamily?.id
                  return (
                    <button
                      key={fam.id}
                      onClick={() => setSelectedFamilyId(fam.id)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                        isFamSelected
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {fam.name}
                    </button>
                  )
                })}
              </div>

              {/* Price Family Table */}
              <div className="p-6 space-y-6">
                {currentFamily ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-slate-800">
                          {currentFamily.name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {currentFamily.description}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {currentFamily.tiers.length} escalões
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Escalão de Peso</th>
                            <th className="py-3 px-4">Zona de Destino</th>
                            <th className="py-3 px-4 text-right font-bold text-blue-900 bg-blue-50/50">Custo Fornecedor (€)</th>
                            <th className="py-3 px-4 text-center">Markup Ref.</th>
                            <th className="py-3 px-4 text-right font-semibold text-emerald-800">PVP Sugerido (€)</th>
                            <th className="py-3 px-4 text-center">Prazo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentFamily.tiers.map((tier) => {
                            const cost = Number(tier.cost_price || 0)
                            const sell = Number(tier.sell_price || (cost * (1 + (tier.margin_pct || 20) / 100)))

                            return (
                              <tr key={tier.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-4 font-semibold text-slate-800">
                                  {tier.label}
                                </td>
                                <td className="py-3 px-4 text-slate-600">
                                  {tier.zone}
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-bold text-blue-900 bg-blue-50/20 text-sm">
                                  {cost.toFixed(2)}€
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                                    +{tier.margin_pct}%
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                                  {sell.toFixed(2)}€
                                </td>
                                <td className="py-3 px-4 text-center text-slate-500 font-medium">
                                  {tier.delivery_time}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-xl text-slate-400 text-sm">
                    Nenhuma família de preço selecionada.
                  </div>
                )}

                {/* Additional Surcharges & Volumetrics Section */}
                <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Surcharges */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Taxas Adicionais do Parceiro
                      </h4>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {(currentCarrier.additional_fees || []).slice(0, 4).map((fee) => (
                        <div key={fee.id} className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200/60">
                          <span className="text-slate-700 font-medium truncate max-w-[180px]">{fee.name}</span>
                          <span className="font-mono font-semibold text-slate-900">
                            {fee.fee_type === "percentage" ? `${fee.supplier_cost}%` : `${fee.supplier_cost.toFixed(2)}€`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Volumetric Rules */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-blue-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Regras de Volumetria
                      </h4>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {(currentCarrier.volumetrics || []).slice(0, 3).map((vol) => (
                        <div key={vol.id} className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200/60">
                          <span className="text-slate-700 font-medium">{vol.zone_name}</span>
                          <span className="font-mono font-semibold text-blue-900">
                            1 m³ = {vol.cost_coefficient} Kg
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
              Selecione um parceiro na lista para visualizar os preços contratados.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
