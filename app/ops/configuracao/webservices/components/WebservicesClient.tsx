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

const tabs = [
  { id: "transportadoras", label: "Transportadoras", icon: Package },
]

interface WebservicesClientProps {
  connections: any[]
}

export function WebservicesClient({ connections: initialConnections }: WebservicesClientProps) {
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
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
      
      {/* Toast Feedback */}
      {feedback && (
        <div className={`absolute top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-sm font-semibold transition-all animate-in fade-in slide-in-from-top-2 ${
          feedback.type === "success" ? "bg-emerald-800 text-white" : "bg-red-800 text-white"
        }`}>
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header Area */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-slate-800">Webservices Globais</h1>
        <div className="text-sm font-medium text-slate-500 flex items-center">
          Configuração <span className="mx-1 text-lg leading-none mb-1">&rsaquo;</span> <span className="text-slate-800">Webservices Globais</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 border-b border-slate-200 bg-slate-50 shrink-0 overflow-x-auto hide-scrollbar">
        <div className="flex items-center gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-semibold text-[13px] transition-colors whitespace-nowrap ${
                  isActive 
                    ? "border-green-600 text-green-700" 
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Toolbar Area */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleOpenNewWizard}
            className="bg-green-600 hover:bg-green-700 active:scale-[0.99] text-white px-3.5 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            Nova Ligação
          </button>
          
          <button 
            onClick={handleBulkToggleActive}
            disabled={selectedIds.length === 0}
            className={`border px-3.5 py-1.5 rounded-lg text-sm font-semibold shadow-xs transition-colors flex items-center gap-1.5 ${
              selectedIds.length > 0
                ? "bg-white border-slate-300 hover:bg-slate-50 text-slate-700 cursor-pointer"
                : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Power className="w-4 h-4" />
            Ativar/Desativar em Massa ({selectedIds.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Pesquisar ligações..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-8 pr-3 py-1 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm h-8"
            />
          </div>
        </div>

      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-slate-50">
        <table className="w-full text-left text-[13px] whitespace-nowrap pb-32">
          <thead className="bg-white sticky top-0 z-10 shadow-sm">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 w-10">
                <input 
                  type="checkbox" 
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer" 
                />
              </th>
              <th className="px-3 py-3 font-bold text-slate-700">Descrição</th>
              <th className="px-3 py-3 font-bold text-slate-700">Fornecedor</th>
              <th className="px-3 py-3 font-bold text-slate-700">Client ID</th>
              <th className="px-3 py-3 font-bold text-slate-700">Contrato</th>
              <th className="px-3 py-3 font-bold text-slate-700 text-center">Ambiente</th>
              <th className="px-3 py-3 font-bold text-slate-700 text-center">Ativo</th>
              <th className="px-3 py-3 font-bold text-slate-700">Criado em</th>
              <th className="px-4 py-3 font-bold text-slate-700 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredConnections.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
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
                  className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                    isSelected ? "bg-green-50/40" : ""
                  }`}
                >
                  <td className="px-4 py-3.5 align-middle" onClick={(e) => handleToggleSelectRow(conn.id, e)}>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer" 
                    />
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="font-bold text-slate-800 hover:text-green-700 transition-colors flex items-center gap-1.5">
                      {conn.description}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium bg-slate-100 inline-block px-1.5 py-0.5 rounded mt-0.5">
                      {conn.carrier_code}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-slate-700 font-medium">
                    {conn.supplier_id === "ctt_portugal" ? "CTT Portugal" :
                     conn.supplier_id === "ctt_expresso" ? "CTT Expresso" :
                     conn.supplier_id === "dpd_portugal" ? "DPD Portugal" :
                     conn.supplier_id === "gls_portugal" ? "GLS Portugal" :
                     (conn.carrier_code?.replace(/_/g, " ").toUpperCase() || "CTT")}
                  </td>
                  <td className="px-3 py-3.5 text-slate-700 font-mono text-xs">{conn.client_id}</td>
                  <td className="px-3 py-3.5 font-mono text-xs text-slate-600">{conn.contract_number}</td>
                  <td className="px-3 py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      conn.environment === 'production' 
                        ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                        : 'bg-orange-100 text-orange-700 border border-orange-200'
                    }`}>
                      {conn.environment || 'QA'}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={(e) => handleToggleActive(conn, e)}
                      title={conn.is_active ? "Clique para desativar" : "Clique para ativar"}
                      className={`inline-flex items-center justify-center w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 cursor-pointer ${
                        conn.is_active ? 'bg-emerald-600' : 'bg-slate-300'
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
                  <td className="px-3 py-3.5 text-slate-500 text-xs">
                    {new Date(conn.created_at).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button 
                        type="button"
                        onClick={() => handleOpenEditWizard(conn)}
                        className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg transition-all shadow-2xs" 
                        title="Editar Ligação"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        disabled={isDeleting}
                        onClick={(e) => handleDeleteConnection(conn, e)}
                        className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg transition-all shadow-2xs" 
                        title="Eliminar Ligação"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
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
