"use client"

import * as React from "react"
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
  LogOut 
} from "lucide-react"
import { useClientScope } from "./ClientScope"
import { ClientProfileSidebar } from "./ClientImpersonationBanner"
import { ClientSidebarNav } from "./ClientSidebarNav"
import { signout } from "@/app/login/actions"

export function ClientMobileNav() {
  const [isOpen, setIsOpen] = React.useState(false)
  const pathname = usePathname()
  const { client, basePath, isEmployee } = useClientScope()

  // Close drawer on route change
  React.useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent background scrolling when drawer is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  const navTabs = [
    { href: basePath, label: "Painel", icon: Home, exact: true },
    { href: `${basePath}/criar-guia`, label: "Novo Envio", icon: PlusCircle },
    { href: `${basePath}/envios`, label: "Envios", icon: Package },
    { href: `${basePath}/faturas`, label: "Faturas", icon: FileText },
  ]

  return (
    <>
      {/* ─── MOBILE TOPBAR (md:hidden) ────────────────────────────────────────── */}
      <div className="md:hidden sticky top-0 z-40 bg-[var(--surface-bg)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Abrir menu do cliente"
            className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[rgba(0,0,0,0.05)] active:scale-95 transition-all cursor-pointer shrink-0"
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
          className="flex items-center gap-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-xs active:scale-95 transition-all shrink-0"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={3} />
          <span>Novo</span>
        </Link>
      </div>

      {/* ─── MOBILE DRAWER & BACKDROP (md:hidden) ─────────────────────────────── */}
      <div 
        className={`fixed inset-0 z-50 md:hidden flex transition-[visibility] duration-300 ${
          isOpen ? "visible pointer-events-auto" : "invisible pointer-events-none delay-300"
        }`}
        aria-hidden={!isOpen}
      >
        {/* Backdrop */}
        <div 
          className={`fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ease-out ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />

        {/* Drawer Sheet */}
        <div 
          className={`relative w-[285px] max-w-[85vw] h-full bg-[var(--surface-bg)] shadow-2xl flex flex-col z-10 border-r border-[var(--border-subtle)] transform transition-transform duration-300 ease-out ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-muted)]/50">
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
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Profile badge in drawer */}
          <div className="pt-3">
            <ClientProfileSidebar />
          </div>

          {/* Scrollable Navigation */}
          <div className="flex-1 overflow-y-auto py-2">
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
      </div>

      {/* ─── MOBILE BOTTOM NAVIGATION BAR (md:hidden) ─────────────────────────── */}
      <nav 
        aria-label="Navegação inferior móvel"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-bg)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] h-14 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom,0px)] shadow-lg"
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
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-all ${
                isActive
                  ? "text-[var(--accent)] font-bold"
                  : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "text-[var(--accent)] stroke-[2.5]" : ""}`} />
              <span className="text-[9px] tracking-tight">{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
