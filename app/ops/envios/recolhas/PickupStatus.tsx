"use client"

import * as React from "react"
import { markPickupCollectedAction } from "@/app/actions/pickups"
import { CheckCircle2 } from "lucide-react"
import { formatPickupRequestTime, type PickupSummary } from "@/lib/pickup-management"

export function PickupStatus({ pickup, onUpdated }: { pickup: PickupSummary; onUpdated?: (pickup: PickupSummary) => void }) {
  const [marking, setMarking] = React.useState(false)
  const [error, setError] = React.useState("")
  const manual = pickup.status === "Realizado" ? pickup.manual_confirmation : undefined
  const canMark = pickup.source === "tms" && ["Agendado", "pendente"].includes(pickup.status)
  const label = manual ? "Recolhida" : pickup.status
  const completed = pickup.status === "Realizado" || (pickup.source === "ctt" && pickup.ctt_status?.state === "completed")
  const color = completed ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : pickup.status === "Cancelado" ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-slate-50 text-slate-700"

  const markCollected = async () => {
    setMarking(true); setError("")
    try {
      const result = await markPickupCollectedAction(pickup.id)
      if (result.success) onUpdated?.(result.pickup)
      else setError(result.error)
    } catch { setError("Não foi possível confirmar a recolha. Atualize a página para verificar o estado antes de repetir.") }
    finally { setMarking(false) }
  }

  return <div className="min-w-40 space-y-1.5">
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${color}`}>{label}</span>
    {manual && <p className="max-w-64 text-[11px] text-[var(--text-secondary)]">Confirmada manualmente por {manual.confirmed_by}<br />{formatPickupRequestTime(manual.confirmed_at)}</p>}
    {canMark && <button type="button" disabled={marking} onClick={() => void markCollected()} aria-label={`Marcar recolhida a recolha ${pickup.ctt_pickup_id || pickup.id}`} className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
      <CheckCircle2 size={14} />{marking ? "A confirmar…" : "Marcar recolhida"}
    </button>}
    {error && <p role="alert" className="max-w-64 text-xs text-red-700">{error}</p>}
  </div>
}
