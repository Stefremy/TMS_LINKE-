"use client"

import * as React from "react"
import { MobileDrawer } from "@/components/ui/mobile-drawer"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  Plus,
  MapPin,
  User,
  LogOut,
  LayoutDashboard,
  Package,
  CalendarCheck
} from "lucide-react"
import { SidebarNav } from "./SidebarNav"
import styles from "./SidebarPattern.module.css"
import { APP_VERSION } from "@/lib/config/version"
import { signout } from "@/app/login/actions"

export function OpsSidebar({ canAccessDocuments = false, canSendMessages = false }: { canAccessDocuments?: boolean; canSendMessages?: boolean }) {
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [isMobileOpen, setIsMobileOpen] = React.useState(false)
  const pathname = usePathname()

  // Auto-close mobile drawer whenever route changes
  React.useEffect(() => {
    // Route changes are an external event that should close the mobile drawer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileOpen(false)
  }, [pathname])

  const closeMobileMenu = React.useCallback(() => setIsMobileOpen(false), [])

  // Load persistence from localStorage safely on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("linke_ops_sidebar_collapsed")
      if (saved !== null) {
        // Sync the user's persisted sidebar preference after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsCollapsed(saved === "true")
      }
    } catch {
      // ignore
    }
  }, [])

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem("linke_ops_sidebar_collapsed", String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <>
      {/* ─── MOBILE TOPBAR (compact layout) ────────────────────────────────────────── */}
      <div className="tms-mobile-only tms-mobile-topbar sticky top-0 z-40 bg-[var(--surface-bg)]/95 backdrop-blur-md border-b border-[var(--border-subtle)] px-3.5 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-label="Abrir menu de navegação"
            aria-controls="ops-mobile-menu"
            aria-expanded={isMobileOpen}
            className="min-h-11 min-w-11 flex items-center justify-center p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[rgba(0,0,0,0.05)] active:scale-95 transition-all cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link href="/ops" className="flex items-center gap-2">
            <Image
              src="/Linke-logo.png"
              alt="Linke TMS"
              width={95}
              height={24}
              className="tms-brand-logo object-contain"
              style={{ height: "auto" }}
              priority
            />
            <span className="hidden min-[380px]:inline-flex text-[10px] font-semibold text-[var(--text-tertiary)] bg-[var(--surface-muted)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
              {APP_VERSION}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/ops/envios/novo"
            className="tms-brand-cta min-h-11 flex items-center gap-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-xs active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            <span>Novo</span>
          </Link>
        </div>
      </div>

      {/* ─── MOBILE DRAWER & BACKDROP (compact layout) ─────────────────────────────── */}
      <MobileDrawer open={isMobileOpen} onClose={closeMobileMenu} label="Menu de operações" id="ops-mobile-menu">
          {/* Drawer Header */}
          <div className="tms-drawer-header shrink-0 p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-muted)]/50">
            <Link href="/ops" className="flex items-center gap-2" onClick={() => setIsMobileOpen(false)}>
              <Image
                src="/Linke-logo.png"
                alt="Linke TMS"
                width={110}
                height={28}
                className="tms-brand-logo object-contain"
                style={{ height: "auto" }}
              />
              <span className="text-[10px] font-medium text-[var(--text-tertiary)] bg-[var(--surface-bg)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                {APP_VERSION}
              </span>
            </Link>
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

          <div className={`tms-drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain ${styles.pattern} ${styles.mobilePattern}`}>
            {/* Scrollable Navigation */}
            <div className="py-2">
              <SidebarNav collapsed={false} canAccessDocuments={canAccessDocuments} canSendMessages={canSendMessages} />
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-3 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 space-y-1.5 text-xs">
              <Link
                href="/ops/perfil"
                onClick={() => setIsMobileOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] font-medium transition-colors"
              >
                <User className="w-4 h-4 text-[var(--accent)]" />
                <span>O meu perfil</span>
              </Link>

              <form action={signout}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 font-medium transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Terminar Sessão</span>
                </button>
              </form>
            </div>
          </div>
      </MobileDrawer>

      {/* ─── DESKTOP SIDEBAR (desktop layout) ─────────────────────────────────── */}
      <aside
        className={`tms-desktop-only tms-sidebar ${styles.pattern} bg-[var(--surface-bg)] border-r border-[var(--border-subtle)] flex-col shrink-0 transition-all duration-200 select-none ${
          isCollapsed ? "w-[68px]" : "w-[220px]"
        }`}
      >
        {/* Logo Area */}
        <div className={`pt-6 pb-2 ${isCollapsed ? "px-2 flex flex-col items-center" : "px-6"}`}>
          <Link href="/ops" className="block">
            {isCollapsed ? (
              <div
                title="Linke TMS"
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-105"
              >
                <Image
                  src="/favicon.png"
                  alt="Linke TMS"
                  width={36}
                  height={36}
                  className="tms-brand-logo object-contain rounded-lg"
                  priority
                />
              </div>
            ) : (
              <>
                <Image
                  src="/Linke-logo.png"
                  alt="Linke TMS"
                  width={130}
                  height={32}
                  className="tms-brand-logo object-contain"
                  style={{ height: "auto" }}
                  priority
                />
                <div className="text-[11px] text-[var(--text-tertiary)] font-medium mt-2">
                  {APP_VERSION}
                </div>
              </>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <SidebarNav collapsed={isCollapsed} canAccessDocuments={canAccessDocuments} canSendMessages={canSendMessages} />

        {/* Bottom Sidebar Action: Recolher painel */}
        <div className={`pb-4 pt-2 ${isCollapsed ? "px-2" : "px-4"}`}>
          <button
            type="button"
            onClick={toggleCollapsed}
            title={isCollapsed ? "Expandir painel" : "Recolher painel"}
            className={`w-full flex items-center rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(0,0,0,0.04)] transition-all cursor-pointer ${
              isCollapsed
                ? "h-10 justify-center p-0"
                : "px-3 py-2 justify-between"
            }`}
          >
            {isCollapsed ? (
              <ChevronsRight className="w-4 h-4 text-[var(--text-secondary)]" />
            ) : (
              <>
                <span className="text-[11px] font-medium text-[var(--text-secondary)]">Recolher painel</span>
                <ChevronsLeft className="w-4 h-4 text-[var(--text-tertiary)]" />
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ─── MOBILE BOTTOM NAVIGATION BAR (compact layout) ─────────────────────────── */}
      <nav
        aria-label="Navegação inferior de operações"
        className="tms-mobile-only tms-bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-bg)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] flex items-center justify-around px-2 shadow-lg"
      >
        <Link
          href="/ops"
          prefetch={false}
          aria-current={pathname === "/ops" ? "page" : undefined}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-all ${
            pathname === "/ops"
              ? "text-[var(--accent)] font-bold"
              : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 mb-0.5 ${pathname === "/ops" ? "text-[var(--accent)] stroke-[2.5]" : ""}`} />
          <span className="text-[11px] tracking-tight">Painel</span>
        </Link>

        <Link
          href="/ops/envios"
          prefetch={false}
          aria-current={pathname.startsWith("/ops/envios") && pathname !== "/ops/envios/novo" ? "page" : undefined}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-all ${
            pathname.startsWith("/ops/envios") && pathname !== "/ops/envios/novo"
              ? "text-[var(--accent)] font-bold"
              : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <Package className={`w-5 h-5 mb-0.5 ${pathname.startsWith("/ops/envios") && pathname !== "/ops/envios/novo" ? "text-[var(--accent)] stroke-[2.5]" : ""}`} />
          <span className="text-[11px] tracking-tight">Envios</span>
        </Link>

        <Link
          href="/ops/envios/novo"
          prefetch={false}
          className="tms-nav-create flex flex-col items-center justify-center -mt-3 shrink-0"
        >
          <div className="tms-brand-cta w-11 h-11 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white flex items-center justify-center shadow-md active:scale-95 transition-all">
            <Plus className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <span className="text-[9px] font-bold text-[var(--accent)] mt-0.5">Novo</span>
        </Link>

        <Link
          href="/ops/envios/recolhas"
          prefetch={false}
          aria-current={pathname.startsWith("/ops/envios/recolhas") ? "page" : undefined}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-all ${
            pathname.startsWith("/ops/envios/recolhas")
              ? "text-[var(--accent)] font-bold"
              : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <CalendarCheck className={`w-5 h-5 mb-0.5 ${pathname.startsWith("/ops/envios/recolhas") ? "text-[var(--accent)] stroke-[2.5]" : ""}`} />
          <span className="text-[11px] tracking-tight">Recolhas</span>
        </Link>

        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          aria-controls="ops-mobile-menu"
          aria-expanded={isMobileOpen}
          className="flex flex-col items-center justify-center flex-1 py-1 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-all cursor-pointer"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] tracking-tight">Mais</span>
        </button>
      </nav>
    </>
  )
}
