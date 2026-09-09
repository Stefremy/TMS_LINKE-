"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { 
  Package, 
  Receipt, 
  Building2, 
  BarChart3, 
  ShieldCheck, 
  MapPin, 
  PlusCircle,
  Percent,
  Search,
  Printer,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  FileText,
  Download
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getClientesAction } from "@/app/actions/clientes"
import { getClientPortalStatsAction } from "@/app/actions/shipments"
import { closeCttShipmentsAction } from "@/app/actions/ctt"
import { Cliente, DEFAULT_CTT_SERVICES_PRICING } from "@/app/ops/entidades/clientes/types"
import { ClientShipmentDetailModal } from "@/app/app/components/ClientShipmentDetailModal"

export function ClientDashboard() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("clientId")
  const clientNameParam = searchParams.get("clientName")

  const [currentClient, setCurrentClient] = React.useState<Cliente | null>(null)
  const [stats, setStats] = React.useState<{
    totalCount: number
    totalRevenue: number
    deliveredCount: number
    deliveryRate: number
    weeklyVolume: Array<{ day: string; count: number; height: string }>
    serviceBreakdown: Array<{ name: string; count: string; rawCount: number; share: number; color: string }>
    destinationRegions: Array<{ region: string; count: string; pct: number }>
    recentShipments: any[]
    allShipments?: any[]
  }>({
    totalCount: 0,
    totalRevenue: 0,
    deliveredCount: 0,
    deliveryRate: 0,
    weeklyVolume: [
      { day: "Seg", count: 0, height: "0%" },
      { day: "Ter", count: 0, height: "0%" },
      { day: "Qua", count: 0, height: "0%" },
      { day: "Qui", count: 0, height: "0%" },
      { day: "Sex", count: 0, height: "0%" },
      { day: "Sáb", count: 0, height: "0%" },
      { day: "Dom", count: 0, height: "0%" },
    ],
    serviceBreakdown: [],
    destinationRegions: [],
    recentShipments: [],
    allShipments: [],
  })

  const [shipments, setShipments] = React.useState<any[]>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("todos")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [openDropdownId, setOpenDropdownId] = React.useState<string | null>(null)
  const [selectedShipment, setSelectedShipment] = React.useState<any | null>(null)
  const [closingBatch, setClosingBatch] = React.useState(false)
  const [manifestData, setManifestData] = React.useState<{ fileName: string; base64: string } | null>(null)

  const pageSize = 15

  // Load client data & real DB stats
  React.useEffect(() => {
    getClientesAction().then((clients) => {
      let target: Cliente | undefined
      if (clientId) {
        target = clients.find((c) => c.id === clientId)
      }
      if (!target && clientNameParam) {
        const decoded = decodeURIComponent(clientNameParam).toLowerCase()
        target = clients.find((c) => c.short_name.toLowerCase() === decoded || c.legal_name.toLowerCase() === decoded)
      }
      if (!target && clients.length > 0) {
        target = clients[0]
      }
      if (target) {
        setCurrentClient(target)
      }

      // Fetch 100% real stats for this client
      getClientPortalStatsAction(target?.id, target?.short_name).then((res) => {
        if (res) {
          setStats(res)
          setShipments(res.allShipments || res.recentShipments || [])
        }
      })
    })
  }, [clientId, clientNameParam])

  // Handle click outside dropdown
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".action-dropdown")) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [])

  const querySuffix = React.useMemo(() => {
    if (!currentClient) return ""
    return `?clientId=${encodeURIComponent(currentClient.id || "")}&clientName=${encodeURIComponent(currentClient.short_name || "")}`
  }, [currentClient])

  // Filtered shipments
  const filteredShipments = React.useMemo(() => {
    return shipments.filter((item) => {
      const q = searchTerm.toLowerCase().trim()
      const ref = (item.tracking_number || item.id || "").toLowerCase()
      const rec = (item.recipient_name || "").toLowerCase()
      const addr = (item.recipient_address || "").toLowerCase()

      const matchesSearch = !q || ref.includes(q) || rec.includes(q) || addr.includes(q)
      const matchesStatus = statusFilter === "todos" || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [shipments, searchTerm, statusFilter])

  // Reset page when search or filter changes
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  // Paginated slice (15 per page)
  const totalPages = Math.ceil(filteredShipments.length / pageSize) || 1
  const paginatedShipments = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredShipments.slice(startIndex, startIndex + pageSize)
  }, [filteredShipments, currentPage, pageSize])

  const pendingShipments = React.useMemo(() => {
    return shipments.filter(s => s.status === "pendente")
  }, [shipments])

  const handleCloseBatch = async () => {
    if (pendingShipments.length === 0) return
    const idsToClose = pendingShipments.map(s => s.tracking_number || s.id).filter(Boolean)
    if (idsToClose.length === 0) return

    setClosingBatch(true)
    try {
      const res = await closeCttShipmentsAction(idsToClose)
      if (res.success && res.documents && res.documents.length > 0) {
        setManifestData({
          fileName: res.documents[0].FileName || "Manifesto_CTT.pdf",
          base64: res.documents[0].File
        })
        setShipments(prev => prev.map(s => {
          if (idsToClose.includes(s.tracking_number) || idsToClose.includes(s.id)) {
            return { ...s, status: "em_transito" }
          }
          return s
        }))
      } else {
        alert("Erro ao fechar lote de envios CTT.")
      }
    } catch (e: any) {
      alert("Erro ao fechar lote: " + e.message)
    } finally {
      setClosingBatch(false)
    }
  }

  const printLabel = (base64String: string) => {
    try {
      const byteCharacters = atob(base64String)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const file = new Blob([byteArray], { type: "application/pdf" })
      const fileURL = URL.createObjectURL(file)
      const printWindow = window.open(fileURL, "_blank")
      if (printWindow) {
        printWindow.onload = () => printWindow.print()
      }
    } catch (err) {
      alert("Não foi possível carregar a etiqueta em PDF.")
    }
  }

  const downloadLabel = (base64String: string, ref: string) => {
    try {
      const link = document.createElement("a")
      link.href = `data:application/pdf;base64,${base64String}`
      link.download = `${ref}_Etiqueta_CTT.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      alert("Erro ao descarregar PDF da etiqueta.")
    }
  }

  // Contractual and pricing details from real client record
  const discountPct = currentClient?.pricing?.discount_pct ?? 0
  const fuelPct = currentClient?.pricing?.fuel_surcharge_pct ?? 12.5
  const creditLimit = currentClient?.credit_limit ?? 0
  const paymentTerms = currentClient?.payment_terms || "Pronto Pagamento"
  const activeServices = (currentClient?.pricing?.services_pricing || DEFAULT_CTT_SERVICES_PRICING).filter(s => s.is_enabled)

  // Real credit calculation
  const usedPlafondPct = creditLimit > 0 ? Math.min((stats.totalRevenue / creditLimit) * 100, 100).toFixed(1) : "0"

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto font-sans relative">

      {/* Detalhes do Envio Modal (Read-Only Mirror of Creation Form) */}
      <ClientShipmentDetailModal 
        shipment={selectedShipment} 
        onClose={() => setSelectedShipment(null)} 
        onUpdateShipment={(updated) => {
          setShipments(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s))
        }}
      />
      
      {/* Top Welcome & Client Header Banner */}
      <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-700 text-white rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              {currentClient?.code || "CLIENTE"}
            </span>
            <span className="text-emerald-100 text-xs font-semibold">
              {currentClient?.city ? `Sede: ${currentClient.city}` : "Conta Ativa"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {currentClient?.legal_name || currentClient?.short_name || "Portal de Envios do Cliente"}
          </h1>
          <p className="text-emerald-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Painel operacional e analítico com métricas em tempo real, tabelas de preçário acordadas e emissão de guias CTT.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href={`/app/criar-guia${querySuffix}`}
            className="px-6 py-3.5 bg-white text-emerald-900 hover:bg-emerald-50 active:scale-[0.99] rounded-2xl text-xs sm:text-sm font-extrabold shadow-md transition-all flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>Novo Envio</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI 1: Envios Totais Reais */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Volume de Envios</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono">{stats.totalCount}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{stats.deliveredCount} entregues no destino</p>
          </div>
        </div>

        {/* KPI 2: Faturação Real */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Faturação Acumulada</span>
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono">
                {stats.totalRevenue.toFixed(2)}€
              </span>
              <span className="text-[11px] text-slate-400 font-medium">+ IVA</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Condições: <strong>{paymentTerms}</strong></p>
          </div>
        </div>

        {/* KPI 3: Desconto Real */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Desconto Contratual</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-indigo-600 font-mono">{discountPct}%</span>
              <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">
                Taxa Comb: {fuelPct}%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {activeServices.length} serviços CTT contratados
            </p>
          </div>
        </div>

        {/* KPI 4: Plafond de Crédito Real */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plafond de Crédito</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            {creditLimit > 0 ? (
              <>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xl font-black text-slate-900 font-mono">
                    {creditLimit.toLocaleString("pt-PT")}€
                  </span>
                  <span className="text-xs font-bold text-emerald-600">{usedPlafondPct}% Utilizado</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${usedPlafondPct}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Disponível: {Math.max(creditLimit - stats.totalRevenue, 0).toLocaleString("pt-PT")}€
                </p>
              </>
            ) : (
              <>
                <span className="text-2xl font-black text-slate-800 font-mono">Sem Limite</span>
                <p className="text-[11px] text-slate-400 mt-1">Conta sem teto fixado</p>
              </>
            )}
          </div>
        </div>

      </div>

      {/* MANIFEST ALERT IF CLOSED */}
      {manifestData && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 animate-in fade-in shadow-xs">
          <div className="flex items-center gap-3.5">
            <div>
              <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                <span>Lote Fechado com Sucesso!</span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                O manifesto (Certificado de Aceitação CTT) foi gerado.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                const link = document.createElement("a")
                link.href = `data:application/pdf;base64,${manifestData.base64}`
                link.download = manifestData.fileName
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
              }}
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Descarregar Manifesto
            </button>
            <button
              type="button"
              onClick={() => setManifestData(null)}
              className="text-emerald-700 hover:text-emerald-950 text-xs font-bold px-2.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* TABELA PRINCIPAL DE ENVIOS (15 POR PÁGINA) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
        {/* Table Header & Controls */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Package className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Envios & Guias de Transporte</h2>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full font-mono">
                {filteredShipments.length} {filteredShipments.length === 1 ? "envio" : "envios"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Lista dos envios emitidos com rastreamento em tempo real e impressão de etiquetas CTT.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {pendingShipments.length > 0 && (
              <button
                onClick={handleCloseBatch}
                disabled={closingBatch}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 active:scale-[0.99] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {closingBatch ? "A Fechar..." : `Fechar ${pendingShipments.length} Envios`}
              </button>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado do envio"
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="todos">Todos os Estados</option>
              <option value="pendente">Pendentes</option>
              <option value="em transito">Em Trânsito</option>
              <option value="entregue">Entregues</option>
              <option value="cancelado">Cancelados</option>
            </select>

            {/* Search Box */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Pesquisar envio, destinatário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        {filteredShipments.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Nenhum envio encontrado</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {searchTerm || statusFilter !== "todos" 
                ? "Tente ajustar os filtros ou o termo de pesquisa."
                : "Ainda não existem envios emitidos para esta conta de cliente."}
            </p>
            <Link
              href={`/app/criar-guia${querySuffix}`}
              className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all"
            >
              Criar Novo Envio
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-5">Guia / Rastreio</th>
                  <th className="py-3.5 px-5">Serviço CTT</th>
                  <th className="py-3.5 px-5">Destinatário & Destino</th>
                  <th className="py-3.5 px-5">Data Emissão</th>
                  <th className="py-3.5 px-5">Valor</th>
                  <th className="py-3.5 px-5">Estado</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedShipments.map((shipment) => {
                  const dateStr = shipment.created_at ? new Date(shipment.created_at).toLocaleDateString("pt-PT", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  }) : "Hoje"

                  const tracking = shipment.tracking_number || shipment.id

                  return (
                    <tr key={shipment.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Tracking / Guia */}
                      <td className="py-4 px-5">
                        <button
                          type="button"
                          onClick={() => setSelectedShipment(shipment)}
                          className="font-mono font-bold text-emerald-700 hover:text-emerald-900 hover:underline text-xs flex items-center gap-1.5 cursor-pointer text-left transition-colors"
                          title="Clique para ver os detalhes do envio"
                        >
                          {tracking}
                        </button>
                      </td>

                      {/* Service Type */}
                      <td className="py-4 px-5">
                        <span className="font-semibold text-slate-700">
                          {shipment.service_type || "CTT Expresso"}
                        </span>
                      </td>

                      {/* Destinatário */}
                      <td className="py-4 px-5 max-w-[260px]">
                        <div className="font-bold text-slate-900 truncate">{shipment.recipient_name}</div>
                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                          <span>{shipment.recipient_address || "Portugal"}</span>
                        </div>
                      </td>

                      {/* Data */}
                      <td className="py-4 px-5 text-slate-500 whitespace-nowrap">
                        {dateStr}
                      </td>

                      {/* Valor */}
                      <td className="py-4 px-5 font-mono font-bold text-slate-900">
                        {shipment.sell_price ? `${Number(shipment.sell_price).toFixed(2)}€` : "—"}
                      </td>

                      {/* Estado */}
                      <td className="py-4 px-5">
                        <Badge variant={
                          shipment.status === "entregue" ? "success" :
                          shipment.status === "pendente" ? "warning" : "info"
                        }>
                          {shipment.status === "em transito" ? "Em Trânsito" : 
                            shipment.status.charAt(0).toUpperCase() + shipment.status.slice(1)}
                        </Badge>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-5 text-right">
                        <div className="relative inline-block text-left action-dropdown">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenDropdownId(openDropdownId === shipment.id ? null : shipment.id)
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openDropdownId === shipment.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 animate-in fade-in-50 zoom-in-95 text-left">
                              {shipment.ctt_label_base64 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null)
                                      printLabel(shipment.ctt_label_base64)
                                    }}
                                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Printer className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Imprimir Etiqueta</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null)
                                      downloadLabel(shipment.ctt_label_base64, tracking)
                                    }}
                                    className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Descarregar PDF</span>
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenDropdownId(null)
                                  setSelectedShipment(shipment)
                                }}
                                className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-400" />
                                <span>Ver Detalhes</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer (15 per page) */}
        {filteredShipments.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              A mostrar <strong>{Math.min((currentPage - 1) * pageSize + 1, filteredShipments.length)}</strong> a <strong>{Math.min(currentPage * pageSize, filteredShipments.length)}</strong> de <strong>{filteredShipments.length}</strong> envios
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <span className="px-2 font-semibold text-slate-700 font-mono">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* GRAPHS & ANALYTICS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Graph 1: Volume Diário Real de Envios */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Volume de Envios por Dia</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Distribuição diária de emissão de guias de transporte CTT</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-xl">
                {stats.totalCount} {stats.totalCount === 1 ? "Envio Registado" : "Envios Registados"}
              </span>
            </div>
          </div>

          {/* Visual Bar Graph with REAL data */}
          {stats.totalCount === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Package className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">Sem envios registados</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Os gráficos de barras serão preenchidos em tempo real à medida que emitir novas guias CTT.
              </p>
            </div>
          ) : (
            <div className="h-64 flex items-end justify-between gap-3 sm:gap-6 pt-8 pb-2 px-2 border-b border-slate-100">
              {stats.weeklyVolume.map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-[11px] font-mono font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.count}
                  </div>
                  <div className="w-full max-w-[48px] bg-slate-100 rounded-t-xl overflow-hidden flex items-end h-full">
                    <div 
                      className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-xl transition-all duration-500"
                      style={{ height: item.height }}
                    />
                  </div>
                  <div className="text-center mt-1">
                    <span className="block text-xs font-bold text-slate-800">{item.day}</span>
                    <span className="block text-[10px] text-slate-400 font-mono font-bold">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-emerald-500" />
              <span>Envios CTT Registados</span>
            </div>
            <span className="font-semibold text-slate-700">
              Total Acumulado: <strong>{stats.totalCount} guias</strong>
            </span>
          </div>
        </div>

      </div>

      {/* LOWER SECTION: REAL DESTINATIONS */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">Destinos dos Envios</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Destinos mais frequentes da mercadoria desta conta</p>
          </div>
        </div>

        {stats.destinationRegions.length === 0 ? (
          <div className="py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <MapPin className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-slate-600">Sem destinos registados</p>
            <p className="text-[11px] text-slate-400 mt-0.5">As localidades de destino aparecerão aqui após emissão.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-2">
            {stats.destinationRegions.map((dest, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{dest.region}</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-400 text-[11px]">{dest.count}</span>
                    <span className="font-bold text-slate-900">{dest.pct}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${dest.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
