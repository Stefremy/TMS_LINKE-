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
import { isPrimordialServico } from "../types"
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
  canManageBaseTables?: boolean
}

type TabType = "servicos_linke" | "matriz_margens" | "simulador"

export function ServicosLinkeClient({
  initialServicos,
  initialFornecedores,
  initialWebservices = [],
  canManageBaseTables = false,
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
  const handleSaveServico = async (servicoData: Partial<ServicoLinke>): Promise<ServicoLinke | false> => {
    const res = await saveServicoLinkeAction(servicoData)
    if (res.success && res.data) {
      const savedData = res.data
      setServicos((prev) => {
        const index = prev.findIndex((s) => s.id === savedData.id)
        if (index >= 0) {
          const next = [...prev]
          next[index] = savedData
          return next
        }
        return [savedData, ...prev]
      })
      showNotification(`Serviço / Tabela '${savedData.name}' gravado com sucesso!`)
      return savedData
    }
    showNotification(res.error || "Não foi possível gravar esta tabela. Tente novamente.")
    return false
  }

  // Duplicate / Clone Service for VIP/Volume Client
  const handleConfirmDuplicate = async (
    sourceId: string,
    targetProfile: string,
    targetClientName: string
  ) => {
    const res = await duplicateServicoForClientAction(sourceId, targetProfile, targetClientName)
    if (res.success && res.data) {
      setServicos((prev) => [res.data!, ...prev])
      showNotification(`Tabela personalizada criada para '${targetClientName}' com os preços da tabela de origem!`)
      return true
    }
    showNotification(res.error || "Não foi possível duplicar esta tabela. Tente novamente.")
    return false
  }

  const handleToggleStatus = async (id: string, active: boolean) => {
    const res = await toggleServicoLinkeStatusAction(id, active)
    if (!res.success) {
      showNotification(res.error || "Não foi possível alterar o estado desta tabela.")
      return
    }
    setServicos((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: active } : s))
    )
    showNotification("Estado do serviço atualizado.")
  }

  const handleDeleteServico = async (id: string) => {
    const target = servicos.find((s) => s.id === id)
    if (target && isPrimordialServico(target)) {
      showNotification("Esta tabela base contratada está bloqueada e não pode ser eliminada.")
      return
    }
    try {
      const res = await deleteServicoLinkeAction(id)
      if (!res.success) {
        showNotification(res.error || "Não foi possível eliminar esta tabela. Tente novamente.")
        return
      }
      setServicos((prev) => prev.filter((s) => s.id !== id))
      showNotification("Tabela eliminada com sucesso.")
    } catch {
      showNotification("Não foi possível eliminar esta tabela. Tente novamente.")
    }
  }

  const handleQuickMarkupChange = async (servicoId: string, markup: number) => {
    const res = await updateServicoMarkupAction(servicoId, markup)
    if (!res.success) {
      showNotification(res.error || "Não foi possível atualizar a margem desta tabela.")
      return
    }
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
  const servicosAtivos = servicos.filter((s) => s.is_active !== false).length
  const baseServicesCount = servicos.filter(isPrimordialServico).length
  const customServicesCount = servicos.filter((s) => !isPrimordialServico(s)).length

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
                Tabelas de preços e serviços
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Consulte preços por destino e peso. Atribua as tabelas na ficha de cada cliente.
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
            Nova tabela
          </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#128A47]" /><strong className="font-semibold text-[var(--text-primary)]">{servicosAtivos}</strong> ativos</span>
        <span><strong className="font-semibold text-[var(--text-primary)]">{baseServicesCount}</strong> tabelas base</span>
        <span><strong className="font-semibold text-[var(--text-primary)]">{customServicesCount}</strong> personalizadas</span>
        <span className="text-[var(--text-tertiary)]">{totalServicos - servicosAtivos} inativos</span>
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
          Tabelas de preços
        </button>

        <button
          onClick={() => setActiveTab("matriz_margens")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "matriz_margens"
              ? "bg-[#128A47] text-white shadow-sm"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          Custos e margens
        </button>

        <button
          onClick={() => setActiveTab("simulador")}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === "simulador"
              ? "bg-[#128A47] text-white shadow-sm"
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
            canManageBaseTables={canManageBaseTables}
            onEditServico={(servico) => {
              if (isPrimordialServico(servico) && !canManageBaseTables) {
                showNotification("Esta tabela base contratada está bloqueada. Apenas stefano.remy e geral@linke podem editar tabelas base.")
                return
              }
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
