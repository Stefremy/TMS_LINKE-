"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  Package, 
  CalendarCheck,
  MapPin,
  AlertTriangle,
  Building2,
  FileText,
  CreditCard,
  BarChart3,
  Plug,
  Settings
} from "lucide-react"

type NavSection = {
  label: string
  items: {
    title: string
    href: string
    icon: React.ElementType
    badge?: number | string
  }[]
}

const navConfig: NavSection[] = [
  {
    label: "OPERAÇÃO",
    items: [
      { title: "Visão geral", href: "/ops", icon: LayoutDashboard },
      { title: "Envios", href: "/ops/envios", icon: Package },
      { title: "Recolhas", href: "/ops/envios/recolhas", icon: CalendarCheck },
      { title: "Tracking", href: "/ops/envios/rastreabilidade", icon: MapPin },
      { title: "Incidências", href: "/ops/incidencias", icon: AlertTriangle },
    ]
  },
  {
    label: "GESTÃO",
    items: [
      { title: "Clientes & Tenants", href: "/ops/entidades/clientes", icon: Building2 },
      { title: "Documentos", href: "/ops/documentos", icon: FileText },
      { title: "Contas Corrente", href: "/ops/faturacao/contas-corrente", icon: CreditCard },
      { title: "Fatura Personalizada", href: "/ops/faturacao/personalizada", icon: FileText },
    ]
  },
  {
    label: "SISTEMA",
    items: [
      { title: "Relatórios", href: "/ops/relatorios", icon: BarChart3 },
      { title: "Integrações", href: "/ops/integracoes", icon: Plug },
      { title: "Configurações", href: "/ops/configuracao/geral", icon: Settings },
    ]
  }
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex-1 px-4 space-y-6 overflow-y-auto mt-4 pb-8">
      {navConfig.map((section, idx) => (
        <div key={idx} className="flex flex-col">
          <h4 className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-2">
            {section.label}
          </h4>
          <div className="flex flex-col space-y-0.5">
            {section.items.map((item) => {
              // Exact match for 'Visão geral' (/ops), startsWith for others
              const isActive = item.href === "/ops" 
                ? pathname === "/ops" 
                : pathname.startsWith(item.href)

              return (
                <Link 
                  key={item.title}
                  href={item.href} 
                  className={`flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] transition-colors group ${
                    isActive 
                      ? "text-[var(--accent)] font-semibold" 
                      : "text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <item.icon 
                      className={`w-[18px] h-[18px] ${
                        isActive ? "text-[var(--accent)]" : "text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]"
                      }`} 
                      strokeWidth={isActive ? 2.2 : 1.8} 
                    />
                    {item.title}
                  </div>
                  {item.badge && (
                    <span className="bg-[#FEF3C7] text-[#D97706] text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}
