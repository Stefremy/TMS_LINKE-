"use client"

import React from "react"
import { TrackingShipment } from "../types"
import { 
  ScanLine, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Navigation,
  ArrowRight
} from "lucide-react"

interface MapSummaryBarProps {
  shipment: TrackingShipment
}

export function MapSummaryBar({ shipment }: MapSummaryBarProps) {
  const { metrics, origin, destination } = shipment

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-[var(--surface-bg)] border border-[var(--border-subtle)] rounded-xl shadow-xs">
      {/* 1. Última Pickagem Registada */}
      <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[var(--surface-muted)]/60 border border-[var(--border-subtle)]/70">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
          <ScanLine className="w-4 h-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] tracking-wider">
            Última Pickagem
          </span>
          <span className="text-xs font-bold text-[var(--text-primary)] truncate" title={metrics.lastPickagemLocation}>
            {metrics.lastPickagemLocation}
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {metrics.lastPickagemStatus} ({metrics.lastPickagemTime})
          </span>
        </div>
      </div>

      {/* 2. Distância Restante até ao Destino */}
      <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[var(--surface-muted)]/60 border border-[var(--border-subtle)]/70">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
          <Navigation className="w-4 h-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] tracking-wider">
            Distância ao Destino
          </span>
          <span className="text-xs font-bold text-[var(--text-primary)]">
            {metrics.remainingDistanceKm} km
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)]">
            Tempo previsto: <strong className="text-[var(--text-secondary)]">{metrics.remainingTimeStr}</strong>
          </span>
        </div>
      </div>

      {/* 3. Ponto de Recolha / Origem */}
      <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[var(--surface-muted)]/60 border border-[var(--border-subtle)]/70">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
          <MapPin className="w-4 h-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] tracking-wider">
            Origem da Expedição
          </span>
          <span className="text-xs font-bold text-[var(--text-primary)] truncate" title={origin.hubName}>
            {origin.city}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)]">
            Partida: {origin.departureTime}
          </span>
        </div>
      </div>

      {/* 4. Validação de Checkpoints */}
      <div className="flex items-start gap-3 p-2.5 rounded-lg bg-[var(--surface-muted)]/60 border border-[var(--border-subtle)]/70">
        <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] tracking-wider">
            Checkpoints de Rede
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-extrabold text-[var(--text-primary)] font-mono">
              {metrics.completedScansCount}
            </span>
            <span className="text-[11px] text-[var(--text-secondary)]">de {metrics.totalScansCount} validados</span>
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {metrics.progressPercent}% do itinerário
          </span>
        </div>
      </div>
    </div>
  )
}
