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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="relative w-full max-w-md bg-[var(--surface-bg)] rounded-xl shadow-[var(--shadow-layer)] border border-[var(--border-subtle)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="bg-[var(--surface-muted)] border-b border-[var(--border-subtle)] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] border border-[rgba(18,138,71,0.15)] flex items-center justify-center shadow-2xs">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Integração Moloni API</h2>
              <p className="text-[11px] text-[var(--text-tertiary)] font-medium">Software de Faturação Certificado AT</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[var(--surface-bg)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status Atual */}
          {config?.isConnected ? (
            <div className="p-3.5 rounded-lg bg-[var(--status-success-soft)] border border-[rgba(18,138,71,0.2)] flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-[var(--status-success)] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[var(--status-success)]">Moloni Ligado e Operacional</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Empresa: <strong>{config.companyName || "Empresa Principal"}</strong> (ID: {config.companyId})
                </p>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                  As faturas e extratos em lote serão comunicados diretamente à API do Moloni.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
                <span>Client ID API: <strong className="font-mono text-[var(--text-primary)]">{clientId}</strong></span>
              </div>
              <span className="px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent)] text-[10px] font-bold uppercase tracking-wider">
                Chaves Registadas
              </span>
            </div>
          )}

          {/* Mensagens de Feedback */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-[var(--status-critical-soft)] border border-[rgba(220,38,38,0.2)] flex items-center gap-2 text-xs text-[var(--status-critical)]">
              <AlertCircle className="w-4 h-4 text-[var(--status-critical)] shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-[var(--status-success-soft)] border border-[rgba(18,138,71,0.2)] flex items-center gap-2 text-xs text-[var(--status-success)]">
              <CheckCircle2 className="w-4 h-4 text-[var(--status-success)] shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Opção 1: Ligar com 1 Clique (Recomendado) */}
          <div className="p-4 rounded-xl bg-[var(--accent-soft)]/50 border border-[rgba(18,138,71,0.2)] text-center space-y-2.5">
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">Ligar Conta Moloni com 1 Clique</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                Inicie sessão diretamente no site do Moloni para autorizar a emissão das faturas oficiais da AT.
              </p>
            </div>

            <a 
              href={oauthAuthUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-xs rounded-lg transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Cloud className="w-4 h-4" />
              <span>Autorizar no Portal Moloni.pt</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Separador */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[var(--border-subtle)]"></div>
            <span className="shrink mx-3 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">ou introduzir credenciais</span>
            <div className="flex-grow border-t border-[var(--border-subtle)]"></div>
          </div>

          {/* Formulário de Login Direto Moloni */}
          <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                Email / Utilizador da Conta Moloni
              </label>
              <input 
                name="username"
                type="text"
                required
                placeholder="ex: utilizador@linke.pt"
                className="w-full text-xs bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-md px-3 py-2 focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                Palavra-passe da Conta Moloni
              </label>
              <div className="relative">
                <input 
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••••••"
                  className="w-full text-xs bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-md px-3 py-2 pr-8 focus:ring-1 focus:ring-[var(--border-strong)] focus:outline-none transition-colors"
                />
                <Lock className="w-3.5 h-3.5 text-[var(--text-tertiary)] absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                A password é utilizada de forma segura apenas para obter o token de sessão do Moloni e não é guardada em texto limpo.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[var(--text-primary)] hover:bg-black text-white font-bold text-xs rounded-lg transition-colors shadow-2xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  A autenticar com Moloni...
                </>
              ) : (
                <>
                  <Building className="w-3.5 h-3.5" />
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
