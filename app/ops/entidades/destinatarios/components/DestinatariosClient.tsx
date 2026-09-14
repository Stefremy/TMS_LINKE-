"use client"

import * as React from "react"
import {
  User,
  Users,
  Building2,
  Package,
  Search,
  Download,
  MapPin,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  Copy,
  Check,
  Eye,
  Layers,
  ArrowRight,
  RefreshCw,
  Phone,
  Mail
} from "lucide-react"
import { Destinatario } from "../types"
import { DestinatarioDetailsModal } from "./DestinatarioDetailsModal"
import { getDestinatariosAction } from "@/app/actions/destinatarios"
import type { Cliente } from "@/app/ops/entidades/clientes/types"

interface DestinatariosClientProps {
  initialDestinatarios: Destinatario[]
  clients: Cliente[]
}

export function DestinatariosClient({
  initialDestinatarios,
  clients,
}: DestinatariosClientProps) {
  const [destinatarios, setDestinatarios] = React.useState<Destinatario[]>(initialDestinatarios || [])
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("")
  const [clientFilter, setClientFilter] = React.useState<string>("todos")
  const [cityFilter, setCityFilter] = React.useState<string>("todos")

  // Modal
  const [selectedDest, setSelectedDest] = React.useState<Destinatario | null>(null)
  const [isModalOpen, setIsModalOpen] = React.useState(false)

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
    const uniqueClientsSet = new Set<string>()
    const uniqueCitiesSet = new Set<string>()

    destinatarios.forEach((d) => {
      totalShipments += d.total_shipments
      if (d.client_name) uniqueClientsSet.add(d.client_name)
      if (d.city) uniqueCitiesSet.add(d.city.toUpperCase().trim())
    })

    return {
      totalDestinatarios: destinatarios.length,
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

  // Unique client names for dropdown
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

  // Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const data = await getDestinatariosAction()
      setDestinatarios(data || [])
    } catch (err) {
      console.error("Error refreshing destinatarios:", err)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Filtered
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

        if (
          !matchName &&
          !matchAddress &&
          !matchCity &&
          !matchPostal &&
          !matchClient &&
          !matchTracking &&
          !matchPhone &&
          !matchEmail
        ) {
          return false
        }
      }

      return true
    })
  }, [destinatarios, clientFilter, cityFilter, searchQuery])

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, clientFilter, cityFilter, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleOpenDetails = (d: Destinatario) => {
    setSelectedDest(d)
    setIsModalOpen(true)
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
      "Morada",
      "Código Postal",
      "Localidade",
      "País",
      "Telefone",
      "Email",
      "Total Envios",
      "Último Envio Data",
      "Último Tracking",
    ]
    const rows = filtered.map((d) => [
      `"${d.name.replace(/"/g, '""')}"`,
      `"${d.client_name.replace(/"/g, '""')}"`,
      `"${d.address.replace(/"/g, '""')}"`,
      `"${d.postal_code}"`,
      `"${d.city.replace(/"/g, '""')}"`,
      `"${d.country}"`,
      `"${d.phone || ""}"`,
      `"${d.email || ""}"`,
      `"${d.total_shipments}"`,
      `"${new Date(d.last_shipment_date).toLocaleDateString("pt-PT")}"`,
      `"${d.last_tracking_number}"`,
    ])

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `destinatarios_linke_${new Date().toISOString().slice(0, 10)}.csv`)
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Destinatários</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
              <User className="w-3.5 h-3.5" />
              Histórico de Clientes
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Base de dados consolidada de todos os destinatários de envios criados pelos clientes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Exportar CSV ({filtered.length})
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "A atualizar..." : "Atualizar"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Destinatarios */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Destinatários Únicos</span>
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{stats.totalDestinatarios}</span>
            <span className="text-xs font-medium text-slate-500">registados</span>
          </div>
        </div>

        {/* Total Shipments Sent */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Envios</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-900">{stats.totalShipments}</span>
            <span className="text-xs font-medium text-blue-600">guias emitidas</span>
          </div>
        </div>

        {/* Clients with shipments */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clientes de Origem</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-900">{stats.totalClients}</span>
            <span className="text-xs font-medium text-amber-600">clientes ativos</span>
          </div>
        </div>

        {/* Cities covered */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Localidades</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-purple-900">{stats.totalCities}</span>
            <span className="text-xs font-medium text-purple-600">cidades atendidas</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por nome, morada, cidade, tracking ou cliente..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-slate-600 bg-slate-200/60 rounded-md px-1.5 py-0.5"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Quick Filters (Client & City) */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Cliente:</span>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="todos">Todos os Clientes</option>
                {uniqueClientOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Localidade:</span>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-green-500 max-w-xs"
              >
                <option value="todos">Todas as Cidades ({uniqueCities.length})</option>
                {uniqueCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            {(searchQuery || clientFilter !== "todos" || cityFilter !== "todos") && (
              <button
                onClick={() => {
                  setSearchQuery("")
                  setClientFilter("todos")
                  setCityFilter("todos")
                }}
                className="text-green-700 hover:text-green-800 font-semibold underline ml-auto"
              >
                Repor filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Table Top Indicator */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            A apresentar <strong className="text-slate-800">{filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> - <strong className="text-slate-800">{Math.min(currentPage * pageSize, filtered.length)}</strong> de <strong className="text-slate-800">{filtered.length}</strong> destinatários
          </span>

          <div className="flex items-center gap-2">
            <span>Por página:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-medium focus:outline-none"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Main Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Destinatário</th>
                <th className="py-3.5 px-4">Cliente de Origem</th>
                <th className="py-3.5 px-4">Morada & Localidade</th>
                <th className="py-3.5 px-4">Total de Envios</th>
                <th className="py-3.5 px-4">Último Envio</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">Nenhum destinatário encontrado</p>
                    <p className="text-xs text-slate-400 mt-1">Os destinatários aparecem automaticamente à medida que os clientes criam envios.</p>
                  </td>
                </tr>
              ) : (
                paginated.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => handleOpenDetails(d)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    {/* Name & Contact */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 group-hover:bg-green-50 group-hover:text-green-700 flex items-center justify-center shrink-0 transition-colors">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 group-hover:text-green-700 transition-colors block">
                            {d.name}
                          </span>
                          {(d.phone || d.email) && (
                            <span className="text-xs text-slate-400">
                              {d.phone || d.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Associated Client */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                        <Building2 className="w-3 h-3 mr-1.5 text-slate-500" />
                        {d.client_name}
                      </span>
                    </td>

                    {/* Address & City */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-slate-800 truncate" title={d.address}>
                          {d.address}
                        </span>
                        <span className="text-xs text-slate-500">
                          {d.postal_code} <strong className="text-slate-700 font-semibold">{d.city}</strong>
                        </span>
                      </div>
                    </td>

                    {/* Total Shipments */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Package className="w-3.5 h-3.5" />
                        {d.total_shipments} {d.total_shipments === 1 ? "guia" : "guias"}
                      </span>
                    </td>

                    {/* Last Shipment Date & Tracking */}
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-slate-800">
                            {d.last_tracking_number}
                          </span>
                          <button
                            onClick={(e) => handleCopyTracking(d.last_tracking_number, e)}
                            className="text-slate-400 hover:text-slate-700"
                            title="Copiar tracking"
                          >
                            {copiedTracking === d.last_tracking_number ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(d.last_shipment_date).toLocaleDateString("pt-PT")}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenDetails(d)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        Histórico
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Página <strong className="text-slate-800">{currentPage}</strong> de <strong className="text-slate-800">{totalPages}</strong>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>

            <span className="px-3 py-1 bg-slate-100 font-semibold text-slate-800 rounded-lg">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      <DestinatarioDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        destinatario={selectedDest}
      />
    </div>
  )
}
