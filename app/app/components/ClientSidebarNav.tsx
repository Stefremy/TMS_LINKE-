"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, FileText, Search, Plus, UserCheck, CreditCard, Bell, MapPin } from "lucide-react"
import { useClientScope } from "./ClientScope"

export function ClientSidebarNav() {
  const pathname = usePathname()
  const { basePath } = useClientScope()

  const navItems = [
    { href: basePath, label: "Painel Principal", icon: Home },
    { href: `${basePath}/criar-guia`, label: "Novo Envio", icon: Plus },
    { href: `${basePath}/tracking`, label: "Rastreio & Mapa", icon: MapPin },
    { href: `${basePath}/envios`, label: "Histórico & Envios", icon: Search },
    { href: `${basePath}/destinatarios`, label: "Destinatários", icon: UserCheck },
    { href: `${basePath}/faturas`, label: "Faturas e Extratos", icon: FileText, hasBadge: true },
    { href: `${basePath}/carregamentos`, label: "Carregamentos", icon: CreditCard },
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
            {item.hasBadge && (
              <span className="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-blue-100 shrink-0" title="Novos documentos disponíveis" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}

export function ClientTopHeaderAction() {
  const { basePath, isEmployee } = useClientScope()
  const [showNotifications, setShowNotifications] = React.useState(false)
  const notifRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="flex items-center gap-2 relative">
      {/* Sino de Notificações */}
      <div className="relative" ref={notifRef}>
        <button
          type="button"
          onClick={() => setShowNotifications(!showNotifications)}
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors relative cursor-pointer"
          title="Notificações"
          aria-label="Notificações"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white" />
        </button>

        {showNotifications && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 py-3 z-50 text-xs animate-in fade-in slide-in-from-top-2">
            <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">Notificações</span>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full">Recentes</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              <Link
                href={`${basePath}/faturas`}
                onClick={() => setShowNotifications(false)}
                className="p-3 flex items-start gap-2.5 hover:bg-slate-50 transition-colors block text-left"
              >
                <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">Faturas e Extratos</div>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Consulte os documentos oficiais de faturação (AT) e recibos emitidos.
                  </p>
                </div>
              </Link>
              <Link
                href={`${basePath}/carregamentos`}
                onClick={() => setShowNotifications(false)}
                className="p-3 flex items-start gap-2.5 hover:bg-slate-50 transition-colors block text-left"
              >
                <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">Histórico de Wallet</div>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Verifique os seus carregamentos e saldo disponível.
                  </p>
                </div>
              </Link>
            </div>
            <div className="px-4 pt-2 border-t border-slate-100 text-center">
              <Link
                href={`${basePath}/faturas`}
                onClick={() => setShowNotifications(false)}
                className="text-[11px] text-blue-600 font-semibold hover:underline"
              >
                Ver todas as faturas →
              </Link>
            </div>
          </div>
        )}
      </div>

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
