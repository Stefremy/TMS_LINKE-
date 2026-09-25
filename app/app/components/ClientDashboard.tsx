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
  Download,
  Undo2,
  Trash2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getClientesAction } from "@/app/actions/clientes"
import { syncCttTrackingAction, closeCttShipmentsAction, convertZplToPdfAction } from "@/app/actions/ctt"
import { printCttLabel, downloadCttLabel } from "@/lib/label-utils"
import { 
  getClientPortalStatsAction, 
  createReturnShipmentAction, 
  deleteShipmentAction
} from "@/app/actions/shipments"
import { Cliente, DEFAULT_CTT_SERVICES_PRICING } from "@/app/ops/entidades/clientes/types"
import { ClientShipmentDetailModal } from "@/app/app/components/ClientShipmentDetailModal"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { getShipmentStatusConfig } from "@/lib/status-helpers"
import { CreditCard } from "lucide-react"
import { ClientTopUpModal } from "@/app/app/components/ClientTopUpModal"

export function ClientDashboard({ userEmail, passedClientId }: { userEmail?: string, passedClientId?: string }) {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("clientId") || passedClientId
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
  const [isTopUpOpen, setIsTopUpOpen] = React.useState(false)

  const pageSize = 15

  // Use URL params for top-up status feedback
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href)
      const topup = url.searchParams.get("topup")
      if (topup === "success") {
        alert("O carregamento de saldo foi finalizado! O valor será creditado assim que o pagamento for confirmado.")
        window.history.replaceState({}, '', window.location.pathname + window.location.search.replace(/&?topup=success/, ''))
      } else if (topup === "cancelled") {
        alert("O carregamento foi cancelado.")
        window.history.replaceState({}, '', window.location.pathname + window.location.search.replace(/&?topup=cancelled/, ''))
      }
    }
  }, [])

  // Load client data & real DB stats
  React.useEffect(() => {
    getClientesAction().then((clients) => {
      let target: Cliente | undefined
      if (clientId) {
        target = clients.find((c) => c.id === clientId)
      }
      if (!target && clientNameParam) {
        target = clients.find((c) => c.short_name.toLowerCase() === clientNameParam.toLowerCase())
      }
      if (!target && userEmail) {
        target = clients.find(c => c.email?.toLowerCase().trim() === userEmail.toLowerCase().trim())
      }
      
      // Fallback para administradores a testar o portal sem parâmetros
      if (!target && clients.length > 0) {
        target = clients[0]
      }

      if (target) {
        setCurrentClient(target)
      }

      // Fetch 100% real stats for this client
      if (target) {
        getClientPortalStatsAction(target.id, target.short_name).then((res) => {
          if (res) {
            setStats(res)
            setShipments(res.allShipments || res.recentShipments || [])
          }
        })
      }
    })
  }, [clientId, clientNameParam, userEmail])

  // Handle click outside dropdown
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest(".action-dropdown")) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
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
      const internalRef = (item.reference || "").toLowerCase()
      const cttRef = (item.carrier_tracking_number || item.ctt_object_id || "").toLowerCase()
      const rec = (item.recipient_name || "").toLowerCase()
      const addr = (item.recipient_address || "").toLowerCase()

      const matchesSearch = !q || ref.includes(q) || internalRef.includes(q) || cttRef.includes(q) || rec.includes(q) || addr.includes(q)
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
          fileName: "Manifesto_CTT.pdf",
          base64: res.documents[0].DocumentData
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

  const resolveLabel = async (rawLabel: string | null | undefined): Promise<string | null> => {
    if (!rawLabel) {
      alert("Este envio não tem etiqueta CTT. A etiqueta é gerada exclusivamente na criação do envio.")
      return null
    }
    if (rawLabel.trimStart().startsWith("^XA")) {
      const res = await convertZplToPdfAction(rawLabel)
      if (res.success && res.base64) return res.base64
      alert(`Falha ao converter etiqueta ZPL para PDF: ${res.error || "Erro desconhecido"}`)
      return null
    }
    return rawLabel
  }

  const printLabel = async (shipmentItem: any) => {
    const label = await resolveLabel(shipmentItem?.ctt_label_base64)
    if (label) printCttLabel(label)
  }

  const downloadLabel = async (shipmentItem: any, ref: string) => {
    const label = await resolveLabel(shipmentItem?.ctt_label_base64)
    if (label) downloadCttLabel(label, `${ref}_Etiqueta_CTT.pdf`)
  }

  // Contractual and pricing details from real client record
  const discountPct = currentClient?.pricing?.discount_pct ?? 0
  const fuelPct = currentClient?.pricing?.fuel_surcharge_pct ?? 12.5
  const creditLimit = currentClient?.credit_limit ?? 0
  const paymentTerms = currentClient?.payment_terms || "Pronto Pagamento"
  const activeServices = (currentClient?.pricing?.services_pricing || DEFAULT_CTT_SERVICES_PRICING).filter(s => s.is_enabled)

  // Real credit calculation
  const usedCreditPct = creditLimit > 0 ? Math.min((stats.totalRevenue / creditLimit) * 100, 100).toFixed(1) : "0"

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
            Painel operacional e analítico com métricas em tempo real, tabelas de preçário acordadas e emissão integrada via CTT Expresso API.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-emerald-200 font-semibold">Operador Integrado:</span>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-white/15">
              <div className="w-5 h-5 rounded bg-white p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getCarrierLogo("ctt") || ""} alt="CTT Expresso" className="max-w-full max-h-full object-contain" />
              </div>
              <span className="text-xs font-bold text-white">CTT Expresso API</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsTopUpOpen(true)}
            className="px-5 py-3.5 bg-emerald-800/80 hover:bg-emerald-800 text-white active:scale-[0.99] rounded-2xl text-xs sm:text-sm font-extrabold shadow-md transition-all flex items-center gap-2 backdrop-blur-xs border border-white/20 cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-emerald-200" />
            <span>Carregar Saldo</span>
          </button>
          
          {currentClient && (currentClient.credit_limit ?? 0) <= 0 ? (
            <button
              type="button"
              onClick={() => {
                alert("Conta bloqueada. O teu saldo é 0.00€ ou negativo. Efetua um carregamento para voltares a criar envios.")
                setIsTopUpOpen(true)
              }}
              className="px-6 py-3.5 bg-red-100 text-red-700 active:scale-[0.99] rounded-2xl text-xs sm:text-sm font-extrabold shadow-md transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-red-500" />
              <span>Novo Envio (Bloqueado)</span>
            </button>
          ) : (
            <Link
              href={`/app/criar-guia${querySuffix}`}
              className="px-6 py-3.5 bg-white text-emerald-900 hover:bg-emerald-50 active:scale-[0.99] rounded-2xl text-xs sm:text-sm font-extrabold shadow-md transition-all flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              <span>Novo Envio</span>
            </Link>
          )}
        </div>
      </div>

      <ClientTopUpModal 
        isOpen={isTopUpOpen} 
        onClose={() => setIsTopUpOpen(false)} 
        clientId={currentClient?.id || ""} 
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI 1: Envios Totais Reais */}
        <div className="bg-[var(--surface-bg)] rounded-xl p-5 border border-[var(--border-subtle)] shadow-2xs flex flex-col justify-between hover:border-[var(--accent)] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Volume de Envios</span>
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[var(--text-primary)] font-mono">{stats.totalCount}</span>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1">{stats.deliveredCount} entregues no destino</p>
          </div>
        </div>

        {/* KPI 2: Faturação Real */}
        <div className="bg-[var(--surface-bg)] rounded-xl p-5 border border-[var(--border-subtle)] shadow-2xs flex flex-col justify-between hover:border-[var(--accent)] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Faturação Acumulada</span>
            <div className="w-9 h-9 rounded-xl bg-[var(--status-info-soft)] text-[var(--status-info)] flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[var(--text-primary)] font-mono">
                {stats.totalRevenue.toFixed(2)}€
              </span>
              <span className="text-[11px] text-[var(--text-tertiary)] font-medium">+ IVA</span>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Condições: <strong>{paymentTerms}</strong></p>
          </div>
        </div>

        {/* KPI 3: Desconto Real */}
        <div className="bg-[var(--surface-bg)] rounded-xl p-5 border border-[var(--border-subtle)] shadow-2xs flex flex-col justify-between hover:border-[var(--accent)] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Desconto Contratual</span>
            <div className="w-9 h-9 rounded-xl bg-[rgba(99,102,241,0.1)] text-[#4f46e5] flex items-center justify-center font-bold">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#4f46e5] font-mono">{discountPct}%</span>
              <span className="text-[11px] text-[#4f46e5] bg-[rgba(99,102,241,0.1)] px-2 py-0.5 rounded-full font-bold">
                Taxa Comb: {fuelPct}%
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)] mt-1.5">
              <span>{activeServices.length} serviços autorizados</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-[var(--surface-bg)] border border-[var(--border-subtle)] p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getCarrierLogo("ctt") || ""} alt="CTT Expresso" className="max-w-full max-h-full object-contain" />
                </div>
                <span className="text-[10px] font-bold text-[var(--text-secondary)]">CTT Expresso</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 4: Crédito (Saldo) */}
        <div className="bg-[var(--surface-bg)] rounded-xl p-5 border border-[var(--border-subtle)] shadow-2xs flex flex-col justify-between hover:border-[var(--accent)] transition-colors">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Crédito (Saldo)</span>
            <div className="w-9 h-9 rounded-xl bg-[var(--status-warning-soft)] text-[var(--status-warning)] flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div>
            {creditLimit > 0 ? (
              <>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xl font-black text-[var(--text-primary)] font-mono">
                    {creditLimit.toLocaleString("pt-PT")}€
                  </span>
                  <span className="text-xs font-bold text-[var(--accent)]">{usedCreditPct}% Utilizado</span>
                </div>
                <div className="w-full bg-[var(--surface-muted)] rounded-full h-2 overflow-hidden">
                  <div className="bg-[var(--accent)] h-2 rounded-full transition-all duration-500" style={{ width: `${usedCreditPct}%` }} />
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                  Disponível: {Math.max(creditLimit - stats.totalRevenue, 0).toLocaleString("pt-PT")}€
                </p>
              </>
            ) : (
              <>
                <span className="text-2xl font-black text-[var(--text-primary)] font-mono">Sem Limite</span>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Conta sem teto fixado</p>
              </>
            )}
          </div>
        </div>

      </div>

      {/* MANIFEST ALERT IF CLOSED */}
      {manifestData && (
        <div className="bg-[var(--status-success-soft)] border border-[var(--status-success)] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 animate-in fade-in shadow-xs">
          <div className="flex items-center gap-3.5">
            <div>
              <div className="text-sm font-bold text-[var(--status-success)] flex items-center gap-2">
                <span>Lote Fechado com Sucesso!</span>
              </div>
              <p className="text-xs text-[var(--status-success)] opacity-90 mt-0.5">
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
              className="bg-[var(--status-success)] hover:opacity-90 text-white px-3.5 py-2.5 rounded-md text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              Descarregar Manifesto
            </button>
            <button
              type="button"
              onClick={() => setManifestData(null)}
              className="text-[var(--status-success)] hover:opacity-70 text-xs font-bold px-2.5 py-2 rounded-md transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* TABELA PRINCIPAL DE ENVIOS (15 POR PÁGINA) */}
      <div className="bg-[var(--surface-bg)] rounded-xl border border-[var(--border-subtle)] shadow-2xs overflow-hidden flex flex-col">
        {/* Table Header & Controls */}
        <div className="p-5 sm:p-6 border-b border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Package className="w-5 h-5 text-[var(--accent)]" />
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Envios & Guias de Transporte</h2>
              <span className="text-xs font-bold text-[var(--text-secondary)] bg-[var(--surface-dim)] border border-[var(--border-strong)] px-2.5 py-0.5 rounded-md font-mono">
                {filteredShipments.length} {filteredShipments.length === 1 ? "envio" : "envios"}
              </span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Lista dos envios emitidos com rastreamento em tempo real e impressão de etiquetas CTT.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {pendingShipments.length > 0 && (
              <button
                onClick={handleCloseBatch}
                disabled={closingBatch}
                className="px-3.5 py-2 bg-[var(--text-primary)] hover:bg-[#202420] active:scale-[0.99] disabled:opacity-50 text-white rounded-md text-xs font-bold shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                {closingBatch ? "A Fechar..." : `Fechar ${pendingShipments.length} Envios`}
              </button>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado do envio"
              className="px-3 py-2 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="todos">Todos os Estados</option>
              <option value="pendente">Pendentes</option>
              <option value="em transito">Em Trânsito</option>
              <option value="entregue">Entregues</option>
              <option value="cancelado">Cancelados</option>
            </select>

            {/* Search Box */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input 
                type="text" 
                placeholder="Pesquisar envio, destinatário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        {filteredShipments.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text-tertiary)] mb-3 border border-[var(--border-subtle)]">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Nenhum envio encontrado</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm">
              {searchTerm || statusFilter !== "todos" 
                ? "Tente ajustar os filtros ou o termo de pesquisa."
                : "Ainda não existem envios emitidos para esta conta de cliente."}
            </p>
            <Link
              href={`/app/criar-guia${querySuffix}`}
              className="mt-4 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-md text-xs font-bold transition-all shadow-xs"
            >
              Criar Novo Envio
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[var(--text-secondary)]">
              <thead className="bg-[var(--surface-muted)] text-[var(--text-tertiary)] font-bold uppercase tracking-wider text-[10px] border-b border-[var(--border-subtle)]">
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
              <tbody className="divide-y divide-[var(--border-subtle)]">
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
                    <tr key={shipment.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                      {/* Tracking / Guia */}
                      <td className="py-4 px-5">
                        {(() => {
                          const linkeRef =
                            (shipment.reference?.startsWith("LTK") ? shipment.reference : null) ||
                            (shipment.tracking_number?.startsWith("LTK") ? shipment.tracking_number : null) ||
                            (shipment.ctt_label_base64?.match(/Ref:\s*(LTK\d+)/i)?.[1]) ||
                            shipment.reference ||
                            null

                          const carrierRef =
                            shipment.carrier_tracking_number ||
                            shipment.ctt_object_id ||
                            (!shipment.tracking_number?.startsWith("LTK") ? shipment.tracking_number : null)

                          const primaryDisplay = linkeRef || carrierRef || shipment.id
                          const secondaryDisplay = (linkeRef && carrierRef && carrierRef !== linkeRef) ? carrierRef : null

                          return (
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                onClick={() => setSelectedShipment(shipment)}
                                className="font-mono font-bold text-[var(--accent)] hover:text-[var(--accent-hover)] hover:underline text-xs flex items-center gap-1.5 cursor-pointer text-left transition-colors"
                                title="Clique para ver os detalhes do envio e rastreio interno"
                              >
                                <span>{primaryDisplay}</span>
                                {linkeRef && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(18,138,71,0.2)] rounded font-sans font-bold leading-none uppercase tracking-wider">
                                    Ref Linke
                                  </span>
                                )}
                              </button>
                              {secondaryDisplay && (
                                <div className="flex items-center gap-1 font-mono text-[11px] font-semibold text-[var(--text-secondary)] mt-0.5" title="Objeto / Guia CTT Expresso">
                                  <span className="text-[var(--text-tertiary)] font-sans text-[10px] uppercase font-bold tracking-wide">CTT:</span>
                                  <span className="font-bold text-[var(--text-primary)]">{secondaryDisplay}</span>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </td>

                      {/* Service Type */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          {getCarrierLogo(shipment.service_type || shipment.carrier || "ctt") ? (
                            <div className="w-5 h-5 rounded bg-[var(--surface-bg)] border border-[var(--border-subtle)] p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={getCarrierLogo(shipment.service_type || shipment.carrier || "ctt")!} 
                                alt={shipment.service_type || "Transportadora"} 
                                className="max-w-full max-h-full object-contain" 
                              />
                            </div>
                          ) : null}
                          <span className="font-semibold text-[var(--text-secondary)] text-xs">
                            {shipment.service_type || "CTT Expresso"}
                          </span>
                        </div>
                      </td>

                      {/* Destinatário */}
                      <td className="py-4 px-5 max-w-[260px]">
                        <div className="font-bold text-[var(--text-primary)] truncate">{shipment.recipient_name}</div>
                        <div className="text-[11px] text-[var(--text-tertiary)] truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0 text-[var(--text-tertiary)]" />
                          <span>{shipment.recipient_address || "Portugal"}</span>
                        </div>
                      </td>

                      {/* Data */}
                      <td className="py-4 px-5 text-[var(--text-secondary)] whitespace-nowrap">
                        {dateStr}
                      </td>

                      {/* Valor */}
                      <td className="py-4 px-5 font-mono font-bold text-[var(--text-primary)]">
                        {shipment.sell_price ? `${Number(shipment.sell_price).toFixed(2)}€` : "—"}
                      </td>

                      {/* Estado */}
                      <td className="py-4 px-5">
                        {(() => {
                          const cfg = getShipmentStatusConfig(shipment.status)
                          return (
                            <Badge variant={cfg.badgeVariant}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cfg.dotColor} shrink-0`} />
                              <span>{cfg.label}</span>
                            </Badge>
                          )
                        })()}
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
                            className="p-1.5 rounded-md border border-[var(--border-strong)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openDropdownId === shipment.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-[var(--surface-bg)] rounded-md shadow-lg border border-[var(--border-subtle)] py-1.5 z-30 animate-in fade-in-50 zoom-in-95 text-left">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenDropdownId(null)
                                  printLabel(shipment)
                                }}
                                className="w-full px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5 text-[var(--accent)]" />
                                <span>Imprimir Etiqueta CTT</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenDropdownId(null)
                                  downloadLabel(shipment, tracking)
                                }}
                                className="w-full px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
                                <span>Descarregar PDF</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenDropdownId(null)
                                  setSelectedShipment(shipment)
                                }}
                                className="w-full px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                                <span>Ver Detalhes</span>
                              </button>

                              <div className="h-px bg-[var(--border-subtle)] my-1" />

                              {/* Criar Devolução */}
                              <button
                                type="button"
                                onClick={async () => {
                                  setOpenDropdownId(null)
                                  const confirmed = window.confirm(`Deseja criar uma guia de DEVOLUÇÃO para o envio ${tracking}?\n\nO Remetente e Destinatário serão invertidos automaticamente.`)
                                  if (!confirmed) return
                                  const res = await createReturnShipmentAction(shipment.id)
                                  if (res.success) {
                                    alert(`✅ Devolução criada com sucesso!\n\nNovo Tracking: ${res.newTrackingNumber}`)
                                    window.location.reload()
                                  } else {
                                    alert("Erro ao criar devolução: " + (res.error || "Erro desconhecido"))
                                  }
                                }}
                                className="w-full px-3 py-2 text-xs font-semibold text-[var(--status-warning)] hover:bg-[var(--status-warning-soft)] flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Undo2 className="w-3.5 h-3.5 text-[var(--status-warning)]" />
                                <span>Criar Devolução</span>
                              </button>

                              {/* Eliminar Envio */}
                              <button
                                type="button"
                                onClick={async () => {
                                  setOpenDropdownId(null)
                                  const confirmed = window.confirm(`⚠️ Tem a certeza que deseja ELIMINAR permanentemente o envio ${tracking}?`)
                                  if (!confirmed) return
                                  const res = await deleteShipmentAction(shipment.id)
                                  if (res.success) {
                                    alert(`🗑️ Envio ${tracking} eliminado com sucesso!`)
                                    window.location.reload()
                                  } else {
                                    alert("Erro ao eliminar envio: " + (res.error || "Erro desconhecido"))
                                  }
                                }}
                                className="w-full px-3 py-2 text-xs font-semibold text-[var(--status-critical)] hover:bg-[var(--status-critical-soft)] flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-[var(--status-critical)]" />
                                <span>Eliminar Envio</span>
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
          <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--text-secondary)]">
            <div>
              A mostrar <strong className="text-[var(--text-primary)]">{Math.min((currentPage - 1) * pageSize + 1, filteredShipments.length)}</strong> a <strong className="text-[var(--text-primary)]">{Math.min(currentPage * pageSize, filteredShipments.length)}</strong> de <strong className="text-[var(--text-primary)]">{filteredShipments.length}</strong> envios
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-[var(--surface-bg)] border border-[var(--border-strong)] hover:bg-[var(--surface-muted)] disabled:opacity-40 disabled:cursor-not-allowed rounded-md font-bold text-[var(--text-primary)] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <span className="px-2 font-bold text-[var(--text-primary)] font-mono">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 bg-[var(--surface-bg)] border border-[var(--border-strong)] hover:bg-[var(--surface-muted)] disabled:opacity-40 disabled:cursor-not-allowed rounded-md font-bold text-[var(--text-primary)] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
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
        <div className="lg:col-span-3 bg-[var(--surface-bg)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-2xs flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">Volume de Envios por Dia</h3>
              </div>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Distribuição diária de emissão de guias de transporte CTT</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 rounded-md">
                {stats.totalCount} {stats.totalCount === 1 ? "Envio Registado" : "Envios Registados"}
              </span>
            </div>
          </div>

          {/* Visual Bar Graph with REAL data */}
          {stats.totalCount === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[var(--surface-muted)] rounded-xl border border-dashed border-[var(--border-strong)]">
              <Package className="w-8 h-8 text-[var(--text-tertiary)] mb-2" />
              <p className="text-xs font-bold text-[var(--text-secondary)]">Sem envios registados</p>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                Os gráficos de barras serão preenchidos em tempo real à medida que emitir novas guias CTT.
              </p>
            </div>
          ) : (
            <div className="h-64 flex items-end justify-between gap-3 sm:gap-6 pt-8 pb-2 px-2 border-b border-[var(--border-subtle)]">
              {stats.weeklyVolume.map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-[11px] font-mono font-bold text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.count}
                  </div>
                  <div className="w-full max-w-[48px] bg-[var(--surface-muted)] rounded-t-md overflow-hidden flex items-end h-full border border-[var(--border-subtle)] border-b-0">
                    <div 
                      className="w-full bg-[var(--accent)] rounded-t-md transition-all duration-500"
                      style={{ height: item.height }}
                    />
                  </div>
                  <div className="text-center mt-1">
                    <span className="block text-xs font-bold text-[var(--text-primary)]">{item.day}</span>
                    <span className="block text-[10px] text-[var(--text-tertiary)] font-mono font-bold">{item.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-[var(--accent)]" />
              <span>Envios CTT Registados</span>
            </div>
            <span className="font-semibold text-[var(--text-secondary)]">
              Total Acumulado: <strong className="text-[var(--text-primary)]">{stats.totalCount} guias</strong>
            </span>
          </div>
        </div>

      </div>

      {/* LOWER SECTION: REAL DESTINATIONS */}
      <div className="bg-[var(--surface-bg)] rounded-xl p-6 border border-[var(--border-subtle)] shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[var(--status-info)]" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">Destinos dos Envios</h3>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Destinos mais frequentes da mercadoria desta conta</p>
          </div>
        </div>

        {stats.destinationRegions.length === 0 ? (
          <div className="py-8 text-center bg-[var(--surface-muted)] rounded-xl border border-dashed border-[var(--border-strong)]">
            <MapPin className="w-6 h-6 text-[var(--text-tertiary)] mx-auto mb-1.5" />
            <p className="text-xs font-bold text-[var(--text-secondary)]">Sem destinos registados</p>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">As localidades de destino aparecerão aqui após emissão.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-2">
            {stats.destinationRegions.map((dest, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)]">{dest.region}</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-[var(--text-tertiary)] text-[11px]">{dest.count}</span>
                    <span className="font-bold text-[var(--text-primary)]">{dest.pct}%</span>
                  </div>
                </div>
                <div className="w-full bg-[var(--surface-muted)] rounded-full h-2 overflow-hidden border border-[var(--border-subtle)]">
                  <div 
                    className="bg-[var(--status-info)] h-2 rounded-full transition-all duration-500"
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
