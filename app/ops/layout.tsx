import * as React from "react"
import Link from "next/link"
import { OpsSidebar } from "./components/OpsSidebar"
import { NotificationBell } from "./components/NotificationBell"
import { TrackingQuickBar } from "./components/TrackingQuickBar"
import { createClient } from "@/lib/supabase/server"
import { signout } from "@/app/login/actions"
import { requireEmployee } from "@/lib/auth/context"
import { 
  Plus,
  HelpCircle,
  User,
  LogOut
} from "lucide-react"

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireEmployee()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Try to get name from metadata, fallback to email prefix, fallback to "Operador"
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || "Operador"

  return (
    <div className="min-h-screen bg-[var(--canvas-bg)] flex flex-col md:flex-row text-[var(--text-primary)]">
      {/* Interactive Collapsible Sidebar */}
      <OpsSidebar />

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
              <Link href="/ops/perfil" className="flex items-center gap-3 group hover:bg-[var(--surface-muted)] p-1 -mr-1 -my-1 pr-3 rounded-md transition-colors">
                <div className="flex flex-col items-end cursor-pointer">
                  <span className="text-[12px] font-bold text-[var(--text-primary)] leading-tight capitalize">{userName}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] font-medium group-hover:text-[var(--accent)] transition-colors">Editar Perfil</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-xs cursor-pointer group-hover:bg-[var(--accent-hover)] transition-colors overflow-hidden">
                  {user?.user_metadata?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.user_metadata.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
              </Link>
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
