"use client"

import * as React from "react"
import { X, Calendar, MapPin, Package, Loader2, CheckCircle2 } from "lucide-react"
import { scheduleCttPickupAction } from "@/app/actions/ctt"

export function NovaRecolhaModal({ onClose, clients = [] }: { onClose: () => void, clients?: any[] }) {
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<any>(null)

  // Form state
  const [date, setDate] = React.useState(new Date(Date.now() + 86400000).toISOString().split('T')[0])
  const [startHour, setStartHour] = React.useState("09:00")
  const [endHour, setEndHour] = React.useState("18:00")
  const [volumes, setVolumes] = React.useState(1)
  const [weightKg, setWeightKg] = React.useState(1)
  const [heaviestWeight, setHeaviestWeight] = React.useState("")
  const [destination, setDestination] = React.useState("PT")
  const [needsGuide, setNeedsGuide] = React.useState(true)
  const [observations, setObservations] = React.useState("")

  const [senderName, setSenderName] = React.useState("Armazém Principal")
  const [senderContact, setSenderContact] = React.useState("")
  const [senderEmail, setSenderEmail] = React.useState("")
  const [senderAddress, setSenderAddress] = React.useState("Rua do Ouro, 100")
  const [senderCountry, setSenderCountry] = React.useState("PT")
  const [senderZip, setSenderZip] = React.useState("4000-001")
  const [senderCity, setSenderCity] = React.useState("Porto")
  const [senderPhone, setSenderPhone] = React.useState("910000000")

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    if (!selectedId) return
    const client = clients.find(c => c.id === selectedId)
    if (client) {
      setSenderName(client.name || "")
      setSenderContact(client.name || "") // Defaults to same
      setSenderEmail(client.email || "")
      setSenderAddress(client.address || "")
      setSenderZip(client.zip_code || "")
      setSenderCity(client.city || "")
      setSenderPhone(client.phone || "")
    }
  }

  const handleSchedule = async () => {
    setLoading(true)
    try {
      const res = await scheduleCttPickupAction({
        date,
        startHour,
        endHour,
        volumes,
        weightKg,
        observations: `${observations}${needsGuide ? " | Necessário levar guia de transporte" : ""}${heaviestWeight ? ` | Objeto mais pesado: ${heaviestWeight}kg` : ""}${destination !== "PT" ? ` | Destino: ${destination}` : ""}`,
        sender: { 
          name: senderName,
          contact: senderContact,
          email: senderEmail,
          country: senderCountry,
          address: senderAddress, 
          zip: senderZip, 
          city: senderCity, 
          phone: senderPhone 
        }
      })
      setResult(res)
    } catch (err: any) {
      setResult({ Success: false, message: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Nova Recolha CTT</h3>
              <p className="text-xs text-slate-500">Agendar pedido de recolha (RecolhasWS)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <div className="text-sm font-semibold text-slate-700">A comunicar com Web Service CTT...</div>
            </div>
          ) : result?.Success ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-800">Recolha Agendada com Sucesso!</h4>
                  <p className="text-xs text-emerald-700 mt-1">O pedido de recolha foi registado nos CTT.</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">ID da Recolha (PickUpID):</span>
                  <span className="font-mono font-bold text-slate-800">{result.PickUpID}</span>
                </div>
              </div>

              <button 
                onClick={onClose}
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 rounded text-sm transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {result && !result.Success && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {result.message || "Falha ao agendar recolha CTT"}
                </div>
              )}
              
              <div className="space-y-3">
                {clients.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Preenchimento Automático (Cliente)</label>
                    <select 
                      onChange={handleClientChange}
                      className="w-full border rounded px-2 py-1.5 text-sm bg-slate-50 border-blue-200 text-blue-900 focus:ring-blue-500 font-medium"
                    >
                      <option value="">-- Selecionar Cliente --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Data</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Horário</label>
                    <div className="flex items-center gap-1">
                      <input type="time" value={startHour} onChange={e => setStartHour(e.target.value)} className="w-full border rounded px-1 py-1.5 text-sm" />
                      <span className="text-xs text-slate-400">às</span>
                      <input type="time" value={endHour} onChange={e => setEndHour(e.target.value)} className="w-full border rounded px-1 py-1.5 text-sm" />
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Local de Recolha (Remetente)</h4>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Nome</label>
                        <input type="text" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Nome da Empresa/Pessoa" className="w-full border rounded px-2 py-1.5 text-sm font-medium" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Nome de Contacto</label>
                        <input type="text" value={senderContact} onChange={e => setSenderContact(e.target.value)} placeholder="Pessoa a contactar" className="w-full border rounded px-2 py-1.5 text-sm" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">País</label>
                      <select value={senderCountry} onChange={e => setSenderCountry(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                        <option value="PT">PORTUGAL</option>
                        <option value="ES">ESPANHA</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Morada</label>
                      <input type="text" value={senderAddress} onChange={e => setSenderAddress(e.target.value)} placeholder="Morada completa" className="w-full border rounded px-2 py-1.5 text-sm mb-2" />
                      <div className="flex gap-2">
                        <input type="text" value={senderZip} onChange={e => setSenderZip(e.target.value)} placeholder="Código Postal" className="w-1/3 border rounded px-2 py-1.5 text-sm" />
                        <input type="text" value={senderCity} onChange={e => setSenderCity(e.target.value)} placeholder="Localidade" className="w-2/3 border rounded px-2 py-1.5 text-sm" />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Email</label>
                        <input type="email" value={senderEmail} onChange={e => setSenderEmail(e.target.value)} placeholder="email@exemplo.pt" className="w-full border rounded px-2 py-1.5 text-sm" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Telefone / Telemóvel</label>
                        <input type="text" value={senderPhone} onChange={e => setSenderPhone(e.target.value)} placeholder="Nº Contacto" className="w-full border rounded px-2 py-1.5 text-sm" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Dados de Recolha</h4>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="w-1/3">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Quantidade</label>
                        <input type="number" value={volumes} onChange={e => setVolumes(Number(e.target.value))} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </div>
                      <div className="w-1/3">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Peso Total (kg)</label>
                        <input type="number" value={weightKg} onChange={e => setWeightKg(Number(e.target.value))} className="w-full border rounded px-2 py-1.5 text-sm" />
                      </div>
                      <div className="w-1/3">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Peso Mais Pesado</label>
                        <input type="number" value={heaviestWeight} onChange={e => setHeaviestWeight(e.target.value)} placeholder="(Opcional)" className="w-full border rounded px-2 py-1.5 text-sm" />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-slate-600 block mb-1">Destino</label>
                        <select value={destination} onChange={e => setDestination(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                          <option value="PT">Portugal</option>
                          <option value="ES">Espanha</option>
                          <option value="ROW">Resto do Mundo</option>
                        </select>
                      </div>
                      <div className="flex-1 flex items-end pb-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={needsGuide} onChange={e => setNeedsGuide(e.target.checked)} className="rounded border-slate-300" />
                          <span className="text-xs font-semibold text-slate-700">Necessário levar guia</span>
                        </label>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Observações</label>
                      <input type="text" value={observations} onChange={e => setObservations(e.target.value)} placeholder="Instruções adicionais..." className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button onClick={onClose} className="px-4 py-2 rounded text-sm text-slate-600 hover:bg-slate-100 font-semibold">Cancelar</button>
                <button onClick={handleSchedule} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-semibold shadow-sm transition-colors">
                  Agendar nos CTT
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
