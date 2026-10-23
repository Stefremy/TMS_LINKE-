"use client"

import * as React from "react"
import {
  User,
  Users,
  Building2,
  Shield,
  Plus,
  Search,
  Download,
  Phone,
  Mail,
  MapPin,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Key,
} from "lucide-react"
import { RefreshIcon } from "@/components/ui/refresh-icon"
import { Colaborador, DEPARTMENTS, ACCESS_LEVELS } from "../types"
import { ColaboradorModal } from "./ColaboradorModal"
import { ColaboradorDetailsModal } from "./ColaboradorDetailsModal"
import { ColaboradorAuthModal } from "./ColaboradorAuthModal"
import { AccessLevelBadge } from "./AccessLevelBadge"
import { deleteColaboradorAction, toggleColaboradorStatusAction, getColaboradoresAction } from "@/app/actions/colaboradores"

interface ColaboradoresClientProps {
  initialColaboradores: Colaborador[]
  isSuperAdmin?: boolean
  isStefano?: boolean
}

export function ColaboradoresClient({
  initialColaboradores,
  isSuperAdmin = true,
  isStefano = false,
}: ColaboradoresClientProps) {
  const [colaboradores, setColaboradores] = React.useState<Colaborador[]>(initialColaboradores || [])
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("")
  const [departmentFilter, setDepartmentFilter] = React.useState<string>("todos")
  const [statusFilter, setStatusFilter] = React.useState<string>("todos")
  const [accessFilter, setAccessFilter] = React.useState<string>("todos")

  // View Mode: grid or table
  const [viewMode, setViewMode] = React.useState<"grid" | "table">("grid")

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = React.useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = React.useState(false)
  const [editingColaborador, setEditingColaborador] = React.useState<Colaborador | null>(null)
  const [selectedColaborador, setSelectedColaborador] = React.useState<Colaborador | null>(null)
  const [authColaborador, setAuthColaborador] = React.useState<Colaborador | null>(null)

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(12)

  // Sync with prop updates
  React.useEffect(() => {
    setColaboradores(initialColaboradores || [])
  }, [initialColaboradores])

  // Stats
  const stats = React.useMemo(() => {
    let ativos = 0
    let admins = 0
    const depts = new Set<string>()

    colaboradores.forEach((c) => {
      if (c.status === "Ativo") ativos++
      if (c.access_level === "Administrador") admins++
      if (c.department) depts.add(c.department)
    })

    return {
      total: colaboradores.length,
      ativos,
      admins,
      departamentos: depts.size,
    }
  }, [colaboradores])

  // Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const data = await getColaboradoresAction()
      setColaboradores(data || [])
    } catch (err) {
      console.error("Error refreshing colaboradores:", err)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Filtered
  const filtered = React.useMemo(() => {
    return colaboradores.filter((c) => {
      // Department filter
      if (departmentFilter !== "todos" && c.department !== departmentFilter) {
        return false
      }

      // Status filter
      if (statusFilter !== "todos" && c.status !== statusFilter) {
        return false
      }

      // Access filter
      if (accessFilter !== "todos" && c.access_level !== accessFilter) {
        return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = c.name.toLowerCase().includes(q)
        const matchRole = c.role.toLowerCase().includes(q)
        const matchDept = c.department.toLowerCase().includes(q)
        const matchEmail = c.email.toLowerCase().includes(q)
        const matchPhone = c.phone.toLowerCase().includes(q)
        const matchCode = c.code.toLowerCase().includes(q)

        if (!matchName && !matchRole && !matchDept && !matchEmail && !matchPhone && !matchCode) {
          return false
        }
      }

      return true
    })
  }, [colaboradores, departmentFilter, statusFilter, accessFilter, searchQuery])

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, departmentFilter, statusFilter, accessFilter, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Actions
  const handleOpenNew = () => {
    setEditingColaborador(null)
    setIsFormModalOpen(true)
  }

  const handleOpenEdit = (col: Colaborador) => {
    setEditingColaborador(col)
    setIsFormModalOpen(true)
  }

  const handleOpenDetails = (col: Colaborador) => {
    setSelectedColaborador(col)
    setIsDetailsModalOpen(true)
  }

  const handleOpenAuth = (col: Colaborador, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setAuthColaborador(col)
    setIsAuthModalOpen(true)
  }

  const handleSaved = (saved: Colaborador) => {
    setColaboradores((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = saved
        return updated
      }
      return [...prev, saved]
    })
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Tem a certeza que deseja remover este colaborador?")) return

    try {
      await deleteColaboradorAction(id)
      setColaboradores((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      console.error("Error deleting colaborador:", err)
    }
  }

  const handleToggleStatus = async (col: Colaborador, e: React.MouseEvent) => {
    e.stopPropagation()
    const nextStatus = col.status === "Ativo" ? "Inativo" : "Ativo"
    try {
      await toggleColaboradorStatusAction(col.id, nextStatus)
      setColaboradores((prev) =>
        prev.map((c) => (c.id === col.id ? { ...c, status: nextStatus } : c))
      )
    } catch (err) {
      console.error("Error toggling status:", err)
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Código",
      "Nome",
      "Cargo",
      "Departamento",
      "Email",
      "Telefone",
      "NIF",
      "Nível Acesso",
      "Estado",
      "Localização",
      "Data Admissão",
    ]
    const rows = filtered.map((c) => [
      `"${c.code}"`,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.role.replace(/"/g, '""')}"`,
      `"${c.department.replace(/"/g, '""')}"`,
      `"${c.email}"`,
      `"${c.phone}"`,
      `"${c.nif || ""}"`,
      `"${c.access_level}"`,
      `"${c.status}"`,
      `"${c.agency_location.replace(/"/g, '""')}"`,
      `"${c.admission_date}"`,
    ])

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `colaboradores_linke_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Colaboradores</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#128A47] text-white border border-[#128A47]">
              <Users className="w-3.5 h-3.5 text-white" />
              Equipa Linke
            </span>
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Gestão de colaboradores, perfis de acesso, cargos e equipa de operações.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-[var(--text-tertiary)]" />
            Exportar CSV
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] shadow-sm transition-colors"
            title="Atualizar lista"
          >
            <RefreshIcon className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleOpenNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo Colaborador
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Colaboradores */}
        <div className="bg-[var(--surface-bg)] rounded-2xl p-5 border border-[var(--border-subtle)] border-t-4 border-t-[#155EEF] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Total Colaboradores</span>
            <div className="w-10 h-10 rounded-xl bg-[#155EEF] flex items-center justify-center text-white">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#155EEF]">{stats.total}</span>
            <span className="text-xs font-medium text-[var(--text-tertiary)]">membros registados</span>
          </div>
        </div>

        {/* Ativos */}
        <div className="bg-[var(--surface-bg)] rounded-2xl p-5 border border-[var(--border-subtle)] border-t-4 border-t-[#008A4B] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Colaboradores Ativos</span>
            <div className="w-10 h-10 rounded-xl bg-[#008A4B] flex items-center justify-center text-white">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#008A4B]">{stats.ativos}</span>
            <span className="text-xs font-medium text-[var(--text-tertiary)]">em funções</span>
          </div>
        </div>

        {/* Administradores */}
        <div className="bg-[var(--surface-bg)] rounded-2xl p-5 border border-[var(--border-subtle)] border-t-4 border-t-[#29496D] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Administradores</span>
            <div className="w-10 h-10 rounded-xl bg-[#29496D] flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#29496D]">{stats.admins}</span>
            <span className="text-xs font-medium text-[var(--text-tertiary)]">acesso total</span>
          </div>
        </div>

        {/* Departamentos */}
        <div className="bg-[var(--surface-bg)] rounded-2xl p-5 border border-[var(--border-subtle)] border-t-4 border-t-[#007F8B] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Departamentos</span>
            <div className="w-10 h-10 rounded-xl bg-[#007F8B] flex items-center justify-center text-white">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#007F8B]">{stats.departamentos}</span>
            <span className="text-xs font-medium text-[var(--text-tertiary)]">áreas operacionais</span>
          </div>
        </div>
      </div>

      {/* Filters and View Controls */}
      <div className="bg-[var(--surface-bg)] rounded-2xl p-4 border border-[var(--border-subtle)] shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por nome, cargo, departamento, email..."
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:bg-[var(--surface-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] bg-[var(--surface-dim)] rounded-md px-1.5 py-0.5"
              >
                Limpar
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-[var(--surface-dim)] p-1 rounded-xl">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === "grid" ? "bg-[var(--surface-bg)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              title="Vista de Cartões"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Cartões</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === "table" ? "bg-[var(--surface-bg)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              title="Vista de Tabela"
            >
              <List className="w-4 h-4" />
              <span>Tabela</span>
            </button>
          </div>
        </div>

        {/* Secondary Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-tertiary)] font-medium">Departamento:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="todos">Todos os Departamentos</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[var(--text-tertiary)] font-medium">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="todos">Todos os Estados</option>
              <option value="Ativo">Ativo</option>
              <option value="Férias">Férias</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[var(--text-tertiary)] font-medium">Perfil de Acesso:</span>
            <select
              value={accessFilter}
              onChange={(e) => setAccessFilter(e.target.value)}
              className="bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-1.5 text-[var(--text-primary)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="todos">Todos os Perfis</option>
              {ACCESS_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          {(searchQuery || departmentFilter !== "todos" || statusFilter !== "todos" || accessFilter !== "todos") && (
            <button
              onClick={() => {
                setSearchQuery("")
                setDepartmentFilter("todos")
                setStatusFilter("todos")
                setAccessFilter("todos")
              }}
              className="text-[var(--accent)] hover:text-[var(--accent-hover)] font-semibold underline ml-auto"
            >
              Repor filtros
            </button>
          )}
        </div>
      </div>

      {/* MAIN VIEW: GRID or TABLE */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paginated.map((col) => (
            <div
              key={col.id}
              onClick={() => handleOpenDetails(col)}
              className="bg-[var(--surface-bg)] rounded-2xl border border-[var(--border-subtle)] hover:border-[var(--accent)] p-6 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              {/* Card Top */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-14 h-14 rounded-xl text-white flex items-center justify-center text-xl font-bold shadow-sm shrink-0 overflow-hidden"
                      style={{ backgroundColor: col.avatar_color || "#477D68" }}
                    >
                      {col.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={col.avatar} alt={col.name} className="w-full h-full object-cover" />
                      ) : (
                        col.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                        {col.name}
                      </h3>
                      <p className="text-xs font-semibold text-[var(--text-tertiary)]">{col.role}</p>
                      <span className="inline-flex items-center text-[11px] font-medium text-[var(--accent)] mt-0.5">
                        {col.department}
                      </span>
                    </div>
                  </div>

                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    col.status === "Ativo"
                      ? "bg-[#008A4B] text-white border border-[#008A4B]"
                      : col.status === "Férias"
                      ? "bg-[#B45309] text-white border border-[#B45309]"
                      : "bg-[var(--surface-dim)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                  }`}>
                    <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${col.status === "Ativo" || col.status === "Férias" ? "bg-white" : "bg-[var(--text-tertiary)]"}`} />
                    {col.status}
                  </span>
                </div>

                {/* Contacts & Info */}
                <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] space-y-2 text-xs text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                    <a
                      href={`mailto:${col.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-[var(--accent)] truncate"
                    >
                      {col.email}
                    </a>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                    <a
                      href={`tel:${col.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-[var(--accent)]"
                    >
                      {col.phone}
                    </a>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                    <span className="truncate">{col.agency_location}</span>
                  </div>
                </div>

                {/* Permissions Tags preview */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <AccessLevelBadge level={col.access_level} />
                  {col.permissions.slice(0, 2).map((p, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--surface-dim)] text-[var(--text-secondary)] truncate max-w-[140px]"
                    >
                      {p}
                    </span>
                  ))}
                  {col.permissions.length > 2 && (
                    <span className="px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-[var(--surface-dim)] text-[var(--text-tertiary)]">
                      +{col.permissions.length - 2}
                    </span>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div
                className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => handleOpenDetails(col)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Ver Perfil
                </button>

                <div className="flex items-center gap-1.5">
                  {isStefano && (
                    <button
                      onClick={(e) => handleOpenAuth(col, e)}
                      className="p-1.5 text-[#376C8A] hover:text-[#376C8A] hover:bg-[#EDF1F3] rounded-lg transition-colors"
                      title="Gerir Acesso & Palavra-passe"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenEdit(col)}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-dim)] rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(col.id, e)}
                    className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--status-critical)] hover:bg-[var(--status-critical-soft)] rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-[var(--surface-bg)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                  <th className="py-3.5 px-4">Colaborador</th>
                  <th className="py-3.5 px-4">Departamento & Cargo</th>
                  <th className="py-3.5 px-4">Contactos</th>
                  <th className="py-3.5 px-4">Acesso</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-sm">
                {paginated.map((col) => (
                  <tr
                    key={col.id}
                    onClick={() => handleOpenDetails(col)}
                    className="hover:bg-[var(--surface-muted)] cursor-pointer transition-colors group"
                  >
                    {/* Name & Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold shadow-sm shrink-0 overflow-hidden"
                          style={{ backgroundColor: col.avatar_color || "#477D68" }}
                        >
                          {col.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={col.avatar} alt={col.name} className="w-full h-full object-cover" />
                          ) : (
                            col.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors block">
                            {col.name}
                          </span>
                          <span className="text-xs font-mono text-[var(--text-tertiary)]">{col.code}</span>
                        </div>
                      </div>
                    </td>

                    {/* Department & Role */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-semibold text-[var(--text-primary)] block text-xs">{col.role}</span>
                        <span className="text-xs text-[var(--accent)] font-medium">{col.department}</span>
                      </div>
                    </td>

                    {/* Contacts */}
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="text-xs space-y-0.5">
                        <a href={`mailto:${col.email}`} className="text-[var(--text-primary)] hover:text-[var(--accent)] block">
                          {col.email}
                        </a>
                        <span className="text-[var(--text-tertiary)]">{col.phone}</span>
                      </div>
                    </td>

                    {/* Access Level */}
                    <td className="py-3.5 px-4">
                      <AccessLevelBadge level={col.access_level} />
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleToggleStatus(col, e)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-transform hover:scale-105 ${
                          col.status === "Ativo"
                            ? "bg-[#008A4B] text-white border border-[#008A4B]"
                            : col.status === "Férias"
                            ? "bg-[#B45309] text-white border border-[#B45309]"
                            : "bg-[var(--surface-dim)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                        }`}
                        title="Clique para alternar estado"
                      >
                        <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${col.status === "Ativo" || col.status === "Férias" ? "bg-white" : "bg-[var(--text-tertiary)]"}`} />
                        {col.status}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {isStefano && (
                          <button
                            onClick={(e) => handleOpenAuth(col, e)}
                            className="p-1.5 text-[#376C8A] hover:text-[#376C8A] hover:bg-[#EDF1F3] rounded-lg transition-colors"
                            title="Gerir Acesso & Palavra-passe"
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenDetails(col)}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-dim)] rounded-lg transition-colors"
                          title="Ver Perfil"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(col)}
                          className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-dim)] rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(col.id, e)}
                          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--status-critical)] hover:bg-[var(--status-critical-soft)] rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <ColaboradorModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        colaborador={editingColaborador}
        onSaved={handleSaved}
      />

      <ColaboradorDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        colaborador={selectedColaborador}
        onEdit={isSuperAdmin ? (col) => handleOpenEdit(col) : undefined}
        onManageAuth={isStefano ? (col) => handleOpenAuth(col) : undefined}
      />

      {authColaborador && (
        <ColaboradorAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          colaborador={authColaborador}
          onUpdated={handleSaved}
        />
      )}
    </div>
  )
}
