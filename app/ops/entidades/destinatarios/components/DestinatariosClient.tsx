"use client"

import * as React from "react"
import {
  UserCheck,
  Users,
  Building2,
  Package,
  Search,
  Download,
  MapPin,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Edit2,
  Trash2,
  BookmarkCheck,
} from "lucide-react"
import { RefreshIcon } from "@/components/ui/refresh-icon"
import { Destinatario } from "../types"
import { DestinatarioDetailsModal } from "./DestinatarioDetailsModal"
import { NovoDestinatarioModal } from "./NovoDestinatarioModal"
import { getDestinatariosAction, deleteDestinatarioAction } from "@/app/actions/destinatarios"
import type { Cliente } from "@/app/ops/entidades/clientes/types"
import { Button } from "@/components/ui/button"

interface DestinatariosClientProps {
  initialDestinatarios: Destinatario[]
  clients: Cliente[]
  lockedClientId?: string
}

export function DestinatariosClient({
  initialDestinatarios,
  clients,
  lockedClientId,
}: DestinatariosClientProps) {
  const [destinatarios, setDestinatarios] = React.useState<Destinatario[]>(initialDestinatarios || [])
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("")
  const [clientFilter, setClientFilter] = React.useState<string>(lockedClientId || "todos")
  const [cityFilter, setCityFilter] = React.useState<string>("todos")
  const [originFilter, setOriginFilter] = React.useState<"todos" | "agenda" | "historico">("todos")

  // Modals
  const [selectedDest, setSelectedDest] = React.useState<Destinatario | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = React.useState(false)

  const [editingDest, setEditingDest] = React.useState<Destinatario | null>(null)
  const [isNovoModalOpen, setIsNovoModalOpen] = React.useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)

  // Copy feedback
  const [copiedTracking, setCopiedTracking] = React.useState<string | null>(null)

  // Sync with prop updates
  React.useEffect(() => {
    setDestinatarios(initialDestinatarios || [])
  }, [initialDestinatarios])

  // Stats
  const stats = React.useMemo(() => {
    let totalShipments = 0
    let savedCount = 0
    const uniqueClientsSet = new Set<string>()
    const uniqueCitiesSet = new Set<string>()

    destinatarios.forEach((d) => {
      totalShipments += d.total_shipments
      if (d.is_saved) savedCount++
      if (d.client_name) uniqueClientsSet.add(d.client_name)
      if (d.city) uniqueCitiesSet.add(d.city.toUpperCase().trim())
    })

    return {
      totalDestinatarios: destinatarios.length,
      savedCount,
      totalShipments,
      totalClients: uniqueClientsSet.size,
      totalCities: uniqueCitiesSet.size,
    }
  }, [destinatarios])

  // Unique cities list for dropdown
  const uniqueCities = React.useMemo(() => {
    const set = new Set<string>()
    destinatarios.forEach((d) => {
      if (d.city && d.city.trim()) {
        set.add(d.city.trim().toUpperCase())
      }
    })
    return Array.from(set).sort()
  }, [destinatarios])

  // Unique client options for dropdown
  const uniqueClientOptions = React.useMemo(() => {
    const map = new Map<string, string>()
    destinatarios.forEach((d) => {
      if (d.client_id && d.client_name) {
        map.set(d.client_id, d.client_name)
      } else if (d.client_name) {
        map.set(d.client_name, d.client_name)
      }
    })
    return Array.from(map.entries())
  }, [destinatarios])

  // Refresh data
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const data = await getDestinatariosAction(lockedClientId)
      setDestinatarios(data || [])
    } catch (err) {
      console.error("Error refreshing destinatarios:", err)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Handle saved destinatario
  const handleDestinatarioSaved = (saved: Destinatario) => {
    setDestinatarios((prev) => {
      const idx = prev.findIndex((d) => d.id === saved.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = { ...copy[idx], ...saved, is_saved: true }
        return copy
      }
      return [saved, ...prev]
    })
  }

  // Handle delete
  const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Tem a certeza que deseja remover "${name}" da lista de destinatários?`)) {
      return
    }

    try {
      const res = await deleteDestinatarioAction(id)
      if (res.success) {
        setDestinatarios((prev) => prev.filter((d) => d.id !== id))
      } else {
        alert(res.error || "Não foi possível remover o destinatário.")
      }
    } catch (err: any) {
      alert("Erro ao remover: " + (err?.message || err))
    }
  }

  // Filtered list
  const filtered = React.useMemo(() => {
    return destinatarios.filter((d) => {
      // Client filter
      if (clientFilter !== "todos") {
        if (d.client_id !== clientFilter && d.client_name !== clientFilter) {
          return false
        }
      }

      // City filter
      if (cityFilter !== "todos") {
        if (d.city.trim().toUpperCase() !== cityFilter) {
          return false
        }
      }

      // Origin filter (Agenda vs Histórico)
      if (originFilter === "agenda" && !d.is_saved) return false
      if (originFilter === "historico" && d.is_saved) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = d.name.toLowerCase().includes(q)
        const matchAddress = d.address.toLowerCase().includes(q)
        const matchCity = d.city.toLowerCase().includes(q)
        const matchPostal = d.postal_code.toLowerCase().includes(q)
        const matchClient = d.client_name.toLowerCase().includes(q)
        const matchTracking = d.last_tracking_number.toLowerCase().includes(q)
        const matchPhone = d.phone?.toLowerCase().includes(q)
        const matchEmail = d.email?.toLowerCase().includes(q)
        const matchNif = d.nif?.toLowerCase().includes(q)

        if (
          !matchName &&
          !matchAddress &&
          !matchCity &&
          !matchPostal &&
          !matchClient &&
          !matchTracking &&
          !matchPhone &&
          !matchEmail &&
          !matchNif
        ) {
          return false
        }
      }

      return true
    })
  }, [destinatarios, clientFilter, cityFilter, originFilter, searchQuery])

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, clientFilter, cityFilter, originFilter, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleOpenDetails = (d: Destinatario) => {
    setSelectedDest(d)
    setIsDetailsModalOpen(true)
  }

  const handleOpenNewModal = () => {
    setEditingDest(null)
    setIsNovoModalOpen(true)
  }

  const handleOpenEditModal = (d: Destinatario, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingDest(d)
    setIsNovoModalOpen(true)
  }

  const handleCopyTracking = (tracking: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(tracking)
    setCopiedTracking(tracking)
    setTimeout(() => setCopiedTracking(null), 2000)
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Nome Destinatário",
      "Cliente Linke",
      "Origem",
      "Morada",
      "Código Postal",
      "Localidade",
      "País",
      "Telefone",
      "Email",
      "NIF",
      "Total Envios",
      "Último Envio Data",
      "Último Tracking",
    ]
    const rows = filtered.map((d) => [
      `"${d.name.replace(/"/g, '""')}"`,
      `"${d.client_name.replace(/"/g, '""')}"`,
      `"${d.is_saved ? "Agenda Guardada" : "Histórico de Envios"}"`,
      `"${d.address.replace(/"/g, '""')}"`,
      `"${d.postal_code}"`,
      `"${d.city.replace(/"/g, '""')}"`,
      `"${d.country}"`,
      `"${d.phone || ""}"`,
      `"${d.email || ""}"`,
      `"${d.nif || ""}"`,
      `"${d.total_shipments}"`,
      `"${new Date(d.last_shipment_date).toLocaleDateString("pt-PT")}"`,
      `"${d.last_tracking_number}"`,
    ])

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute(
      "download",
      `destinatarios_linke_${new Date().toISOString().slice(0, 10)}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-2xs overflow-hidden">
      {/* Top Header */}
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center border border-[rgba(18,138,71,0.1)]">
            <UserCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
              Destinatários
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Agenda consolidada de destinatários, contactos e histórico de entregas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={handleOpenNewModal}
            className="px-3.5 py-1.5 h-auto text-xs font-semibold shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo Destinatário
          </Button>

          <div className="hidden sm:flex text-[10px] font-semibold text-[var(--text-tertiary)] items-center gap-1.5 uppercase tracking-wide">
            <span>{lockedClientId ? "Portal" : "Entidades"}</span>
            <span className="text-[var(--border-strong)]">&gt;</span>
            <span className="text-[var(--text-secondary)]">Destinatários</span>
          </div>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/40">
        <div className="bg-[var(--surface-bg)] rounded-md p-3 border border-[var(--border-subtle)] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Total Contactos
            </span>
            <Users className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold font-mono text-[var(--text-primary)]">
              {stats.totalDestinatarios}
            </span>
            <span className="text-[11px] text-[var(--text-tertiary)]">na base</span>
          </div>
        </div>

        <div className="bg-[var(--surface-bg)] rounded-md p-3 border border-[var(--border-subtle)] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Guardados na Agenda
            </span>
            <BookmarkCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold font-mono text-[var(--accent)]">
              {stats.savedCount}
            </span>
            <span className="text-[11px] text-[var(--text-tertiary)]">contactos fixos</span>
          </div>
        </div>

        <div className="bg-[var(--surface-bg)] rounded-md p-3 border border-[var(--border-subtle)] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Total de Envios
            </span>
            <Package className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold font-mono text-[var(--text-primary)]">
              {stats.totalShipments}
            </span>
            <span className="text-[11px] text-[var(--text-tertiary)]">guias emitidas</span>
          </div>
        </div>

        <div className="bg-[var(--surface-bg)] rounded-md p-3 border border-[var(--border-subtle)] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
              Localidades
            </span>
            <MapPin className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold font-mono text-[var(--text-primary)]">
              {stats.totalCities}
            </span>
            <span className="text-[11px] text-[var(--text-tertiary)]">cidades</span>
          </div>
        </div>
      </div>

      {/* Toolbar Area */}
      <div className="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-bg)] flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="px-2.5 py-1.5 h-auto text-[11px] font-medium shadow-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 opacity-70" />
            Exportar CSV ({filtered.length})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-2.5 py-1.5 h-auto text-[11px] font-medium shadow-xs"
          >
            <RefreshIcon className={`w-4 h-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "A carregar..." : "Atualizar"}
          </Button>

          <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />

          {/* Filtro Origem (Todos / Agenda / Histórico) */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-bg)] border border-[var(--border-strong)] rounded-md px-2.5 py-1.5 shadow-2xs">
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value as any)}
              className="text-[11px] font-medium text-[var(--text-primary)] bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos os Registos</option>
              <option value="agenda">Apenas Agenda Guardada</option>
              <option value="historico">Apenas Histórico de Envios</option>
            </select>
          </div>

          {/* Filtro Cliente (se não estiver bloqueado na área de cliente) */}
          {!lockedClientId && (
            <div className="flex items-center gap-1.5 bg-[var(--surface-bg)] border border-[var(--border-strong)] rounded-md px-2.5 py-1.5 shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="text-[11px] font-medium text-[var(--text-primary)] bg-transparent focus:outline-none cursor-pointer max-w-[180px] truncate"
              >
                <option value="todos">Todos os Clientes</option>
                {uniqueClientOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filtro Cidade */}
          <div className="flex items-center gap-1.5 bg-[var(--surface-bg)] border border-[var(--border-strong)] rounded-md px-2.5 py-1.5 shadow-2xs">
            <MapPin className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="text-[11px] font-medium text-[var(--text-primary)] bg-transparent focus:outline-none cursor-pointer max-w-[180px] truncate"
            >
              <option value="todos">Todas as Cidades ({uniqueCities.length})</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {(searchQuery || clientFilter !== (lockedClientId || "todos") || cityFilter !== "todos" || originFilter !== "todos") && (
            <button
              onClick={() => {
                setSearchQuery("")
                setClientFilter(lockedClientId || "todos")
                setCityFilter("todos")
                setOriginFilter("todos")
              }}
              className="text-[11px] text-[var(--accent)] hover:underline font-medium px-2 py-1"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Right Search Area */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Pesquisar nome, morada, NIF..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-64 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md pl-8 pr-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
            />
          </div>

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
              <th className="py-2.5 px-4 min-w-[200px]">Destinatário</th>
              {!lockedClientId && <th className="py-2.5 px-3 min-w-[150px]">Cliente de Origem</th>}
              <th className="py-2.5 px-3 min-w-[240px]">Morada & Localidade</th>
              <th className="py-2.5 px-3 w-28 text-center">Tipo / Estado</th>
              <th className="py-2.5 px-3 w-28 text-center">Total Envios</th>
              <th className="py-2.5 px-3 min-w-[160px]">Última Expedição</th>
              <th className="py-2.5 px-4 w-32 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)] text-[12px] bg-[var(--surface-bg)]">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={lockedClientId ? 6 : 7} className="py-12 text-center text-[var(--text-secondary)]">
                  <UserCheck className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2 opacity-50" />
                  <span className="font-semibold text-sm">Nenhum destinatário encontrado</span>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                    Crie um novo destinatário ou aguarde a emissão de envios para povoar a lista.
                  </p>
                </td>
              </tr>
            ) : (
              paginated.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => handleOpenDetails(d)}
                  className="hover:bg-[var(--surface-hover)] cursor-pointer transition-colors"
                >
                  {/* Name & Contact */}
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{d.name}</span>
                      {d.is_saved && (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(18,138,71,0.2)]">
                          Agenda
                        </span>
                      )}
                    </div>
                    {(d.phone || d.email || d.nif) && (
                      <div className="text-[11px] text-[var(--text-tertiary)] font-mono flex items-center gap-2 mt-0.5">
                        {d.phone && <span>{d.phone}</span>}
                        {d.phone && d.email && <span>&bull;</span>}
                        {d.email && <span className="truncate max-w-[160px]">{d.email}</span>}
                        {d.nif && (
                          <>
                            <span>&bull;</span>
                            <span>NIF: {d.nif}</span>
                          </>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Associated Client (OPS only) */}
                  {!lockedClientId && (
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                        <Building2 className="w-3 h-3 mr-1 text-[var(--text-tertiary)]" />
                        {d.client_name}
                      </span>
                    </td>
                  )}

                  {/* Address & City */}
                  <td className="py-2.5 px-3 max-w-xs">
                    <div className="truncate text-xs text-[var(--text-secondary)]" title={d.address}>
                      {d.address}
                    </div>
                    <div className="text-[11px] text-[var(--text-tertiary)] font-mono mt-0.5">
                      {d.postal_code} <strong className="font-medium text-[var(--text-primary)]">{d.city}</strong>
                    </div>
                  </td>

                  {/* Tipo / Estado */}
                  <td className="py-2.5 px-3 text-center">
                    {d.is_saved ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                        <BookmarkCheck className="w-3 h-3 mr-1 text-[var(--accent)]" />
                        Guardado
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--surface-muted)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]">
                        Histórico
                      </span>
                    )}
                  </td>

                  {/* Total Shipments */}
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                      {d.total_shipments} {d.total_shipments === 1 ? "guia" : "guias"}
                    </span>
                  </td>

                  {/* Last Shipment Date & Tracking */}
                  <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] font-medium text-[var(--text-primary)]">
                      <span>{d.last_tracking_number}</span>
                      {d.last_tracking_number !== "—" && (
                        <button
                          onClick={(e) => handleCopyTracking(d.last_tracking_number, e)}
                          className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-0.5 rounded hover:bg-[var(--surface-muted)]"
                          title="Copiar tracking"
                        >
                          {copiedTracking === d.last_tracking_number ? (
                            <Check className="w-3 h-3 text-[var(--accent)]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)] font-mono mt-0.5">
                      {d.last_shipment_date ? new Date(d.last_shipment_date).toLocaleDateString("pt-PT") : "—"}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetails(d)}
                        className="px-2 py-1 h-auto text-[11px] font-medium shadow-2xs"
                        title="Ver detalhes e histórico"
                      >
                        <Eye className="w-3 h-3 mr-1 opacity-70" />
                        Histórico
                      </Button>

                      {d.is_saved && (
                        <>
                          <button
                            onClick={(e) => handleOpenEditModal(d, e)}
                            className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
                            title="Editar contacto"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>

                          <button
                            onClick={(e) => handleDelete(d.id, d.name, e)}
                            className="p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--status-critical)] hover:bg-[var(--surface-muted)] transition-colors"
                            title="Eliminar destinatário"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-bg)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
        <div>
          A apresentar{" "}
          <strong className="text-[var(--text-primary)] font-mono">
            {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
          </strong>{" "}
          -{" "}
          <strong className="text-[var(--text-primary)] font-mono">
            {Math.min(currentPage * pageSize, filtered.length)}
          </strong>{" "}
          de{" "}
          <strong className="text-[var(--text-primary)] font-mono">
            {filtered.length}
          </strong>{" "}
          destinatários
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1 rounded border border-[var(--border-strong)] bg-[var(--surface-bg)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Página anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 py-0.5 font-medium font-mono text-[var(--text-primary)]">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1 rounded border border-[var(--border-strong)] bg-[var(--surface-bg)] hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Página seguinte"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Details Modal */}
      <DestinatarioDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        destinatario={selectedDest}
      />

      {/* Novo / Editar Destinatário Modal */}
      <NovoDestinatarioModal
        isOpen={isNovoModalOpen}
        onClose={() => setIsNovoModalOpen(false)}
        onSaved={handleDestinatarioSaved}
        clients={clients}
        initialData={editingDest}
        lockedClientId={lockedClientId}
      />
    </div>
  )
}
