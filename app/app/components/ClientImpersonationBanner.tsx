"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ExternalLink, ArrowLeft, Building2 } from "lucide-react"

export function ClientImpersonationBanner() {
  const searchParams = useSearchParams()
  const clientName = searchParams.get("clientName")
  const clientId = searchParams.get("clientId")

  if (!clientName && !clientId) return null

  const displayName = clientName ? decodeURIComponent(clientName) : "Cliente Selecionado"

  return (
    <div className="bg-[#141714] text-white px-5 py-1.5 text-[11px] flex flex-wrap items-center justify-between gap-2 shrink-0 border-b border-[rgba(255,255,255,0.08)]">
      <div className="flex items-center gap-2">
        <span className="bg-[var(--accent-active)] text-[#141714] text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider">
          Sessão Operador TMS
        </span>
        <span className="text-[rgba(255,255,255,0.6)]">
          A visualizar a interface do cliente: <strong className="text-white font-semibold">{displayName}</strong>
        </span>
      </div>

      <Link
        href="/ops/entidades/clientes"
        className="inline-flex items-center gap-1.5 bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.7)] px-2.5 py-1 rounded-md text-[10px] font-medium border border-[rgba(255,255,255,0.1)] transition-colors"
      >
        <ArrowLeft className="w-3 h-3" />
        Voltar a Entidades Clientes
      </Link>
    </div>
  )
}

export function ClientProfileSidebar() {
  const searchParams = useSearchParams()
  const clientName = searchParams.get("clientName")

  const displayName = clientName ? decodeURIComponent(clientName) : "Conta Cliente"
  const initial = displayName.substring(0, 2).toUpperCase()

  return (
    <div className="px-3 mb-4">
      <div className="w-full flex items-center justify-between p-2 bg-[var(--accent-soft)] rounded-md border border-[rgba(18,138,71,0.12)] transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[var(--accent)] text-white rounded-md flex items-center justify-center font-semibold text-[10px]">
            {initial}
          </div>
          <div className="flex flex-col text-left">
            <span className="font-semibold text-[var(--text-primary)] text-[11px] truncate max-w-[120px]">{displayName}</span>
            <span className="text-[9px] text-[var(--accent)] font-medium">Conta Ativa</span>
          </div>
        </div>
        <Link 
          href="/ops/entidades/clientes" 
          className="text-[var(--text-tertiary)] hover:text-[var(--accent)] p-1"
          title="Ver no TMS"
        >
          <Building2 className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
