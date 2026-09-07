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

export default function OpsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row font-sans text-slate-800">
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
        <div className="px-4 mb-6">
          <button className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg border border-transparent transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center text-xl">
                🌵
              </div>
              <span className="font-semibold text-slate-700 text-sm">Cacto Lda.</span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <Link href="/ops" className="flex items-center gap-3 px-3 py-2.5 text-green-700 bg-green-50 rounded-lg font-medium text-sm transition-colors">
            <Home className="w-5 h-5 text-green-600" />
            Painel
          </Link>
          <Link href="/ops/criar-guia" className="flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors">
            <FileText className="w-5 h-5" />
            Criar Guia
          </Link>
          <Link href="/ops/recolhas" className="flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors">
            <Truck className="w-5 h-5" />
            Minhas Recolhas
          </Link>
          <Link href="/ops/rastreamento" className="flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors">
            <Search className="w-5 h-5" />
            Rastreamento
          </Link>
          <Link href="/ops/faturas" className="flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors">
            <Receipt className="w-5 h-5" />
            Faturas
          </Link>
          <Link href="/ops/definicoes" className="flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg font-medium text-sm transition-colors">
            <Settings className="w-5 h-5" />
            Definições da Empresa
          </Link>
        </nav>
        
        {/* Footer actions */}
        <div className="p-4 space-y-4">
          <div className="p-4 border border-slate-200 rounded-xl bg-white shadow-sm flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Precisa de ajuda?</p>
              <a href="#" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mt-0.5">
                Fale connosco
              </a>
            </div>
          </div>
          <button className="flex items-center gap-3 px-3 py-2 w-full text-left text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors">
            <LogOut className="w-5 h-5" />
            Terminar sessão
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar / Header */}
        <header className="h-20 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Home className="w-4 h-4" />
            <span className="text-slate-300">&gt;</span>
            <span>Painel</span>
            <span className="text-slate-300">&gt;</span>
            <span className="text-green-600 font-medium">Criar Envio</span>
          </div>
          
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-md text-sm font-medium shadow-sm transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nova Guia de Transporte
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto px-8 pb-8">
          {children}
        </main>
      </div>
    </div>
  )
}
