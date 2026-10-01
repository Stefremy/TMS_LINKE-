"use client"

import * as React from "react"
import { Plane, Ship, Globe, Waves } from "lucide-react"

/**
 * High-precision vector SVG of the Flag of Portugal
 */
export function PortugalFlag({ className = "w-4 h-3" }: { className?: string }) {
  return (
    <svg 
      className={`${className} rounded-[2px] shadow-2xs shrink-0 overflow-hidden ring-1 ring-slate-900/10 inline-block align-middle`} 
      viewBox="0 0 600 400" 
      aria-label="Portugal"
    >
      <rect width="240" height="400" fill="#006600"/>
      <rect x="240" width="360" height="400" fill="#ff0000"/>
      <circle cx="240" cy="200" r="80" fill="#ffcc00"/>
      <circle cx="240" cy="200" r="62" fill="#ffffff"/>
      <path d="M210 160 h60 v50 c0 20 -30 35 -30 35 s-30 -15 -30 -35 z" fill="#002b7f"/>
      <path d="M220 170 h40 v35 c0 12 -20 22 -20 22 s-20 -10 -20 -22 z" fill="#ffffff"/>
      <circle cx="240" cy="188" r="5" fill="#002b7f"/>
    </svg>
  )
}

/**
 * High-precision vector SVG of the Flag of Spain
 */
export function SpainFlag({ className = "w-4 h-3" }: { className?: string }) {
  return (
    <svg 
      className={`${className} rounded-[2px] shadow-2xs shrink-0 overflow-hidden ring-1 ring-slate-900/10 inline-block align-middle`} 
      viewBox="0 0 750 500" 
      aria-label="Espanha"
    >
      <rect width="750" height="500" fill="#c60b1e"/>
      <rect y="125" width="750" height="250" fill="#ffc400"/>
      <rect x="170" y="200" width="60" height="90" rx="6" fill="#c60b1e"/>
      <rect x="178" y="208" width="44" height="74" rx="4" fill="#ffffff"/>
      <circle cx="200" cy="180" r="14" fill="#ffc400"/>
    </svg>
  )
}

/**
 * High-precision vector SVG of the Flag of the European Union
 */
export function EuFlag({ className = "w-4 h-3" }: { className?: string }) {
  return (
    <svg 
      className={`${className} rounded-[2px] shadow-2xs shrink-0 overflow-hidden ring-1 ring-slate-900/10 inline-block align-middle`} 
      viewBox="0 0 810 540" 
      aria-label="União Europeia"
    >
      <rect width="810" height="540" fill="#003399"/>
      <g fill="#ffcc00">
        <circle cx="405" cy="100" r="16"/>
        <circle cx="405" cy="440" r="16"/>
        <circle cx="235" cy="270" r="16"/>
        <circle cx="575" cy="270" r="16"/>
        <circle cx="280" cy="145" r="16"/>
        <circle cx="530" cy="145" r="16"/>
        <circle cx="280" cy="395" r="16"/>
        <circle cx="530" cy="395" r="16"/>
        <circle cx="338" cy="112" r="16"/>
        <circle cx="472" cy="112" r="16"/>
        <circle cx="338" cy="428" r="16"/>
        <circle cx="472" cy="428" r="16"/>
      </g>
    </svg>
  )
}

/**
 * Renders professional vector icon badges for each destination zone code
 */
export function DestinationBadge({ code, showLabel = false }: { code: string; showLabel?: boolean }) {
  switch (code) {
    case "PT-CONT":
      return (
        <span className="inline-flex items-center gap-1.5 shrink-0 text-slate-700">
          <PortugalFlag className="w-3.5 h-2.5" />
          {showLabel && <span className="text-[11px] font-medium text-slate-700">PT</span>}
        </span>
      )

    case "PT-ILHAS":
      return (
        <span className="inline-flex items-center gap-1 shrink-0 text-slate-700">
          <PortugalFlag className="w-3.5 h-2.5" />
          <span className="text-[10px] font-medium text-slate-600">
            Ilhas
          </span>
        </span>
      )

    case "ES-PENIN":
      return (
        <span className="inline-flex items-center gap-1.5 shrink-0 text-slate-700">
          <SpainFlag className="w-3.5 h-2.5" />
          {showLabel && <span className="text-[11px] font-medium text-slate-700">ES</span>}
        </span>
      )

    case "ES-ILHAS":
      return (
        <span className="inline-flex items-center gap-1 shrink-0 text-slate-700">
          <SpainFlag className="w-3.5 h-2.5" />
          <span className="text-[10px] font-medium text-slate-600">
            Ilhas
          </span>
        </span>
      )

    case "EU-Z1":
    case "EU-Z2":
    case "EU-Z3":
      return (
        <span className="inline-flex items-center gap-1 shrink-0 text-slate-700">
          <EuFlag className="w-3.5 h-2.5" />
          <span className="text-[10px] font-medium text-slate-600">
            {code.replace("EU-", "Z")}
          </span>
        </span>
      )

    case "INTL-AERO":
      return (
        <span className="inline-flex items-center gap-1 shrink-0 text-slate-600">
          <Plane className="w-3 h-3 text-slate-500" />
          <span className="text-[10px] font-medium text-slate-600">
            Aéreo
          </span>
        </span>
      )

    case "INTL-MAR":
      return (
        <span className="inline-flex items-center gap-1 shrink-0 text-slate-600">
          <Ship className="w-3 h-3 text-slate-500" />
          <span className="text-[10px] font-medium text-slate-600">
            Marítimo
          </span>
        </span>
      )

    case "INTL":
    default:
      return (
        <span className="inline-flex items-center gap-1 shrink-0 text-slate-600">
          <Globe className="w-3 h-3 text-slate-400" />
          <span className="text-[10px] font-medium text-slate-600">
            {code === "INTL" ? "Internacional" : code}
          </span>
        </span>
      )
  }
}
