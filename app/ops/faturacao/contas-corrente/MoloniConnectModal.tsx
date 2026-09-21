"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { X, Cloud, CheckCircle2, ShieldCheck, Lock, ExternalLink, Loader2, Building, AlertCircle } from "lucide-react"
import { connectMoloniWithPasswordAction } from "@/app/actions/moloni"

interface MoloniConnectModalProps {
  isOpen: boolean
  onClose: () => void
  config?: {
    isConnected?: boolean
    companyName?: string
    companyId?: string
    clientId?: string
  }
}

export function MoloniConnectModal({ isOpen, onClose, config }: MoloniConnectModalProps) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  if (!isOpen) return null

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    const formData = new FormData(e.currentTarget)
    const res = await connectMoloniWithPasswordAction(formData)
    setLoading(false)

    if (res.success) {
      setSuccessMsg(`Conta ligada com sucesso à empresa ${res.companyName}!`)
      setTimeout(() => {
        router.refresh()
        onClose()
      }, 1500)
    } else {
      setErrorMsg(res.error || "Falha ao ligar ao Moloni.")
    }
  }

  const clientId = config?.clientId || "518600300"
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  // Moloni developer portal registered callback:
  const registeredCallbackUri = "https://linke-store-ten.vercel.app/api/moloni/callback"
  // Correct Moloni OAuth authorization endpoint
  const oauthAuthUrl = `https://www.moloni.pt/ac/root/oauth/?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(registeredCallbackUri)}&state=${encodeURIComponent(currentOrigin)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div 
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Integração Moloni API</h2>
              <p className="text-xs text-slate-400">Software de Faturação Certificado</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status Atual */}
          {config?.isConnected ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-800">Moloni Ligado e Operacional</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Empresa: <strong>{config.companyName || "Empresa Principal"}</strong> (ID: {config.companyId})
                </p>
                <p className="text-[11px] text-emerald-600 mt-1">
                  As faturas e extratos em lote serão comunicados diretamente à API do Moloni.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Client ID API: <strong>{clientId}</strong></span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                Chaves Registadas
              </span>
            </div>
          )}

          {/* Mensagens de Feedback */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Opção 1: Ligar com 1 Clique (Recomendado) */}
          <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-center space-y-3">
            <div>
              <p className="text-xs font-black text-indigo-950">Ligar Conta Moloni com 1 Clique</p>
              <p className="text-[11px] text-indigo-700 mt-0.5">
                Inicie sessão diretamente no site do Moloni para autorizar a emissão das faturas oficiais da AT.
              </p>
            </div>

            <a 
              href={oauthAuthUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 hover:shadow-md cursor-pointer"
            >
              <Cloud className="w-4 h-4" />
              <span>Autorizar no Portal Moloni.pt</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Separador */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">ou introduzir credenciais</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Formulário de Login Direto Moloni */}
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email / Utilizador da Conta Moloni
              </label>
              <input 
                name="username"
                type="text"
                required
                placeholder="ex: utilizador@linke.pt"
                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Palavra-passe da Conta Moloni
              </label>
              <div className="relative">
                <input 
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••••••"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2.5 pr-8 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                A password é utilizada de forma segura apenas para obter o token de sessão do Moloni e não é guardada em texto limpo.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  A autenticar com Moloni...
                </>
              ) : (
                <>
                  <Building className="w-4 h-4" />
                  {config?.isConnected ? "Atualizar Ligação Moloni" : "Ligar com Password"}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
