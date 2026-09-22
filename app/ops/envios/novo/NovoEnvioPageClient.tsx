"use client"

import * as React from "react"
import { X, Package, User, MapPin, Loader2, CheckCircle2, Weight, Euro } from "lucide-react"
import { emitClientGuiaAction } from "@/app/actions/shipments"

import type { Cliente } from "@/app/ops/entidades/clientes/types"
import type { ServicoLinke } from "@/app/ops/configuracao/servicos/types"

export function NovoEnvioPageClient({ clients, servicosLinke = [] }: { clients: Cliente[], servicosLinke?: ServicoLinke[] }) {
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState("")
  const [selectedClientId, setSelectedClientId] = React.useState("")
  const [selectedServiceId, setSelectedServiceId] = React.useState("")
  const [weightKg, setWeightKg] = React.useState<number>(1)
  const [recipientCountry, setRecipientCountry] = React.useState("PT")
  const [selectedSpecialServices, setSelectedSpecialServices] = React.useState<string[]>([])
  const [codValue, setCodValue] = React.useState<number>(0)

  const currentClient = clients.find(c => c.id === selectedClientId)

  const availableServicos = React.useMemo(() => {
    let active = servicosLinke.filter((s) => s.is_active !== false)
    if (currentClient?.assigned_linke_service_ids && currentClient.assigned_linke_service_ids.length > 0) {
      active = active.filter(s => currentClient.assigned_linke_service_ids!.includes(s.id))
    }
    if (active.length === 0) return []
    if (currentClient?.default_linke_table_id) {
      const match = active.find((s) => s.id === currentClient.default_linke_table_id)
      if (match) {
        return [match, ...active.filter((s) => s.id !== match.id)]
      }
    }
    return active
  }, [servicosLinke, currentClient])

  const activeLinkeService = availableServicos.find((s) => s.id === selectedServiceId) || availableServicos[0]

  const specialServicesAvailable = currentClient?.pricing?.special_services_fees?.filter(f => f.is_enabled) || []

  // Client-side weight-based estimate (display only; server recalculates using assigned table)
  const estimatedTier = (() => {
    if (activeLinkeService?.zones?.[0]?.tiers?.length) {
      const origTiers = activeLinkeService.zones[0].tiers || []
      const tiers = origTiers.filter(t => t.enabled !== false).sort((a, b) => a.weight_max - b.weight_max)
      const tierIndex = tiers.findIndex(t => weightKg <= t.weight_max)
      const matchedTier = tierIndex !== -1 ? tiers[tierIndex] : tiers[tiers.length - 1]
      if (matchedTier) {
        const origIndex = origTiers.indexOf(matchedTier)
        const customPrice = currentClient?.custom_tier_overrides?.[activeLinkeService.id]?.[origIndex]
        const effectiveSell = customPrice !== undefined ? customPrice : matchedTier.sell_price
        return {
          label: matchedTier.label || `Até ${matchedTier.weight_max} Kg`,
          sell: effectiveSell,
          buy: matchedTier.cost_price,
        }
      }
    }
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
      const res = await emitClientGuiaAction({
        clientId: selectedClientId,
        clientName: currentClient?.short_name || currentClient?.legal_name || "Operador",
        senderAddress: formData.get("sender_address") as string || "",
        senderCity: formData.get("sender_city") as string || "",
        senderPostal: formData.get("sender_zip") as string || "",
        recipientName: formData.get("recipient_name") as string,
        recipientAddress: formData.get("recipient_address") as string,
        recipientCity: formData.get("recipient_city") as string,
        recipientPostal: formData.get("recipient_zip") as string,
        weightKg: Number(formData.get("weight_kg")) || 1,
        volumesCount: Number(formData.get("volumes")) || 1,
        lengthCm: Number(formData.get("length_cm")) || 0,
        widthCm: Number(formData.get("width_cm")) || 0,
        heightCm: Number(formData.get("height_cm")) || 0,
        serviceName: activeLinkeService?.name || "Linke Expresso 24H",
        subProductId: activeLinkeService?.webservice_service_code,
        calculatedPrice: estimatedTier.sell,
        selectedSpecialServices: selectedSpecialServices,
        codValue: selectedSpecialServices.includes("cod") ? codValue : undefined
      })
      
      if (!res.success) {
        throw new Error((res as any).error || "Erro ao comunicar com os CTT")
      }
      
      setSuccess(true)
      setTimeout(() => {
        window.location.href = "/ops/envios"
      }, 1500)
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao criar envio.")
      setLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Criar Novo Envio</h2>
              <p className="text-sm text-slate-500">Registar expedição operacional via CTT</p>
            </div>
          </div>
        </div>

        {/* Content */}
        {success ? (
          <div className="p-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">Envio Criado!</h3>
              <p className="text-slate-500 mt-1">O envio e a etiqueta CTT foram gerados com sucesso.</p>
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
                    <select name="client_id" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="">Selecione o Cliente</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.short_name || c.legal_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Serviço/Produto *</label>
                    <select
                      name="service_type"
                      required
                      value={selectedServiceId}
                      onChange={e => setSelectedServiceId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {availableServicos.map(s => (
                        <option key={s.id} value={s.id}>[{s.category}] {s.name}</option>
                      ))}
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
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Comp. (cm)</label>
                    <input
                      type="number"
                      name="length_cm"
                      min="0"
                      step="1"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Largura (cm)</label>
                    <input
                      type="number"
                      name="width_cm"
                      min="0"
                      step="1"
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Altura (cm)</label>
                    <input
                      type="number"
                      name="height_cm"
                      min="0"
                      step="1"
                      placeholder="0"
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

            {specialServicesAvailable.length > 0 && (
              <div className="px-6 pb-6">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-500" />
                  Opções Especiais de Entrega
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {specialServicesAvailable.map(service => {
                    const isSelected = selectedSpecialServices.includes(service.special_service_code);
                    return (
                      <div key={service.special_service_code} className={`border rounded-lg p-3 cursor-pointer transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300 bg-white'}`} onClick={() => {
                        if (isSelected) {
                          setSelectedSpecialServices(prev => prev.filter(s => s !== service.special_service_code));
                        } else {
                          setSelectedSpecialServices(prev => [...prev, service.special_service_code]);
                        }
                      }}>
                        <div className="flex items-center gap-2 mb-1">
                          <input type="checkbox" checked={isSelected} readOnly className="rounded text-blue-600 focus:ring-blue-500" />
                          <span className="text-sm font-bold text-slate-700">{service.special_service_name.split(" ")[0]}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 pl-6 leading-tight">{service.description}</p>
                        
                        {isSelected && service.special_service_code === "cod" && (
                          <div className="mt-2 pl-6" onClick={e => e.stopPropagation()}>
                            <label className="text-[10px] font-semibold text-slate-600 block mb-1">Valor a Cobrar (€)</label>
                            <input 
                              type="number" 
                              step="0.01" 
                              min="0"
                              value={codValue}
                              onChange={(e) => setCodValue(Number(e.target.value))}
                              className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                              required
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => window.history.back()}
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
                Emitir Envio & Etiqueta
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
