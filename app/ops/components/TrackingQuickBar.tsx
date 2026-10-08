"use client"

import * as React from "react"
import Link from "next/link"
import { 
  MapPin, 
  ExternalLink 
} from "lucide-react"

export function TrackingQuickBar() {
  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/ops/tracking"
        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs font-semibold text-[var(--text-primary)] hover:text-blue-600 transition-colors cursor-pointer"
        title="Tracking e Mapa em Tempo Real"
      >
        <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span className="hidden sm:inline">Tracking & Mapa</span>
      </Link>
      <Link
        href="/tracking"
        target="_blank"
        className="hidden md:flex items-center gap-1 px-2 py-1.5 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        title="Abrir portal público de rastreio de clientes"
      >
        <span>Portal Público</span>
        <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  )
}
