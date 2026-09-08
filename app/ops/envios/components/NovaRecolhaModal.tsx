"use client"

import * as React from "react"
import { X, Calendar, MapPin, Package, Loader2, CheckCircle2 } from "lucide-react"
import { scheduleCttPickupAction } from "@/app/actions/ctt"

export function NovaRecolhaModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<any>(null)

  const handleSchedule = async () => {
    setLoading(true)
    try {
      const res = await scheduleCttPickupAction({
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
        startHour: "09:00",
        endHour: "18:00",
        volumes: 2,
        weightKg: 15,
        sender: { 
          name: "Armazém Principal", 
          address: "Rua do Ouro, 100", 
          zip: "4000-001", 
          city: "Porto", 
          phone: "910000000" 
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
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Data</label>
                    <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" defaultValue={new Date(Date.now() + 86400000).toISOString().split('T')[0]} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Horário</label>
                    <div className="flex items-center gap-1">
                      <input type="time" className="w-full border rounded px-1 py-1.5 text-sm" defaultValue="09:00" />
                      <span className="text-xs text-slate-400">às</span>
                      <input type="time" className="w-full border rounded px-1 py-1.5 text-sm" defaultValue="18:00" />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Morada de Recolha</label>
                  <input type="text" className="w-full border rounded px-2 py-1.5 text-sm mb-2" defaultValue="Rua do Ouro, 100" />
                  <div className="flex gap-2">
                    <input type="text" className="w-1/3 border rounded px-2 py-1.5 text-sm" defaultValue="4000-001" />
                    <input type="text" className="w-2/3 border rounded px-2 py-1.5 text-sm" defaultValue="Porto" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Volumes</label>
                    <input type="number" className="w-full border rounded px-2 py-1.5 text-sm" defaultValue={2} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Peso Total (kg)</label>
                    <input type="number" className="w-full border rounded px-2 py-1.5 text-sm" defaultValue={15} />
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
