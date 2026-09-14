"use client"

import * as React from "react"
import {
  Package,
  Building2,
  Store,
  Search,
  RefreshCw,
  Download,
  MapPin,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  Layers,
  Sparkles,
  Globe2
} from "lucide-react"
import { CTTPontoEntrega } from "@/lib/services/ctt"
import { getPontosPickupCttAction } from "@/app/actions/ctt"
import { PontoDetailsModal } from "./PontoDetailsModal"

interface PontosPickupClientProps {
  initialPoints: CTTPontoEntrega[]
  initialCachedAt?: string
  initialError?: string
}

export function PontosPickupClient({
  initialPoints,
  initialCachedAt,
  initialError,
}: PontosPickupClientProps) {
  const [points, setPoints] = React.useState<CTTPontoEntrega[]>(initialPoints || [])
  const [cachedAt, setCachedAt] = React.useState<string | undefined>(initialCachedAt)
  const [errorMsg, setErrorMsg] = React.useState<string | undefined>(initialError)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  // Primary Country Tab (Separadores Principais: Ibérico, Portugal, Espanha)
  const [countryFilter, setCountryFilter] = React.useState<"todos" | "PT" | "ES">("todos")

  // Secondary Filters
  const [searchQuery, setSearchQuery] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<"todos" | "cacifo" | "loja" | "parceiro">("todos")
  const [entityFilter, setEntityFilter] = React.useState<string>("todos")
  const [cityFilter, setCityFilter] = React.useState<string>("todos")

  // Modal
  const [selectedPonto, setSelectedPonto] = React.useState<CTTPontoEntrega | null>(null)
  const [isModalOpen, setIsModalOpen] = React.useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)

  // Copy feedback state
  const [copiedCodeId, setCopiedCodeId] = React.useState<string | null>(null)

  // Global counts for Country Tabs
  const countryCounts = React.useMemo(() => {
    let pt = 0
    let es = 0
    points.forEach((p) => {
      if (p.pais === "PT") pt++
      else if (p.pais === "ES") es++
    })
    return {
      all: points.length,
      pt,
      es,
    }
  }, [points])

  // Stats for active country tab
  const activeStats = React.useMemo(() => {
    const subset = points.filter(p => countryFilter === "todos" || p.pais === countryFilter)
    let cacifos = 0
    let lojas = 0
    let parceiros = 0

    subset.forEach((p) => {
      if (p.tipoCategoria === "cacifo") cacifos++
      else if (p.tipoCategoria === "loja") lojas++
      else parceiros++
    })

    return {
      total: subset.length,
      cacifos,
      lojas,
      parceiros,
    }
  }, [points, countryFilter])

  // Unique cities list for quick filter
  const uniqueCities = React.useMemo(() => {
    const set = new Set<string>()
    points.forEach((p) => {
      if (countryFilter !== "todos" && p.pais !== countryFilter) return
      if (p.localidade && p.localidade.trim()) {
        set.add(p.localidade.trim().toUpperCase())
      }
    })
    return Array.from(set).sort()
  }, [points, countryFilter])

  // Refresh from CTT WebService
  const handleRefresh = async () => {
    setIsRefreshing(true)
    setErrorMsg(undefined)
    try {
      const res = await getPontosPickupCttAction(true)
      if (res.success && res.points) {
        setPoints(res.points)
        setCachedAt(res.cachedAt)
      } else if (res.error) {
        setErrorMsg(res.error)
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Falha ao sincronizar com os webservices CTT")
    } finally {
      setIsRefreshing(false)
    }
  }

  // Filtered points
  const filtered = React.useMemo(() => {
    return points.filter((p) => {
      // Country tab filter
      if (countryFilter !== "todos" && p.pais !== countryFilter) {
        return false
      }

      // Category filter
      if (categoryFilter !== "todos" && p.tipoCategoria !== categoryFilter) {
        return false
      }

      // Entity filter
      if (entityFilter !== "todos") {
        if (entityFilter === "1" && p.entidadeId !== 1) return false
        if (entityFilter === "2" && p.entidadeId !== 2) return false
      }

      // City filter
      if (cityFilter !== "todos") {
        if (p.localidade.trim().toUpperCase() !== cityFilter) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = p.nome.toLowerCase().includes(q)
        const matchCode = p.codigo.toLowerCase().includes(q)
        const matchStreet = p.morada.toLowerCase().includes(q)
        const matchCity = p.localidade.toLowerCase().includes(q)
        const matchPostal = p.codigoPostal.toLowerCase().includes(q)

        if (!matchName && !matchCode && !matchStreet && !matchCity && !matchPostal) {
          return false
        }
      }

      return true
    })
  }, [points, countryFilter, categoryFilter, entityFilter, cityFilter, searchQuery])

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, countryFilter, categoryFilter, entityFilter, cityFilter, pageSize])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleCopyCode = (codigo: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(codigo)
    setCopiedCodeId(codigo)
    setTimeout(() => setCopiedCodeId(null), 2000)
  }

  const handleOpenDetails = (ponto: CTTPontoEntrega) => {
    setSelectedPonto(ponto)
    setIsModalOpen(true)
  }

  // Export CSV
  const handleExportCSV = () => {
    const headers = ["Código PuP", "Nome", "Tipo", "Entidade", "Morada", "Código Postal", "Localidade", "País", "Horário", "Latitude", "Longitude", "Telefone"]
    const rows = filtered.map((p) => [
      `"${p.codigo}"`,
      `"${p.nome.replace(/"/g, '""')}"`,
      `"${p.tipo}"`,
      `"${p.entidadeNome}"`,
      `"${p.morada.replace(/"/g, '""')}"`,
      `"${p.codigoPostal}"`,
      `"${p.localidade.replace(/"/g, '""')}"`,
      `"${p.pais}"`,
      `"${p.horarioFormatado || ""}"`,
      `"${p.latitude || ""}"`,
      `"${p.longitude || ""}"`,
      `"${p.telefone || ""}"`,
    ])

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `pontos_pickup_${countryFilter}_${new Date().toISOString().slice(0, 10)}.csv`)
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pontos Pickup</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              CTT Expresso & CTT Express ES
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Rede oficial de pontos de entrega e recolha CTT, Cacifos Locky 24H e parceiros em Portugal e Espanha.
            {cachedAt && (
              <span className="ml-1 text-slate-400">
                (Sincronizado: {new Date(cachedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })})
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Exportar CSV ({filtered.length.toLocaleString("pt-PT")})
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "A sincronizar..." : "Sincronizar CTT"}
          </button>
        </div>
      </div>

      {/* Error alert if any */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SEPARADORES PRINCIPAIS: IBÉRICO / PORTUGAL / ESPANHA */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
        {/* Ibérico */}
        <button
          onClick={() => setCountryFilter("todos")}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
            countryFilter === "todos"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Globe2 className="w-4 h-4" />
          <span>Rede Ibérica (PT + ES)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            countryFilter === "todos" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600"
          }`}>
            {countryCounts.all.toLocaleString("pt-PT")}
          </span>
        </button>

        {/* Portugal */}
        <button
          onClick={() => setCountryFilter("PT")}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
            countryFilter === "PT"
              ? "bg-green-600 text-white shadow-md shadow-green-600/20"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <span className="text-base">🇵🇹</span>
          <span>Portugal</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            countryFilter === "PT" ? "bg-green-700 text-white" : "bg-slate-100 text-slate-600"
          }`}>
            {countryCounts.pt.toLocaleString("pt-PT")}
          </span>
        </button>

        {/* Espanha */}
        <button
          onClick={() => setCountryFilter("ES")}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
            countryFilter === "ES"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <span className="text-base">🇪🇸</span>
          <span>Espanha (CTT Express)</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            countryFilter === "ES" ? "bg-amber-700 text-white" : "bg-slate-100 text-slate-600"
          }`}>
            {countryCounts.es.toLocaleString("pt-PT")}
          </span>
        </button>
      </div>

      {/* KPI Cards (Adaptam-se ao país selecionado) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {countryFilter === "PT" ? "Total Portugal" : countryFilter === "ES" ? "Total Espanha" : "Total Ibérico"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{activeStats.total.toLocaleString("pt-PT")}</span>
            <span className="text-xs font-medium text-slate-500">pontos ativos</span>
          </div>
        </div>

        {/* Cacifos Locky */}
        <div 
          onClick={() => setCategoryFilter(categoryFilter === "cacifo" ? "todos" : "cacifo")}
          className={`bg-white rounded-2xl p-5 border shadow-sm cursor-pointer transition-all ${
            categoryFilter === "cacifo" ? "border-purple-500 ring-2 ring-purple-100" : "border-slate-200/80 hover:border-purple-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Cacifos Locky 24H</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-purple-900">{activeStats.cacifos.toLocaleString("pt-PT")}</span>
            <span className="text-xs font-medium text-purple-600">lockers 24/7</span>
          </div>
        </div>

        {/* Lojas CTT */}
        <div 
          onClick={() => setCategoryFilter(categoryFilter === "loja" ? "todos" : "loja")}
          className={`bg-white rounded-2xl p-5 border shadow-sm cursor-pointer transition-all ${
            categoryFilter === "loja" ? "border-rose-500 ring-2 ring-rose-100" : "border-slate-200/80 hover:border-rose-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Lojas & Postos CTT</span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-900">{activeStats.lojas.toLocaleString("pt-PT")}</span>
            <span className="text-xs font-medium text-rose-600">oficiais</span>
          </div>
        </div>

        {/* Parceiros */}
        <div 
          onClick={() => setCategoryFilter(categoryFilter === "parceiro" ? "todos" : "parceiro")}
          className={`bg-white rounded-2xl p-5 border shadow-sm cursor-pointer transition-all ${
            categoryFilter === "parceiro" ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200/80 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Pontos Parceiros</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-900">{activeStats.parceiros.toLocaleString("pt-PT")}</span>
            <span className="text-xs font-medium text-emerald-600">agentes & lojas</span>
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
              placeholder="Pesquisar por nome, código PuP, morada, localidade ou CP..."
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

          {/* Quick Category Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setCategoryFilter("todos")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                categoryFilter === "todos"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todos ({activeStats.total.toLocaleString("pt-PT")})
            </button>
            <button
              onClick={() => setCategoryFilter("cacifo")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                categoryFilter === "cacifo"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-purple-700"
              }`}
            >
              📦 Cacifos Locky ({activeStats.cacifos.toLocaleString("pt-PT")})
            </button>
            <button
              onClick={() => setCategoryFilter("loja")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                categoryFilter === "loja"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-rose-700"
              }`}
            >
              🏢 Lojas CTT ({activeStats.lojas.toLocaleString("pt-PT")})
            </button>
            <button
              onClick={() => setCategoryFilter("parceiro")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                categoryFilter === "parceiro"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-emerald-700"
              }`}
            >
              🏪 Parceiros ({activeStats.parceiros.toLocaleString("pt-PT")})
            </button>
          </div>
        </div>

        {/* Secondary Filters (Entity & City) */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Rede / Entidade:</span>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="todos">Todas as Redes</option>
              <option value="1">Rede CTT / Locky / Agências</option>
              <option value="2">Rede Parceiros / Animática</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Localidade / Cidade:</span>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500 max-w-xs"
            >
              <option value="todos">Todas as Localidades ({uniqueCities.length.toLocaleString("pt-PT")})</option>
              {uniqueCities.slice(0, 150).map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {(searchQuery || categoryFilter !== "todos" || entityFilter !== "todos" || cityFilter !== "todos" || countryFilter !== "todos") && (
            <button
              onClick={() => {
                setSearchQuery("")
                setCategoryFilter("todos")
                setEntityFilter("todos")
                setCityFilter("todos")
                setCountryFilter("todos")
              }}
              className="text-green-700 hover:text-green-800 font-semibold underline ml-auto"
            >
              Repor filtros
            </button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Table top indicator */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            A apresentar <strong className="text-slate-800">{filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> - <strong className="text-slate-800">{Math.min(currentPage * pageSize, filtered.length).toLocaleString("pt-PT")}</strong> de <strong className="text-slate-800">{filtered.length.toLocaleString("pt-PT")}</strong> pontos de pickup
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
                <th className="py-3.5 px-4">Ponto Pickup / Nome</th>
                <th className="py-3.5 px-4">Código (PuP ID)</th>
                <th className="py-3.5 px-4">Tipo & Rede</th>
                <th className="py-3.5 px-4">Localização</th>
                <th className="py-3.5 px-4">Horário</th>
                <th className="py-3.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">Nenhum ponto de pickup encontrado</p>
                    <p className="text-xs text-slate-400 mt-1">Tente ajustar a sua pesquisa ou filtros.</p>
                  </td>
                </tr>
              ) : (
                paginated.map((p) => {
                  const isCacifo = p.tipoCategoria === "cacifo"
                  const isLoja = p.tipoCategoria === "loja"
                  const isParceiro = p.tipoCategoria === "parceiro"

                  return (
                    <tr
                      key={p.codigo + "-" + p.nome}
                      onClick={() => handleOpenDetails(p)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isCacifo
                              ? "bg-purple-50 text-purple-600"
                              : isLoja
                              ? "bg-rose-50 text-rose-600"
                              : "bg-emerald-50 text-emerald-600"
                          }`}>
                            {isCacifo ? (
                              <Package className="w-4 h-4" />
                            ) : isLoja ? (
                              <Building2 className="w-4 h-4" />
                            ) : (
                              <Store className="w-4 h-4" />
                            )}
                          </div>

                          <div>
                            <span className="font-semibold text-slate-900 group-hover:text-green-700 transition-colors block">
                              {p.nome}
                            </span>
                            <span className="text-xs text-slate-400">
                              {p.pais === "PT" ? "🇵🇹 Portugal" : "🇪🇸 Espanha"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-mono text-xs font-semibold transition-colors">
                          <span>{p.codigo}</span>
                          <button
                            onClick={(e) => handleCopyCode(p.codigo, e)}
                            className="text-slate-400 hover:text-slate-700"
                            title="Copiar código PuP"
                          >
                            {copiedCodeId === p.codigo ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Type & Entity */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                            isCacifo
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : isLoja
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}>
                            {p.tipo}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            {p.entidadeNome}
                          </span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-slate-800 truncate" title={p.morada}>
                            {p.morada}
                          </span>
                          <span className="text-xs text-slate-500">
                            {p.codigoPostal} <strong className="text-slate-700 font-semibold">{p.localidade}</strong>
                          </span>
                        </div>
                      </td>

                      {/* Schedule */}
                      <td className="py-3.5 px-4">
                        {isCacifo ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            24 Horas
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600 font-medium block truncate max-w-[180px]" title={p.horarioFormatado}>
                            {p.horarioFormatado || "Sob consulta"}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenDetails(p)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  )
                })
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

            {/* Quick page jumps */}
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
      <PontoDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        ponto={selectedPonto}
      />
    </div>
  )
}
