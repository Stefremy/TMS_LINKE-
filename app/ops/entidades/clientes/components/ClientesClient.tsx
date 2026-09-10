"use client"

import * as React from "react"
import { 
  Plus, 
  ArrowUpDown, 
  Filter, 
  Search, 
  ChevronDown, 
  Building2, 
  Mail, 
  Phone, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  Edit, 
  Trash2, 
  Power,
  RefreshCw,
  MapPin,
  FileText,
  UserCheck,
  ExternalLink
} from "lucide-react"
import { toggleClienteStatusAction, deleteClienteAction } from "@/app/actions/clientes"
import { Cliente, DEFAULT_CLIENT_CATEGORIES } from "../types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"
import { ClienteModal } from "./ClienteModal"
import { ClientAuthModal } from "./ClientAuthModal"

interface ClientesClientProps {
  initialClientes: Cliente[]
  initialServicosLinke?: ServicoLinke[]
}

export function ClientesClient({ initialClientes, initialServicosLinke = [] }: ClientesClientProps) {
  const [clientes, setClientes] = React.useState<Cliente[]>(initialClientes || [])
  const [servicosLinke, setServicosLinke] = React.useState<ServicoLinke[]>(initialServicosLinke || [])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState("Todos")
  const [statusFilter, setStatusFilter] = React.useState("Todos")
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingCliente, setEditingCliente] = React.useState<Cliente | null>(null)
  
  // Auth Modal state
  const [authModalCliente, setAuthModalCliente] = React.useState<Cliente | null>(null)

  // Actions dropdown per row
  const [openActionId, setOpenActionId] = React.useState<string | null>(null)

  // Pagination state
  const [pageSize, setPageSize] = React.useState(25)
  const [currentPage, setCurrentPage] = React.useState(1)

  // Sync with prop updates
  React.useEffect(() => {
    setClientes(initialClientes || [])
  }, [initialClientes])

  // Filtered clients
  const filtered = React.useMemo(() => {
    return clientes.filter((item) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch = !q || (
        item.short_name?.toLowerCase().includes(q) ||
        item.legal_name?.toLowerCase().includes(q) ||
        item.city?.toLowerCase().includes(q) ||
        item.nif?.includes(q) ||
        item.code?.toLowerCase().includes(q) ||
        item.email?.toLowerCase().includes(q) ||
        item.phone?.includes(q)
      )

      const matchesCategory = categoryFilter === "Todos" || item.category === categoryFilter
      const matchesStatus = statusFilter === "Todos" || 
        (statusFilter === "Ativo" && item.is_active) || 
        (statusFilter === "Inativo" && !item.is_active)
      
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [clientes, searchQuery, categoryFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleOpenNewModal = () => {
    setEditingCliente(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (client: Cliente) => {
    setEditingCliente(client)
    setIsModalOpen(true)
    setOpenActionId(null)
  }

  const handleSaved = (saved: Cliente) => {
    setClientes((prev) => {
      const exists = prev.some((c) => c.id === saved.id)
      if (exists) {
        return prev.map((c) => (c.id === saved.id ? saved : c))
      }
      return [saved, ...prev]
    })
  }

  const handleToggleStatus = async (client: Cliente, e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus = !client.is_active
    setClientes((prev) =>
      prev.map((c) => (c.id === client.id ? { ...c, is_active: newStatus } : c))
    )
    setOpenActionId(null)

    try {
      await toggleClienteStatusAction(client.id, newStatus)
    } catch (err: any) {
      alert("Erro ao atualizar estado: " + err.message)
    }
  }

  const handleDelete = async (client: Cliente, e: React.MouseEvent) => {
    e.stopPropagation()
    const confirmed = window.confirm(
      `Tem a certeza que deseja eliminar o cliente "${client.short_name}" (${client.code})?`
    )
    if (!confirmed) return

    setClientes((prev) => prev.filter((c) => c.id !== client.id))
    setSelectedIds((prev) => prev.filter((id) => id !== client.id))
    setOpenActionId(null)

    try {
      await deleteClienteAction(client.id)
    } catch (err: any) {
      alert("Erro ao eliminar: " + err.message)
    }
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map((c) => c.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden" onClick={() => setOpenActionId(null)}>
      
      {/* Top Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Clientes</h1>
            <p className="text-xs text-slate-500">Gestão de contas cliente, faturação, limites de crédito e expedição</p>
          </div>
        </div>

        <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
          <span>Painel de Resumo</span>
          <span>&gt;</span>
          <span>Entidades</span>
          <span>&gt;</span>
          <span className="text-slate-600 font-semibold">Clientes</span>
        </div>
      </div>

      {/* Toolbar Area */}
      <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-[13px]">
        
        {/* Left Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Green Novo Button */}
          <button
            type="button"
            onClick={handleOpenNewModal}
            className="bg-[#10b981] hover:bg-[#059669] active:scale-[0.99] text-white font-bold px-3.5 py-1.5 rounded text-[13px] shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            Novo
          </button>

          {/* Inverter Ordenação */}
          <button 
            type="button"
            onClick={() => setClientes(prev => [...prev].reverse())}
            className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium px-2.5 py-1.5 rounded text-[12px] flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            Ordenar
          </button>

          {/* Filtro Categoria */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded px-2.5 py-1 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="Todos">Todas as Categorias</option>
              {DEFAULT_CLIENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Filtro Estado */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded px-2.5 py-1 shadow-2xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="Todos">Todos os Estados</option>
              <option value="Ativo">Apenas Ativos</option>
              <option value="Inativo">Apenas Inativos</option>
            </select>
          </div>
        </div>

        {/* Right Search Area */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text"
              placeholder="Pesquisar por Código, Nome, NIF, Cidade..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-72 bg-white border border-slate-300 rounded pl-8 pr-3 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
            />
          </div>

          {/* Items per page selector */}
          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
            <span>Ver</span>
            <select 
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="border border-slate-300 rounded bg-white px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4 w-10 text-center">
                <input 
                  type="checkbox"
                  checked={selectedIds.length > 0 && selectedIds.length === filtered.length}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </th>
              <th className="py-3 px-3 w-28">Código</th>
              <th className="py-3 px-3 min-w-[240px]">Cliente / Razão Social</th>
              <th className="py-3 px-3 w-28">NIF</th>
              <th className="py-3 px-3 min-w-[200px]">Contactos</th>
              <th className="py-3 px-3 min-w-[150px]">Localidade & Agência</th>
              <th className="py-3 px-3 min-w-[160px]">Categoria</th>
              <th className="py-3 px-3 w-28">Cond. Pagam.</th>
              <th className="py-3 px-3 w-24 text-right">Plafond</th>
              <th className="py-3 px-3 w-20 text-center">Estado</th>
              <th className="py-3 px-4 w-16 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[13px]">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400">
                  <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <span className="font-medium text-slate-500">Nenhum cliente encontrado</span>
                  <p className="text-xs text-slate-400 mt-0.5">Tente ajustar a sua pesquisa ou adicione um novo cliente.</p>
                </td>
              </tr>
            ) : (
              paginated.map((item) => {
                const isSelected = selectedIds.includes(item.id)
                const isActionOpen = openActionId === item.id

                return (
                  <tr 
                    key={item.id}
                    onClick={() => handleOpenEditModal(item)}
                    className={`transition-colors hover:bg-slate-50/80 cursor-pointer ${
                      isSelected ? "bg-emerald-50/40" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-4 text-center" onClick={(e) => handleToggleSelectRow(item.id, e)}>
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>

                    {/* Código com Color Swatch */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" 
                          style={{ backgroundColor: item.color || "#10b981" }} 
                        />
                        <span className="font-bold text-slate-800 font-mono text-xs">
                          {item.code}
                        </span>
                      </div>
                    </td>

                    {/* Designação Curta / Razão Social */}
                    <td className="py-3.5 px-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 hover:text-emerald-700 transition-colors">
                          {item.short_name}
                        </span>
                        {item.legal_name && item.legal_name !== item.short_name && (
                          <span className="text-[11px] text-slate-500 line-clamp-1">
                            {item.legal_name}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* NIF */}
                    <td className="py-3.5 px-3 font-mono text-xs text-slate-700 font-medium">
                      {item.nif || "—"}
                    </td>

                    {/* Contactos */}
                    <td className="py-3.5 px-3 text-xs text-slate-600">
                      <div className="flex flex-col gap-0.5">
                        {item.email && (
                          <div className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-600 transition-colors">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[190px]">{item.email}</span>
                          </div>
                        )}
                        {item.phone && (
                          <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[11px]">
                            <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{item.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Localidade & Agência */}
                    <td className="py-3.5 px-3 text-xs">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{item.city || "—"}</span>
                        <span className="text-[11px] text-slate-400 truncate max-w-[140px]">{item.billing_agency || "A01"}</span>
                      </div>
                    </td>

                    {/* Categoria */}
                    <td className="py-3.5 px-3">
                      <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                        {item.category}
                      </span>
                    </td>

                    {/* Condições de Pagamento */}
                    <td className="py-3.5 px-3 text-xs text-slate-700 font-medium">
                      {item.payment_terms}
                    </td>

                    {/* Plafond */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-xs text-slate-800">
                      {item.credit_limit ? `${item.credit_limit.toLocaleString("pt-PT")}€` : "—"}
                    </td>

                    {/* Estado */}
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        item.is_active 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {item.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    {/* Ações Dropdown */}
                    <td className="py-3.5 px-4 text-center relative" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={() => setOpenActionId(isActionOpen ? null : item.id)}
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded transition-colors cursor-pointer"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        {isActionOpen && (
                          <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-xl z-30 py-1 text-left animate-in fade-in zoom-in-95 duration-100">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionId(null)
                                handleOpenEditModal(item)
                              }}
                              className="w-full px-3 py-2 text-xs text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 font-bold transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5 text-emerald-600" />
                              Abrir Detalhes do Cliente
                            </button>

                            <div className="my-1 border-t border-slate-100" />

                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionId(null)
                                setAuthModalCliente(item)
                              }}
                              className="w-full px-3 py-2 text-xs text-slate-800 hover:bg-blue-50 hover:text-blue-800 flex items-center gap-2 font-bold transition-colors"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                              Definir Acesso Portal
                            </button>

                            <div className="my-1 border-t border-slate-100" />

                            <button
                              type="button"
                              onClick={(e) => handleToggleStatus(item, e)}
                              className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium"
                            >
                              <Power className="w-3.5 h-3.5 text-amber-500" />
                              {item.is_active ? "Desativar Cliente" : "Ativar Cliente"}
                            </button>

                            <div className="my-1 border-t border-slate-100" />

                            <button
                              type="button"
                              onClick={(e) => handleDelete(item, e)}
                              className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              Eliminar Cliente
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div>
          A mostrar <strong className="text-slate-800">{paginated.length}</strong> de <strong className="text-slate-800">{filtered.length}</strong> clientes registados
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1.5 border border-slate-300 rounded bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <span className="px-2 text-xs font-semibold text-slate-700">
            Página {currentPage} de {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 border border-slate-300 rounded bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <ClienteModal
          initialData={editingCliente}
          servicosLinke={servicosLinke}
          onClose={() => setIsModalOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Auth Modal */}
      {authModalCliente && (
        <ClientAuthModal
          clientId={authModalCliente.id}
          clientName={authModalCliente.short_name}
          clientEmail={authModalCliente.email}
          onClose={() => setAuthModalCliente(null)}
        />
      )}

    </div>
  )
}
