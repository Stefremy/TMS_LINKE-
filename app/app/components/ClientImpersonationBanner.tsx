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
    <div className="bg-slate-900 text-white px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shrink-0 border-b border-slate-800 animate-in fade-in">
      <div className="flex items-center gap-2.5">
        <span className="bg-emerald-500 text-slate-950 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wide">
          Sessão Operador TMS
        </span>
        <span className="text-slate-300">
          A visualizar a interface do cliente: <strong className="text-white font-bold">{displayName}</strong>
        </span>
      </div>

      <Link
        href="/ops/entidades/clientes"
        className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-lg text-xs font-bold border border-slate-700 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
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
    <div className="px-4 mb-6">
      <div className="w-full flex items-center justify-between p-2 bg-emerald-50/70 rounded-xl border border-emerald-200 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center font-bold text-xs shadow-2xs">
            {initial}
          </div>
          <div className="flex flex-col text-left">
            <span className="font-bold text-slate-800 text-xs truncate max-w-[130px]">{displayName}</span>
            <span className="text-[10px] text-emerald-700 font-semibold">Conta Ativa</span>
          </div>
        </div>
        <Link 
          href="/ops/entidades/clientes" 
          className="text-slate-400 hover:text-emerald-700 p-1"
          title="Ver no TMS"
        >
          <Building2 className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}
