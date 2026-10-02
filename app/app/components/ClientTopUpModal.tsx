"use client"

import * as React from "react"
import { CreditCard, X, AlertCircle, ShieldCheck } from "lucide-react"

interface ClientTopUpModalProps {
  isOpen: boolean
  onClose: () => void
  clientId: string
}

export function ClientTopUpModal({ isOpen, onClose, clientId }: ClientTopUpModalProps) {
  const [amount, setAmount] = React.useState<number | "">("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  if (!isOpen) return null

  const handleQuickAmount = (val: number) => {
    setAmount(val)
  }

  const handleCheckout = async () => {
    const val = Number(amount)
    if (val < 1) {
      setError("O valor mínimo é 1€.")
      return
    }

    try {
      setIsLoading(true)
      setError("")
      
      const { createTopUpCheckoutSession } = await import("@/app/actions/stripe")
      const result = await createTopUpCheckoutSession(clientId, val)
      
      if (result.success && result.url) {
        window.location.href = result.url
      } else {
        setError(result.error || "Ocorreu um erro ao ligar ao provedor de pagamentos.")
        setIsLoading(false)
      }
    } catch {
      setError("Erro de rede. Tente novamente.")
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--surface-bg)] rounded-xl shadow-xl w-full max-w-md overflow-hidden relative border border-[var(--border-subtle)]">
        
        {/* Top 1px Accent Line */}
        <div className="h-1 w-full bg-[var(--accent)]" />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-[var(--border-subtle)] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--surface-muted)] text-[var(--accent)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Carregar Saldo</h2>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                Adicione fundos à sua conta corrente com segurança
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Quick Amounts */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2.5">
              Valores Rápidos
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[20, 50, 100].map((val) => {
                const isSelected = amount === val
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickAmount(val)}
                    className={`py-2 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-2xs"
                        : "border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {val}€
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom Amount */}
          <div>
            <label className="block text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
              Ou introduza outro montante (€)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <span className="text-[var(--text-tertiary)] font-bold text-sm font-mono">€</span>
              </div>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || "")}
                placeholder="Ex: 50"
                className="w-full border border-[var(--border-subtle)] rounded-lg pl-8 pr-3 py-2 text-base font-mono font-bold text-[var(--text-primary)] bg-[var(--surface-muted)] focus:bg-white focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] outline-none transition-all"
              />
            </div>
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-[var(--status-critical)] bg-[var(--status-critical-soft)] border border-[rgba(239,68,68,0.2)] p-3 rounded-lg text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2 space-y-3">
            <button
              onClick={handleCheckout}
              disabled={isLoading || !amount || Number(amount) < 1}
              className="w-full flex items-center justify-center py-2.5 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold rounded-lg transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? "A carregar sessão..." : `Avançar para Pagamento ${amount ? `(${amount}€)` : ""}`}
            </button>
            
            <div className="pt-1 flex flex-col items-center justify-center gap-1.5 text-center">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-tertiary)]">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Processamento Seguro via Stripe</span>
              </div>
              <p className="text-[10px] text-[var(--text-tertiary)]">
                Aceita MB WAY, Multibanco, Cartões de Crédito e Débito.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
