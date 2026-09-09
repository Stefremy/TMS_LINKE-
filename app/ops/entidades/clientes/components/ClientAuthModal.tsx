"use client"

import * as React from "react"
import { X, Key } from "lucide-react"
import { setClientPasswordAction } from "@/app/actions/auth"

interface ClientAuthModalProps {
  clientId: string
  clientName: string
  clientEmail?: string
  onClose: () => void
}

export function ClientAuthModal({ clientId, clientName, clientEmail, onClose }: ClientAuthModalProps) {
  const [email, setEmail] = React.useState(clientEmail || "")
  const [password, setPassword] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [success, setSuccess] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    try {
      const res = await setClientPasswordAction(clientId, email, password)
      setSuccess(res.message)
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Acesso Portal</h2>
              <p className="text-xs text-slate-500">{clientName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg">
                {success}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Email de Login
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="email@empresa.pt"
              />
              <p className="text-[11px] text-slate-500 mt-1">Este email será usado para entrar no portal de cliente.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="Deixar em branco para manter a atual..."
              />
              <p className="text-[11px] text-slate-500 mt-1">Preencha apenas se quiser definir/alterar a password do cliente.</p>
            </div>

          </div>

          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? "A Guardar..." : "Guardar Acesso"}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
