"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2
} from "lucide-react"

import { ActionMenu } from "./ActionMenu"
import { FerramentasMenu } from "./FerramentasMenu"
import { NovaRecolhaModal } from "./NovaRecolhaModal"
import { ManifestModal } from "./ManifestModal"
import { ShipmentLateralDrawer } from "./ShipmentLateralDrawer"
import { ClientShipmentDetailModal } from "@/app/app/components/ClientShipmentDetailModal"
import { getCarrierLogo } from "@/lib/carrier-logos"
import { getShipmentStatusConfig } from "@/lib/status-helpers"
import { closeCttShipmentsAction, syncCttTrackingAction } from "@/app/actions/ctt"
import { deleteShipmentsBulkAction } from "@/app/actions/shipments"
import { Button } from "@/components/ui/button"

interface EnviosClientProps {
  envios: any[]
  recolhas: any[]
  clients: any[]
}

export function EnviosClient({ envios, recolhas, clients }: EnviosClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("Todos")
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
        await syncCttTrackingAction("", id)
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
      const targetLabel = statusFilter === "Incidências" ? "Incidência" : statusFilter
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
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-[var(--surface-bg)] rounded-lg shadow-sm border border-[var(--border-subtle)] overflow-hidden">
      
      {/* Header Area */}
      <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
          {viewMode === "envios" ? "Envios e Serviços" : "Pedidos de Recolha"}
        </h1>
        <div className="text-[10px] font-semibold text-[var(--text-tertiary)] flex items-center gap-1.5 uppercase tracking-wide">
          <span>Painel de Resumo</span>
          <span className="text-[var(--border-strong)]">&gt;</span>
          <span className="text-[var(--text-secondary)]">
            {viewMode === "envios" ? "Envios e Serviços" : "Recolhas"}
          </span>
        </div>
      </div>

      {/* Toolbar Area */}
      <div className="px-5 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-bg)] shrink-0 gap-3 text-[11px]">
        
        <div className="flex items-center gap-2">
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
            className="font-semibold px-3 py-1.5 h-auto text-xs shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={3} />
            Novo
          </Button>
          
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === "envios" ? "recolhas" : "envios")}
            className={`px-3 py-1.5 h-auto text-xs font-semibold shadow-xs ${
              viewMode === "recolhas" 
                ? "bg-[var(--surface-dim)] border-[var(--border-strong)] text-[var(--text-primary)]" 
                : ""
            }`}
          >
            <Package className="w-3.5 h-3.5 mr-1.5" />
            {viewMode === "envios" ? "Recolhas" : "Envios"}
          </Button>
          
          <Button variant="outline" size="sm" className="px-3 py-1.5 h-auto text-[11px] font-medium shadow-xs">
            <MapPin className="w-3.5 h-3.5 mr-1.5" />
            Localizar
          </Button>

          <FerramentasMenu />
          
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 h-auto text-[11px] font-medium shadow-xs ${
              showFilters 
                ? "bg-[var(--surface-dim)] border-[var(--border-strong)] text-[var(--text-primary)]" 
                : ""
            }`}
          >
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            Filtrar
            <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </Button>

          <div className="flex items-center ml-2 border-l border-[var(--border-subtle)] pl-4">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)] mr-2">Estado</span>
            <div className="relative">
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-[var(--surface-bg)] border border-[var(--border-strong)] text-[var(--text-primary)] text-[11px] font-medium rounded-md px-2.5 py-1.5 pr-7 focus:outline-none focus:border-[var(--accent)] shadow-2xs"
              >
                <option value="Todos">Todos</option>
                <option value="Pendente">Pendente</option>
                <option value="Em Trânsito">Em Trânsito</option>
                <option value="Em Distribuição">Em Distribuição</option>
                <option value="Entregue">Entregue</option>
                <option value="Entregue (PUDO)">Entregue (PUDO)</option>
                <option value="Incidência">Incidências</option>
                <option value="Devolvido">Devolvido</option>
                <option value="Cancelado">Cancelado</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
            <input 
              type="text" 
              placeholder="Q TRK" 
              className="w-28 pl-8 pr-3 py-1.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-[11px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
            />
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-8 pr-3 py-1.5 bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-[11px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors"
            />
          </div>
        </div>

      </div>

      {/* Expanded Filters Area */}
      {showFilters && (
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] shrink-0 flex flex-col gap-3 text-[10px]">
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
        <div className="bg-[#141714] text-white px-5 py-2.5 flex items-center justify-between shadow-md shrink-0 border-y border-[rgba(255,255,255,0.08)] transition-all">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold bg-[var(--status-success-soft)] text-[var(--status-success)] border border-[rgba(18,138,71,0.2)] px-2 py-0.5 rounded flex items-center gap-1.5 uppercase tracking-wide">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {selectedIds.length} selecionado(s)
            </span>
            <span className="text-[11px] text-[rgba(255,255,255,0.6)] hidden md:inline font-medium">
              Operações em lote para expedição e sincronização
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCloseSelected}
              disabled={isClosingManifest}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isClosingManifest ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              <span>Fechar Expedição / Manifesto</span>
            </button>

            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={isDeletingSelected}
              className="bg-[var(--status-critical)] hover:bg-red-700 text-white px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isDeletingSelected ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              <span>Eliminar</span>
            </button>

            <button
              type="button"
              onClick={handleSyncSelected}
              disabled={isSyncingSelected}
              className="bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.8)] px-2.5 py-1.5 rounded-md text-[11px] font-bold border border-[rgba(255,255,255,0.1)] transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isSyncingSelected ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span>Sincronizar Tracking</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-[10px] font-semibold text-[rgba(255,255,255,0.5)] hover:text-white px-2 py-1.5 transition-colors cursor-pointer ml-1"
            >
              Desmarcar
            </button>
          </div>
        </div>
      )}

      {/* Table Area */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs whitespace-nowrap pb-32">
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
              <th className="px-3 py-2.5">Entrega</th>
              <th className="px-3 py-2.5">Estado</th>
              <th className="px-3 py-2.5">Valor</th>
              <th className="px-4 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--surface-bg)] text-[11px]">
            {filteredEnvios.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                  Nenhum envio encontrado com a pesquisa atual.
                </td>
              </tr>
            ) : filteredEnvios.map((envio, idx) => {
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
                      className="font-mono font-semibold text-[var(--status-info)] hover:text-blue-800 hover:underline flex items-center gap-1 text-xs text-left cursor-pointer transition-colors"
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
                      <span className="font-mono text-[10px] font-semibold text-[var(--text-primary)] mt-0.5" title="Objeto / Rastreio CTT Expresso">
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
                    <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wider leading-none ${envio.service?.bgColor || 'bg-[var(--surface-dim)]'} ${envio.service?.textColor || 'text-[var(--text-secondary)]'}`}>
                      {envio.service?.name}
                    </span>
                  </div>
                </td>

                {/* Remessa Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-[var(--text-primary)] text-[11px]">{envio.package?.count || "1 Caixa"}</span>
                    <span className="text-[var(--text-tertiary)] text-[10px] font-medium">{envio.package?.weight || "-"}</span>
                  </div>
                </td>

                {/* Entrega Column */}
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
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
                    return (
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider leading-none border shadow-2xs ${
                          cfg.color.includes('green') ? 'bg-[var(--status-success-soft)] text-[var(--status-success)] border-[rgba(18,138,71,0.2)]' :
                          cfg.color.includes('yellow') || cfg.color.includes('orange') ? 'bg-[var(--status-warning-soft)] text-[var(--status-warning)] border-[rgba(217,119,6,0.2)]' :
                          cfg.color.includes('red') ? 'bg-[var(--status-critical-soft)] text-[var(--status-critical)] border-[rgba(220,38,38,0.2)]' :
                          cfg.color.includes('blue') ? 'bg-[var(--status-info-soft)] text-[var(--status-info)] border-[rgba(37,99,235,0.2)]' :
                          'bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${cfg.dotColor.replace('bg-', 'bg-')} shrink-0`} />
                          <span>{cfg.label}</span>
                        </span>
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
      </div>
      
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
          }}
        />
      )}

      {manifestData && (
        <ManifestModal 
          isOpen={Boolean(manifestData)} 
          onClose={() => setManifestData(null)}
          deliveryNoteId={manifestData.deliveryNoteId}
          shipmentsCount={manifestData.count}
          manifestPdfBase64={manifestData.manifestPdfBase64}
        />
      )}
    </div>
  )
}
