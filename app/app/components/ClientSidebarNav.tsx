"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, FileText, Search, Plus, UserCheck, CreditCard, Inbox, MapPin, Banknote, Plane, ShoppingBag, CalendarDays } from "lucide-react"
import { useClientScope } from "./ClientScope"
import { ClientMessageBell } from "./ClientMessages"

function clientNavSections(basePath: string) {
  return [
    {
      category: "Principal",
      items: [
        { href: basePath, label: "Painel Principal", icon: Home },
      ],
    },
    {
      category: "Envios",
      items: [
        { href: `${basePath}/criar-guia`, label: "Novo Envio", icon: Plus },
        { href: `${basePath}/tracking`, label: "Rastreio & Mapa", icon: MapPin },
        { href: `${basePath}/envios`, label: "Histórico & Envios", icon: Search },
        { href: `${basePath}/destinatarios`, label: "Destinatários", icon: UserCheck },
        { href: `${basePath}/recolhas`, label: "Pedir recolha", icon: CalendarDays },
        { href: `${basePath}/cotacoes`, label: "Envio aéreo internacional", icon: Plane },
      ],
    },
    {
      category: "Financeiro",
      items: [
        { href: `${basePath}/reembolsos`, label: "Reembolsos", icon: Banknote },
        { href: `${basePath}/faturas`, label: "Faturas e Extratos", icon: FileText },
        { href: `${basePath}/carregamentos`, label: "Carregamentos", icon: CreditCard },
      ],
    },
    {
      category: "Conta",
      items: [
        { href: `${basePath}/mensagens`, label: "Caixa de Entrada", icon: Inbox },
        { href: `${basePath}/integracoes`, label: "Lojas & Webservices", icon: ShoppingBag },
      ],
    },
  ]
}

export function ClientSidebarNav() {
  const pathname = usePathname()
  const { basePath } = useClientScope()
  const navSections = clientNavSections(basePath)

  return (
    <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
      {navSections.flatMap((section) => [
        <div key={`cat-${section.category}`} className="pt-3.5 first:pt-1 pb-1 px-2.5 select-none">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            {section.category}
          </span>
        </div>,
        ...section.items.map((item) => {
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
        }),
      ])}
    </nav>
  )
}

/** Breadcrumb for the desktop header: names the section of the page being viewed. */
export function ClientBreadcrumb() {
  const pathname = usePathname()
  const { basePath } = useClientScope()
  const items = clientNavSections(basePath).flatMap((section) => section.items)
  const current = items
    .filter((item) => pathname === item.href || (item.href !== basePath && pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return (
    <nav aria-label="Localização" className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] font-medium">
      <Link href={basePath} className="flex items-center gap-1.5 hover:text-[var(--text-primary)]">
        <Home className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Área de Cliente</span>
      </Link>
      <span aria-hidden="true" className="text-[var(--border-strong)]">/</span>
      <span aria-current="page" className="text-[var(--text-primary)] font-semibold">
        {current?.label ?? "Painel Principal"}
      </span>
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
