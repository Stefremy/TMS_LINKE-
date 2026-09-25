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
import { Button } from "@/components/ui/button"

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
    if (client.code === "CL001") {
      alert("A Conta GO Linke (CL001) é protegida e não pode ser desativada.")
      return
    }
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
    if (client.code === "CL001") {
      alert("A Conta GO Linke (CL001) é protegida e não pode ser eliminada.")
      return
    }
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
    <div className="flex flex-col bg-[var(--surface-bg)] rounded-lg shadow-sm border border-[var(--border-subtle)] overflow-hidden" onClick={() => setOpenActionId(null)}>
      
      {/* Top Header */}
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center border border-[rgba(18,138,71,0.1)]">
            <Building2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Clientes</h1>
            <p className="text-xs text-[var(--text-secondary)]">Gestão de contas cliente, faturação e expedição</p>
          </div>
        </div>

        <div className="text-[10px] font-semibold text-[var(--text-tertiary)] flex items-center gap-1.5 uppercase tracking-wide">
          <span>Entidades</span>
          <span className="text-[var(--border-strong)]">&gt;</span>
          <span className="text-[var(--text-secondary)]">Clientes</span>
        </div>
      </div>

      {/* Toolbar Area */}
      <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-bg)] flex flex-wrap items-center justify-between gap-3 text-xs">
        
        {/* Left Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleOpenNewModal} size="sm" className="font-semibold px-3 py-1.5 h-auto text-xs shadow-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setClientes(prev => [...prev].reverse())}
            className="px-2.5 py-1.5 h-auto text-[11px] font-medium shadow-xs"
          >
            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 opacity-70" />
            Ordenar
          </Button>

          {/* Filtro Categoria */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-bg)] border border-[var(--border-strong)] rounded-md px-2.5 py-1.5 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-[11px] font-medium text-[var(--text-primary)] bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="Todos">Todas as Categorias</option>
              {DEFAULT_CLIENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Filtro Estado */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-bg)] border border-[var(--border-strong)] rounded-md px-2.5 py-1.5 shadow-2xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[11px] font-medium text-[var(--text-primary)] bg-transparent focus:outline-none cursor-pointer"
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
            <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text"
              placeholder="Pesquisar por Código, Nome, NIF..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-64 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
            />
          </div>

          {/* Items per page selector */}
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] font-medium">
            <span>Ver</span>
            <select 
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="border border-[var(--border-strong)] rounded-md bg-[var(--surface-bg)] px-1.5 py-0.5 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] shadow-2xs cursor-pointer"
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
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider text-[10px]">
              <th className="py-2.5 px-4 w-10 text-center">
                <input 
                  type="checkbox"
                  checked={selectedIds.length > 0 && selectedIds.length === filtered.length}
                  onChange={handleSelectAll}
                  className="rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-[var(--accent-active)] cursor-pointer"
                />
              </th>
              <th className="py-2.5 px-3 w-28">Código</th>
              <th className="py-2.5 px-3 min-w-[240px]">Cliente / Razão Social</th>
              <th className="py-2.5 px-3 w-28">NIF</th>
              <th className="py-2.5 px-3 min-w-[200px]">Contactos</th>
              <th className="py-2.5 px-3 min-w-[150px]">Localidade & Agência</th>
              <th className="py-2.5 px-3 min-w-[140px]">Categoria</th>
              <th className="py-2.5 px-3 w-24">Cond. Pagam.</th>
              <th className="py-2.5 px-3 w-24 text-right">Crédito</th>
              <th className="py-2.5 px-3 w-20 text-center">Estado</th>
              <th className="py-2.5 px-4 w-12 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)] text-[12px] bg-[var(--surface-bg)]">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-[var(--text-secondary)]">
                  <Building2 className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2 opacity-50" />
                  <span className="font-semibold">Nenhum cliente encontrado</span>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Tente ajustar a sua pesquisa ou adicione um novo cliente.</p>
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
                    className={`transition-colors cursor-pointer ${
                      !item.is_active
                        ? "bg-[var(--status-critical-soft)] hover:bg-[rgba(220,38,38,0.15)] text-[var(--text-primary)]"
                        : isSelected 
                        ? "bg-[var(--accent-soft)] hover:bg-[rgba(18,138,71,0.15)]" 
                        : "hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-4 text-center" onClick={(e) => handleToggleSelectRow(item.id, e)}>
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-[var(--accent-active)] cursor-pointer"
                      />
                    </td>

                    {/* Código com Color Swatch */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs" 
                          style={{ backgroundColor: item.color || "var(--accent)" }} 
                        />
                        <span className="font-semibold text-[var(--text-primary)] font-mono text-[11px]">
                          {item.code}
                        </span>
                      </div>
                    </td>

                    {/* Designação Curta / Razão Social com Avatar/Logo da Marca */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-[10px] shadow-2xs shrink-0 overflow-hidden border border-[var(--border-subtle)]"
                          style={{ backgroundColor: item.color || "var(--accent)" }}
                        >
                          {item.logo_url ? (
                            <img 
                              src={item.logo_url} 
                              alt={item.short_name} 
                              className="w-full h-full object-cover bg-white"
                            />
                          ) : (
                            <span>{item.short_name ? item.short_name.substring(0, 2).toUpperCase() : <Building2 className="w-3.5 h-3.5" />}</span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-[var(--text-primary)] hover:text-[var(--accent-hover)] transition-colors text-xs truncate">
                            {item.short_name}
                          </span>
                          {item.legal_name && item.legal_name !== item.short_name && (
                            <span className="text-[10px] text-[var(--text-tertiary)] line-clamp-1 mt-0.5">
                              {item.legal_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* NIF */}
                    <td className="py-3 px-3 font-mono text-[11px] text-[var(--text-secondary)] font-medium">
                      {item.nif || "—"}
                    </td>

                    {/* Contactos */}
                    <td className="py-3 px-3 text-[11px] text-[var(--text-secondary)]">
                      <div className="flex flex-col gap-1">
                        {item.email && (
                          <div className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors">
                            <Mail className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />
                            <span className="truncate max-w-[190px]">{item.email}</span>
                          </div>
                        )}
                        {item.phone && (
                          <div className="flex items-center gap-1.5 font-mono text-[10px]">
                            <Phone className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />
                            <span>{item.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Localidade & Agência */}
                    <td className="py-3 px-3 text-[11px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-[var(--text-primary)]">{item.city || "—"}</span>
                        <span className="text-[10px] text-[var(--text-tertiary)] truncate max-w-[140px]">{item.billing_agency || "A01"}</span>
                      </div>
                    </td>

                    {/* Categoria */}
                    <td className="py-3 px-3">
                      <span className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide">
                        {item.category}
                      </span>
                    </td>

                    {/* Condições de Pagamento */}
                    <td className="py-3 px-3 text-[11px] text-[var(--text-secondary)] font-medium">
                      {item.payment_terms}
                    </td>

                    {/* Crédito */}
                    <td className="py-3 px-3 text-right font-mono text-[11px] text-[var(--text-primary)]">
                      {item.credit_limit ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`font-semibold ${item.available_credit !== undefined && item.available_credit < item.credit_limit * 0.2 ? 'text-[var(--status-critical)]' : ''}`}>
                            {item.available_credit !== undefined ? item.available_credit.toLocaleString("pt-PT") : item.credit_limit.toLocaleString("pt-PT")}€
                          </span>
                          <span className="text-[9px] text-[var(--text-tertiary)]">
                            de {item.credit_limit.toLocaleString("pt-PT")}€
                          </span>
                        </div>
                      ) : <span className="text-[var(--text-tertiary)]">—</span>}
                    </td>

                    {/* Estado */}
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        item.is_active 
                          ? "bg-[var(--status-success-soft)] text-[var(--status-success)] border border-[rgba(18,138,71,0.2)]" 
                          : "bg-[var(--surface-bg)] text-[var(--status-critical)] border border-[var(--status-critical-soft)] shadow-2xs"
                      }`}>
                        <span className={`w-1 h-1 rounded-full ${item.is_active ? "bg-[var(--status-success)]" : "bg-[var(--status-critical)]"}`} />
                        {item.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    {/* Ações Dropdown */}
                    <td className="py-3 px-4 text-center relative" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={() => setOpenActionId(isActionOpen ? null : item.id)}
                          className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] rounded transition-colors cursor-pointer border border-transparent hover:border-[var(--border-subtle)]"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>

                        {isActionOpen && (
                          <div className="absolute right-0 top-full mt-1 w-52 bg-[var(--surface-bg)] border border-[var(--border-strong)] rounded-md shadow-[var(--shadow-layer)] z-30 py-1 text-left">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionId(null)
                                handleOpenEditModal(item)
                              }}
                              className="w-full px-3 py-2 text-[11px] text-[var(--text-primary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-hover)] flex items-center gap-2 font-semibold transition-colors"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              Abrir Detalhes do Cliente
                            </button>

                            <div className="my-1 border-t border-[var(--border-subtle)]" />

                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionId(null)
                                setAuthModalCliente(item)
                              }}
                              className="w-full px-3 py-2 text-[11px] text-[var(--text-primary)] hover:bg-[var(--status-info-soft)] hover:text-[var(--status-info)] flex items-center gap-2 font-semibold transition-colors"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Definir Acesso Portal
                            </button>

                            <div className="my-1 border-t border-[var(--border-subtle)]" />

                            <button
                              type="button"
                              onClick={(e) => handleToggleStatus(item, e)}
                              className="w-full px-3 py-1.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] flex items-center gap-2 font-medium"
                            >
                              <Power className="w-3.5 h-3.5" />
                              {item.is_active ? "Desativar Cliente" : "Ativar Cliente"}
                            </button>

                            <div className="my-1 border-t border-[var(--border-subtle)]" />

                            <button
                              type="button"
                              onClick={(e) => handleDelete(item, e)}
                              className="w-full px-3 py-1.5 text-[11px] text-[var(--status-critical)] hover:bg-[var(--status-critical-soft)] flex items-center gap-2 font-medium"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
      <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-bg)] flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--text-secondary)]">
        <div>
          A mostrar <strong className="text-[var(--text-primary)] font-semibold">{paginated.length}</strong> de <strong className="text-[var(--text-primary)] font-semibold">{filtered.length}</strong> clientes registados
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="w-6 h-6 p-0 rounded"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>

          <span className="px-1.5 text-[11px] font-semibold text-[var(--text-primary)]">
            Página {currentPage} de {totalPages}
          </span>

          <Button
            variant="outline"
            size="icon"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="w-6 h-6 p-0 rounded"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
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
