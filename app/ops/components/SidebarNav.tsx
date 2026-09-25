"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  Package, 
  PackagePlus,
  CalendarCheck, 
  MapPin, 
  AlertTriangle, 
  Building2, 
  FileText, 
  CreditCard, 
  BarChart3, 
  Plug, 
  Settings,
  ChevronDown,
  Users,
  Receipt,
  Euro
} from "lucide-react"

type NavItem = {
  title: string
  href: string
  icon: React.ElementType
  badge?: number | string
  subItems?: { title: string; href: string }[]
}

type NavSection = {
  label: string
  items: NavItem[]
}

const navConfig: NavSection[] = [
  {
    label: "OPERAÇÃO",
    items: [
      { title: "Visão geral", href: "/ops", icon: LayoutDashboard },
      { title: "Novo Envio", href: "/ops/envios/novo", icon: PackagePlus },
      { title: "Envios", href: "/ops/envios", icon: Package },
      { title: "Recolhas", href: "/ops/envios/recolhas", icon: CalendarCheck },
      { title: "Tracking", href: "/ops/envios/rastreabilidade", icon: MapPin },
      { title: "Incidências", href: "/ops/incidencias", icon: AlertTriangle },
    ]
  },
  {
    label: "GESTÃO",
    items: [
      { 
        title: "Entidades", 
        href: "/ops/entidades", 
        icon: Users,
        subItems: [
          { title: "Clientes", href: "/ops/entidades/clientes" },
          { title: "Destinatários", href: "/ops/entidades/destinatarios" },
          { title: "Pontos Pickup", href: "/ops/entidades/pontos-pickup" },
          { title: "Transportadoras", href: "/ops/entidades/fornecedores" },
          { title: "Colaboradores", href: "/ops/entidades/colaboradores" },
        ]
      },
      { 
        title: "Faturação", 
        href: "/ops/faturacao", 
        icon: Receipt,
        subItems: [
          { title: "Contas Corrente", href: "/ops/faturacao/contas-corrente" },
          { title: "Fatura Personalizada", href: "/ops/faturacao/personalizada" },
          { title: "Faturação Clientes", href: "/ops/faturacao/clientes" },
          { title: "Análise Estatística", href: "/ops/faturacao/estatistica" },
        ]
      },
      { 
        title: "Tesouraria", 
        href: "/ops/tesouraria", 
        icon: Euro,
        subItems: [
          { title: "Reembolsos", href: "/ops/tesouraria/reembolsos" },
          { title: "Salários", href: "/ops/tesouraria/salarios" },
        ]
      },
      { title: "Documentos", href: "/ops/documentos", icon: FileText },
    ]
  },
  {
    label: "SISTEMA",
    items: [
      { title: "Relatórios", href: "/ops/relatorios", icon: BarChart3 },
      { title: "Integrações", href: "/ops/integracoes", icon: Plug },
      { 
        title: "Configurações", 
        href: "/ops/configuracao/geral", 
        icon: Settings,
        subItems: [
          { title: "Geral", href: "/ops/configuracao/geral" },
          { title: "Webservices Globais", href: "/ops/configuracao/webservices" },
          { title: "Serviços Linke", href: "/ops/configuracao/servicos" },
          { title: "Taxas Adicionais", href: "/ops/configuracao/taxas" },
          { title: "Tabelas de Preço", href: "/ops/configuracao/precos" },
          { title: "Zonas de Preço", href: "/ops/configuracao/zonas" },
          { title: "Estados de Envio", href: "/ops/configuracao/estados" },
          { title: "Email e Notificações", href: "/ops/configuracao/notificacoes" },
        ]
      },
    ]
  }
]

export function SidebarNav() {
  const pathname = usePathname()
  
  // Track open state of multiple accordions
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>({})

  // Automatically open accordions if we are on a matching route
  React.useEffect(() => {
    const newOpenItems = { ...openItems }
    let changed = false
    navConfig.forEach((section) => {
      section.items.forEach((item) => {
        if (item.subItems) {
          const isChildActive = item.subItems.some((sub) => {
             return pathname === sub.href || (sub.href === "/ops/configuracao/precos" && pathname === "/ops/configuracao/servicos") || pathname.startsWith(sub.href + "/")
          })
          if (isChildActive && !newOpenItems[item.title]) {
            newOpenItems[item.title] = true
            changed = true
          }
        }
      })
    })
    if (changed) {
      setOpenItems(newOpenItems)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const toggleItem = (title: string) => {
    setOpenItems(prev => ({
      ...prev,
      [title]: !prev[title]
    }))
  }

  return (
    <nav className="flex-1 px-4 space-y-6 overflow-y-auto mt-4 pb-8">
      {navConfig.map((section, idx) => (
        <div key={idx} className="flex flex-col">
          <h4 className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-2">
            {section.label}
          </h4>
          <div className="flex flex-col space-y-0.5">
            {section.items.map((item) => {
              const hasSubItems = item.subItems && item.subItems.length > 0

              // Exact match for 'Visão geral' (/ops), startsWith for others
              const isActive = item.href === "/ops" 
                ? pathname === "/ops" 
                : hasSubItems 
                ? false // Parent item shouldn't be "active" if it has subitems, we rely on isGroupActive below
                : pathname.startsWith(item.href)

              if (hasSubItems) {
                const isOpen = openItems[item.title] || false
                const isGroupActive = item.subItems!.some(sub => 
                  pathname === sub.href || 
                  (sub.href === "/ops/configuracao/precos" && pathname === "/ops/configuracao/servicos") ||
                  pathname.startsWith(sub.href + "/")
                )

                return (
                  <div key={item.title} className="flex flex-col space-y-0.5">
                    <button
                      type="button"
                      onClick={() => toggleItem(item.title)}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-md text-[13px] transition-colors group cursor-pointer w-full text-left ${
                        isGroupActive 
                          ? "text-[var(--accent)] font-semibold" 
                          : "text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon 
                          className={`w-[18px] h-[18px] ${
                            isGroupActive ? "text-[var(--accent)]" : "text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]"
                          }`} 
                          strokeWidth={isGroupActive ? 2.2 : 1.8} 
                        />
                        {item.title}
                      </div>
                      <ChevronDown 
                        className={`w-3.5 h-3.5 text-[var(--text-tertiary)] transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-[var(--text-secondary)]" : ""
                        }`} 
                      />
                    </button>

                    {/* Sub Items */}
                    {isOpen && (
                      <div className="flex flex-col space-y-0.5 pl-6 pr-1 mt-0.5 mb-1.5 border-l-2 border-[var(--border-subtle)] ml-4">
                        {item.subItems!.map((sub) => {
                          const isSubActive = pathname === sub.href || (sub.href === "/ops/configuracao/precos" && pathname === "/ops/configuracao/servicos")
                          return (
                            <Link
                              key={sub.title}
                              href={sub.href}
                              className={`block py-1.5 px-2 rounded-md text-[12px] transition-colors ${
                                isSubActive
                                  ? "text-[var(--accent)] font-bold bg-[var(--accent-soft)]/70"
                                  : "text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                              }`}
                            >
                              {sub.title}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

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
