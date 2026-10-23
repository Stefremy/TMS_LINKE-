"use client"
import { ShipmentParcelWeight } from '@/components/shipments/ShipmentParcelWeight'

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTrackingPolling } from "@/lib/hooks/useTrackingPolling"
import { 
  Plus, 
  Package, 
  MapPin, 
  Settings, 
  Filter, 
  Search,
  Truck,
  ChevronDown,
  Edit2,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Lock
} from "lucide-react"
import { RefreshIcon } from "@/components/ui/refresh-icon"

import { ActionMenu } from "./ActionMenu"
import { FerramentasMenu } from "./FerramentasMenu"
import { NovaRecolhaModal } from "./NovaRecolhaModal"
import { ManifestModal } from "./ManifestModal"
import { ShipmentLateralDrawer } from "./ShipmentLateralDrawer"
import { ClientShipmentDetailModal } from "@/app/app/components/ClientShipmentDetailModal"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { getShipmentStatusConfig } from "@/lib/status-helpers"
import { closeCttShipmentsAction } from "@/app/actions/ctt"
import { deleteShipmentsBulkAction, syncShipmentTrackingAction } from "@/app/actions/shipments"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface EnviosClientProps {
  envios: any[]
  recolhas: any[]
  clients: any[]
  pagination?: {
    page: number
    totalPages: number
    total: number
  }
  initialSearch?: string
  initialStatus?: string
}

function getMutedShipmentBadgeClass(variant: string) {
  switch (variant) {
    case "success":
      return "!bg-[#32734A] !text-white !border-[#285F3C]"
    case "warning":
      return "!bg-[#9A6B2E] !text-white !border-[#805823]"
    case "info":
      return "!bg-[#315D82] !text-white !border-[#274C6A]"
    case "purple":
      return "!bg-[#477D98] !text-white !border-[#39677F]"
    case "danger":
      return "!bg-[#B04740] !text-white !border-[#963B35]"
    case "neutral":
      return "!bg-[#697078] !text-white !border-[#596068]"
    default:
      return "!bg-[#65736B] !text-white !border-[#536058]"
  }
}

export function EnviosClient({ envios, recolhas, clients, pagination, initialSearch, initialStatus }: EnviosClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = React.useState(initialSearch || "")
  const [statusFilter, setStatusFilter] = React.useState(initialStatus || "Todos")
  const [showFilters, setShowFilters] = React.useState(false)
  const [viewMode, setViewMode] = React.useState<"envios" | "recolhas">("envios")
  const [showRecolhaModal, setShowRecolhaModal] = React.useState(false)
  const [selectedShipment, setSelectedShipment] = React.useState<any | null>(null)
  const [drawerShipment, setDrawerShipment] = React.useState<any | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [manifestData, setManifestData] = React.useState<any | null>(null)
  const [isClosingManifest, setIsClosingManifest] = React.useState(false)
  const [isSyncingSelected, setIsSyncingSelected] = React.useState(false)
  const [isDeletingSelected, setIsDeletingSelected] = React.useState(false)
  const statusTabs = ["Todos", "Pendente", "Em Trânsito", "Em Distribuição", "Entregue", "Entregue (PUDO)", "Incidência", "Devolvido", "Cancelado"]

  const activeIds = React.useMemo(() => envios
    .filter(e => !["entregue", "devolvido", "cancelado"].includes(
      (e.rawShipment?.status || e.status?.raw || "").toLowerCase()))
    .map(e => e.rawId || e.rawShipment?.id)
    .filter(Boolean) as string[], [envios])
  useTrackingPolling(activeIds, () => router.refresh())


  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = filteredEnvios.map(e => e.rawId || e.rawShipment?.id || e.trk?.id).filter(Boolean)
      setSelectedIds(allIds)
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleCloseSelected = async () => {
    if (selectedIds.length === 0) return
    setIsClosingManifest(true)
    try {
      const res = await closeCttShipmentsAction(selectedIds)
      if (res.success) {
        setManifestData(res)
        setSelectedIds([])
        router.refresh()
      } else {
        alert(res.error || "Erro ao fechar expedição.")
      }
    } catch (err: any) {
      alert("Erro ao fechar expedição: " + err.message)
    } finally {
      setIsClosingManifest(false)
    }
  }

  const handleSyncSelected = async () => {
    if (selectedIds.length === 0) return
    setIsSyncingSelected(true)
    try {
      for (const id of selectedIds) {
        await syncShipmentTrackingAction("", id)
      }
      alert(`Sincronização concluída com sucesso para ${selectedIds.length} envio(s).`)
      setSelectedIds([])
      router.refresh()
    } catch (err: any) {
      alert("Erro na sincronização: " + err.message)
    } finally {
      setIsSyncingSelected(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Tem a certeza que deseja eliminar ${selectedIds.length} envio(s)? Esta ação é irreversível.`)) return
    
    setIsDeletingSelected(true)
    try {
      const res = await deleteShipmentsBulkAction(selectedIds)
      if (res.success) {
        setSelectedIds([])
        router.refresh()
      } else {
        alert(res.error || "Erro ao eliminar envios.")
      }
    } catch (err: any) {
      alert("Erro ao eliminar envios: " + err.message)
    } finally {
      setIsDeletingSelected(false)
    }
  }

  const dataSource = viewMode === "envios" ? envios : recolhas

  const filteredEnvios = dataSource.filter((item) => {
    // 1. Status Filter
    const rawStatus = item.status?.label || item.rawShipment?.ctt_estado || "Pendente"
    const statusCfg = getShipmentStatusConfig(rawStatus)
    
    if (statusFilter !== "Todos") {
      const targetLabel = statusFilter === "Pendente"
        ? "Aguarda Entrada"
        : statusFilter === "Incidências" || statusFilter === "Incidência"
        ? "Incidência"
        : statusFilter
      if (statusCfg.label !== targetLabel) return false
    }

    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    
    // Add safety checks in case properties are missing
    const trkId = item.trk?.id || ""
    const trkRef = item.trk?.ref || ""
    const carrierRef = item.trk?.carrierRef || item.rawShipment?.ctt_object_id || ""
    const senderName = item.sender?.name || ""
    const recipientName = item.recipient?.name || ""
    const serviceName = item.service?.name || ""
    const statusLabel = item.status?.label || ""
    const valueAmount = item.value?.amount || ""

    return (
      trkId.toLowerCase().includes(q) ||
      trkRef.toLowerCase().includes(q) ||
      carrierRef.toLowerCase().includes(q) ||
      senderName.toLowerCase().includes(q) ||
      recipientName.toLowerCase().includes(q) ||
      serviceName.toLowerCase().includes(q) ||
      statusLabel.toLowerCase().includes(q) ||
      valueAmount.toLowerCase().includes(q)
    )
  })

  return (
    <div className="tms-shipment-workspace mx-auto flex w-full max-w-[1600px] flex-col gap-4 bg-transparent [--accent:#526B57] [--accent-hover:#435A48] [--accent-active:#3A4F3F] [--accent-soft:#E9EEE8] [--status-success:#526B57] [--status-success-soft:#E9EEE8] [--status-warning:#846C43] [--status-warning-soft:#F2EEE5] [--status-critical:#9A625D] [--status-critical-soft:#F2E8E6] [--status-info:#596F7C] [--status-info-soft:#EBF0F2]">
      
      {/* Header Area */}
      <div className="flex flex-wrap items-end justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
            {viewMode === "envios" ? "Envios" : "Recolhas"}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {viewMode === "envios" ? `${pagination?.total ?? envios.length} envios registados` : `${recolhas.length} pedidos de recolha`}
          </p>
        </div>
      </div>

      {/* Toolbar Area */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-3 sm:p-4 flex flex-row flex-wrap items-center justify-between gap-3 shrink-0 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            onClick={(e) => {
              if (viewMode === "recolhas") {
                e.preventDefault()
                setShowRecolhaModal(true)
              } else {
                router.push('/ops/envios/novo')
              }
            }}
            className="h-9 px-3.5 text-sm font-medium shadow-none !bg-[#128A47] hover:!bg-[#0E6C37]"
          >
            <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={3} />
            Novo envio
          </Button>
          
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === "envios" ? "recolhas" : "envios")}
            className={`h-9 px-3.5 text-sm font-medium shadow-none ${
              viewMode === "recolhas" 
                ? "bg-[var(--surface-dim)] border-[var(--border-strong)] text-[var(--text-primary)]" 
                : ""
            }`}
          >
            <Package className="w-3.5 h-3.5 mr-1.5" />
            {viewMode === "envios" ? "Recolhas" : "Envios"}
          </Button>
          
          <Button variant="outline" size="sm" className="hidden xs:flex h-9 px-3.5 text-sm font-medium shadow-none">
            <MapPin className="w-3.5 h-3.5 mr-1.5" />
            Localizar
          </Button>

          <FerramentasMenu selectedShipmentIds={selectedIds} onManifestClosed={() => { setSelectedIds([]); router.refresh() }} />
          
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`h-9 px-3.5 text-sm font-medium shadow-none ${
              showFilters 
                ? "bg-[var(--surface-dim)] border-[var(--border-strong)] text-[var(--text-primary)]" 
                : ""
            }`}
          >
            <Filter className="w-3.5 h-3.5 mr-1" />
            Filtrar
            <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </Button>

        </div>

        <div className="flex items-center gap-2 w-full sm:w-[320px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
            <input 
              type="text" 
              placeholder="Pesquisar guia, cliente ou destino"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Pesquisar envios"
              className="h-10 w-full pl-9 pr-3 bg-[var(--surface-bg)] border border-[var(--border-strong)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-colors"
            />
          </div>
        </div>

        {viewMode === "envios" && (
          <div role="group" aria-label="Filtrar envios por estado" className="-mx-1 flex w-full max-w-full gap-1 overflow-x-auto px-1 pb-0.5">
            {statusTabs.map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={statusFilter === status}
                onClick={() => setStatusFilter(status)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${statusFilter === status ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"}`}
              >
                {status === "Incidência" ? "Incidências" : status === "Todos" ? "Todos os envios" : status}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Filters Area */}
      {showFilters && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4 shrink-0 flex flex-col gap-3 text-xs">
          {/* Row 1 */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1 w-32">
              <label className="font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Filtrar Data</label>
              <select className="border border-[var(--border-strong)] rounded-md px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)]">
                <option>Data Recolha</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-56">
              <label className="font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Data</label>
              <div className="flex items-center gap-1">
                <input type="text" placeholder="Início" className="w-full border border-[var(--border-strong)] rounded-md px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)]" />
                <span className="text-[var(--text-tertiary)] px-1">até</span>
                <input type="text" placeholder="Fim" className="w-full border border-[var(--border-strong)] rounded-md px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)]" />
              </div>
            </div>
            <div className="flex flex-col gap-1 w-32">
              <label className="font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Serviço</label>
              <select className="border border-[var(--border-strong)] rounded-md px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)]">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-40">
              <label className="font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Fornecedor</label>
              <div className="flex">
                <span className="bg-[var(--surface-dim)] border border-[var(--border-strong)] border-r-0 rounded-l-md px-2 py-1.5 text-[var(--text-secondary)] font-bold">=</span>
                <select className="w-full border border-[var(--border-strong)] rounded-r-md px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)]">
                  <option>Todos</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Contexto</label>
              <select className="border border-[var(--border-strong)] rounded-md px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)]">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-28">
              <label className="font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Tipo</label>
              <select className="border border-[var(--border-strong)] rounded-md px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)]">
                <option>Todos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 w-32">
              <div className="flex justify-between items-center"><label className="font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Motorista</label><span className="text-[9px] text-[var(--status-info)] cursor-pointer hover:underline">Todos</span></div>
              <select className="border border-[var(--border-strong)] rounded-md px-2 py-1.5 focus:outline-none focus:border-[var(--accent)] bg-[var(--surface-bg)] text-[var(--text-primary)]">
                <option>Todos</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] text-[var(--text-primary)] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium bg-[var(--accent-soft)] text-[var(--accent)] px-2.5 py-1 rounded-md flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
              {selectedIds.length} selecionado(s)
            </span>
            <span className="text-xs text-[var(--text-secondary)] hidden md:inline">
              Operações em lote para expedição e sincronização
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCloseSelected}
              disabled={isClosingManifest}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isClosingManifest ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              <span>Fechar Expedição / Manifesto</span>
            </button>

            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={isDeletingSelected}
              className="bg-[var(--status-critical)] hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isDeletingSelected ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              <span>Eliminar</span>
            </button>

            <button
              type="button"
              onClick={handleSyncSelected}
              disabled={isSyncingSelected}
              className="bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] px-3 py-2 rounded-lg text-xs font-medium border border-[var(--border-strong)] transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isSyncingSelected ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshIcon className="w-4 h-4" />}
              <span>Sincronizar Tracking</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1.5 transition-colors cursor-pointer ml-1"
            >
              Desmarcar
            </button>
          </div>
        </div>
      )}

      {/* Table Area (Desktop Table + Mobile Card View) */}
      <div className="flex-1 overflow-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        {filteredEnvios.length === 0 ? (
          <div className="px-4 py-12 text-center text-[var(--text-secondary)]">
            Nenhum envio encontrado com a pesquisa atual.
          </div>
        ) : (
          <>
            {/* ─── MOBILE CARD VIEW (md:hidden) ─────────────────────────────────── */}
            <div className="tms-compact-list divide-y divide-[var(--border-subtle)] bg-[var(--surface-bg)]">
              {filteredEnvios.map((envio, idx) => {
                const rowId = envio.rawId || envio.rawShipment?.id || envio.trk?.id
                const isSelected = selectedIds.includes(rowId)
                const statusVal = envio.rawShipment?.status || envio.status?.raw || envio.status?.label
                const cfg = getShipmentStatusConfig(statusVal)
                const isBilled = Boolean(
                  envio.rawShipment?.billing_statement_id || 
                  envio.billing_statement_id || 
                  envio.is_invoiced
                )

                return (
                  <div 
                    key={`mob-${idx}`}
                    className={`p-3.5 space-y-2.5 transition-colors ${
                      isSelected ? "bg-[var(--accent-soft)]/40" : "hover:bg-[var(--surface-muted)]/50"
                    }`}
                  >
                    {/* Top Row: Checkbox + TRK + Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => handleToggleRow(rowId)}
                          aria-label={`Selecionar envio ${envio.trk?.id || ""}`}
                          className="rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-[var(--accent-active)] cursor-pointer shrink-0" 
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            const target = envio.rawShipment ? { ...envio.rawShipment, ...envio, id: envio.rawId || envio.rawShipment.id } : envio;
                            setDrawerShipment(target)
                          }}
                          className="font-mono font-bold text-[#1D4ED8] text-xs truncate text-left"
                        >
                          {envio.trk?.id || "N/A"}
                        </button>
                        <span className="px-1.5 py-0.2 bg-[var(--accent)] text-white text-[8px] font-bold rounded uppercase">
                          {envio.trk?.tag || "A01"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={cfg.badgeVariant} className={getMutedShipmentBadgeClass(cfg.badgeVariant)}>
                          {cfg.label}
                        </Badge>
                        {isBilled && (
                          <span className="p-0.5 rounded bg-[#EEF0F1] text-[#626B70] border border-[#D7DCDF]" title="Faturado">
                            <Lock className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle: Remetente ➔ Destinatário */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-[var(--surface-muted)]/60 p-2.5 rounded-lg border border-[var(--border-subtle)]">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">De</span>
                        <p className="font-semibold text-[var(--text-primary)] truncate">{envio.sender?.name || "-"}</p>
                        <p className="text-[10px] text-[var(--text-secondary)] truncate">
                          {envio.sender?.flag === 'PT' ? '🇵🇹' : '🇪🇸'} {envio.sender?.city || ""}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">Para</span>
                        <p className="font-semibold text-[var(--text-primary)] truncate">{envio.recipient?.name || "-"}</p>
                        <p className="text-[10px] text-[var(--text-secondary)] truncate">
                          {envio.recipient?.flag === 'PT' ? '🇵🇹' : '🇪🇸'} {envio.recipient?.city || ""}
                        </p>
                      </div>
                    </div>

                    {viewMode === 'envios' && <ShipmentParcelWeight summary={envio.parcel_summary || envio.rawShipment?.parcel_summary} />}

                    {/* Bottom Row: Service + Price + Actions */}
                    <div className="flex items-center justify-between pt-0.5 text-xs">
                      <div className="flex items-center gap-2">
                        {getCarrierLogo(envio.service?.name || envio.service?.code || envio.rawShipment?.carrier_name || "ctt") && (
                          <div className="w-4 h-4 rounded bg-white border border-[var(--border-subtle)] p-0.5 flex items-center justify-center shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={getCarrierLogo(envio.service?.name || envio.service?.code || envio.rawShipment?.carrier_name || "ctt")!} 
                              alt="Logo" 
                              className="max-w-full max-h-full object-contain" 
                            />
                          </div>
                        )}
                        <span className="text-[10px] font-medium text-[var(--text-secondary)]">{envio.service?.name || envio.service?.code || "Expresso"}</span>
                        <span className="font-bold text-[var(--text-primary)] font-mono">{envio.value?.amount || "0,00€"}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const target = envio.rawShipment ? { ...envio.rawShipment, ...envio, id: envio.rawId || envio.rawShipment.id } : envio;
                            setDrawerShipment(target)
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-md transition-colors"
                        >
                          Ver
                        </button>
                        <ActionMenu 
                          shipment={envio.rawShipment || envio}
                          shipmentId={envio.rawId} 
                          trackingRef={envio.trk?.ref || envio.trk?.id} 
                          isCtt={envio.service?.code?.includes('CTT')}
                          onOpenDetails={() => setSelectedShipment(envio.rawShipment || envio)}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ─── DESKTOP TABLE (hidden md:table) ─────────────────────────────── */}
            <table className="tms-wide-table w-full min-w-[1120px] text-left text-xs whitespace-nowrap pb-32">
              <thead className="bg-[var(--surface-muted)] sticky top-0 z-10">
                <tr className="border-b border-[var(--border-subtle)] text-[10px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">
                  <th className="px-4 py-2.5 w-10">
                    <input 
                      type="checkbox" 
                      checked={filteredEnvios.length > 0 && selectedIds.length === filteredEnvios.length}
                      onChange={handleSelectAll}
                      className="rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-[var(--accent-active)] cursor-pointer" 
                      title="Selecionar Todos"
                    />
                  </th>
                  <th className="px-3 py-2.5">TRK</th>
                  <th className="px-3 py-2.5">Remetente</th>
                  <th className="px-3 py-2.5">Destinatário</th>
                  <th className="px-3 py-2.5">Serviço</th>
                  <th className="px-3 py-2.5">Remessa</th>
                  <th className="px-3 py-2.5">Recolha / Entrega</th>
                  <th className="px-3 py-2.5">Estado</th>
                  <th className="px-3 py-2.5">Valor</th>
                  <th className="px-4 py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--surface-bg)] text-[11px]">
                {filteredEnvios.map((envio, idx) => {
                  const rowId = envio.rawId || envio.rawShipment?.id || envio.trk?.id
                  const isSelected = selectedIds.includes(rowId)
              const isDrawerActive = drawerShipment && (
                (drawerShipment.id && (drawerShipment.id === envio.rawId || drawerShipment.id === envio.rawShipment?.id)) ||
                (drawerShipment.tracking_number && (drawerShipment.tracking_number === envio.trk?.id || drawerShipment.tracking_number === envio.trk?.carrierRef)) ||
                (drawerShipment.trk?.id && drawerShipment.trk.id === envio.trk?.id)
              )

              return (
              <tr 
                key={idx} 
                className={`transition-colors group cursor-pointer ${
                  isDrawerActive
                    ? 'bg-[var(--accent-soft)] hover:bg-[rgba(18,138,71,0.15)] ring-1 ring-inset ring-[var(--accent)]/40'
                    : isSelected 
                    ? 'bg-[var(--accent-soft)]/50 hover:bg-[rgba(18,138,71,0.15)]' 
                    : 'hover:bg-[var(--surface-muted)]'
                }`}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('input')) return;
                  const target = envio.rawShipment ? { ...envio.rawShipment, ...envio, id: envio.rawId || envio.rawShipment.id } : envio;
                  setDrawerShipment(target)
                }}
              >
                <td className="px-4 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => handleToggleRow(rowId)}
                    className="rounded border-[var(--border-strong)] text-[var(--accent)] focus:ring-[var(--accent-active)] mt-1 cursor-pointer" 
                  />
                </td>
                
                {/* TRK Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const target = envio.rawShipment ? { ...envio.rawShipment, ...envio, id: envio.rawId || envio.rawShipment.id } : envio;
                        setDrawerShipment(target)
                      }}
                      className="font-mono font-semibold text-[#1D4ED8] hover:text-[#1E40AF] hover:underline flex items-center gap-1 text-xs text-left cursor-pointer transition-colors"
                      title="Clique para ver os detalhes na barra lateral"
                    >
                      {envio.trk?.id || "N/A"}
                    </button>
                    <span className="text-[var(--text-tertiary)] text-[10px]">{envio.trk?.date}</span>
                    {envio.trk?.ref && envio.trk.ref !== envio.trk.id && (
                      <span className="font-mono text-[10px] font-medium text-[var(--text-secondary)] mt-0.5" title="Referência Interna Linke">
                        Ref: {envio.trk.ref}
                      </span>
                    )}
                    {envio.trk?.carrierRef && envio.trk.carrierRef !== envio.trk.id && (
                      <span className="font-mono text-[10px] font-semibold text-[var(--text-primary)] mt-0.5" title={`Objeto / Rastreio ${envio.trk?.carrierName || "Transportadora"}`}>
                        {envio.trk.carrierRef}
                      </span>
                    )}
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-[var(--accent)] text-white text-[9px] font-semibold rounded-sm w-fit leading-none uppercase tracking-wide">
                      {envio.trk?.tag || "A01"}
                    </span>
                  </div>
                </td>

                {/* Remetente Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5 max-w-[180px] whitespace-normal">
                    <span className="font-medium text-[var(--text-primary)] leading-tight mb-1">{envio.sender?.name}</span>
                    <div className="flex text-[var(--text-tertiary)] text-[10px] leading-tight font-medium">
                      <span className="mr-1 mt-0.5 shrink-0 text-[9px]">
                        {envio.sender?.flag === 'PT' ? '🇵🇹' : '🇪🇸'}
                      </span>
                      <span>{envio.sender?.zip} {envio.sender?.city}{envio.sender?.phone ? `, ${envio.sender.phone}` : ''}</span>
                    </div>
                  </div>
                </td>

                {/* Destinatário Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5 max-w-[180px] whitespace-normal">
                    <span className="font-medium text-[var(--text-primary)] leading-tight mb-1">{envio.recipient?.name}</span>
                    <div className="flex text-[var(--text-tertiary)] text-[10px] leading-tight font-medium">
                      <span className="mr-1 mt-0.5 shrink-0 text-[9px]">
                        {envio.recipient?.flag === 'PT' ? '🇵🇹' : '🇪🇸'}
                      </span>
                      <span>{envio.recipient?.zip} {envio.recipient?.city}{envio.recipient?.phone ? `, ${envio.recipient.phone}` : ''}</span>
                    </div>
                  </div>
                </td>

                {/* Serviço Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-1.5 items-start">
                    <div className="flex items-center gap-1.5">
                      {getCarrierLogo(envio.service?.name || envio.service?.code || envio.rawShipment?.carrier_name || "ctt") ? (
                        <div className="w-4 h-4 rounded bg-white border border-[var(--border-subtle)] p-0.5 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={getCarrierLogo(envio.service?.name || envio.service?.code || envio.rawShipment?.carrier_name || "ctt")!} 
                            alt={envio.service?.name || "Transportadora"} 
                            className="max-w-full max-h-full object-contain" 
                          />
                        </div>
                      ) : null}
                      <span className="font-semibold text-[var(--text-secondary)] text-[10px]">{envio.service?.code}</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider leading-none bg-[#1D4ED8] text-white">
                      {envio.service?.name}
                    </span>
                  </div>
                </td>

                {/* Remessa Column */}
                <td className="px-3 py-3 align-top">
                  {viewMode === 'envios' ? <ShipmentParcelWeight summary={envio.parcel_summary || envio.rawShipment?.parcel_summary} /> : <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-[var(--text-primary)] text-[11px]">{envio.package?.count || "1 Caixa"}</span>
                    <span className="text-[var(--text-tertiary)] text-[10px] font-medium">{envio.package?.weight || "-"}</span>
                  </div>}
                </td>

                {/* Collection and delivery dates */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <div className="mb-1 flex items-center gap-1 whitespace-nowrap text-[10px] text-[var(--text-secondary)]" title={envio.pickup ? "Data de recolha confirmada pelo rastreio" : "Ainda não existe confirmação de recolha no rastreio"}>
                      <Package className="h-3 w-3 shrink-0 text-[var(--text-tertiary)]" />
                      <span>Recolha:</span>
                      {envio.pickup ? (
                        <span className="font-semibold text-[var(--text-primary)]">{envio.pickup.date} <span className="font-mono font-normal text-[var(--text-secondary)]">{envio.pickup.time}</span></span>
                      ) : <span className="text-[var(--text-tertiary)]">Por confirmar</span>}
                    </div>
                    <div className="flex items-center gap-1 font-semibold text-[var(--text-primary)] text-[11px]">
                      <Truck className="w-3 h-3 text-[var(--text-tertiary)]" />
                      <span>{envio.delivery?.date || "--/--/----"}</span>
                    </div>
                    {envio.delivery?.time && envio.delivery.time !== "--:--" ? (
                      <span className="text-[var(--status-success)] font-mono font-bold text-[10px] ml-4">
                        {envio.delivery.time}
                      </span>
                    ) : (
                      <span className="text-[var(--text-tertiary)] text-[9px] ml-4 font-medium uppercase tracking-wide">
                        {envio.status?.raw === 'entregue' ? '--:--' : 'Aguardar entrega'}
                      </span>
                    )}
                  </div>
                </td>

                {/* Estado Column */}
                <td className="px-3 py-3 align-top">
                  {(() => {
                    const statusVal = envio.rawShipment?.status || envio.status?.raw || envio.status?.label
                    const cfg = getShipmentStatusConfig(statusVal)
                    const isBilled = Boolean(
                      envio.rawShipment?.billing_statement_id || 
                      envio.billing_statement_id || 
                      envio.is_invoiced
                    )
                    return (
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant={cfg.badgeVariant} className={getMutedShipmentBadgeClass(cfg.badgeVariant)}>
                          {cfg.label}
                        </Badge>
                        {isBilled && (
                          <span 
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EEF0F1] text-[#626B70] border border-[#D7DCDF] shadow-2xs"
                            title="🔒 Envio Faturado - Eliminação Bloqueada"
                          >
                            <Lock className="w-2.5 h-2.5 text-[#707A80] shrink-0" />
                            Faturado
                          </span>
                        )}
                        {envio.status?.subCode && (
                          <span className="text-[var(--text-tertiary)] font-semibold text-[9px] tracking-wider ml-1 uppercase">
                            {envio.status?.subCode}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </td>

                {/* Valor Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-1 items-start">
                    <span className="font-semibold text-[var(--text-primary)] text-[11px]">{envio.value?.amount || "0,00€"}</span>
                    <span className={`px-1 py-0.5 rounded text-[9px] font-bold border leading-none tracking-wide ${envio.value?.diffColor ? envio.value.diffColor.replace('bg-green-100', 'bg-[var(--status-success-soft)]').replace('text-green-700', 'text-[var(--status-success)]').replace('border-green-200', 'border-[rgba(18,138,71,0.2)]') : 'text-[var(--text-secondary)] bg-[var(--surface-muted)] border-[var(--border-subtle)]'}`}>
                      {envio.value?.diff || "0,00€"}
                    </span>
                    <span className="text-[var(--text-tertiary)] text-[9px] uppercase font-bold tracking-wider">{envio.value?.ref}</span>
                  </div>
                </td>

                {/* Ações Column */}
                <td className="px-4 py-3 align-top text-right overflow-visible">
                  <ActionMenu 
                    shipment={envio.rawShipment || envio}
                    shipmentId={envio.rawId} 
                    trackingRef={envio.trk?.ref || envio.trk?.id} 
                    isCtt={envio.service?.code?.includes('CTT')}
                    onOpenDetails={() => setSelectedShipment(envio.rawShipment || envio)}
                  />
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </>
        )}
      </div>
      
      {pagination && viewMode === "envios" && (
        <div className="rounded-xl border border-[var(--border-subtle)] px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-[var(--surface-bg)]">
          <span className="text-[11px] text-[var(--text-secondary)] font-medium">
            A mostrar {envios.length} de {pagination.total} envios (Página {pagination.page} de {pagination.totalPages})
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => {
                const params = new URLSearchParams(window.location.search)
                params.set("page", (pagination.page - 1).toString())
                router.push(`?${params.toString()}`)
              }}
              className="h-7 text-[11px]"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => {
                const params = new URLSearchParams(window.location.search)
                params.set("page", (pagination.page + 1).toString())
                router.push(`?${params.toString()}`)
              }}
              className="h-7 text-[11px]"
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {showRecolhaModal && (
        <NovaRecolhaModal onClose={() => setShowRecolhaModal(false)} clients={clients} />
      )}
      

      {/* Lateral Drawer Panel */}
      <ShipmentLateralDrawer 
        shipment={drawerShipment} 
        isOpen={Boolean(drawerShipment)} 
        onClose={() => setDrawerShipment(null)}
        onOpenFullModal={(s) => {
          setSelectedShipment(s)
        }}
        onUpdateShipment={() => {
          router.refresh()
        }}
      />

      {selectedShipment && (
        <ClientShipmentDetailModal 
          shipment={selectedShipment} 
          onClose={() => setSelectedShipment(null)}
          onUpdateShipment={(updated) => {
            setSelectedShipment(updated)
            router.refresh()
          }}
        />
      )}

      {manifestData && (
        <ManifestModal 
          isOpen={Boolean(manifestData)} 
          onClose={() => setManifestData(null)}
          manifestReference={manifestData.manifestReference}
          documents={manifestData.documents}
          shipmentsCount={manifestData.count}
          manifestPdfBase64={manifestData.manifestPdfBase64}
          warning={manifestData.warning}
        />
      )}
    </div>
  )
}
