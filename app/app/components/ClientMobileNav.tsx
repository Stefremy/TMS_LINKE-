"use client"

import * as React from "react"
import { MobileDrawer } from "@/components/ui/mobile-drawer"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Menu,
  X,
  Home,
  Plus,
  PlusCircle,
  Package,
  FileText,
  UserCheck,
  HelpCircle,
  LogOut,
  MapPin
} from "lucide-react"
import { useClientScope } from "./ClientScope"
import { ClientAccountDetailsModal } from "./ClientAccountDetailsModal"
import { ClientProfileSidebar } from "./ClientImpersonationBanner"
import { ClientSidebarNav } from "./ClientSidebarNav"
import { signout } from "@/app/login/actions"
import sidebarStyles from "@/app/ops/components/SidebarPattern.module.css"

export function ClientMobileNav() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [isAccountOpen, setIsAccountOpen] = React.useState(false)
  const pathname = usePathname()
  const { client, basePath, isEmployee } = useClientScope()

  // Close drawer on route change
  React.useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  const closeMobileMenu = React.useCallback(() => setIsOpen(false), [])

  const navTabs = [
    { href: basePath, label: "Painel", icon: Home, exact: true },
    { href: `${basePath}/criar-guia`, label: "Novo Envio", icon: PlusCircle },
    { href: `${basePath}/tracking`, label: "Mapa", icon: MapPin },
    { href: `${basePath}/envios`, label: "Envios", icon: Package },
    { href: `${basePath}/faturas`, label: "Faturas", icon: FileText },
  ]

  return (
    <>
      {/* ─── MOBILE TOPBAR (compact layout) ────────────────────────────────────────── */}
      <div className="tms-mobile-only tms-mobile-topbar sticky top-0 z-40 bg-[var(--surface-bg)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Abrir menu do cliente"
            aria-controls="client-mobile-menu"
            aria-expanded={isOpen}
            className="min-h-11 min-w-11 flex items-center justify-center p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[rgba(0,0,0,0.05)] active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href={basePath} className="flex items-center gap-2 min-w-0">
            <Image
              src="/Linke-logo.png"
              alt="Linke"
              width={85}
              height={22}
              className="object-contain shrink-0"
              style={{ height: "auto" }}
              priority
            />
            <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-full border border-[rgba(18,138,71,0.2)] truncate max-w-[130px]">
              {client.short_name}
            </span>
          </Link>
        </div>

        <Link
          href={`${basePath}/criar-guia`}
          className="min-h-11 flex items-center gap-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-xs active:scale-95 transition-all shrink-0"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={3} />
          <span>Novo</span>
        </Link>
      </div>

      {/* ─── MOBILE DRAWER & BACKDROP (compact layout) ─────────────────────────────── */}
      <MobileDrawer open={isOpen} onClose={closeMobileMenu} label="Menu da área do cliente" id="client-mobile-menu">
          {/* Header */}
          <div className={`tms-drawer-header shrink-0 p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-muted)]/50 ${sidebarStyles.mobilePattern}`}>
            <div className="flex flex-col">
              <Image
                src="/Linke-logo.png"
                alt="Linke"
                width={100}
                height={26}
                className="object-contain"
                style={{ height: "auto" }}
              />
              <span className="text-[var(--text-tertiary)] text-[9px] font-bold tracking-wider mt-1 uppercase">
                Portal do Cliente
              </span>
            </div>
            <button
              type="button"
              onClick={closeMobileMenu}
              data-drawer-close
              className="min-h-11 min-w-11 flex items-center justify-center p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className={`tms-drawer-scroll ${sidebarStyles.pattern} relative min-h-0 flex-1 overflow-y-auto overscroll-contain`}>
            {/* Profile badge in drawer */}
            <div className="pt-3">
              <ClientProfileSidebar onOpenDetails={() => { closeMobileMenu(); setIsAccountOpen(true) }} />
            </div>

            {/* Scrollable Navigation */}
            <div className="py-2">
              <ClientSidebarNav />
            </div>

            {/* Support and Signout */}
            <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 space-y-2 text-xs">
              <div className="p-2.5 border border-[var(--border-subtle)] rounded-lg bg-[var(--surface-bg)] flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[var(--accent)] flex items-center justify-center shrink-0">
                  <HelpCircle className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-[var(--text-primary)] font-semibold leading-tight">Suporte Dedicado</p>
                  <a href="mailto:suporte@linke.pt" className="text-[10px] text-[var(--accent)] font-medium hover:underline truncate block">
                    suporte@linke.pt
                  </a>
                </div>
              </div>

              {isEmployee ? (
                <Link
                  href="/ops/entidades/clientes"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair para o TMS</span>
                </Link>
              ) : (
                <form action={signout}>
                  <button type="submit" className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer">
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Terminar sessão</span>
                  </button>
                </form>
              )}
            </div>
          </div>
      </MobileDrawer>

      <ClientAccountDetailsModal isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} client={client} userAvatar={null} />

      {/* ─── MOBILE BOTTOM NAVIGATION BAR (compact layout) ─────────────────────────── */}
      <nav
        aria-label="Navegação inferior móvel"
        className="tms-mobile-only tms-bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-bg)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] flex items-center justify-around px-2 shadow-lg"
      >
        {navTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={false}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-all ${
                isActive
                  ? "text-[var(--accent)] font-bold"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "text-[var(--accent)] stroke-[2.5]" : ""}`} />
              <span className="text-[11px] tracking-tight">{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
