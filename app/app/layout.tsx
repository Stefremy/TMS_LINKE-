import * as React from "react"
import Link from "next/link"
import { 
  Home, 
  LogOut, 
  HelpCircle,
} from "lucide-react"

import { Suspense } from "react"
import { ClientImpersonationBanner, ClientProfileSidebar } from "./components/ClientImpersonationBanner"
import { ClientSidebarNav, ClientTopHeaderAction } from "./components/ClientSidebarNav"

export default function OpsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-800">
      {/* Top Admin Impersonation Bar */}
      <Suspense fallback={null}>
        <ClientImpersonationBanner />
      </Suspense>

      <div className="flex-1 flex flex-col md:flex-row min-w-0">
        {/* Sidebar */}
        <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
          
          {/* Logo Area */}
          <div className="pt-8 pb-6 px-6">
            <div className="flex flex-col">
              <span className="text-emerald-600 text-3xl font-black tracking-tight leading-none">linke</span>
              <span className="text-slate-400 text-[0.65rem] font-bold tracking-wider mt-1.5 uppercase">Portal do Cliente</span>
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
          <div className="p-4 space-y-4 mt-auto">
            <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50/60 shadow-2xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                <HelpCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-700 font-bold">Suporte Dedicado</p>
                <a href="mailto:suporte@linke.pt" className="text-xs text-emerald-700 font-semibold hover:underline flex items-center gap-1 mt-0.5">
                  Fale connosco
                </a>
              </div>
            </div>
            <Link href="/ops/entidades/clientes" className="flex items-center gap-2.5 px-3 py-2 w-full text-left text-slate-500 hover:text-slate-900 text-xs font-bold transition-colors">
              <LogOut className="w-4 h-4" />
              <span>Sair para o TMS</span>
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar / Header */}
          <header className="h-20 flex items-center justify-between px-6 sm:px-8 shrink-0 border-b border-slate-200/60 bg-white/60 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <Home className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-300">&gt;</span>
              <span>Área de Cliente</span>
              <span className="text-slate-300">&gt;</span>
              <span className="text-emerald-700 font-bold">Painel & Operações</span>
            </div>
            
            <Suspense fallback={null}>
              <ClientTopHeaderAction />
            </Suspense>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-6 sm:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
