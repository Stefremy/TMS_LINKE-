"use client"

import * as React from "react"
import { 
  Package, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Copy,
  TrendingDown, 
  ShieldCheck, 
  UserCheck,
  Percent,
  Sparkles,
  Users,
  Building2,
  Tag
} from "lucide-react"
import { getCarrierLogo } from "@/lib/carrier-logos"
import type { ServicoLinke } from "../types"
import type { Fornecedor } from "@/app/ops/entidades/fornecedores/types"

interface TabelasLinkeTabProps {
  servicos: ServicoLinke[]
  fornecedores: Fornecedor[]
  onEditServico: (servico: ServicoLinke) => void
  onNewServico: () => void
  onDuplicateServico: (servico: ServicoLinke) => void
  onDeleteServico: (id: string) => void
  onToggleStatus: (id: string, active: boolean) => void
  onQuickMarkupChange: (servicoId: string, markup: number) => void
}

export function TabelasLinkeTab({
  servicos,
  fornecedores,
  onEditServico,
  onNewServico,
  onDuplicateServico,
  onDeleteServico,
  onToggleStatus,
  onQuickMarkupChange,
}: TabelasLinkeTabProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState<string>("Todas")
  const [selectedProfile, setSelectedProfile] = React.useState<string>("Todos os Perfis")
  const [activeServicoId, setActiveServicoId] = React.useState<string>(
    servicos[0]?.id || ""
  )

  const categories = ["Todas", "Nacional", "Ibérico", "Ilhas", "Internacional", "Especial / Recolhas", "Ponto / Locky", "Paletes / Carga"]
  const profiles = ["Todos os Perfis", "Standard / Geral", "VIP / Alto Volume", "E-Commerce PME", "Tabela Negociada Cliente"]

  const filteredServicos = servicos.filter((s) => {
    const matchesSearch = 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.preferred_carrier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.target_client_name && s.target_client_name.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesCategory = selectedCategory === "Todas" || s.category === selectedCategory
    const matchesProfile = selectedProfile === "Todos os Perfis" || s.pricing_profile === selectedProfile

    return matchesSearch && matchesCategory && matchesProfile
  })

  const currentServico = servicos.find((s) => s.id === activeServicoId) || filteredServicos[0]

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-col gap-4 bg-slate-50/90 p-4 rounded-xl border border-slate-200">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between w-full">
          {/* Search Box */}
          <div className="relative flex-1 w-full max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar serviço, código, cliente alvo ou transportador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
            />
          </div>

          {/* Profile Filter Selector */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Perfil Cliente:</span>
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500/20"
            >
              {profiles.map((prof) => (
                <option key={prof} value={prof}>
                  {prof}
                </option>
              ))}
            </select>
          </div>

          {/* New Service Button */}
          <button
            onClick={onNewServico}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Novo Serviço / Tabela Linke
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-200/60">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Categoria:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-emerald-700 text-white shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Left Service Selector + Right Price Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Services List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Tabelas & Serviços Linke ({filteredServicos.length})
            </h3>
            <span className="text-[11px] text-emerald-700 font-semibold">
              Ilimitados
            </span>
          </div>

          <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
            {filteredServicos.map((servico) => {
              const isSelected = servico.id === currentServico?.id
              const isVip = servico.pricing_profile === "VIP / Alto Volume"
              const isCustom = servico.pricing_profile === "Tabela Negociada Cliente"

              return (
                <div
                  key={servico.id}
                  onClick={() => setActiveServicoId(servico.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? "bg-emerald-50/80 border-emerald-500 shadow-sm ring-1 ring-emerald-500/30"
                      : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs text-white shadow-sm flex-shrink-0"
                        style={{ backgroundColor: servico.color || "#059669" }}
                      >
                        {servico.code.substring(0, 3)}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-semibold text-xs text-slate-800 leading-tight truncate">
                          {servico.name}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-500 block truncate">
                          {servico.code} • {servico.category}
                        </span>
                      </div>
                    </div>

                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                      servico.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                    }`}>
                      {servico.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  {/* Target Client Badge */}
                  <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      isVip
                        ? "bg-teal-100 text-teal-800 border border-teal-200"
                        : isCustom
                        ? "bg-purple-100 text-purple-800 border border-purple-200"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                      <UserCheck className="w-3 h-3" />
                      {servico.pricing_profile}
                    </span>

                    {servico.target_client_name && (
                      <span className="text-[10px] text-slate-500 font-medium truncate max-w-[170px]" title={servico.target_client_name}>
                        • {servico.target_client_name}
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      {getCarrierLogo(servico.preferred_carrier_name) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={getCarrierLogo(servico.preferred_carrier_name)!} 
                          alt={servico.preferred_carrier_name} 
                          className="w-4 h-4 object-contain" 
                        />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className="truncate max-w-[120px] font-medium text-slate-700">{servico.preferred_carrier_name}</span>
                    </div>
                    <div className="flex items-center gap-1 font-bold text-emerald-700">
                      <span>+{servico.global_markup_pct}% Markup</span>
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredServicos.length === 0 && (
              <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                Nenhuma tabela de preço Linke encontrada para os filtros selecionados.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Detailed Service View & Price Table */}
        <div className="lg:col-span-8">
          {currentServico ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              
              {/* Header Details */}
              <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-sm"
                      style={{ backgroundColor: currentServico.color }}
                    >
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold text-slate-900">
                          {currentServico.name}
                        </h2>
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-xs font-semibold rounded-md border border-slate-200">
                          {currentServico.code}
                        </span>
                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">
                          {currentServico.pricing_profile}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {currentServico.description || "Tabela de preços de venda personalizada."}
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Duplicate / Clone for VIP Button */}
                    <button
                      onClick={() => onDuplicateServico(currentServico)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold rounded-lg transition-colors"
                      title="Criar nova variante de preço para cliente com mais volume"
                    >
                      <Copy className="w-3.5 h-3.5 text-teal-600" />
                      Duplicar p/ Cliente VIP
                    </button>

                    <button
                      onClick={() => onEditServico(currentServico)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar
                    </button>

                    <button
                      onClick={() => onToggleStatus(currentServico.id, !currentServico.is_active)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        currentServico.is_active
                          ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      }`}
                    >
                      {currentServico.is_active ? "Desativar" : "Ativar"}
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Eliminar a tabela '${currentServico.name}'?`)) {
                          onDeleteServico(currentServico.id)
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar Tabela"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Target Client & Operational Parameters */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-slate-100">
                  <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="text-[11px] font-medium text-slate-400 block">Cliente / Alvo</span>
                    <span className="text-xs font-bold text-slate-800 block mt-0.5 truncate" title={currentServico.target_client_name}>
                      {currentServico.target_client_name || "Clientes Gerais"}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="text-[11px] font-medium text-slate-400 block">Transportador Parceiro</span>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mt-0.5 truncate">
                      {getCarrierLogo(currentServico.preferred_carrier_name) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={getCarrierLogo(currentServico.preferred_carrier_name)!} 
                          alt={currentServico.preferred_carrier_name} 
                          className="w-4 h-4 object-contain flex-shrink-0" 
                        />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      )}
                      {currentServico.preferred_carrier_name}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="text-[11px] font-medium text-slate-400 block">Webservice API</span>
                    <span className="text-xs font-bold text-slate-800 block mt-0.5 truncate">
                      {currentServico.webservice_connection_id ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          {currentServico.webservice_service_code || "API Conectada"}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">Manual / Offline</span>
                      )}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="text-[11px] font-medium text-slate-400 block">Markup Médio</span>
                    <span className="text-xs font-bold text-emerald-700 block mt-0.5">
                      +{currentServico.global_markup_pct}% sobre custo
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="text-[11px] font-medium text-slate-400 block">Prazo de Entrega</span>
                    <span className="text-xs font-bold text-slate-800 block mt-0.5">
                      {currentServico.transit_time_label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Price Tables per Zone */}
              <div className="p-6 space-y-6">
                {currentServico.zones.map((zone) => (
                  <div key={zone.zone_code} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        <h3 className="font-bold text-sm text-slate-800">
                          {zone.zone_name}
                        </h3>
                        <span className="text-xs font-mono text-slate-400">
                          ({zone.zone_code})
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {zone.tiers.length} escalões de peso
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Escalão / Peso</th>
                            <th className="py-3 px-4 text-right">Custo Parceiro (€)</th>
                            <th className="py-3 px-4 text-center">Markup (%)</th>
                            <th className="py-3 px-4 text-right font-bold text-emerald-800 bg-emerald-50/50">PVP Linke (€)</th>
                            <th className="py-3 px-4 text-right text-slate-700">Lucro Bruto (€)</th>
                            <th className="py-3 px-4 text-center">Prazo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {zone.tiers.map((tier) => {
                            const cost = Number(tier.cost_price || 0)
                            const sell = Number(tier.sell_price || 0)
                            const profit = sell - cost
                            const marginPct = cost > 0 ? ((profit / cost) * 100).toFixed(0) : "0"

                            return (
                              <tr key={tier.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                  {tier.label}
                                </td>
                                <td className="py-3 px-4 text-right font-mono text-slate-600">
                                  {cost.toFixed(2)}€
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                                    +{tier.margin_pct}%
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-sm bg-emerald-50/30">
                                  {sell.toFixed(2)}€
                                </td>
                                <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-800">
                                  +{profit.toFixed(2)}€ <span className="text-[10px] text-slate-400 font-normal">({marginPct}%)</span>
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
                ))}
              </div>

              {/* Bottom Notification Info */}
              <div className="p-4 bg-emerald-50/40 border-t border-emerald-100 flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    Podes duplicar esta tabela para criar tarifários com desconto para clientes com grande volume de expedição.
                  </span>
                </div>
                <span className="font-semibold text-emerald-800 whitespace-nowrap">
                  TMS Linke Multi-Cliente
                </span>
              </div>

            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
              Selecione um serviço na lista à esquerda para visualizar a tabela de preços.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
