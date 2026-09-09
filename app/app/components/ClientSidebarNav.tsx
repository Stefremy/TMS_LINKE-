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
    { href: "/app/criar-guia", label: "Novo Envio", icon: FileText },
    { href: "/app/envios", label: "Histórico & Envios", icon: Search },
  ]

  return (
    <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={`${item.href}${queryParams}`}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-colors ${
              isActive
                ? "text-emerald-800 bg-emerald-50 border border-emerald-200/60 shadow-2xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Icon className={`w-4 h-4 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

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
    <Link
      href={`/app/criar-guia${queryParams}`}
      className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
    >
      <Plus className="w-4 h-4" />
      <span>Novo Envio</span>
    </Link>
  )
}
