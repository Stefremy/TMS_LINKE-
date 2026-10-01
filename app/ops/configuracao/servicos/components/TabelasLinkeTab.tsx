"use client"

import * as React from "react"
import { 
  Package, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Copy,
  ShieldCheck, 
  Lock,
  MapPin,
  Percent,
  TrendingUp,
  DollarSign
} from "lucide-react"
import { DestinationBadge } from "./DestinationIcons"
import { getCarrierLogo } from "@/lib/carrier-logos"
import type { ServicoLinke } from "../types"
import type { Fornecedor } from "@/app/ops/entidades/fornecedores/types"

interface TabelasLinkeTabProps {
  mode?: "base" | "custom" | "linke_services"
  servicos: ServicoLinke[]
  fornecedores: Fornecedor[]
  canDeletePrimordial?: boolean
  onEditServico: (servico: ServicoLinke) => void
  onNewServico: () => void
  onDuplicateServico: (servico: ServicoLinke) => void
  onDeleteServico: (id: string) => void
  onToggleStatus: (id: string, active: boolean) => void
  onQuickMarkupChange: (servicoId: string, markup: number) => void
}

export function TabelasLinkeTab({
  mode = "base",
  servicos,
  fornecedores,
  canDeletePrimordial = false,
  onEditServico,
  onNewServico,
  onDuplicateServico,
  onDeleteServico,
  onToggleStatus,
  onQuickMarkupChange,
}: TabelasLinkeTabProps) {
  const isLinkeServicesMode = mode === "linke_services" || mode === "custom"
  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedCategory, setSelectedCategory] = React.useState<string>("Todas")
  const [selectedProfile, setSelectedProfile] = React.useState<string>("Todos os Perfis")
  const [sectionFilter, setSectionFilter] = React.useState<"all" | "og" | "custom">("all")
  const [activeServicoId, setActiveServicoId] = React.useState<string>(
    servicos[0]?.id || ""
  )

  const categories = ["Todas", "Nacional", "Ibérico", "Ilhas", "Internacional", "Especial / Recolhas", "Ponto / Locky", "Paletes / Carga"]
  const profiles = ["Todos os Perfis", "Standard / Geral", "VIP / Alto Volume", "E-Commerce PME", "Tabela Negociada Cliente"]

  const filteredServicos = servicos.filter((s) => {
    if (!isLinkeServicesMode && s.pricing_profile === "Tabela Negociada Cliente") {
      return false
    }

    const matchesSearch = 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.preferred_carrier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.target_client_name && s.target_client_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.webservice_service_code && s.webservice_service_code.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesCategory = selectedCategory === "Todas" || s.category === selectedCategory
    const matchesProfile = selectedProfile === "Todos os Perfis" || s.pricing_profile === selectedProfile

    return matchesSearch && matchesCategory && matchesProfile
  })

  const ogServicos = filteredServicos.filter((s) => Boolean(s.is_primordial))
  const customServicos = filteredServicos.filter((s) => !s.is_primordial)

  const currentServico = servicos.find((s) => s.id === activeServicoId) || filteredServicos[0]
  const [quickMarkupInput, setQuickMarkupInput] = React.useState<number>(currentServico?.global_markup_pct || 22)

  React.useEffect(() => {
    if (currentServico) {
      setQuickMarkupInput(currentServico.global_markup_pct || 22)
    }
  }, [currentServico?.id, currentServico?.global_markup_pct])

  const renderServiceCard = (servico: ServicoLinke) => {
    const isSelected = servico.id === currentServico?.id
    const isCustom = servico.pricing_profile === "Tabela Negociada Cliente"
    const isOg = Boolean(servico.is_primordial)

    return (
      <div
        key={servico.id}
        onClick={() => setActiveServicoId(servico.id)}
        className={`p-3 rounded-lg border transition-all cursor-pointer text-xs ${
          isSelected
            ? "bg-slate-50 border-slate-900 shadow-2xs"
            : "bg-white border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {getCarrierLogo(servico.preferred_carrier_name) ? (
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-white border border-slate-200 shadow-2xs shrink-0 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getCarrierLogo(servico.preferred_carrier_name)!}
                  alt={servico.preferred_carrier_name}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center font-medium text-xs text-white shrink-0"
                style={{ backgroundColor: servico.color || "#0f172a" }}
              >
                {servico.code.substring(0, 3)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h4 className="font-medium text-xs text-slate-900 truncate">
                  {servico.name}
                </h4>
                {isOg && (
                  <span title="Tabela Base Contratada" className="text-slate-400 shrink-0">
                    <Lock className="w-2.5 h-2.5" />
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-mono block truncate">
                {servico.code}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className={`w-1.5 h-1.5 rounded-full ${servico.is_active ? "bg-emerald-500" : "bg-slate-300"}`} />
            <span className="text-[10px] text-slate-500">
              {servico.is_active ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {isOg ? (
            <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
              Base Oficial
            </span>
          ) : (
            <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
              Personalizada
            </span>
          )}

          {servico.webservice_service_code && (
            <span className="text-[10px] font-mono text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded" title="Código de Subproduto WebService">
              {servico.webservice_service_code}
            </span>
          )}

          {servico.target_client_name && !isOg && (
            <span className="text-[10px] text-slate-500 truncate max-w-[130px]" title={servico.target_client_name}>
              {servico.target_client_name}
            </span>
          )}
        </div>

        {/* Destination Coverage Badges */}
        {servico.allowed_zones && servico.allowed_zones.length > 0 && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            {servico.allowed_zones.slice(0, 3).map((z) => (
              <span key={z} className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200/60">
                <DestinationBadge code={z} showLabel={true} />
              </span>
            ))}
            {servico.allowed_zones.length > 3 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                +{servico.allowed_zones.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="truncate max-w-[140px]">{servico.preferred_carrier_name}</span>
          <span className="font-medium text-slate-600 shrink-0">{servico.transit_time_label || "24h"}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Top Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between w-full">
          {/* Search Box */}
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar tabela, subproduto ou transportador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>

          {/* Segment Tabs (All / Base / Custom) */}
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/60 shrink-0">
            <button
              type="button"
              onClick={() => setSectionFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                sectionFilter === "all"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todas ({filteredServicos.length})
            </button>
            <button
              type="button"
              onClick={() => setSectionFilter("og")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                sectionFilter === "og"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Lock className="w-3 h-3 text-slate-400" />
              Tabelas Base ({ogServicos.length})
            </button>
            <button
              type="button"
              onClick={() => setSectionFilter("custom")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                sectionFilter === "custom"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Personalizadas ({customServicos.length})
            </button>
          </div>

          {/* Profile Filter Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
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
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium shadow-2xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            {isLinkeServicesMode ? "Novo Serviço" : "Nova Tabela"}
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pt-2 border-t border-slate-100">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Left Service Selector + Right Price Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Side: Services List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="space-y-4 max-h-[750px] overflow-y-auto pr-1">
            {/* Tabelas Base Section */}
            {(sectionFilter === "all" || sectionFilter === "og") && ogServicos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1 py-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-slate-400" />
                    Tabelas Base Contratadas
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {ogServicos.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {ogServicos.map(renderServiceCard)}
                </div>
              </div>
            )}

            {/* Tabelas Personalizadas Section */}
            {(sectionFilter === "all" || sectionFilter === "custom") && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between px-1 py-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Tabelas Personalizadas & Clientes
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {customServicos.length}
                  </span>
                </div>

                {customServicos.length > 0 ? (
                  <div className="space-y-2">
                    {customServicos.map(renderServiceCard)}
                  </div>
                ) : (
                  <div className="p-4 text-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-slate-400 text-xs">
                    Nenhuma tabela personalizada criada.
                  </div>
                )}
              </div>
            )}

            {filteredServicos.length === 0 && (
              <div className="p-8 text-center bg-white rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
                Nenhuma tabela encontrada para os filtros selecionados.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Detailed Service View & Price Table */}
        <div className="lg:col-span-8">
          {currentServico ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              
              {/* Header Details */}
              <div className="p-5 border-b border-slate-200/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0">
                      <Package className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-semibold text-slate-900">
                          {currentServico.name}
                        </h2>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-mono text-xs font-medium rounded border border-slate-200/80">
                          {currentServico.code}
                        </span>
                        {currentServico.is_primordial ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200/80 text-xs font-medium rounded flex items-center gap-1">
                            <Lock className="w-3 h-3 text-slate-400" /> Tabela Base
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-medium rounded">
                            Personalizada
                          </span>
                        )}
                        <span className="text-xs text-slate-500 font-medium">
                          {currentServico.pricing_profile}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {currentServico.description || "Tabela de preços de expedição."}
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onDuplicateServico(currentServico)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors shadow-2xs"
                      title="Criar variante para cliente específico"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      Duplicar
                    </button>

                    <button
                      onClick={() => onEditServico(currentServico)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                      Editar
                    </button>

                    <button
                      onClick={() => onToggleStatus(currentServico.id, !currentServico.is_active)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors shadow-2xs"
                    >
                      {currentServico.is_active ? "Desativar" : "Ativar"}
                    </button>

                    {/* Delete button: Protected if base table */}
                    {currentServico.is_primordial ? (
                      canDeletePrimordial ? (
                        <button
                          onClick={() => {
                            if (confirm(`Eliminar a tabela base '${currentServico.name}'?`)) {
                              onDeleteServico(currentServico.id)
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Eliminar Tabela Base (Admin)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          disabled
                          className="p-1.5 text-slate-300 rounded-lg cursor-not-allowed"
                          title="Tabela base protegida contra eliminação"
                        >
                          <Lock className="w-4 h-4 text-slate-300" />
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => {
                          if (confirm(`Eliminar a tabela '${currentServico.name}'?`)) {
                            onDeleteServico(currentServico.id)
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Eliminar Tabela"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Meta Parameters Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200/60">
                    <span className="text-[11px] text-slate-400 block">Cliente / Alvo</span>
                    <span className="font-medium text-slate-800 block mt-0.5 truncate" title={currentServico.target_client_name}>
                      {currentServico.target_client_name || "Clientes Gerais"}
                    </span>
                  </div>
                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200/60">
                    <span className="text-[11px] text-slate-400 block">Transportador</span>
                    <span className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5 truncate">
                      {getCarrierLogo(currentServico.preferred_carrier_name) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img 
                          src={getCarrierLogo(currentServico.preferred_carrier_name)!} 
                          alt={currentServico.preferred_carrier_name} 
                          className="w-3.5 h-3.5 object-contain shrink-0" 
                        />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      {currentServico.preferred_carrier_name}
                    </span>
                  </div>
                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200/60">
                    <span className="text-[11px] text-slate-400 block">Webservice API</span>
                    <span className="font-medium text-slate-800 block mt-0.5 truncate">
                      {currentServico.webservice_service_code ? (
                        <span className="font-mono text-slate-700">
                          {currentServico.webservice_service_code}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">Offline</span>
                      )}
                    </span>
                  </div>
                  <div className="bg-slate-50/60 p-2.5 rounded-lg border border-slate-200/60">
                    <span className="text-[11px] text-slate-400 block">Prazo</span>
                    <span className="font-medium text-slate-800 block mt-0.5">
                      {currentServico.transit_time_label || "24h"}
                    </span>
                  </div>
                </div>

                {/* Destinos e Cobertura Geográfica */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Destinos:
                    </span>
                    {(!currentServico.allowed_zones || currentServico.allowed_zones.length === 0) ? (
                      <span className="text-xs text-slate-500 italic">
                        Todas as zonas da tabela
                      </span>
                    ) : (
                      currentServico.allowed_zones.map((code) => {
                        const labels: Record<string, string> = {
                          "PT-CONT": "Portugal Continental",
                          "PT-ILHAS": "Ilhas PT",
                          "ES-PENIN": "Espanha Peninsular",
                          "ES-ILHAS": "Ilhas ES",
                          "EU-Z1": "Europa Z1",
                          "EU-Z2": "Europa Z2",
                          "EU-Z3": "Europa Z3",
                          "INTL-AERO": "Aéreo",
                          "INTL-MAR": "Marítimo",
                          "INTL": "Internacional",
                        }
                        return (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-medium"
                          >
                            <DestinationBadge code={code} />
                            <span>{labels[code] || code}</span>
                          </span>
                        )
                      })
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {currentServico.allowed_zones?.length || 0} destino(s)
                  </span>
                </div>
              </div>

              {/* Quick Margin & Markup Adjustment Bar */}
              <div className="bg-slate-50/70 border-b border-slate-200/80 px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                    <Percent className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">
                      Margem Base Linke: +{currentServico.global_markup_pct || 20}%
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Calcula o Preço de Venda Linke sobre o custo base de {currentServico.preferred_carrier_name}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-medium">Atalhos:</span>
                  {[18, 20, 22, 25, 28, 30].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setQuickMarkupInput(pct)
                        onQuickMarkupChange(currentServico.id, pct)
                      }}
                      className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                        currentServico.global_markup_pct === pct
                          ? "bg-slate-900 text-white shadow-2xs"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      +{pct}%
                    </button>
                  ))}

                  <div className="inline-flex items-center gap-1 ml-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                    <input
                      type="number"
                      value={quickMarkupInput}
                      onChange={(e) => setQuickMarkupInput(parseFloat(e.target.value) || 0)}
                      className="w-12 px-1.5 py-0.5 text-xs font-mono font-bold text-center text-slate-800 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400 font-bold pr-1">%</span>
                    <button
                      type="button"
                      onClick={() => onQuickMarkupChange(currentServico.id, quickMarkupInput)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-medium rounded-md transition-colors"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>

              {/* Price Tables per Zone */}
              <div className="p-5 space-y-6">
                {currentServico.zones.map((zone, idx) => {
                  const tiers = zone.tiers || []
                  const costs = tiers.map(t => Number(t.cost_price || 0))
                  const sells = tiers.map(t => Number(t.sell_price || 0))
                  const minCost = costs.length > 0 ? Math.min(...costs) : 0
                  const maxCost = costs.length > 0 ? Math.max(...costs) : 0
                  const minSell = sells.length > 0 ? Math.min(...sells) : 0
                  const maxSell = sells.length > 0 ? Math.max(...sells) : 0
                  const avgProfit = tiers.length > 0
                    ? tiers.reduce((acc, t) => acc + (Number(t.sell_price || 0) - Number(t.cost_price || 0)), 0) / tiers.length
                    : 0

                  return (
                    <div key={zone.zone_code || (zone as any).id || idx} className="space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          <h3 className="font-semibold text-xs text-slate-800">
                            {zone.zone_name || (zone as any).name}
                          </h3>
                          <span className="text-[11px] font-mono text-slate-400">
                            ({zone.zone_code || "N/A"})
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                          <span>{tiers.length} escalões</span>
                          <span>•</span>
                          <span>
                            Custo {currentServico.preferred_carrier_name}: <strong className="text-slate-700 font-mono">{minCost.toFixed(2)}€ - {maxCost.toFixed(2)}€</strong>
                          </span>
                          <span>•</span>
                          <span>
                            PVP Linke: <strong className="text-slate-900 font-mono">{minSell.toFixed(2)}€ - {maxSell.toFixed(2)}€</strong>
                          </span>
                          <span>•</span>
                          <span className="text-emerald-700 font-semibold font-mono">
                            Lucro Médio: +{avgProfit.toFixed(2)}€
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 font-medium">Escalão / Peso</th>
                              <th className="py-2.5 px-3 text-right font-medium text-slate-700" title={`Preço base cobrado por ${currentServico.preferred_carrier_name}`}>
                                Custo Fornecedor (€)
                              </th>
                              <th className="py-2.5 px-3 text-center font-medium">Margem (%)</th>
                              <th className="py-2.5 px-3 text-right font-semibold text-slate-900">
                                Preço Venda Cliente (€)
                              </th>
                              <th className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                                Lucro Bruto (€)
                              </th>
                              <th className="py-2.5 px-3 text-center font-medium">Prazo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {tiers.map((tier) => {
                              const cost = Number(tier.cost_price || 0)
                              const sell = Number(tier.sell_price || (cost * (1 + (tier.margin_pct || currentServico.global_markup_pct || 20) / 100)))
                              const profit = sell - cost
                              const margin = cost > 0 ? Number(tier.margin_pct || Math.round(((profit / cost) * 100))) : 0

                              return (
                                <tr key={tier.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-2 px-3 font-medium text-slate-800">
                                    {tier.label}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-600 bg-slate-50/30">
                                    {cost.toFixed(2)}€
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700">
                                      +{margin}%
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                                    {sell.toFixed(2)}€
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                    +{profit.toFixed(2)}€
                                  </td>
                                  <td className="py-2 px-3 text-center text-slate-500 font-medium">
                                    {tier.delivery_time}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
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
