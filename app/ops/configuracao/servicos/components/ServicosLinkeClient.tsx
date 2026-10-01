"use client"

import * as React from "react"
import { 
  Package, 
  Building2, 
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
import { SimuladorCotacaoTab } from "./SimuladorCotacaoTab"
import { MatrizRentabilidadeTab } from "./MatrizRentabilidadeTab"
import { ServicoModal } from "./ServicoModal"
import { DuplicateServicoModal } from "./DuplicateServicoModal"

interface ServicosLinkeClientProps {
  initialServicos: ServicoLinke[]
  initialFornecedores: Fornecedor[]
  initialWebservices?: any[]
  canDeletePrimordial?: boolean
}

type TabType = "servicos_linke" | "matriz_margens" | "simulador"

export function ServicosLinkeClient({
  initialServicos,
  initialFornecedores,
  initialWebservices = [],
  canDeletePrimordial = false,
}: ServicosLinkeClientProps) {
  const [servicos, setServicos] = React.useState<ServicoLinke[]>(initialServicos)
  const [fornecedores] = React.useState<Fornecedor[]>(initialFornecedores)
  const [webservices] = React.useState<any[]>(initialWebservices)
  const [activeTab, setActiveTab] = React.useState<TabType>("servicos_linke")
  
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
    const res = await deleteServicoLinkeAction(id)
    if (res && res.success === false) {
      showNotification(res.error || "Apenas o Administrador Principal (Stefano) tem autorização para eliminar tabelas base primordiais.")
      return
    }
    setServicos((prev) => prev.filter((s) => s.id !== id))
    showNotification("Tabela eliminada com sucesso.")
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
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-4 duration-200">
          <span>{notification}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center border border-slate-200/80">
              <Package className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
                Serviços & Tabelas de Preço
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Custos base de fornecedores (CTT Expresso, Correos Express), margens e tarifários para clientes.
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Serviço / Tabela
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 bg-white px-3 py-1.5 rounded-xl shadow-2xs">
        <button
          onClick={() => setActiveTab("servicos_linke")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "servicos_linke"
              ? "bg-slate-900 text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Tabelas de Preço & Serviços
        </button>

        <button
          onClick={() => setActiveTab("matriz_margens")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "matriz_margens"
              ? "bg-slate-900 text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          Matriz de Margens dos Fornecedores
        </button>

        <button
          onClick={() => setActiveTab("simulador")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "simulador"
              ? "bg-slate-900 text-white shadow-2xs"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          Simulador de Cotação
        </button>
      </div>

      {/* Active Tab Body */}
      <div>
        {activeTab === "servicos_linke" && (
          <TabelasLinkeTab
            mode="linke_services"
            servicos={servicos}
            fornecedores={fornecedores}
            canDeletePrimordial={canDeletePrimordial}
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

        {activeTab === "matriz_margens" && (
          <MatrizRentabilidadeTab
            servicos={servicos}
            fornecedores={fornecedores}
          />
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
            <span className="text-xs font-semibold text-slate-500">Transportadores Parceiros</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-extrabold text-slate-900">{fornecedores.length}</span>
            <span className="text-xs text-slate-400">parceiros registados</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold block mt-1">
            Rede Integrada & Contratos
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
