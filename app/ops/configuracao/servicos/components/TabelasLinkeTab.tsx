"use client"

import * as React from "react"
import { 
  Package, 
  Search, 
  Edit3, 
  Trash2, 
  Copy,
  ShieldCheck, 
  Lock,
  Percent,
  ChevronDown,
} from "lucide-react"
import { DestinationBadge } from "./DestinationIcons"
import { CttServiceBadge } from "@/components/ctt-service-badge"
import { getCttServiceIdentity } from "@/lib/services/ctt/service-identity"
import { getCarrierLogo } from "@/lib/carrier-logos"
import type { ServicoLinke } from "../types"
import { isPrimordialServico } from "../types"

interface TabelasLinkeTabProps {
  mode?: "base" | "custom" | "linke_services"
  servicos: ServicoLinke[]
  onEditServico: (servico: ServicoLinke) => void
  onDuplicateServico: (servico: ServicoLinke) => void
  onDeleteServico: (id: string) => void
  onToggleStatus: (id: string, active: boolean) => void
  onQuickMarkupChange: (servicoId: string, markup: number) => void
}

export function TabelasLinkeTab({
  mode = "base",
  servicos,
  onEditServico,
  onDuplicateServico,
  onDeleteServico,
  onToggleStatus,
  onQuickMarkupChange,
}: TabelasLinkeTabProps) {
  const isLinkeServicesMode = mode === "linke_services" || mode === "custom"
  const [searchTerm, setSearchTerm] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"active" | "inactive" | "all">("active")
  const [selectedCategory, setSelectedCategory] = React.useState<string>("Todas")
  const [selectedProfile, setSelectedProfile] = React.useState<string>("Todos os Perfis")
  const [sectionFilter, setSectionFilter] = React.useState<"all" | "og" | "custom">("all")
  const [activeServicoId, setActiveServicoId] = React.useState<string>(
    servicos[0]?.id || ""
  )

  const categories = ["Todas", ...new Set(servicos.map(s => s.category))]
  const profiles = ["Todos os Perfis", "Standard / Geral", "VIP / Alto Volume", "E-Commerce PME", "Tabela Negociada Cliente"]

  const filteredServicos = servicos.filter((s) => {
    if (!isLinkeServicesMode && s.pricing_profile === "Tabela Negociada Cliente") {
      return false
    }

    const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    const identity = getCttServiceIdentity(s)
    const query = normalizeSearch(searchTerm)
    const matchesSearch = [s.name, s.code, s.preferred_carrier_name, s.target_client_name,
      s.webservice_service_code, identity?.label].some(value => value && normalizeSearch(value).includes(query))

    const matchesCategory = selectedCategory === "Todas" || s.category === selectedCategory
    const matchesProfile = selectedProfile === "Todos os Perfis" || s.pricing_profile === selectedProfile

    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? s.is_active !== false : s.is_active === false)
    return matchesSearch && matchesCategory && matchesProfile && matchesStatus
  })

  const getCarrierRank = (s: Partial<ServicoLinke>) => {
    const c = (s.preferred_carrier_name || "").toLowerCase()
    if (c.includes("ctt")) return 1
    if (c.includes("correos")) return 2
    return 3
  }

  const ogServicos = filteredServicos
    .filter((s) => isPrimordialServico(s))
    .sort((a, b) => getCarrierRank(a) - getCarrierRank(b))
  const customServicos = filteredServicos
    .filter((s) => !isPrimordialServico(s))
    .sort((a, b) => getCarrierRank(a) - getCarrierRank(b))

  const visibleServicos = filteredServicos
    .filter(s => sectionFilter === "all" || (sectionFilter === "og" ? isPrimordialServico(s) : !isPrimordialServico(s)))
    .sort((a, b) => getCarrierRank(a) - getCarrierRank(b))
  const currentServico = visibleServicos.find((s) => s.id === activeServicoId) || visibleServicos[0]
  const [quickMarkupInput, setQuickMarkupInput] = React.useState<number>(currentServico?.global_markup_pct ?? 22)

  React.useEffect(() => {
    if (currentServico) {
      setQuickMarkupInput(currentServico.global_markup_pct ?? 22)
    }
  }, [currentServico?.id, currentServico?.global_markup_pct])

  const renderServiceCard = (servico: ServicoLinke) => {
    const isSelected = servico.id === currentServico?.id
    const isOg = isPrimordialServico(servico)

    return (
      <button
        type="button"
        key={servico.id}
        onClick={() => setActiveServicoId(servico.id)}
        aria-pressed={isSelected}
        className={`w-full rounded-lg border p-3 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128A47] ${
          isSelected ? "border-[#128A47] bg-[var(--surface-bg)] ring-1 ring-[#128A47]" : "border-[var(--border-subtle)] bg-[var(--surface-bg)] hover:border-[var(--border-strong)]"
        }`}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--border-subtle)] bg-white p-1">
            {getCarrierLogo(servico.preferred_carrier_name) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={getCarrierLogo(servico.preferred_carrier_name)!} alt={servico.preferred_carrier_name} className="max-h-full max-w-full object-contain" />
            ) : <Package className="h-4 w-4 text-slate-500" />}
          </div>
          <div className="min-w-0 flex-1">
            <span className="block font-semibold leading-5 text-[var(--text-primary)]">{servico.name}</span>
            <span className="mt-0.5 block text-[11px] text-[var(--text-secondary)]">{servico.category} · {servico.preferred_carrier_name || "Transportador por definir"}</span>
          </div>
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${servico.is_active !== false ? "bg-[#128A47]" : "bg-slate-400"}`} title={servico.is_active !== false ? "Ativo" : "Inativo"} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--text-tertiary)]">
          <span className="inline-flex items-center gap-1">{isOg && <Lock className="h-2.5 w-2.5" />}{isOg ? "Tabela base" : "Personalizada"}</span>
          {servico.target_client_name && <span>{servico.target_client_name}</span>}
          {servico.is_active === false && <span>Inativo</span>}
          {isSelected && <span className="ml-auto font-semibold text-[#128A47]">A consultar</span>}
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shadow-2xs">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <label className="min-w-0 flex-1 text-[11px] font-semibold text-[var(--text-secondary)]">
            Pesquisar tabelas
            <span className="relative mt-1 block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input type="search" placeholder="Nome, cliente ou transportador…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] py-2 pl-9 pr-3 text-xs font-normal text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#128A47]" />
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:w-auto">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Estado
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="mt-1 block w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2.5 py-2 text-xs font-normal text-[var(--text-primary)]">
                <option value="active">Ativos ({servicos.filter(s => s.is_active !== false).length})</option>
                <option value="inactive">Inativos ({servicos.filter(s => s.is_active === false).length})</option>
                <option value="all">Todos ({servicos.length})</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Destino
              <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2.5 py-2 text-xs font-normal text-[var(--text-primary)]">
                {categories.map(category => <option key={category} value={category}>{category === "Todas" ? "Todos os destinos" : category}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Tipo de tabela
              <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value as typeof sectionFilter)} className="mt-1 block w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2.5 py-2 text-xs font-normal text-[var(--text-primary)]">
                <option value="all">Todas</option><option value="og">Tabelas base</option><option value="custom">Personalizadas</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Perfil de preços
              <select value={selectedProfile} onChange={e => setSelectedProfile(e.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-2.5 py-2 text-xs font-normal text-[var(--text-primary)]">
                {profiles.map(profile => <option key={profile} value={profile}>{profile === "Todos os Perfis" ? "Todos os perfis" : profile}</option>)}
              </select>
            </label>
          </div>
        </div>
        {(searchTerm || selectedCategory !== "Todas" || sectionFilter !== "all" || selectedProfile !== "Todos os Perfis" || statusFilter !== "active") && (
          <button type="button" onClick={() => { setSearchTerm(""); setSelectedCategory("Todas"); setSectionFilter("all"); setSelectedProfile("Todos os Perfis"); setStatusFilter("active") }} className="mt-3 text-xs font-medium text-[var(--accent)] hover:underline">Limpar filtros</button>
        )}
      </div>

      {/* Main Grid: Left Service Selector + Right Price Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Side: Services List */}
        <div className="min-w-0 lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1 text-xs"><h2 className="font-semibold text-[var(--text-primary)]">Escolha uma tabela</h2><span className="text-[var(--text-secondary)]">{visibleServicos.length} resultado(s)</span></div>
          <select aria-label="Tabela a consultar" value={currentServico?.id || ""} onChange={e => setActiveServicoId(e.target.value)}
            className="block w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2.5 text-xs text-[var(--text-primary)] lg:hidden">
            {visibleServicos.length === 0 && <option value="">Nenhuma tabela encontrada</option>}
            {visibleServicos.map(service => <option key={service.id} value={service.id}>{service.name} · {service.category}</option>)}
          </select>
          <div className="hidden space-y-4 max-h-[750px] overflow-y-auto pr-1 lg:block">
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

            {visibleServicos.length === 0 && (
              <div className="p-8 text-center bg-white rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
                Nenhuma tabela encontrada para os filtros selecionados.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Detailed Service View & Price Table */}
        <div className="min-w-0 lg:col-span-8">
          {currentServico ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              
              {/* Header Details */}
              <div className="p-5 border-b border-slate-200/80">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
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
                        <CttServiceBadge service={currentServico} />
                        {isPrimordialServico(currentServico) ? (
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
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => onDuplicateServico(currentServico)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors shadow-2xs"
                      title="Criar variante para cliente específico"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      Criar variante
                    </button>

                    <button
                      onClick={() => onEditServico(currentServico)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                      Editar tabela
                    </button>

                    <button
                      onClick={() => onToggleStatus(currentServico.id, !currentServico.is_active)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg transition-colors shadow-2xs"
                    >
                      {currentServico.is_active ? "Desativar" : "Ativar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Eliminar a tabela '${currentServico.name}'?`)) {
                          onDeleteServico(currentServico.id)
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Eliminar Tabela"
                      aria-label={`Eliminar tabela ${currentServico.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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

              <details key={`markup-${currentServico.id}`} className="group border-b border-slate-200/80">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50/60 px-5 py-3 text-xs font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-2"><Percent className="h-3.5 w-3.5" />Ajustar margem e recalcular preços</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                {/* Quick Margin & Markup Adjustment Bar */}
                <div className="bg-slate-50/70 border-b border-slate-200/80 px-5 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shrink-0">
                      <Percent className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">
                        Acréscimo sobre o custo: +{currentServico.global_markup_pct ?? 20}%
                      </span>
                      <p className="text-[11px] text-slate-500">
                        Ao aplicar, os preços de venda desta tabela serão recalculados a partir dos custos.
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
                        }}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-all ${
                          quickMarkupInput === pct
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
                        Aplicar margem
                      </button>
                    </div>
                  </div>
                </div>
              </details>

              {/* Price Tables per Zone */}
              <div className="p-5 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><h3 className="text-sm font-semibold text-slate-900">Preços por destino e peso</h3><p className="mt-1 text-xs text-slate-500">Valores base sem IVA, combustível e serviços adicionais.</p></div>
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">Combustível: {currentServico.fuel_surcharge_pct == null ? "Conforme cliente" : `${currentServico.fuel_surcharge_pct}%`}</span>
                </div>
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
