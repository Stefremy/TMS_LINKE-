"use client"

import * as React from "react"
import Link from "next/link"
import { 
  MapPin, 
  ExternalLink 
} from "lucide-react"

export function TrackingQuickBar() {
  return (
    <Link
      href="/tracking"
      target="_blank"
      className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-bg)] hover:bg-[var(--surface-muted)] border border-[var(--border-subtle)] rounded-md text-xs font-medium text-[var(--text-secondary)] transition-colors cursor-pointer"
      title="Rastreio rápido e partilha com clientes"
    >
      <MapPin className="w-3.5 h-3.5 text-[var(--accent)]" />
      <span className="hidden sm:inline">Rastreio & Partilha</span>
      <ExternalLink className="w-3 h-3 text-[var(--text-tertiary)]" />
    </Link>
  )
}
