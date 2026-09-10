"use client"

import * as React from "react"
import { 
  Plus, 
  ArrowUpDown, 
  Wrench, 
  Filter, 
  Search, 
  ChevronDown, 
  Truck, 
  Mail, 
  Phone, 
  CheckCircle2, 
  XCircle, 
  ChevronLeft, 
  ChevronRight, 
  Edit, 
  Trash2, 
  Power,
  Check
} from "lucide-react"
import { toggleFornecedorStatusAction, deleteFornecedorAction } from "@/app/actions/fornecedores"
import { Fornecedor } from "@/app/ops/entidades/fornecedores/types"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { FornecedorModal } from "./FornecedorModal"

interface FornecedoresClientProps {
  initialFornecedores: Fornecedor[]
}

export function FornecedoresClient({ initialFornecedores }: FornecedoresClientProps) {
  const [fornecedores, setFornecedores] = React.useState<Fornecedor[]>(initialFornecedores || [])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [codeFilter, setCodeFilter] = React.useState("")
  const [typeFilter, setTypeFilter] = React.useState("Todos")
  const [categoryFilter, setCategoryFilter] = React.useState("Todos")
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [editingFornecedor, setEditingFornecedor] = React.useState<Fornecedor | null>(null)

  // Actions dropdown per row
  const [openActionId, setOpenActionId] = React.useState<string | null>(null)

  // Pagination state
  const [pageSize, setPageSize] = React.useState(25)
  const [currentPage, setCurrentPage] = React.useState(1)

  // Sync with prop updates
  React.useEffect(() => {
    setFornecedores(initialFornecedores || [])
  }, [initialFornecedores])

  // Filtered suppliers
  const filtered = React.useMemo(() => {
    return fornecedores.filter((item) => {
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

      const matchesCode = !codeFilter.trim() || item.code?.toLowerCase().includes(codeFilter.toLowerCase().trim())
      const matchesType = typeFilter === "Todos" || item.role?.toLowerCase().includes(typeFilter.toLowerCase())
      
      return matchesSearch && matchesCode && matchesType
    })
  }, [fornecedores, searchQuery, codeFilter, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleOpenNewModal = () => {
    setEditingFornecedor(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (forn: Fornecedor) => {
    setEditingFornecedor(forn)
    setIsModalOpen(true)
    setOpenActionId(null)
  }

  const handleSaved = (saved: Fornecedor) => {
    setFornecedores((prev) => {
      const exists = prev.some((f) => f.id === saved.id)
      if (exists) {
        return prev.map((f) => (f.id === saved.id ? saved : f))
      }
      return [saved, ...prev]
    })
  }

  const handleToggleStatus = async (forn: Fornecedor, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const nextState = !forn.is_active
    setFornecedores((prev) =>
      prev.map((f) => (f.id === forn.id ? { ...f, is_active: nextState } : f))
    )
    setOpenActionId(null)
    try {
      await toggleFornecedorStatusAction(forn.id, nextState)
    } catch {
      // Revert if error
      setFornecedores((prev) =>
        prev.map((f) => (f.id === forn.id ? { ...f, is_active: !nextState } : f))
      )
    }
  }

  const handleDelete = async (forn: Fornecedor, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const confirmed = window.confirm(`Tem a certeza de que deseja eliminar o fornecedor "${forn.short_name}"?`)
    if (!confirmed) return

    setFornecedores((prev) => prev.filter((f) => f.id !== forn.id))
    setSelectedIds((prev) => prev.filter((id) => id !== forn.id))
    setOpenActionId(null)

    try {
      await deleteFornecedorAction(forn.id)
    } catch (err: any) {
      alert("Erro ao eliminar: " + err.message)
    }
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map((f) => f.id))
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
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Fornecedores</h1>
        <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
          <span>Painel de Resumo</span>
          <span>&gt;</span>
          <span>Entidades</span>
          <span>&gt;</span>
          <span className="text-slate-600 font-semibold">Fornecedores</span>
        </div>
      </div>

      {/* Toolbar Area */}
      <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-[13px]">
        
        {/* Left Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Green Novo Button */}
          <button
            onClick={handleOpenNewModal}
            className="bg-[#10b981] hover:bg-[#059669] active:scale-[0.99] text-white font-bold px-3.5 py-1.5 rounded text-[13px] shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            Novo
          </button>

          {/* Ordenar */}
          <button 
            type="button"
            onClick={() => setFornecedores(prev => [...prev].reverse())}
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded font-medium shadow-2xs flex items-center gap-1.5 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            Ordenar
          </button>

          {/* Ferramentas */}
          <button 
            type="button"
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded font-medium shadow-2xs flex items-center gap-1 transition-colors"
          >
            <Wrench className="w-3.5 h-3.5 text-slate-500" />
            Ferramentas
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {/* Filtrar */}
          <button 
            type="button"
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded font-medium shadow-2xs flex items-center gap-1 transition-colors"
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            Filtrar
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {/* Tipo Filter */}
          <div className="flex items-center gap-1.5 text-slate-700 font-medium ml-1">
            <span className="text-slate-600">Tipo</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2.5 py-1 text-[13px] text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="Todos">Todos</option>
              <option value="Subcontratado">Subcontratado</option>
              <option value="Próprio">Próprio</option>
            </select>
          </div>

          {/* Categoria Filter */}
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <span className="text-slate-600">Categoria</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2.5 py-1 text-[13px] text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-green-500"
            >
              <option value="Todos">Todos</option>
              <option value="Transporte">Transporte Expresso</option>
              <option value="Carga">Carga Geral</option>
            </select>
          </div>

          {/* Código Input Filter */}
          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
            <span className="text-slate-600">Código</span>
            <input
              type="text"
              value={codeFilter}
              onChange={(e) => setCodeFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-[13px] w-20 text-slate-800 font-mono shadow-2xs focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Right Search Box */}
        <div className="relative min-w-[220px]">
          <input
            type="text"
            placeholder="Pesquisar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 pr-8 text-[13px] text-slate-800 placeholder:text-slate-400 shadow-2xs focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <Search className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

      </div>

      {/* Table Area */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 w-10 text-center">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer"
                />
              </th>
              <th className="py-3 px-3 w-20 cursor-pointer hover:text-slate-900">
                <div className="flex items-center gap-1">
                  <span>Nº</span>
                  <span className="text-[10px] text-slate-400">▾</span>
                </div>
              </th>
              <th className="py-3 px-3 min-w-[180px]">Designação Curta</th>
              <th className="py-3 px-3 min-w-[280px]">Designação Social</th>
              <th className="py-3 px-3 min-w-[160px]">Localidade</th>
              <th className="py-3 px-3 min-w-[200px]">Contactos</th>
              <th className="py-3 px-3 min-w-[100px]">Saldo</th>
              <th className="py-3 px-2 text-center w-10">
                <Check className="w-3.5 h-3.5 mx-auto text-slate-500" strokeWidth={3} />
              </th>
              <th className="py-3 px-2 text-center w-10">
                <span className="text-sm">🚩</span>
              </th>
              <th className="py-3 px-4 text-center w-28">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-500">
                  Nenhum fornecedor encontrado com os critérios selecionados.
                </td>
              </tr>
            ) : (
              paginated.map((forn) => {
                const isSelected = selectedIds.includes(forn.id)
                const isActionOpen = openActionId === forn.id

                return (
                  <tr
                    key={forn.id}
                    onClick={() => handleOpenEditModal(forn)}
                    className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                      isSelected ? "bg-green-50/30" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-4 text-center align-middle" onClick={(e) => handleToggleSelectRow(forn.id, e)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-green-600 focus:ring-green-500 cursor-pointer"
                      />
                    </td>

                    {/* Nº & Armazém Badge */}
                    <td className="py-3 px-3 align-middle">
                      <div className="font-semibold text-slate-700 leading-tight">
                        {forn.code}
                      </div>
                      <div className="mt-1">
                        <span className="inline-block bg-[#16a34a] text-white text-[10px] font-bold px-1.5 py-0.2 rounded leading-tight shadow-3xs">
                          {forn.center_code || "A01"}
                        </span>
                      </div>
                    </td>

                    {/* Designação Curta */}
                    <td className="py-3 px-3 align-middle">
                      <div className="flex items-center gap-2">
                        {getCarrierLogo(forn.short_name || forn.code) ? (
                          <div className="w-6 h-6 rounded bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={getCarrierLogo(forn.short_name || forn.code)!} 
                              alt={forn.short_name} 
                              className="max-w-full max-h-full object-contain" 
                            />
                          </div>
                        ) : (
                          /* Colored Swatch */
                          <div
                            className="w-3 h-3 rounded-xs shrink-0"
                            style={{ backgroundColor: forn.color || "#00a3e0" }}
                          />
                        )}
                        <span
                          className="font-bold tracking-tight text-[13px] hover:underline"
                          style={{ color: forn.color || "#00a3e0" }}
                        >
                          {forn.short_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 italic mt-0.5 font-normal">
                        <Truck className="w-3 h-3 text-slate-400 not-italic shrink-0" />
                        <span>Transportador</span>
                      </div>
                    </td>

                    {/* Designação Social */}
                    <td className="py-3 px-3 align-middle">
                      <div className="font-semibold text-blue-600/90 hover:text-blue-700 text-[13px] leading-snug">
                        {forn.legal_name || forn.short_name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {forn.nif ? `NIF: ${forn.nif} • ` : ""}
                        {forn.role || "Transportador Subcontratado"}
                      </div>
                    </td>

                    {/* Localidade */}
                    <td className="py-3 px-3 align-middle text-slate-700 font-medium uppercase text-xs">
                      {forn.city || "—"}
                    </td>

                    {/* Contactos */}
                    <td className="py-3 px-3 align-middle text-xs" onClick={(e) => e.stopPropagation()}>
                      {forn.phone && (
                        <div className="flex items-center gap-1.5 text-slate-700 mb-0.5">
                          <Phone className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <a href={`tel:${forn.phone}`} className="hover:text-green-600 hover:underline">
                            {forn.phone}
                          </a>
                        </div>
                      )}
                      {forn.email && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <a href={`mailto:${forn.email}`} className="hover:text-green-600 hover:underline truncate max-w-[190px]">
                            {forn.email}
                          </a>
                        </div>
                      )}
                      {!forn.phone && !forn.email && (
                        <span className="text-slate-400 italic">—</span>
                      )}
                    </td>

                    {/* Saldo */}
                    <td className="py-3 px-3 align-middle">
                      <div className="font-bold text-[#16a34a] text-xs">
                        {forn.balance || "0,00€"}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {forn.payment_terms || "A 30 dias"}
                      </div>
                    </td>

                    {/* Status Ativo */}
                    <td className="py-3 px-2 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleStatus(forn, e)}
                        title={forn.is_active ? "Fornecedor Ativo" : "Fornecedor Inativo"}
                        className="cursor-pointer inline-flex items-center justify-center p-0.5 rounded hover:bg-slate-100"
                      >
                        {forn.is_active ? (
                          <CheckCircle2 className="w-4 h-4 text-[#16a34a]" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-300" />
                        )}
                      </button>
                    </td>

                    {/* Bandeira País */}
                    <td className="py-3 px-2 text-center align-middle">
                      <span className="inline-flex items-center justify-center text-sm shadow-3xs" title="Portugal">
                        🇵🇹
                      </span>
                    </td>

                    {/* Ações Dropdown */}
                    <td className="py-3 px-4 text-center align-middle relative" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center border border-slate-300 rounded shadow-3xs bg-white">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(forn)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors border-r border-slate-200"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpenActionId(isActionOpen ? null : forn.id)}
                          className="px-1.5 py-1 text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Dropdown Menu */}
                      {isActionOpen && (
                        <div className="absolute right-4 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30 text-left text-xs font-medium animate-in fade-in duration-100">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(forn)}
                            className="w-full px-3 py-2 flex items-center gap-2 text-slate-700 hover:bg-slate-50"
                          >
                            <Edit className="w-3.5 h-3.5 text-blue-600" />
                            Editar dados
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleToggleStatus(forn, e)}
                            className="w-full px-3 py-2 flex items-center gap-2 text-slate-700 hover:bg-slate-50"
                          >
                            <Power className="w-3.5 h-3.5 text-amber-600" />
                            {forn.is_active ? "Inativar" : "Ativar"}
                          </button>
                          <div className="border-t border-slate-100 my-1" />
                          <button
                            type="button"
                            onClick={(e) => handleDelete(forn, e)}
                            className="w-full px-3 py-2 flex items-center gap-2 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Pagination */}
      <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-slate-600">
        
        {/* Page size selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span>Ver</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 shadow-3xs focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="text-slate-500">
            <strong className="text-slate-700 font-bold">{filtered.length}</strong> registos
            <span className="mx-2 text-slate-300">|</span>
            <span>
              A ver registo {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} ao{" "}
              {Math.min(currentPage * pageSize, filtered.length)}
            </span>
          </div>
        </div>

        {/* Pagination buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="p-1 rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-3xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setCurrentPage(p)}
              className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                currentPage === p
                  ? "bg-blue-600 text-white border-blue-600 shadow-3xs"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-3xs"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="p-1 rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-3xs"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <FornecedorModal
          initialData={editingFornecedor}
          allFornecedores={fornecedores}
          onSelectFornecedor={(f) => setEditingFornecedor(f)}
          onClose={() => {
            setIsModalOpen(false)
            setEditingFornecedor(null)
          }}
          onSaved={handleSaved}
        />
      )}

    </div>
  )
}
