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
import Image from "next/image"

interface ShipmentCardProps {
  shipment: TrackingShipment
  isSelected: boolean
  onSelect: (shipment: TrackingShipment) => void
}

export function ShipmentCard({ shipment, isSelected, onSelect }: ShipmentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getCarrierLogo = (carrier: string) => {
    const c = carrier.toLowerCase()
    if (c.includes("ctt")) return "/logo_transportadoras/ctt_express_logo.svg"
    if (c.includes("correos")) return "/logo_transportadoras/correos_logo.jpeg"
    if (c.includes("dpd")) return "/logo_transportadoras/dpd_logo.svg"
    return null
  }
  const carrierLogo = getCarrierLogo(shipment.carrier)

  // Status pill styling
  const getStatusBadge = () => {
    switch (shipment.status) {
      case "active":
        return {
          bg: "bg-[var(--surface-bg)] text-emerald-600 border-[var(--border-strong)] font-bold shadow-2xs",
          dot: "bg-emerald-500 animate-pulse",
          label: "Em Trânsito"
        }
      case "arriving":
        return {
          bg: "bg-[var(--surface-bg)] text-indigo-600 border-[var(--border-strong)] font-bold shadow-2xs",
          dot: "bg-indigo-500",
          label: "A Chegar"
        }
      case "departed":
        return {
          bg: "bg-[var(--surface-bg)] text-sky-600 border-[var(--border-strong)] font-bold shadow-2xs",
          dot: "bg-sky-500",
          label: "Partida Recente"
        }
      case "delivered":
        return {
          bg: "bg-[var(--surface-bg)] text-emerald-600 border-[var(--border-strong)] font-bold shadow-2xs",
          dot: "bg-emerald-500",
          label: "Entregue"
        }
      default:
        return {
          bg: "bg-[var(--surface-bg)] text-emerald-600 border-[var(--border-strong)] font-bold shadow-2xs",
          dot: "bg-emerald-500",
          label: shipment.statusLabel || "Em Rota"
        }
    }
  }

  const badge = getStatusBadge()

  return (
    <div 
      onClick={() => onSelect(shipment)}
      className={`cursor-pointer rounded-xl border transition-all duration-200 bg-[var(--surface-bg)] shadow-xs ${
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
          <div className="flex items-center gap-2">
            {carrierLogo ? (
              <img src={carrierLogo} alt={shipment.carrier} className="h-4 object-contain max-w-[80px]" />
            ) : (
              <span className="text-[10px] font-medium text-[var(--text-tertiary)] truncate max-w-[100px]">
                {shipment.carrier}
              </span>
            )}
            
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition-colors border border-[var(--border-subtle)]"
            >
              <span>{isExpanded ? "Menos" : "Mais"}</span>
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
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

          <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-primary)] bg-[var(--surface-bg)] border border-[var(--border-subtle)] px-2 py-1.5 rounded-lg shadow-2xs mt-2">
            <span>{shipment.serviceType}</span>
            <span className="text-[var(--text-secondary)] font-semibold">Seguro: {shipment.documentation.insuredValueEur.toLocaleString()} €</span>
          </div>
        </div>
      )}
    </div>
  )
}
