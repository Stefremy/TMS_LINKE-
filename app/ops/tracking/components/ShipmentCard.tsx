"use client"

import React, { useState } from "react"
import { TrackingShipment } from "../types"
import { 
  Navigation, 
  ChevronDown, 
  ChevronUp, 
  MapPin, 
  Clock, 
  Package, 
  Building2, 
  ArrowRight,
  ShieldCheck,
  Truck
} from "lucide-react"

interface ShipmentCardProps {
  shipment: TrackingShipment
  isSelected: boolean
  onSelect: (shipment: TrackingShipment) => void
}

export function ShipmentCard({ shipment, isSelected, onSelect }: ShipmentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Status pill styling
  const getStatusBadge = () => {
    switch (shipment.status) {
      case "active":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
          dot: "bg-emerald-500 animate-pulse",
          label: "Em Trânsito"
        }
      case "arriving":
        return {
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800",
          dot: "bg-indigo-500",
          label: "A Chegar"
        }
      case "departed":
        return {
          bg: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800",
          dot: "bg-sky-500",
          label: "Partida Recente"
        }
      case "delivered":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
          dot: "bg-emerald-500",
          label: "Entregue"
        }
      default:
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
          dot: "bg-emerald-500",
          label: shipment.statusLabel || "Em Rota"
        }
    }
  }

  const badge = getStatusBadge()

  return (
    <div 
      className={`rounded-xl border transition-all duration-200 bg-[var(--surface-bg)] shadow-xs ${
        isSelected 
          ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-md" 
          : "border-[var(--border-subtle)] hover:border-emerald-300 dark:hover:border-emerald-800"
      }`}
    >
      <div className="p-3.5 flex flex-col gap-2.5">
        {/* Top Header: ID & Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
              {shipment.displayId}
            </span>
            {shipment.isDemo && (
              <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                Simulado
              </span>
            )}
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
        </div>

        {/* Route Line: Origin -> Destination */}
        <div className="flex items-center justify-between text-xs py-0.5">
          <div className="flex flex-col">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold">Origem</span>
            <span className="font-semibold text-[var(--text-primary)] truncate max-w-[110px]" title={shipment.origin.city}>
              {shipment.origin.city}
            </span>
          </div>

          <div className="flex-1 flex items-center justify-center px-2">
            <div className="w-full flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <div className="h-0.5 flex-1 border-t-2 border-dashed border-emerald-300 dark:border-emerald-700" />
              <ArrowRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold">Destino</span>
            <span className="font-semibold text-[var(--text-primary)] truncate max-w-[110px]" title={shipment.destination.city}>
              {shipment.destination.city}
            </span>
          </div>
        </div>

        {/* ETA & Carrier */}
        <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] border-t border-[var(--border-subtle)] pt-2">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span>ETA: <strong className="text-[var(--text-primary)]">{shipment.destination.eta}</strong></span>
          </span>
          <span className="text-[10px] font-medium text-[var(--text-tertiary)] truncate max-w-[130px]">
            {shipment.carrier}
          </span>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between pt-1 gap-2">
          <button
            type="button"
            onClick={() => onSelect(shipment)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isSelected
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900"
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>{isSelected ? "A Seguir" : "Seguir"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors border border-[var(--border-subtle)]"
          >
            <span>{isExpanded ? "Ver menos" : "Ver mais"}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="p-3 bg-[var(--surface-muted)]/70 border-t border-[var(--border-subtle)] rounded-b-xl flex flex-col gap-2 text-xs">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--text-tertiary)]">Cliente</span>
              <span className="font-semibold text-[var(--text-primary)] truncate">{shipment.cargo.clientName}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--text-tertiary)]">Carga / Volumes</span>
              <span className="font-medium text-[var(--text-secondary)]">
                {shipment.cargo.packagesCount} vols • {shipment.cargo.weightStr}
              </span>
            </div>
          </div>

          <div className="text-[11px] pt-1 border-t border-[var(--border-subtle)]/60 flex flex-col gap-1">
            <div className="flex items-start gap-1 text-[var(--text-tertiary)]">
              <MapPin className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
              <span className="text-[10px] leading-tight text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">De:</strong> {shipment.origin.address}
              </span>
            </div>
            <div className="flex items-start gap-1 text-[var(--text-tertiary)]">
              <MapPin className="w-3 h-3 text-rose-500 mt-0.5 shrink-0" />
              <span className="text-[10px] leading-tight text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">Para:</strong> {shipment.destination.address}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 px-2 py-1 rounded">
            <span>{shipment.serviceType}</span>
            <span>Seguro: {shipment.documentation.insuredValueEur.toLocaleString()} €</span>
          </div>
        </div>
      )}
    </div>
  )
}
