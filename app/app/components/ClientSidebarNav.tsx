"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, FileText, Search, Plus, UserCheck, CreditCard, Inbox, MapPin, Banknote } from "lucide-react"
import { useClientScope } from "./ClientScope"
import { ClientMessageBell } from "./ClientMessages"

export function ClientSidebarNav() {
  const pathname = usePathname()
  const { basePath } = useClientScope()

  const navItems = [
    { href: basePath, label: "Painel Principal", icon: Home },
    { href: `${basePath}/criar-guia`, label: "Novo Envio", icon: Plus },
    { href: `${basePath}/tracking`, label: "Rastreio & Mapa", icon: MapPin },
    { href: `${basePath}/envios`, label: "Histórico & Envios", icon: Search },
    { href: `${basePath}/destinatarios`, label: "Destinatários", icon: UserCheck },
    { href: `${basePath}/reembolsos`, label: "Reembolsos", icon: Banknote },
    { href: `${basePath}/faturas`, label: "Faturas e Extratos", icon: FileText },
    { href: `${basePath}/carregamentos`, label: "Carregamentos", icon: CreditCard },
    { href: `${basePath}/mensagens`, label: "Caixa de Entrada", icon: Inbox },
  ]

  return (
    <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={`flex items-center justify-between px-2.5 py-2 rounded-md text-[13px] transition-colors group ${
              isActive
                ? "text-[var(--accent)] bg-[var(--accent-soft)] font-semibold border border-[rgba(18,138,71,0.15)]"
                : "text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon 
                className={`w-[18px] h-[18px] shrink-0 ${
                  isActive ? "text-[var(--accent)]" : "text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]"
                }`} 
                strokeWidth={1.75}
              />
              <span className="truncate">{item.label}</span>
            </div>

          </Link>
        )
      })}
    </nav>
  )
}

export function ClientTopHeaderAction() {
  const { basePath } = useClientScope()
  return (
    <div className="flex items-center gap-2 relative">
      <ClientMessageBell />

      <Link
        href={`${basePath}/criar-guia`}
        className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-[0.99] text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Novo Envio</span>
      </Link>
    </div>
  )
}
