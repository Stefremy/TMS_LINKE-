import * as React from "react"
import { Mail, Settings, CheckCircle2, AlertCircle } from "lucide-react"

export default function NotificacoesPage() {
  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.STORE_FROM_EMAIL || "notificacoes@linke.pt"
  
  const isConnected = !!resendKey

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Email e Notificações</h1>
        <p className="text-slate-500 mt-1">Configure o servidor SMTP e os templates de email para as notificações da plataforma.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Integração Resend</h2>
              <p className="text-sm text-slate-500">Credenciais para envio de emails de sistema.</p>
            </div>
          </div>
          {isConnected ? (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Conectado
            </span>
          ) : (
            <span className="px-3 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Não Configurado
            </span>
          )}
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">API Key do Resend</label>
              <input 
                type="password" 
                value={resendKey || ""}
                placeholder="re_..." 
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                disabled 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email de Remetente (From)</label>
              <input 
                type="email" 
                value={fromEmail}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                disabled 
              />
            </div>
          </div>
          
          <div className="pt-4 flex justify-end">
            <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors opacity-50 cursor-not-allowed">
              Guardar Definições
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Templates de Notificação</h2>
              <p className="text-sm text-slate-500">Gerir mensagens automáticas enviadas para os clientes.</p>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <h3 className="font-semibold text-slate-800">Aviso de Recolha Agendada</h3>
                <p className="text-sm text-slate-500">Enviado quando uma recolha CTT/Correos é confirmada.</p>
              </div>
              <button className="px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" disabled>
                Editar Template
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <h3 className="font-semibold text-slate-800">Alerta de Saldo Baixo</h3>
                <p className="text-sm text-slate-500">Enviado quando o saldo pré-pago do cliente atinge o limite.</p>
              </div>
              <button className="px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" disabled>
                Editar Template
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <h3 className="font-semibold text-slate-800">Em Transporte</h3>
                <p className="text-sm text-slate-500">Enviado quando a encomenda é recolhida e entra em distribuição.</p>
              </div>
              <button className="px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" disabled>
                Editar Template
              </button>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <h3 className="font-semibold text-slate-800">Guia de Transporte (Tracking)</h3>
                <p className="text-sm text-slate-500">Enviado para o destinatário final com o link de tracking.</p>
              </div>
              <button className="px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" disabled>
                Editar Template
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <h3 className="font-semibold text-slate-800">Incidências / Problemas na Entrega</h3>
                <p className="text-sm text-slate-500">Enviado quando há uma falha na entrega (ausência, morada incorreta, etc).</p>
              </div>
              <button className="px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors" disabled>
                Editar Template
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
