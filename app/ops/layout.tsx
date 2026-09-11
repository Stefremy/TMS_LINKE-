import * as React from "react"
import Link from "next/link"
import { SidebarNav } from "./components/SidebarNav"
import { NotificationBell } from "./components/NotificationBell"
import { TrackingQuickBar } from "./components/TrackingQuickBar"
import { 
  Home, 
  Package, 
  Truck, 
  Search, 
  Receipt, 
  Settings, 
  Bell,
  Plus,
  Building2,
  ChevronDown,
  Users,
  Plug
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
        <div className="pt-8 pb-8 px-6">
          <div className="flex flex-col">
            <span className="text-green-600 text-[2.5rem] font-extrabold tracking-tight leading-none">linke</span>
          </div>
        </div>
        
        {/* Navigation */}
        <SidebarNav />
        
        {/* Footer actions */}
        <div className="p-4">
          <button className="flex items-center justify-between w-full p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-bold text-slate-800">Linke Logistics, Lda.</span>
                <span className="text-xs text-slate-500 font-medium">Mudar cliente</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar / Header */}
        <header className="h-24 flex items-center justify-between px-10 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-lg">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Pesquisar envios, guias, clientes..." 
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 shadow-sm"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <TrackingQuickBar />
            <NotificationBell />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto px-10 pb-10">
          {children}
        </main>
      </div>
    </div>
  )
}
