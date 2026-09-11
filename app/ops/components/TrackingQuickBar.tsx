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
      className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 shadow-2xs transition-all cursor-pointer"
      title="Rastreio rápido e partilha com clientes"
    >
      <MapPin className="w-4 h-4 text-emerald-600" />
      <span className="hidden sm:inline">Rastreio & Partilha</span>
      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
    </Link>
  )
}
