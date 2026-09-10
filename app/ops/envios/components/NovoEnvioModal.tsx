"use client"

import * as React from "react"
import { X, Package, User, MapPin, Loader2, CheckCircle2, Weight, Euro } from "lucide-react"
import { createShipmentAction } from "@/app/actions/shipments"

interface NovoEnvioModalProps {
  onClose: () => void
  clients: { id: string, name: string }[]
}

export function NovoEnvioModal({ onClose, clients }: NovoEnvioModalProps) {
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState("")
  const [selectedClientId, setSelectedClientId] = React.useState("")
  const [weightKg, setWeightKg] = React.useState<number>(1)
  const [recipientCountry, setRecipientCountry] = React.useState("PT")

  // Client-side weight-based estimate (display only; server recalculates using assigned table)
  const estimatedTier = (() => {
    if (weightKg <= 1)  return { label: "Até 1 Kg",  sell: 3.56, buy: 2.85 }
    if (weightKg <= 2)  return { label: "Até 2 Kg",  sell: 3.94, buy: 3.15 }
    if (weightKg <= 5)  return { label: "Até 5 Kg",  sell: 4.58, buy: 3.75 }
    if (weightKg <= 10) return { label: "Até 10 Kg", sell: 5.61, buy: 4.60 }
    if (weightKg <= 20) return { label: "Até 20 Kg", sell: 7.44, buy: 6.20 }
    if (weightKg <= 30) return { label: "Até 30 Kg", sell: 9.48, buy: 7.90 }
    return { label: "+30 Kg", sell: +(9.48 + (weightKg - 30) * 0.35).toFixed(2), buy: +(7.90 + (weightKg - 30) * 0.28).toFixed(2) }
  })()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg("")
    
    const formData = new FormData(e.currentTarget)
    try {
      await createShipmentAction(formData)
      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao criar envio.")
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Criar Novo Envio</h2>
              <p className="text-sm text-slate-500">Registar expedição para um cliente</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Envio Criado!</h3>
              <p className="text-slate-500 mt-1">O envio foi registado com estado Rascunho/Pendente.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-6 overflow-y-auto flex-1 space-y-8">
              
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                  {errorMsg}
                </div>
              )}

              {/* Price Preview Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800">
                  <Euro className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold">Preço estimado</span>
                  <span className="text-[11px] text-emerald-600">({estimatedTier.label} · tabela padrão)</span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-slate-500">Custo: <span className="font-bold text-slate-700">{estimatedTier.buy.toFixed(2)}€</span></span>
                  <span className="text-emerald-700 font-extrabold text-sm">{estimatedTier.sell.toFixed(2)}€</span>
                </div>
              </div>

              {/* Cliente & Serviço */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" />
                  Detalhes da Expedição
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Cliente *</label>
                    <select name="client_id" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="">Selecione o Cliente</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Serviço/Produto *</label>
                    <select
                      name="service_type"
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="CTT Expresso 24H">CTT Expresso 24H (D+1)</option>
                      <option value="CTT 48H">CTT 48H Económico (D+2)</option>
                      <option value="CTT 5 Dias">CTT 5 Dias (Economy D+5)</option>
                      <option value="CTT Ilhas">CTT Ilhas Expresso</option>
                      <option value="CTT Espanha">CTT Espanha 24H</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                      <Weight className="w-3.5 h-3.5 text-slate-400" />
                      Peso (kg) *
                    </label>
                    <input
                      type="number"
                      name="weight_kg"
                      min="0.1"
                      step="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(Number(e.target.value) || 1)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                      placeholder="1.0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Volumes</label>
                    <input
                      type="number"
                      name="volumes"
                      min="1"
                      defaultValue={1}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Remetente */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    Remetente
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Nome</label>
                      <input type="text" name="sender_name" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Morada</label>
                      <input type="text" name="sender_address" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">C. Postal</label>
                        <input type="text" name="sender_zip" placeholder="Ex: 1000-001" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Localidade</label>
                        <input type="text" name="sender_city" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Destinatário */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-500" />
                    Destinatário
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Nome</label>
                      <input type="text" name="recipient_name" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Morada</label>
                      <input type="text" name="recipient_address" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">C. Postal</label>
                        <input type="text" name="recipient_zip" placeholder="Ex: 4000-001" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600">Localidade</label>
                        <input type="text" name="recipient_city" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">País</label>
                      <select 
                        name="recipient_country" 
                        value={recipientCountry}
                        onChange={(e) => setRecipientCountry(e.target.value)}
                        required 
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="PT">Portugal</option>
                        <option value="ES">Espanha</option>
                        <option value="FR">França</option>
                        <option value="DE">Alemanha</option>
                        <option value="IT">Itália</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-70"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Guardar Envio
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
