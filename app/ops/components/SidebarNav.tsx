"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  Home, 
  Package, 
  Receipt, 
  Settings, 
  Users,
  ChevronDown,
  Euro,
} from "lucide-react"

type NavItem = {
  title: string
  href?: string
  icon: React.ElementType
  subItems?: { title: string; href: string }[]
}

const navConfig: NavItem[] = [
  {
    title: "Painel de Resumo",
    href: "/ops",
    icon: Home,
  },
  {
    title: "Entidades",
    icon: Users,
    subItems: [
      { title: "Clientes", href: "/ops/entidades/clientes" },
      { title: "Destinatários", href: "/ops/entidades/destinatarios" },
      { title: "Pontos Pickup", href: "/ops/entidades/pontos-pickup" },
      { title: "Fornecedores", href: "/ops/entidades/fornecedores" },
      { title: "Colaboradores", href: "/ops/entidades/colaboradores" },
    ]
  },
  {
    title: "Envios e Serviços",
    icon: Package,
    subItems: [
      { title: "Lista de Envios", href: "/ops/envios" },
      { title: "Criar Envio", href: "/ops/envios/novo" },
      { title: "Pedidos de Recolha", href: "/ops/envios/recolhas" },
      { title: "Mapas de Distribuição", href: "/ops/envios/mapas" },
      { title: "Rastreabilidade", href: "/ops/envios/rastreabilidade" },
      { title: "Gestão Operacional", href: "/ops/envios/operacional" },
      { title: "Gestor de Tarefas", href: "/ops/envios/tarefas" },
    ]
  },
  {
    title: "Tesouraria",
    icon: Euro,
    subItems: [
      { title: "Reembolsos", href: "/ops/tesouraria/reembolsos" },
      { title: "Portes no Destino", href: "/ops/tesouraria/portes" },
      { title: "Ajudas de Custo", href: "/ops/tesouraria/ajudas-custo" },
      { title: "Salários", href: "/ops/tesouraria/salarios" },
      { title: "Movimentos Bancários", href: "/ops/tesouraria/movimentos" },
      { title: "Multibanco / Visa", href: "/ops/tesouraria/cartoes" },
      { title: "SEPA", href: "/ops/tesouraria/sepa" },
    ]
  },
  {
    title: "Faturação",
    icon: Receipt,
    subItems: [
      { title: "Vendas", href: "/ops/faturacao/vendas" },
      { title: "Compras", href: "/ops/faturacao/compras" },
      { title: "Contas Corrente", href: "/ops/faturacao/contas-corrente" },
      { title: "Faturação Clientes", href: "/ops/faturacao/clientes" },
      { title: "Faturação Terceiros", href: "/ops/faturacao/terceiros" },
      { title: "Análise Estatística", href: "/ops/faturacao/estatistica" },
    ]
  },
  {
    title: "Configuração",
    icon: Settings,
    subItems: [
      { title: "Geral", href: "/ops/configuracao/geral" },
      { title: "Empresas", href: "/ops/configuracao/empresas" },
      { title: "Serviços de Transporte", href: "/ops/configuracao/servicos" },
      { title: "Taxas Adicionais", href: "/ops/configuracao/taxas" },
      { title: "Tabelas de Preço", href: "/ops/configuracao/precos" },
      { title: "Zonas de Preço", href: "/ops/configuracao/zonas" },
      { title: "Estados de Envio", href: "/ops/configuracao/estados" },
      { title: "Permissões", href: "/ops/configuracao/permissoes" },
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
    navConfig.forEach((item) => {
      if (item.subItems) {
        const isChildActive = item.subItems.some((sub) => pathname.startsWith(sub.href))
        if (isChildActive) {
          newOpenItems[item.title] = true
        }
      }
    })
    setOpenItems(newOpenItems)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const toggleItem = (title: string) => {
    setOpenItems(prev => ({
      ...prev,
      [title]: !prev[title]
    }))
  }

  return (
    <nav className="flex-1 px-4 space-y-2 overflow-y-auto mt-4 pb-10">
      {navConfig.map((item) => {
        
        // Single link item
        if (item.href) {
          const isActive = pathname === item.href
          return (
            <Link 
              key={item.title}
              href={item.href} 
              className={`flex items-center gap-4 px-4 py-3 rounded-xl font-semibold text-[15px] transition-colors ${
                isActive 
                  ? "text-green-800 bg-green-50 font-bold" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-green-600" : ""}`} strokeWidth={isActive ? 2.5 : 2} />
              {item.title}
            </Link>
          )
        }

        // Accordion item
        const isOpen = openItems[item.title]
        const hasActiveChild = item.subItems?.some(sub => pathname.startsWith(sub.href))

        return (
          <div key={item.title} className="flex flex-col space-y-1">
            <button 
              onClick={() => toggleItem(item.title)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-[15px] transition-colors w-full ${
                hasActiveChild 
                  ? "text-green-800 bg-green-50/50" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-4">
                <item.icon className={`w-5 h-5 ${hasActiveChild ? "text-green-600" : ""}`} strokeWidth={2} />
                {item.title}
              </div>
              <ChevronDown 
                className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} 
              />
            </button>
            
            {/* Sub Items */}
            {isOpen && item.subItems && (
              <div className="flex flex-col space-y-1 pl-12 pr-2 mt-1 mb-2">
                {item.subItems.map((sub) => {
                  const isSubActive = pathname === sub.href
                  return (
                    <Link
                      key={sub.title}
                      href={sub.href}
                      className={`block py-2 text-[14px] font-medium transition-colors ${
                        isSubActive
                          ? "text-green-700 font-bold"
                          : "text-slate-500 hover:text-slate-800"
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
      })}
    </nav>
  )
}
