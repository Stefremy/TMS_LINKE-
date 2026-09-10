"use client"

import * as React from "react"
import { 
  Package, 
  Building2, 
  TrendingUp, 
  Calculator, 
  Plus, 
  Layers, 
  ShieldCheck, 
  Percent, 
  ArrowUpRight,
  RefreshCw,
  Sparkles,
  Users,
  Globe
} from "lucide-react"

import type { ServicoLinke } from "../types"
import type { Fornecedor } from "@/app/ops/entidades/fornecedores/types"
import { 
  saveServicoLinkeAction, 
  duplicateServicoForClientAction,
  toggleServicoLinkeStatusAction, 
  deleteServicoLinkeAction, 
  updateServicoMarkupAction 
} from "@/app/actions/servicos-linke"

import { TabelasLinkeTab } from "./TabelasLinkeTab"
import { TabelasFornecedoresTab } from "./TabelasFornecedoresTab"
import { MatrizRentabilidadeTab } from "./MatrizRentabilidadeTab"
import { SimuladorCotacaoTab } from "./SimuladorCotacaoTab"
import { ServicoModal } from "./ServicoModal"
import { DuplicateServicoModal } from "./DuplicateServicoModal"

interface ServicosLinkeClientProps {
  initialServicos: ServicoLinke[]
  initialFornecedores: Fornecedor[]
  initialWebservices?: any[]
}

type TabType = "tabelas_linke" | "tabelas_fornecedores" | "matriz_rentabilidade" | "simulador"

export function ServicosLinkeClient({
  initialServicos,
  initialFornecedores,
  initialWebservices = [],
}: ServicosLinkeClientProps) {
  const [servicos, setServicos] = React.useState<ServicoLinke[]>(initialServicos)
  const [fornecedores] = React.useState<Fornecedor[]>(initialFornecedores)
  const [webservices] = React.useState<any[]>(initialWebservices)
  const [activeTab, setActiveTab] = React.useState<TabType>("tabelas_linke")
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [selectedServicoForEdit, setSelectedServicoForEdit] = React.useState<ServicoLinke | null>(null)
  
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = React.useState(false)
  const [selectedServicoForDuplicate, setSelectedServicoForDuplicate] = React.useState<ServicoLinke | null>(null)

  const [notification, setNotification] = React.useState<string | null>(null)

  const showNotification = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 4500)
  }

  // Save Service handler
  const handleSaveServico = async (servicoData: Partial<ServicoLinke>) => {
    const res = await saveServicoLinkeAction(servicoData)
    if (res.success && res.data) {
      setServicos((prev) => {
        const index = prev.findIndex((s) => s.id === res.data.id)
        if (index >= 0) {
          const next = [...prev]
          next[index] = res.data
          return next
        }
        return [res.data, ...prev]
      })
      showNotification(`Serviço / Tabela '${res.data.name}' gravado com sucesso!`)
    }
  }

  // Duplicate / Clone Service for VIP/Volume Client
  const handleConfirmDuplicate = async (
    sourceId: string,
    targetProfile: "VIP / Alto Volume" | "E-Commerce PME" | "Tabela Negociada Cliente",
    targetClientName: string,
    discountPct: number
  ) => {
    const res = await duplicateServicoForClientAction(sourceId, targetProfile, targetClientName, discountPct)
    if (res.success && res.data) {
      setServicos((prev) => [res.data!, ...prev])
      showNotification(`Tabela personalizada com -${discountPct}% criada para '${targetClientName}'!`)
    }
  }

  const handleToggleStatus = async (id: string, active: boolean) => {
    await toggleServicoLinkeStatusAction(id, active)
    setServicos((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: active } : s))
    )
    showNotification("Estado do serviço atualizado.")
  }

  const handleDeleteServico = async (id: string) => {
    await deleteServicoLinkeAction(id)
    setServicos((prev) => prev.filter((s) => s.id !== id))
    showNotification("Serviço eliminado com sucesso.")
  }

  const handleQuickMarkupChange = async (servicoId: string, markup: number) => {
    await updateServicoMarkupAction(servicoId, markup)
    setServicos((prev) =>
      prev.map((s) => {
        if (s.id === servicoId) {
          return {
            ...s,
            global_markup_pct: markup,
            zones: s.zones.map((z) => ({
              ...z,
              tiers: z.tiers.map((t) => ({
                ...t,
                margin_pct: markup,
                sell_price: Number((t.cost_price * (1 + markup / 100)).toFixed(2)),
              })),
            })),
          }
        }
        return s
      })
    )
    showNotification(`Markup atualizado para +${markup}%.`)
  }

  // Stats
  const totalServicos = servicos.length
  const servicosAtivos = servicos.filter((s) => s.is_active).length
  const activeWebservicesCount = (webservices && webservices.length > 0)
    ? webservices.filter((w) => w.is_active !== false).length
    : 1
  const vipServicesCount = servicos.filter((s) => s.pricing_profile === "VIP / Alto Volume" || s.pricing_profile === "Tabela Negociada Cliente").length
  const avgMarkup = totalServicos > 0
    ? (servicos.reduce((acc, s) => acc + s.global_markup_pct, 0) / totalServicos).toFixed(1)
    : "0"

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-4 h-4 text-emerald-300" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-700/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Serviços Linke & Gestão de Tarifários
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Crie e edite serviços ilimitados, associe parceiros e configure preços diferenciados para clientes com maior volume de envios.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedServicoForEdit(null)
              setIsModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all hover:shadow-emerald-700/20"
          >
            <Plus className="w-4 h-4" />
            Adicionar Novo Serviço Linke
          </button>
        </div>
      </div>


      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 rounded-xl shadow-2xs">
        <button
          onClick={() => setActiveTab("tabelas_linke")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === "tabelas_linke"
              ? "bg-emerald-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Package className="w-4 h-4" />
          Tabelas Linke (Preços de Venda / PVP)
        </button>

        <button
          onClick={() => setActiveTab("tabelas_fornecedores")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === "tabelas_fornecedores"
              ? "bg-blue-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Tabelas Fornecedores (Custos dos Parceiros)
        </button>

        <button
          onClick={() => setActiveTab("matriz_rentabilidade")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === "matriz_rentabilidade"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Matriz de Rentabilidade (Custo vs PVP)
        </button>

        <button
          onClick={() => setActiveTab("simulador")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === "simulador"
              ? "bg-teal-700 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Calculator className="w-4 h-4" />
          Simulador de Cotação
        </button>
      </div>

      {/* Active Tab Body */}
      <div>
        {activeTab === "tabelas_linke" && (
          <TabelasLinkeTab
            servicos={servicos}
            fornecedores={fornecedores}
            onEditServico={(servico) => {
              setSelectedServicoForEdit(servico)
              setIsModalOpen(true)
            }}
            onNewServico={() => {
              setSelectedServicoForEdit(null)
              setIsModalOpen(true)
            }}
            onDuplicateServico={(servico) => {
              setSelectedServicoForDuplicate(servico)
              setIsDuplicateModalOpen(true)
            }}
            onDeleteServico={handleDeleteServico}
            onToggleStatus={handleToggleStatus}
            onQuickMarkupChange={handleQuickMarkupChange}
          />
        )}

        {activeTab === "tabelas_fornecedores" && (
          <TabelasFornecedoresTab fornecedores={fornecedores} />
        )}

        {activeTab === "matriz_rentabilidade" && (
          <MatrizRentabilidadeTab servicos={servicos} fornecedores={fornecedores} />
        )}

        {activeTab === "simulador" && (
          <SimuladorCotacaoTab servicos={servicos} />
        )}
      </div>

      {/* Bottom Stat KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tabelas & Serviços Linke</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-extrabold text-slate-900">{servicosAtivos}</span>
            <span className="text-xs text-slate-400">/ {totalServicos} configurados</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium block mt-1">
            Criação ilimitada de serviços
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Tabelas VIP / Grande Volume</span>
            <span className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-extrabold text-teal-700">{vipServicesCount}</span>
            <span className="text-xs text-slate-400">tarifas negociadas</span>
          </div>
          <span className="text-[11px] text-teal-600 font-medium block mt-1">
            Preços reduzidos p/ mais envios
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Webservices / APIs Conectadas</span>
            <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
              <Globe className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-extrabold text-blue-700">{activeWebservicesCount}</span>
            <span className="text-xs text-slate-400">webservice ativo</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-bold block mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            CTT Expresso API (Ativa)
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Markup Médio Global</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-extrabold text-emerald-700">+{avgMarkup}%</span>
            <span className="text-xs text-slate-400">sobre custo parceiro</span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">
            Margem comercial calculada
          </span>
        </div>
      </div>

      {/* Modal for Create/Edit Linke Service & Tables */}
      <ServicoModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedServicoForEdit(null)
        }}
        onSave={handleSaveServico}
        initialData={selectedServicoForEdit}
        fornecedores={fornecedores}
        webservices={webservices}
      />

      {/* Modal for Duplicate / Clone for VIP / Multi-Client Table */}
      <DuplicateServicoModal
        isOpen={isDuplicateModalOpen}
        onClose={() => {
          setIsDuplicateModalOpen(false)
          setSelectedServicoForDuplicate(null)
        }}
        servico={selectedServicoForDuplicate}
        onConfirmDuplicate={handleConfirmDuplicate}
      />

    </div>
  )
}
