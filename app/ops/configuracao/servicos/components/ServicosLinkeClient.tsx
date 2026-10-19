"use client"

import * as React from "react"
import { 
  Package, 
  Calculator, 
  Plus, 
  Layers, 
  Percent
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
  const baseServicesCount = servicos.filter((s) => s.is_primordial).length
  const customServicesCount = servicos.filter((s) => !s.is_primordial).length
  const avgMarkup = totalServicos > 0
    ? (servicos.reduce((acc, s) => acc + (Number(s.global_markup_pct) || 0), 0) / totalServicos).toFixed(1)
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--surface-bg)] p-5 rounded-xl border border-[var(--border-subtle)] shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#128A47] text-white flex items-center justify-center border border-[#128A47]">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">
                Serviços & Tabelas de Preço
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Custos base de fornecedores (CTT Expresso, Correos Express), margens e tarifários para clientes.
              </p>
            </div>
          </div>
        </div>

        {activeTab === "servicos_linke" && (
          <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedServicoForEdit(null)
              setIsModalOpen(true)
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#128A47] hover:bg-[#0E6C37] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Serviço / Tabela
          </button>
          </div>
        )}
      </div>

      {/* Resumo rápido: sempre visível antes das ferramentas de gestão */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-[var(--surface-bg)] p-3.5 rounded-xl border border-[var(--border-subtle)] border-t-4 border-t-[#008A4B] shadow-sm">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Serviços ativos</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-[#008A4B]">{servicosAtivos}</span>
            <span className="text-xs text-[var(--text-tertiary)]">de {totalServicos}</span>
          </div>
        </div>
        <div className="bg-[var(--surface-bg)] p-3.5 rounded-xl border border-[var(--border-subtle)] border-t-4 border-t-[#155EEF] shadow-sm">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Tabelas base</span>
          <div className="mt-1 text-xl font-bold text-[#155EEF]">{baseServicesCount}</div>
        </div>
        <div className="bg-[var(--surface-bg)] p-3.5 rounded-xl border border-[var(--border-subtle)] border-t-4 border-t-[#E76F61] shadow-sm">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Tabelas personalizadas</span>
          <div className="mt-1 text-xl font-bold text-[#C94F45]">{customServicesCount}</div>
        </div>
        <div className="bg-[var(--surface-bg)] p-3.5 rounded-xl border border-[var(--border-subtle)] border-t-4 border-t-[#007F8B] shadow-sm">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Margem média configurada</span>
          <div className="mt-1 text-xl font-bold text-[#007F8B]">{avgMarkup}%</div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex flex-wrap items-center gap-1.5 border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-1.5 rounded-xl shadow-sm">
        <button
          onClick={() => setActiveTab("servicos_linke")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "servicos_linke"
              ? "bg-[#128A47] text-white shadow-sm"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Serviços e tabelas
        </button>

        <button
          onClick={() => setActiveTab("matriz_margens")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "matriz_margens"
              ? "bg-[#155EEF] text-white shadow-sm"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          Margens dos fornecedores
        </button>

        <button
          onClick={() => setActiveTab("simulador")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "simulador"
              ? "bg-[#007F8B] text-white shadow-sm"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          Simulador de preços
        </button>
      </div>

      {/* Active Tab Body */}
      <div>
        {activeTab === "servicos_linke" && (
          <TabelasLinkeTab
            mode="linke_services"
            servicos={servicos}
            canDeletePrimordial={canDeletePrimordial}
            onEditServico={(servico) => {
              setSelectedServicoForEdit(servico)
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
