"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { useClientScope } from "./ClientScope"

export function ClientImpersonationBanner() {
  const { client, isEmployee } = useClientScope()
  if (!isEmployee) return null
  const displayName = client.short_name

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

import { ClientAccountDetailsModal } from "./ClientAccountDetailsModal"

export function ClientProfileSidebar() {
  const { client } = useClientScope()
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false)
  const displayName = client.short_name
  const storeSubtitle = client?.legal_name && client.legal_name.toLowerCase() !== displayName.toLowerCase()
    ? client.legal_name
    : "Conta Ativa"

  const avatarImage = client.logo_url || null
  const initial = displayName.substring(0, 2).toUpperCase()
  const avatarBg = client?.color || "var(--accent)"

  return (
    <>
      <div className="px-3 mb-4">
        <div 
          onClick={() => setIsDetailsOpen(true)}
          className="w-full flex items-center justify-between p-2 bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)]/90 rounded-md border border-[rgba(18,138,71,0.18)] hover:border-[rgba(18,138,71,0.35)] transition-all cursor-pointer group shadow-2xs"
          title="Clique para ver todos os detalhes da sua conta"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div 
              className="w-7 h-7 rounded-md flex items-center justify-center font-semibold text-[10px] text-white shrink-0 overflow-hidden shadow-2xs border border-[rgba(18,138,71,0.2)] group-hover:scale-105 transition-transform"
              style={{ backgroundColor: avatarBg }}
            >
              {avatarImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src={avatarImage} 
                  alt={displayName} 
                  className="w-full h-full object-cover bg-white" 
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="flex flex-col text-left min-w-0">
              <span className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] text-[11px] truncate max-w-[125px] transition-colors" title={displayName}>
                {displayName}
              </span>
              <span className="text-[9px] text-[var(--accent)] font-medium truncate max-w-[125px]" title={storeSubtitle}>
                {storeSubtitle}
              </span>
            </div>
          </div>
          <div className="text-[var(--text-tertiary)] group-hover:text-[var(--accent)] p-1 shrink-0 transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      <ClientAccountDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        client={client}
        userAvatar={null}
      />
    </>
  )
}
