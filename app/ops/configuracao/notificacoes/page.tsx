import * as React from "react"
import { Settings, CheckCircle2, AlertCircle } from "lucide-react"
import { TemplatesClient } from "./TemplatesClient"

export default function NotificacoesPage() {
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.STORE_FROM_EMAIL || "notificacoes@linke.pt"
  
  const isConnected = !!resendKey

  return (
    <div className="max-w-5xl mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">Email e Notificações</h1>
          <p className="text-[13px] font-medium text-[var(--text-secondary)] mt-0.5">Configure o servidor SMTP e os templates de email para as notificações da plataforma.</p>
        </div>
      </div>

      <div className="bg-[var(--surface-bg)] rounded-lg shadow-sm border border-[var(--border-subtle)] overflow-hidden">
        <div className="p-5 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] border border-[rgba(18,138,71,0.1)]">
              <Settings className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-[var(--text-primary)] leading-tight">Integração Resend</h2>
              <p className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5">Credenciais para envio de emails de sistema.</p>
            </div>
          </div>
          {isConnected ? (
            <span className="px-2 py-1 bg-[var(--status-success-soft)] text-[var(--status-success)] text-[10px] font-bold uppercase tracking-wider rounded border border-[rgba(21,128,61,0.2)] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={3} />
              Conectado
            </span>
          ) : (
            <span className="px-2 py-1 bg-[var(--status-warning-soft)] text-[var(--status-warning)] text-[10px] font-bold uppercase tracking-wider rounded border border-[rgba(217,119,6,0.2)] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" strokeWidth={3} />
              Não Configurado
            </span>
          )}
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">API Key do Resend</label>
              <input 
                type="password" 
                value={resendKey || ""}
                placeholder="re_..." 
                className="w-full px-3 py-2 bg-[var(--surface-muted)] border border-[var(--border-strong)] rounded-md text-[13px] font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors shadow-2xs opacity-75 cursor-not-allowed" 
                disabled 
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Email de Remetente (From)</label>
              <input 
                type="email" 
                value={fromEmail}
                className="w-full px-3 py-2 bg-[var(--surface-muted)] border border-[var(--border-strong)] rounded-md text-[13px] font-mono text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors shadow-2xs opacity-75 cursor-not-allowed" 
                disabled 
              />
            </div>
          </div>
          
          <div className="pt-2 flex justify-end">
            <button className="px-5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-[12px] font-bold rounded-md shadow-xs transition-colors opacity-50 cursor-not-allowed">
              Guardar Definições
            </button>
          </div>
        </div>
      </div>

      <TemplatesClient />
    </div>
  )
}
