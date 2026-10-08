"use client"

import React, { useState } from "react"
import { TrackingShipment } from "../types"
import { 
  RefreshCw, 
  CheckCircle2, 
  Circle, 
  Clock, 
  MapPin, 
  ScanLine, 
  Package, 
  Building2, 
  ShieldCheck, 
  ArrowRight,
  Truck
} from "lucide-react"

interface DeliveryProgressPanelProps {
  shipment: TrackingShipment
  onRefresh?: () => void
}

export function DeliveryProgressPanel({ shipment, onRefresh }: DeliveryProgressPanelProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  const handleRefreshClick = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setIsRefreshing(false)
      setLastRefreshedAt(new Date())
      if (onRefresh) onRefresh()
    }, 600)
  }

  const { metrics, pickagens, cargo, origin, destination } = shipment

  return (
    <div className="w-full xl:w-[360px] flex flex-col gap-4 shrink-0">
      {/* 1. Card: Overall Delivery Progress */}
      <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Progresso do Rastreio
            </h3>
            <p className="text-[11px] text-[var(--text-tertiary)]">
              Atualizado às {lastRefreshedAt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-emerald-600 transition-colors disabled:opacity-50"
            title="Atualizar leituras da transportadora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>

        {/* Progress Bar & Percent */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-base">
              {metrics.progressPercent}%
            </span>
            <span className="text-[11px] text-[var(--text-secondary)]">
              ETA: <strong className="text-[var(--text-primary)]">{destination.eta}</strong>
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
              style={{ width: `${metrics.progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)] pt-0.5">
            <span>{metrics.completedScansCount} de {metrics.totalScansCount} leituras</span>
            <span>Restam ~{metrics.remainingTimeStr}</span>
          </div>
        </div>
      </div>

      {/* 2. Card: Timeline of Pickagens (Scans) */}
      <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5">
            <ScanLine className="w-3.5 h-3.5 text-emerald-600" />
            Pickagens & Checkpoints
          </h4>
          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
            Itinerário Mapeado
          </span>
        </div>

        <div className="relative flex flex-col gap-4 pl-1">
          {pickagens.map((p, idx) => {
            const isCompleted = p.status === "completed"
            const isCurrent = p.status === "current" || p.isCurrentPosition
            const isPending = p.status === "pending"

            return (
              <div key={p.id} className="relative flex items-start gap-3 text-xs">
                {/* Connecting Vertical Line */}
                {idx !== pickagens.length - 1 && (
                  <div 
                    className={`absolute left-[9px] top-5 bottom-[-16px] w-0.5 ${
                      isCompleted ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
                    }`}
                  />
                )}

                {/* Step Icon Indicator */}
                <div className="relative z-10 shrink-0 mt-0.5">
                  {isCompleted ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  ) : isCurrent ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20 text-white flex items-center justify-center animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center">
                      <Circle className="w-2 h-2 text-slate-400" />
                    </div>
                  )}
                </div>

                {/* Step Text Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={`font-semibold text-xs truncate ${
                      isCurrent 
                        ? "text-emerald-600 dark:text-emerald-400 font-bold" 
                        : isCompleted 
                        ? "text-[var(--text-primary)]" 
                        : "text-[var(--text-tertiary)]"
                    }`}>
                      {p.title}
                    </span>
                    <span className={`font-mono text-[11px] shrink-0 ${
                      isCurrent ? "font-bold text-emerald-600 dark:text-emerald-400" : "text-[var(--text-tertiary)]"
                    }`}>
                      {p.formattedTime}
                    </span>
                  </div>

                  <p className="text-[11px] font-medium text-[var(--text-secondary)] leading-snug mt-0.5">
                    {p.locationName}
                  </p>

                  {p.description && (
                    <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                      {p.description}
                    </p>
                  )}

                  {p.scannerDevice && (
                    <span className="inline-block text-[9px] font-mono text-[var(--text-tertiary)] bg-[var(--surface-muted)] px-1.5 py-0.2 rounded mt-1">
                      {p.scannerDevice}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 3. Card: Shipment Cargo & Operational Routing */}
      <div className="bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl p-4 shadow-xs flex flex-col gap-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
          Especificações da Expedição
        </h4>

        {/* Carrier & Service */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border-subtle)]">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {shipment.carrier}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              {shipment.serviceType}
            </span>
          </div>

          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
            {shipment.trackingNumber || shipment.displayId}
          </span>
        </div>

        {/* Cargo Attributes Grid */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 rounded-lg bg-[var(--surface-muted)]/70 flex flex-col">
            <span className="text-[10px] text-[var(--text-tertiary)]">Cliente</span>
            <span className="font-bold text-[var(--text-primary)] truncate" title={cargo.clientName}>
              {cargo.clientName}
            </span>
          </div>

          <div className="p-2 rounded-lg bg-[var(--surface-muted)]/70 flex flex-col">
            <span className="text-[10px] text-[var(--text-tertiary)]">Volumes / Peso</span>
            <span className="font-bold text-[var(--text-primary)]">
              {cargo.packagesCount} vols • {cargo.weightStr}
            </span>
          </div>

          <div className="col-span-2 p-2 rounded-lg bg-[var(--surface-muted)]/70 flex flex-col">
            <span className="text-[10px] text-[var(--text-tertiary)]">Tipo de Mercadoria</span>
            <span className="font-semibold text-[var(--text-primary)] truncate">
              {cargo.category}
            </span>
          </div>
        </div>

        {/* Address Footer */}
        <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-col gap-1 text-[11px]">
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
            <span className="text-[10px] text-[var(--text-secondary)] leading-snug">
              <strong>Origem:</strong> {origin.address}
            </span>
          </div>
          <div className="flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
            <span className="text-[10px] text-[var(--text-secondary)] leading-snug">
              <strong>Destino:</strong> {destination.address}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
