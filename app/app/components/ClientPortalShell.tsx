import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { 
  Home, 
  LogOut, 
  HelpCircle,
} from "lucide-react"

import { Suspense } from "react"
import { ClientImpersonationBanner, ClientProfileSidebar } from "./ClientImpersonationBanner"
import { ClientSidebarNav, ClientTopHeaderAction } from "./ClientSidebarNav"
import { signout } from "@/app/login/actions"
import type { requirePortalStore } from "@/lib/client-portal/access"
import { ClientScopeProvider } from "./ClientScope"
import { ClientMobileNav } from "./ClientMobileNav"

export function ClientPortalShell({ children, store }: {
  children: React.ReactNode
  store: Awaited<ReturnType<typeof requirePortalStore>>
}) {
  const { client, isEmployee, basePath } = store
  return (
    <ClientScopeProvider key={client.id} value={{ client, isEmployee, basePath }}>
    <div className="min-h-screen bg-[var(--canvas-bg)] flex flex-col text-[var(--text-primary)]">
      {/* Top Admin Impersonation Bar */}
      <Suspense fallback={null}>
        <ClientImpersonationBanner />
      </Suspense>

      {/* Mobile Topbar, Drawer & Bottom Navigation */}
      <Suspense fallback={null}>
        <ClientMobileNav />
      </Suspense>

      <div className="flex-1 flex flex-col md:flex-row min-w-0">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-60 bg-[var(--surface-bg)] border-r border-[var(--border-subtle)] flex-col shrink-0">
          
          {/* Logo Area */}
          <div className="pt-7 pb-5 px-5">
            <div className="flex flex-col">
              <Image src="/Linke-logo.png" alt="Linke" width={100} height={30} className="object-contain" style={{ height: "auto" }} preload />
              <span className="text-[var(--text-tertiary)] text-[10px] font-semibold tracking-wider mt-2 uppercase">Portal do Cliente</span>
            </div>
          </div>

          {/* Profile Selector */}
          <Suspense fallback={null}>
            <ClientProfileSidebar />
          </Suspense>
        
          {/* Client Navigation */}
          <Suspense fallback={null}>
            <ClientSidebarNav />
          </Suspense>
        
          {/* Footer actions */}
          <div className="p-3 space-y-3 mt-auto">
            <div className="p-3 border border-[var(--border-subtle)] rounded-lg bg-[var(--surface-muted)] flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center shrink-0">
                <HelpCircle className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-primary)] font-semibold">Suporte Dedicado</p>
                <a href="mailto:suporte@linke.pt" className="text-[11px] text-[var(--accent)] font-medium hover:underline flex items-center gap-1 mt-0.5">
                  Fale connosco
                </a>
              </div>
            </div>
            {isEmployee ? (
              <Link href="/ops/entidades/clientes" className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--text-tertiary)]">
                <LogOut className="w-3.5 h-3.5" />
                <span>Sair para o TMS</span>
              </Link>
            ) : (
              <form action={signout}>
                <button type="submit" className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--text-tertiary)]">
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Terminar sessão</span>
                </button>
              </form>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop Topbar / Header */}
          <header className="hidden md:flex h-12 items-center justify-between px-5 sm:px-6 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-bg)]">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] font-medium">
              <Home className="w-3 h-3" />
              <span className="text-[var(--border-strong)]">&gt;</span>
              <span>Área de Cliente</span>
              <span className="text-[var(--border-strong)]">&gt;</span>
              <span className="text-[var(--accent)] font-semibold">Painel & Operações</span>
            </div>
            
            <Suspense fallback={null}>
              <ClientTopHeaderAction />
            </Suspense>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-6 pb-20 md:pb-6">
            {children}
          </main>
        </div>
      </div>
    </div>
    </ClientScopeProvider>
  )
}
