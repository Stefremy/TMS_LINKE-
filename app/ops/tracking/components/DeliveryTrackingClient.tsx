"use client"

import React, { useState, useMemo } from "react"
import dynamic from "next/dynamic"
import { TrackingShipment, ShipmentStatus } from "../types"
import { ShipmentCard } from "./ShipmentCard"
import { MapSummaryBar } from "./MapSummaryBar"
import { DeliveryProgressPanel } from "./DeliveryProgressPanel"
import { DocumentationModal } from "./DocumentationModal"

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

interface DeliveryTrackingClientProps {
  initialShipments?: TrackingShipment[]
}

export function DeliveryTrackingClient({ initialShipments }: DeliveryTrackingClientProps) {
  const allShipments = useMemo(() => {
    return initialShipments || []
  }, [initialShipments])

  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(allShipments[0]?.id || "LTK-8921-PT")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | ShipmentStatus>("all")
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

  return (
    <div className="flex flex-col gap-4 min-h-[calc(100vh-120px)]">
      {/* Top Banner Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[var(--surface-bg)] border border-[var(--border-strong)] rounded-xl text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
          </span>
          <span className="font-bold text-[var(--text-primary)]">Posto de Controlo de Rastreio por Pickagens & Checkpoints</span>
          <span className="text-[var(--text-tertiary)]">•</span>
          <span className="text-[11px] font-medium text-[var(--text-secondary)]">
            Itinerário geolocalizado com mapa real OpenStreetMap / CartoDB com base nas leituras dos hubs da transportadora.
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-primary)] bg-[var(--surface-muted)] px-3 py-1 rounded-full border border-[var(--border-strong)] shadow-2xs">
          <Info className="w-3.5 h-3.5 text-emerald-600" />
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
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar guia, cidade, matrícula..."
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-muted)] text-xs text-[var(--text-primary)] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
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
                    ? "bg-[var(--surface-bg)] text-emerald-600 dark:text-emerald-400 shadow-xs"
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
                    ? "bg-[var(--surface-bg)] text-emerald-600 dark:text-emerald-400 shadow-xs font-bold"
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
                    ? "bg-[var(--surface-bg)] text-emerald-600 dark:text-emerald-400 shadow-xs font-bold"
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
                    ? "bg-[var(--surface-bg)] text-emerald-600 dark:text-emerald-400 shadow-xs font-bold"
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
