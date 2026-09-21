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
    } catch (err: any) {
      setError("Erro de rede. Tente novamente.")
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative border border-slate-100">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-full p-1.5 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="pt-8 pb-6 px-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center text-center border-b border-indigo-50 relative overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-blob"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-blob animation-delay-2000"></div>
          
          <div className="relative">
            <div className="w-16 h-16 bg-white shadow-md text-indigo-600 rounded-2xl flex items-center justify-center mb-4 transform rotate-3">
              <CreditCard className="w-8 h-8 transform -rotate-3" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-1">Carregar Saldo</h2>
          <p className="text-sm text-slate-500 font-medium max-w-[250px]">
            Adiciona fundos à tua conta rapidamente e com segurança.
          </p>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Valores Rápidos</label>
              <div className="grid grid-cols-3 gap-3">
                {[10, 20, 50].map(val => (
                  <button
                    key={val}
                    onClick={() => handleQuickAmount(val)}
                    className={`py-2.5 rounded-2xl border-2 text-sm font-black transition-all ${
                      amount === val 
                        ? "bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm transform scale-[1.02]" 
                        : "bg-white border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {val}€
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Ou insere outro valor (€)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-slate-400 font-bold text-lg">€</span>
                </div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || "")}
                  placeholder="15"
                  className="w-full border-2 border-slate-100 rounded-2xl pl-9 pr-4 py-3.5 text-xl font-black text-slate-900 focus:border-indigo-600 focus:ring-0 outline-none transition-colors"
                />
              </div>
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3.5 rounded-xl text-xs font-bold animate-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>

          <div className="mt-8 space-y-4">
            <button
              onClick={handleCheckout}
              disabled={isLoading || !amount || Number(amount) < 1}
              className="relative w-full flex items-center justify-center py-4 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/10 w-full translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 ease-in-out"></div>
              {isLoading ? "A carregar..." : "Avançar para Pagamento"}
            </button>
            
            <div className="flex items-center justify-center gap-4 text-slate-300">
              <div className="h-[1px] w-full bg-slate-100"></div>
              <span className="text-[10px] font-bold uppercase tracking-widest shrink-0 text-slate-400">Pagamento Seguro</span>
              <div className="h-[1px] w-full bg-slate-100"></div>
            </div>

            <div className="flex flex-col items-center justify-center gap-2">
              <div className="flex items-center gap-3">
                <img src="/stripe-3.svg" alt="Stripe" className="h-6 opacity-60 grayscale" />
              </div>
              <p className="text-[10px] font-semibold text-slate-400 text-center">
                Aceita <span className="font-bold text-slate-600">MB WAY</span>, <span className="font-bold text-slate-600">Multibanco</span>, Cartões de Crédito, Apple Pay e Google Pay.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
