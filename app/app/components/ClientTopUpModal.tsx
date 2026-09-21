"use client"

import * as React from "react"
import { CreditCard, X, AlertCircle } from "lucide-react"

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
    if (val < 5) {
      setError("O valor mínimo é 5€.")
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
    } catch (err: any) {
      setError("Erro de rede. Tente novamente.")
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3">
            <CreditCard className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Carregar Saldo</h2>
          <p className="text-sm text-slate-500 mt-1 font-medium">Adiciona fundos à tua conta rapidamente e com segurança.</p>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Valores Rápidos</label>
              <div className="grid grid-cols-3 gap-2">
                {[20, 50, 100].map(val => (
                  <button
                    key={val}
                    onClick={() => handleQuickAmount(val)}
                    className={`py-2 rounded-xl border text-sm font-bold transition-colors ${
                      amount === val 
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {val}€
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Ou insere o valor (€)</label>
              <input
                type="number"
                min="5"
                step="1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || "")}
                placeholder="Ex: 15"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-shadow"
              />
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-xs font-bold">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>

          <div className="mt-8">
            <button
              onClick={handleCheckout}
              disabled={isLoading || !amount || Number(amount) < 5}
              className="w-full flex items-center justify-center py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-200 hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "A carregar..." : "Avançar para Pagamento"}
            </button>
            <p className="text-[10px] text-center text-slate-400 font-medium mt-3">
              Processamento seguro via Stripe. Suporta MB WAY e Cartões.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
