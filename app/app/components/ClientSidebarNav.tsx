"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Home, FileText, Search, Plus } from "lucide-react"

export function ClientSidebarNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const clientId = searchParams.get("clientId")
  const clientName = searchParams.get("clientName")

  const queryParams = React.useMemo(() => {
    if (!clientId && !clientName) return ""
    const params = new URLSearchParams()
    if (clientId) params.set("clientId", clientId)
    if (clientName) params.set("clientName", clientName)
    return `?${params.toString()}`
  }, [clientId, clientName])

  const navItems = [
    { href: "/app", label: "Painel Principal", icon: Home },
    { href: "/app/criar-guia", label: "Novo Envio", icon: Plus },
    { href: "/app/envios", label: "Histórico & Envios", icon: Search },
    { href: "/app/faturas", label: "Faturas e Extratos", icon: FileText },
  ]

  return (
    <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={`${item.href}${queryParams}`}
            className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium text-[12px] transition-colors ${
              isActive
                ? "text-[var(--accent)] bg-[var(--accent-soft)] font-semibold border border-[rgba(18,138,71,0.15)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

import { TrackingQuickBar } from "@/app/ops/components/TrackingQuickBar"

export function ClientTopHeaderAction() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("clientId")
  const clientName = searchParams.get("clientName")

  const queryParams = React.useMemo(() => {
    if (!clientId && !clientName) return ""
    const params = new URLSearchParams()
    if (clientId) params.set("clientId", clientId)
    if (clientName) params.set("clientName", clientName)
    return `?${params.toString()}`
  }, [clientId, clientName])

  return (
    <div className="flex items-center gap-2">
      <TrackingQuickBar />
      <Link
        href={`/app/criar-guia${queryParams}`}
        className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-[0.99] text-white px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Novo Envio</span>
      </Link>
    </div>
  )
}
