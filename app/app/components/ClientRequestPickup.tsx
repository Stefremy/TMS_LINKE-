"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Calendar, Truck, CheckCircle2, Building2, Clock, MapPin, Package, ArrowLeft } from "lucide-react"
import { getClientesAction } from "@/app/actions/clientes"
import { Cliente } from "@/app/ops/entidades/clientes/types"

export function ClientRequestPickup() {
  const searchParams = useSearchParams()
  const clientId = searchParams.get("clientId")
  const clientNameParam = searchParams.get("clientName")

  const [currentClient, setCurrentClient] = React.useState<Cliente | null>(null)
  const [pickupDate, setPickupDate] = React.useState(new Date().toISOString().split("T")[0])
  const [pickupVolumes, setPickupVolumes] = React.useState("2")
  const [pickupWeight, setPickupWeight] = React.useState("5.0")
  const [pickupTimeSlot, setPickupTimeSlot] = React.useState("tarde")
  const [notes, setNotes] = React.useState("")
  const [pickupSuccess, setPickupSuccess] = React.useState(false)
  const [pickupId, setPickupId] = React.useState<string | null>(null)

  React.useEffect(() => {
    getClientesAction().then((clients) => {
      let target: Cliente | undefined
      if (clientId) {
        target = clients.find((c) => c.id === clientId)
      }
      if (!target && clientNameParam) {
        const decoded = decodeURIComponent(clientNameParam).toLowerCase()
        target = clients.find((c) => c.short_name.toLowerCase() === decoded || c.legal_name.toLowerCase() === decoded)
      }
      if (!target && clients.length > 0) {
        target = clients[0]
      }
      if (target) {
        setCurrentClient(target)
      }
    })
  }, [clientId, clientNameParam])

  const querySuffix = React.useMemo(() => {
    if (!currentClient) return ""
    return `?clientId=${encodeURIComponent(currentClient.id || "")}&clientName=${encodeURIComponent(currentClient.short_name || "")}`
  }, [currentClient])

  const senderAddress = currentClient?.address 
    ? `${currentClient.address}, ${currentClient.postal_code} ${currentClient.city}` 
    : "Sede Comercial da Empresa"

  const handleConfirmPickup = (e: React.FormEvent) => {
    e.preventDefault()
    const newPickupCode = `REC-CTT-${Math.floor(100000 + Math.random() * 900000)}`
    setPickupId(newPickupCode)
    setPickupSuccess(true)
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <Link href={`/app${querySuffix}`} className="hover:text-emerald-700">Painel Principal</Link>
            <span>&gt;</span>
            <span className="text-indigo-600 font-bold">Pedir Recolha CTT</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Agendar Recolha de Mercadoria</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Agende a passagem do estafeta CTT Expresso nas suas instalações para levantamento de volumes.
          </p>
        </div>

        {currentClient && (
          <div className="flex items-center gap-2.5 bg-white border border-slate-200 px-4 py-2 rounded-2xl shadow-2xs text-xs">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <span className="font-bold text-slate-900">{currentClient.short_name}</span>
          </div>
        )}
      </div>

      {/* Success Banner */}
      {pickupSuccess && (
        <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                <span>Pedido de Recolha Registado!</span>
                <span className="font-mono text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-bold">
                  {pickupId}
                </span>
              </div>
              <p className="text-xs text-emerald-800">
                O estafeta CTT passará na data e período indicados.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPickupSuccess(false)}
            className="text-emerald-800 hover:text-emerald-950 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-100 cursor-pointer"
          >
            Novo Pedido
          </button>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <form onSubmit={handleConfirmPickup} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Data Pretendida para Recolha *</label>
              <input 
                type="date" 
                required
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Período de Recolha CTT</label>
              <select
                value={pickupTimeSlot}
                onChange={(e) => setPickupTimeSlot(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="manha">Manhã (09h00 às 13h00)</option>
                <option value="tarde">Tarde (14h00 às 18h00)</option>
                <option value="dia_todo">Qualquer hora útil (09h00 às 19h00)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Nº de Volumes Previstos *</label>
              <input 
                type="number" 
                min="1"
                required
                value={pickupVolumes}
                onChange={(e) => setPickupVolumes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Peso Total Estimado (kg)</label>
              <input 
                type="number" 
                step="0.5"
                min="0.5"
                value={pickupWeight}
                onChange={(e) => setPickupWeight(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-700">Morada de Recolha (Instalações)</label>
              <input 
                type="text" 
                defaultValue={senderAddress}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold text-slate-700">Instruções Adicionais para o Estafeta</label>
              <textarea 
                rows={3}
                placeholder="Ex: Tocar à campainha do armazém 2 / Cais das traseiras"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" 
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <Link
              href={`/app${querySuffix}`}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Cancelar
            </Link>

            <button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-3 rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span>Confirmar Pedido de Recolha CTT</span>
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
