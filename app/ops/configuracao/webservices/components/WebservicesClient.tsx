"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  Plus, 
  Settings, 
  Power, 
  Check, 
  X, 
  Search, 
  ChevronDown, 
  Edit2, 
  Trash2, 
  Package, 
  Loader2,
  CheckCircle2,
  AlertTriangle
} from "lucide-react"
import { NewConnectionWizard } from "./NewConnectionWizard"
import { 
  toggleCarrierConnectionAction, 
  deleteCarrierConnectionAction 
} from "@/app/actions/ctt"
import type { Fornecedor } from "@/app/ops/entidades/fornecedores/types"

const tabs = [
  { id: "transportadoras", label: "Transportadoras", icon: Package },
]

interface WebservicesClientProps {
  connections: any[]
  fornecedores?: Fornecedor[]
}

export function WebservicesClient({ connections: initialConnections, fornecedores = [] }: WebservicesClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState("transportadoras")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isWizardOpen, setIsWizardOpen] = React.useState(false)
  const [editingConnection, setEditingConnection] = React.useState<any | null>(null)
  const [connections, setConnections] = React.useState(initialConnections || [])
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [togglingId, setTogglingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<{ message: string; type: "success" | "error" } | null>(null)

  React.useEffect(() => {
    setConnections(initialConnections || [])
  }, [initialConnections])

  // Clear feedback after 4 seconds
  React.useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  const handleOpenNewWizard = () => {
    setEditingConnection(null)
    setIsWizardOpen(true)
  }

  const handleOpenEditWizard = (conn: any) => {
    setEditingConnection(conn)
    setIsWizardOpen(true)
  }

  const handleConnectionSaved = (newConn: any) => {
    setConnections(prev => {
      const filtered = prev.filter(c => c.id !== newConn.id && c.carrier_code !== newConn.carrier_code)
      return [newConn, ...filtered]
    })
    setFeedback({
      message: `Ligação "${newConn.description}" gravada com sucesso!`,
      type: "success"
    })
  }

  const handleToggleActive = async (conn: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const nextState = !conn.is_active
    setTogglingId(conn.id)

    // Optimistic UI update
    setConnections(prev =>
      prev.map(c => (c.id === conn.id ? { ...c, is_active: nextState } : c))
    )

    try {
      await toggleCarrierConnectionAction(conn.id, nextState, conn.carrier_code)
      router.refresh()
      setFeedback({
        message: `Ligação ${nextState ? "ativada" : "desativada"} com sucesso.`,
        type: "success"
      })
    } catch (err: any) {
      // Revert optimistic update
      setConnections(prev =>
        prev.map(c => (c.id === conn.id ? { ...c, is_active: !nextState } : c))
      )
      setFeedback({
        message: `Erro ao alterar estado: ${err.message}`,
        type: "error"
      })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDeleteConnection = async (conn: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const confirmed = window.confirm(
      `Tem a certeza de que deseja eliminar a ligação "${conn.description}" (${conn.carrier_code})?\nEsta ação não pode ser revertida.`
    )
    if (!confirmed) return

    setDeletingId(conn.id)
    try {
      await deleteCarrierConnectionAction(conn.id, conn.carrier_code)
      setConnections(prev => prev.filter(c => c.id !== conn.id && c.carrier_code !== conn.carrier_code))
      setSelectedIds(prev => prev.filter(id => id !== conn.id))
      router.refresh()
      setFeedback({
        message: `Ligação "${conn.description}" eliminada com sucesso.`,
        type: "success"
      })
    } catch (err: any) {
      setFeedback({
        message: `Erro ao eliminar ligação: ${err.message}`,
        type: "error"
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredConnections.map(c => c.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleBulkToggleActive = async () => {
    if (selectedIds.length === 0) {
      alert("Selecione pelo menos uma ligação na tabela.")
      return
    }

    const selectedConns = connections.filter(c => selectedIds.includes(c.id))
    const shouldActivate = selectedConns.some(c => !c.is_active)

    setConnections(prev =>
      prev.map(c =>
        selectedIds.includes(c.id) ? { ...c, is_active: shouldActivate } : c
      )
    )

    for (const conn of selectedConns) {
      try {
        await toggleCarrierConnectionAction(conn.id, shouldActivate, conn.carrier_code)
      } catch (err) {
        console.error("Bulk toggle error for:", conn.id, err)
      }
    }

    router.refresh()
    setFeedback({
      message: `${selectedConns.length} ligação(ões) ${shouldActivate ? "ativadas" : "desativadas"} com sucesso.`,
      type: "success"
    })
  }

  const filteredConnections = connections.filter((conn) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      conn.description?.toLowerCase().includes(q) ||
      conn.carrier_code?.toLowerCase().includes(q) ||
      conn.client_id?.toLowerCase().includes(q)
    )
  })

  const isAllSelected =
    filteredConnections.length > 0 &&
    filteredConnections.every(c => selectedIds.includes(c.id))

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-[var(--surface-bg)] rounded-lg shadow-sm border border-[var(--border-subtle)] overflow-hidden relative">
      
      {/* Toast Feedback */}
      {feedback && (
        <div className={`absolute top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-[12px] font-semibold transition-all animate-in fade-in slide-in-from-top-2 ${
          feedback.type === "success" ? "bg-[var(--status-success)] text-white" : "bg-[var(--status-critical)] text-white"
        }`}>
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header Area */}
      <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">Webservices Globais</h1>
          <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5">Ligações a transportadoras e APIs externas</p>
        </div>
        <div className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1">
          Configuração <span className="mx-1 text-base leading-none">›</span> <span className="text-[var(--text-primary)] font-semibold">Webservices</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] shrink-0 overflow-x-auto">
        <div className="flex items-center gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 py-2.5 px-1 border-b-2 text-[12px] font-semibold transition-colors whitespace-nowrap ${
                  isActive 
                    ? "border-[var(--accent)] text-[var(--accent)]" 
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Toolbar Area */}
      <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-bg)] shrink-0">
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleOpenNewWizard}
            className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-[0.99] text-white px-3 py-1.5 rounded-md text-[12px] font-bold shadow-xs transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={3} />
            Nova Ligação
          </button>
          
          <button 
            onClick={handleBulkToggleActive}
            disabled={selectedIds.length === 0}
            className={`border px-3 py-1.5 rounded-md text-[12px] font-semibold shadow-xs transition-colors flex items-center gap-1.5 ${
              selectedIds.length > 0
                ? "bg-[var(--surface-bg)] border-[var(--border-strong)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] cursor-pointer"
                : "bg-[var(--surface-muted)] border-[var(--border-subtle)] text-[var(--text-tertiary)] cursor-not-allowed"
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            Ativar/Desativar ({selectedIds.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input 
              type="text" 
              placeholder="Pesquisar ligações..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-8 pr-3 py-1.5 bg-[var(--surface-muted)] border border-[var(--border-strong)] rounded-md text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] shadow-2xs transition-colors"
            />
          </div>
        </div>

      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-[var(--surface-muted)]">
        <table className="w-full text-left text-[12px] whitespace-nowrap">
          <thead className="bg-[var(--surface-bg)] sticky top-0 z-10 border-b border-[var(--border-subtle)]">
            <tr>
              <th className="px-4 py-2.5 w-10">
                <input 
                  type="checkbox" 
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer" 
                />
              </th>
              <th className="px-3 py-2.5 font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Descrição</th>
              <th className="px-3 py-2.5 font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Fornecedor</th>
              <th className="px-3 py-2.5 font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Client ID</th>
              <th className="px-3 py-2.5 font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Contrato</th>
              <th className="px-3 py-2.5 font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px] text-center">Ambiente</th>
              <th className="px-3 py-2.5 font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px] text-center">Ativo</th>
              <th className="px-3 py-2.5 font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px]">Criado em</th>
              <th className="px-4 py-2.5 font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[10px] text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--surface-bg)]">
            {filteredConnections.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-[var(--text-tertiary)] text-[13px] font-medium">
                  Nenhuma ligação configurada.
                </td>
              </tr>
            ) : filteredConnections.map((conn) => {
              const isSelected = selectedIds.includes(conn.id)
              const isToggling = togglingId === conn.id
              const isDeleting = deletingId === conn.id

              return (
                <tr 
                  key={conn.id} 
                  onClick={() => handleOpenEditWizard(conn)}
                  className={`hover:bg-[var(--surface-muted)] transition-colors cursor-pointer group ${
                    isSelected ? "bg-[var(--accent-soft)]" : ""
                  }`}
                >
                  <td className="px-4 py-3 align-middle" onClick={(e) => handleToggleSelectRow(conn.id, e)}>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer" 
                    />
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-bold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors flex items-center gap-1.5">
                      {conn.description}
                    </div>
                    <div className="text-[10px] font-mono font-semibold text-[var(--text-tertiary)] bg-[var(--surface-muted)] inline-block px-1.5 py-0.5 rounded border border-[var(--border-subtle)] mt-0.5">
                      {conn.carrier_code}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[var(--text-primary)] font-medium">
                    {(() => {
                      const sid = conn.supplier_id
                      if (!sid || sid === "none") {
                        return <span className="text-[var(--text-tertiary)] text-[11px] italic">Não associado</span>
                      }
                      const match = fornecedores.find(
                        f => f.id === sid || f.code.toLowerCase() === sid.toLowerCase() || f.id.endsWith(sid)
                      )
                      if (match) {
                        return (
                          <div className="flex items-center gap-1.5">
                            <span 
                              className="w-2 h-2 rounded-full shrink-0 shadow-xs" 
                              style={{ backgroundColor: match.color || "#00a3e0" }} 
                            />
                            <span className="font-bold text-[var(--text-primary)] text-[12px]">{match.short_name}</span>
                            <span className="text-[10px] font-mono font-bold bg-[var(--surface-muted)] text-[var(--text-secondary)] px-1 py-0.5 rounded border border-[var(--border-subtle)]">
                              {match.code}
                            </span>
                          </div>
                        )
                      }
                      const fallbackLabel = 
                        sid === "ctt_portugal" ? "CTT Portugal" :
                        sid === "ctt_expresso" ? "CTT Expresso" :
                        sid === "dpd_portugal" ? "DPD Portugal" :
                        sid === "gls_portugal" ? "GLS Portugal" :
                        (conn.carrier_code?.replace(/_/g, " ").toUpperCase() || "CTT")

                      return (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[var(--status-critical)] shrink-0" />
                          <span className="font-bold text-[var(--text-primary)] text-[12px]">{fallbackLabel}</span>
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-3 py-3 text-[var(--text-secondary)] font-mono text-[11px]">{conn.client_id}</td>
                  <td className="px-3 py-3 font-mono text-[11px] text-[var(--text-secondary)]">{conn.contract_number}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      conn.environment === 'production' 
                        ? 'bg-[rgba(59,130,246,0.1)] text-blue-600 border border-[rgba(59,130,246,0.2)]' 
                        : 'bg-[var(--status-warning-soft)] text-[var(--status-warning)] border border-[rgba(217,119,6,0.2)]'
                    }`}>
                      {conn.environment || 'QA'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={(e) => handleToggleActive(conn, e)}
                      title={conn.is_active ? "Clique para desativar" : "Clique para ativar"}
                      className={`inline-flex items-center justify-center w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--accent)] cursor-pointer ${
                        conn.is_active ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'
                      }`}
                    >
                      {isToggling ? (
                        <Loader2 className="w-3 h-3 text-white animate-spin" />
                      ) : (
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                          conn.is_active ? 'translate-x-2.5' : '-translate-x-2.5'
                        }`} />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-[var(--text-tertiary)] text-[11px]">
                    {new Date(conn.created_at).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        type="button"
                        onClick={() => handleOpenEditWizard(conn)}
                        className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] border border-[var(--border-subtle)] hover:border-[rgba(18,138,71,0.2)] rounded-md transition-all shadow-2xs" 
                        title="Editar Ligação"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => handleDeleteConnection(conn, e)}
                        className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--status-critical)] hover:bg-[var(--status-critical-soft)] border border-[var(--border-subtle)] hover:border-[rgba(220,38,38,0.2)] rounded-md transition-all shadow-2xs" 
                        title="Eliminar Ligação"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--status-critical)]" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {isWizardOpen && (
        <NewConnectionWizard 
          initialData={editingConnection}
          onClose={() => {
            setIsWizardOpen(false)
            setEditingConnection(null)
          }} 
          onSaved={handleConnectionSaved}
        />
      )}
    </div>
  )
}

