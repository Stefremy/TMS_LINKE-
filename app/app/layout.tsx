import * as React from "react"
import Link from "next/link"
import { 
  Home, 
  FileText, 
  Truck, 
  Search, 
  Receipt, 
  Settings, 
  LogOut, 
  ChevronDown, 
  HelpCircle,
  Plus
} from "lucide-react"

import { Suspense } from "react"
import { ClientImpersonationBanner, ClientProfileSidebar } from "./components/ClientImpersonationBanner"

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
              <span className="text-green-600 text-3xl font-extrabold tracking-tight leading-none">linke</span>
              <span className="text-slate-400 text-[0.65rem] font-semibold tracking-wider mt-1 uppercase">Portal do Cliente</span>
            </div>
          </div>

          {/* Profile Selector */}
          <Suspense fallback={null}>
            <ClientProfileSidebar />
          </Suspense>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <Link href="/app" className="flex items-center gap-3 px-3 py-2.5 text-green-700 bg-green-50 rounded-lg font-medium text-sm transition-colors">
            <Home className="w-5 h-5 text-green-600" />
            Painel Principal
          </Link>
          <a href="/app#criar-guia" className="flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors">
            <FileText className="w-5 h-5 text-slate-500" />
            Criar Envio / Guia
          </a>
          <a href="/app#recolhas" className="flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors">
            <Truck className="w-5 h-5 text-slate-500" />
            Pedir Recolha
          </a>
          <a href="/app#envios" className="flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors">
            <Search className="w-5 h-5 text-slate-500" />
            Rastreamento & Envios
          </a>
          <a href="/app#faturas" className="flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors">
            <Receipt className="w-5 h-5 text-slate-500" />
            Conta & Faturas
          </a>
          <a href="/app#definicoes" className="flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors">
            <Settings className="w-5 h-5 text-slate-500" />
            Definições da Conta
          </a>
        </nav>
        
        {/* Footer actions */}
        <div className="p-4 space-y-4">
          <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Precisa de ajuda?</p>
              <a href="mailto:suporte@linke.pt" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mt-0.5">
                Fale connosco
              </a>
            </div>
          </div>
          <Link href="/ops/entidades/clientes" className="flex items-center gap-3 px-3 py-2 w-full text-left text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors">
            <LogOut className="w-5 h-5" />
            Sair para o TMS
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar / Header */}
        <header className="h-20 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Home className="w-4 h-4" />
            <span className="text-slate-300">&gt;</span>
            <span>Área de Cliente</span>
            <span className="text-slate-300">&gt;</span>
            <span className="text-green-600 font-medium">Criar Envios & Recolhas</span>
          </div>
          
          <a href="/app#criar-guia" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nova Guia de Transporte
          </a>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto px-8 pb-8">
          {children}
        </main>
      </div>
    </div>
  </div>
)
}
