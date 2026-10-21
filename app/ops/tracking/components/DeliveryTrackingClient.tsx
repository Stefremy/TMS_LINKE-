"use client"

import React, { useState, useMemo, useEffect } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { TrackingShipment, ShipmentStatus } from "../types"
import { ShipmentCard } from "./ShipmentCard"
import { MapSummaryBar } from "./MapSummaryBar"
import { DeliveryProgressPanel } from "./DeliveryProgressPanel"
import { DocumentationModal } from "./DocumentationModal"
import { DEMO_TRACKING_SHIPMENTS } from "../mockData"

const RealLeafletMap = dynamic(
  () => import("./RealLeafletMap").then((m) => m.RealLeafletMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 min-h-[380px] lg:min-h-[480px] bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 text-xs font-semibold">
        A carregar mapa real de estradas e itinerários...
      </div>
    )
  }
)
import { 
  Search, 
  X, 
  Filter, 
  Radio, 
  Truck, 
  Package, 
  Info,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight
} from "lucide-react"

import Link from "next/link"

interface DeliveryTrackingClientProps {
  initialShipments?: TrackingShipment[]
  isClientPortal?: boolean
  baseTrackingPath?: string
  clientName?: string
  newShipmentHref?: string
}

export function DeliveryTrackingClient({ 
  initialShipments,
  isClientPortal = false,
  baseTrackingPath,
  clientName,
  newShipmentHref
}: DeliveryTrackingClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlSearch = searchParams.get("search") || ""
  
  const allShipments = useMemo(() => {
    if (isClientPortal) {
      return initialShipments || []
    }
    return initialShipments && initialShipments.length > 0 ? initialShipments : DEMO_TRACKING_SHIPMENTS
  }, [initialShipments, isClientPortal])

  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(allShipments[0]?.id || "")
  const [searchQuery, setSearchQuery] = useState(urlSearch)
  const [statusFilter, setStatusFilter] = useState<"all" | ShipmentStatus>("all")

  // Keep selected shipment ID in sync when shipments change
  useEffect(() => {
    if (allShipments.length > 0 && (!selectedShipmentId || !allShipments.some(s => s.id === selectedShipmentId))) {
      setSelectedShipmentId(allShipments[0].id)
    }
  }, [allShipments, selectedShipmentId])

  // Sync search input to URL after typing
  useEffect(() => {
    // Skip on initial render if searchQuery is equal to urlSearch
    if (searchQuery === urlSearch) return

    const timer = setTimeout(() => {
      const currentParams = new URLSearchParams(window.location.search)
      if (searchQuery.trim()) {
        currentParams.set("search", searchQuery.trim())
      } else {
        currentParams.delete("search")
      }
      const basePath = baseTrackingPath || "/ops/tracking"
      const newUrl = currentParams.toString() ? `${basePath}?${currentParams.toString()}` : basePath
      router.push(newUrl)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery, urlSearch, baseTrackingPath, router])
  const [isDocModalOpen, setIsDocModalOpen] = useState(false)
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false)

  // Current selected shipment
  const selectedShipment = useMemo(() => {
    return allShipments.find(s => s.id === selectedShipmentId) || allShipments[0]
  }, [allShipments, selectedShipmentId])

  // Status counts for filter tabs
  const counts = useMemo(() => {
    return {
      all: allShipments.length,
      active: allShipments.filter(s => s.status === "active").length,
      arriving: allShipments.filter(s => s.status === "arriving").length,
      departed: allShipments.filter(s => s.status === "departed").length,
    }
  }, [allShipments])

  // Filtered shipments list
  const filteredShipments = useMemo(() => {
    return allShipments.filter(s => {
      // 1. Status Filter
      if (statusFilter !== "all" && s.status !== statusFilter) {
        return false
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchId = s.id.toLowerCase().includes(q) || s.displayId.toLowerCase().includes(q)
        const matchOrigin = s.origin.city.toLowerCase().includes(q) || s.origin.hubName.toLowerCase().includes(q)
        const matchDest = s.destination.city.toLowerCase().includes(q) || s.destination.hubName.toLowerCase().includes(q)
        const matchCarrier = s.carrier.toLowerCase().includes(q)
        const matchTracking = (s.trackingNumber || "").toLowerCase().includes(q)
        const matchClient = s.cargo.clientName.toLowerCase().includes(q)

        return matchId || matchOrigin || matchDest || matchCarrier || matchTracking || matchClient
      }

      return true
    })
  }, [allShipments, statusFilter, searchQuery])

  if (allShipments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-2xl text-center shadow-xs min-h-[380px]">
        <div className="w-14 h-14 rounded-2xl bg-[var(--surface-muted)] text-[var(--accent)] flex items-center justify-center mb-4 border border-[var(--border-subtle)] shadow-2xs">
          <Truck className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-[var(--text-primary)]">Nenhum envio em trânsito no momento</h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1.5 max-w-md leading-relaxed">
          {searchQuery 
            ? "Não foram encontrados envios correspondentes ao termo de pesquisa introduzido."
            : "Assim que registar novos envios, poderá acompanhar a localização em tempo real no mapa com o percurso geolocalizado entre a origem e o destino."}
        </p>
        <div className="flex items-center gap-3 mt-5">
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="px-3.5 py-2 text-xs font-semibold bg-[var(--surface-muted)] hover:bg-[var(--surface-dim)] text-[var(--text-secondary)] rounded-lg transition-colors cursor-pointer"
            >
              Limpar Pesquisa
            </button>
          )}
          {newShipmentHref && (
            <Link
              href={newShipmentHref}
              className="px-4 py-2 text-xs font-bold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Package className="w-4 h-4" />
              <span>Criar Novo Envio</span>
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 min-h-[calc(100vh-120px)]">
      {/* Top Banner Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[var(--surface-bg)] border border-[var(--border-strong)] rounded-xl text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#477D68]"></span>
          </span>
          <span className="font-bold text-[var(--text-primary)]">
            {isClientPortal ? `Rastreio & Mapeamento de Envios • ${clientName || "Minha Conta"}` : "Posto de Controlo de Rastreio por Pickagens & Checkpoints"}
          </span>
          <span className="text-[var(--text-tertiary)]">•</span>
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Itinerário geolocalizado com mapa real OpenStreetMap / CartoDB com base nas leituras dos hubs da transportadora.
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-primary)] bg-[var(--surface-muted)] px-3 py-1 rounded-full border border-[var(--border-strong)] shadow-2xs">
          <Info className="w-3.5 h-3.5 text-[#477D68]" />
          <span>Mapeamento por Pickagens Ativo</span>
        </div>
      </div>

      {/* Main 3-Column Workstation Grid */}
      <div className="flex flex-col xl:flex-row items-start gap-4 flex-1">
        
        {/* LEFT PANEL: Search, Filters & Expandable Shipment Cards */}
        <div className="w-full xl:w-[340px] 2xl:w-[380px] flex flex-col gap-3 shrink-0">
          <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl p-3.5 shadow-xs flex flex-col gap-3">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar guia, cidade, matrícula..."
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-muted)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[#477D68]/20 focus:border-[#477D68] transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs (Active / Arriving / Departed) */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-[var(--surface-muted)] rounded-lg text-xs font-semibold select-none">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`py-1.5 px-1 rounded-md text-[11px] transition-all flex items-center justify-center gap-1 ${
                  statusFilter === "all"
                    ? "bg-[var(--surface-bg)] text-[#477D68] shadow-xs"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>Todos</span>
                <span className="text-[10px] opacity-75 font-mono">({counts.all})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`py-1.5 px-1 rounded-md text-[11px] transition-all flex items-center justify-center gap-1 ${
                  statusFilter === "active"
                    ? "bg-[var(--surface-bg)] text-[#477D68] shadow-xs font-bold"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>Ativos</span>
                <span className="text-[10px] opacity-75 font-mono">({counts.active})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("arriving")}
                className={`py-1.5 px-1 rounded-md text-[11px] transition-all flex items-center justify-center gap-1 ${
                  statusFilter === "arriving"
                    ? "bg-[var(--surface-bg)] text-[#477D68] shadow-xs font-bold"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>A Chegar</span>
                <span className="text-[10px] opacity-75 font-mono">({counts.arriving})</span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("departed")}
                className={`py-1.5 px-1 rounded-md text-[11px] transition-all flex items-center justify-center gap-1 ${
                  statusFilter === "departed"
                    ? "bg-[var(--surface-bg)] text-[#477D68] shadow-xs font-bold"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>Partidos</span>
                <span className="text-[10px] opacity-75 font-mono">({counts.departed})</span>
              </button>
            </div>
          </div>

          {/* Shipment Cards List */}
          <div className="flex flex-col gap-3 max-h-[750px] overflow-y-auto pr-1">
            {filteredShipments.length === 0 ? (
              <div className="py-12 px-4 text-center bg-[var(--surface-bg)] border border-dashed border-[var(--border-strong)] rounded-xl flex flex-col items-center justify-center">
                <Package className="w-8 h-8 text-[var(--text-tertiary)] opacity-40 mb-2" />
                <p className="text-xs font-bold text-[var(--text-secondary)]">Nenhum envio encontrado</p>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                  Tente alterar os filtros de estado ou a pesquisa.
                </p>
              </div>
            ) : (
              filteredShipments.map((s) => (
                <ShipmentCard
                  key={s.id}
                  shipment={s}
                  isSelected={s.id === selectedShipment?.id}
                  onSelect={(shipment) => {
                    setSelectedShipmentId(shipment.id)
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* CENTER PANEL: Real Leaflet Map & Bottom Summary Bar */}
        <div className="flex-1 flex flex-col gap-3 min-w-0 w-full">
          {selectedShipment ? (
            <>
              <RealLeafletMap
                shipment={selectedShipment}
                onOpenDocumentation={() => setIsDocModalOpen(true)}
              />
              <MapSummaryBar shipment={selectedShipment} />
            </>
          ) : (
            <div className="flex-1 min-h-[380px] lg:min-h-[480px] bg-slate-900 rounded-xl flex flex-col items-center justify-center text-slate-400 text-sm font-semibold">
              <Package className="w-10 h-10 opacity-50 mb-3" />
              <p>Nenhum envio selecionado.</p>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Delivery Progress, Timeline & Vehicle Telemetry */}
        {selectedShipment && (
          <DeliveryProgressPanel
            shipment={selectedShipment}
            onRefresh={() => {
              // Optional telemetry ping feedback
            }}
          />
        )}

      </div>

      {/* Official Documentation Modal */}
      {selectedShipment && (
        <DocumentationModal
          shipment={selectedShipment}
          isOpen={isDocModalOpen}
          onClose={() => setIsDocModalOpen(false)}
        />
      )}
    </div>
  )
}
