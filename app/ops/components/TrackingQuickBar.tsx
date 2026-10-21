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
