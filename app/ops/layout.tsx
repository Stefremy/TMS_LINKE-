import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { SidebarNav } from "./components/SidebarNav"
import { NotificationBell } from "./components/NotificationBell"
import { TrackingQuickBar } from "./components/TrackingQuickBar"
import { createClient } from "@/lib/supabase/server"
import { signout } from "@/app/login/actions"
import { 
  Plus,
  HelpCircle,
  ToggleRight,
  ChevronsLeft,
  User,
  LogOut
} from "lucide-react"

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Try to get name from metadata, fallback to email prefix, fallback to "Operador"
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || "Operador"

  return (
    <div className="min-h-screen bg-[var(--canvas-bg)] flex flex-col md:flex-row text-[var(--text-primary)]">
      {/* Sidebar */}
      <aside className="w-full md:w-[220px] bg-[var(--surface-bg)] border-r border-[var(--border-subtle)] flex flex-col shrink-0">
        
        {/* Logo Area */}
        <div className="pt-6 pb-2 px-6">
          <Link href="/ops" className="block w-full">
            <Image 
              src="/Linke-logo.png" 
              alt="Linke TMS" 
              width={130} 
              height={32} 
              className="object-contain" 
              priority 
            />
          </Link>
          <div className="text-[11px] text-[var(--text-tertiary)] font-medium mt-2">
            v2.8.4 Enterprise
          </div>
        </div>
        
        {/* Navigation */}
        <SidebarNav />

        {/* Bottom Sidebar Toggles */}
        <div className="px-4 pb-4 pt-2">
          <div className="bg-[var(--surface-muted)] rounded-md border border-[var(--border-subtle)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)]">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Modo Operações</span>
              <ToggleRight className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-[rgba(0,0,0,0.02)] transition-colors">
              <span className="text-[11px] font-medium text-[var(--text-secondary)]">Recolher painel</span>
              <ChevronsLeft className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar / Header */}
        <header className="h-[56px] flex items-center justify-between px-6 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface-bg)]">
          <div className="flex items-center gap-3">
            <TrackingQuickBar />
          </div>
          
          <div className="flex items-center gap-5">
            <Link href="/ops/envios/novo" className="flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-3 py-1.5 rounded-md text-[12px] font-bold transition-colors shadow-xs">
              <Plus className="w-3.5 h-3.5" strokeWidth={3} />
              Novo Envio
            </Link>
            
            <div className="flex items-center gap-4 border-r border-[var(--border-subtle)] pr-5">
              <NotificationBell />
              <HelpCircle className="w-5 h-5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer transition-colors" />
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-3 pl-1">
              <div className="flex flex-col items-end cursor-pointer">
                <span className="text-[12px] font-bold text-[var(--text-primary)] leading-tight capitalize">{userName}</span>
                <span className="text-[10px] text-[var(--text-secondary)] font-medium">Operador Sénior · Porto</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-xs cursor-pointer">
                <User className="w-4 h-4" />
              </div>
              <div className="h-6 w-[1px] bg-[var(--border-subtle)] mx-1"></div>
              <form action={signout}>
                <button 
                  type="submit" 
                  title="Terminar Sessão"
                  className="p-1.5 text-[var(--text-tertiary)] hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-[var(--canvas-bg)] p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
