"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Clock } from "lucide-react"
import { getCorreosPickupCutoffAction } from "@/app/actions/correos"

type Result = Awaited<ReturnType<typeof getCorreosPickupCutoffAction>>
const lisbonNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map(x => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) }
}
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** Correos same-day cut-off from their API (consultarHoraCorte). Advisory only: Correos still decides. */
export function CorreosCutoffNotice({ connectionId, postalCode, country, date }: { connectionId?: string; postalCode: string; country: string; date: string }) {
  const [state, setState] = useState<{ key: string; result: Result } | null>(null)
  const [now, setNow] = useState<ReturnType<typeof lisbonNow> | null>(null)
  const key = `${connectionId}|${country}|${postalCode}`
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      getCorreosPickupCutoffAction(connectionId, postalCode, country)
        .catch(() => ({ success: false as const, error: "Não foi possível consultar a Correos Express." }))
        .then(result => { if (!cancelled) setState({ key, result }) })
    }, 600)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [key, connectionId, postalCode, country])
  useEffect(() => {
    const first = setTimeout(() => setNow(lisbonNow()), 0)
    const timer = setInterval(() => setNow(lisbonNow()), 30_000)
    return () => { clearTimeout(first); clearInterval(timer) }
  }, [])

  const result = state?.key === key ? state.result : null
  if (!result || !now) return <p className="mt-3 text-xs text-[var(--text-secondary)]">A consultar a hora-limite na Correos Express…</p>
  if (!result.success) return <p role="status" className="mt-3 rounded-lg border border-[var(--border-strong)] p-3 text-xs text-[var(--text-secondary)]">Hora-limite por confirmar: {result.error}</p>

  const today = date === now.date
  const left = toMinutes(result.cutoff) - now.minutes
  const late = date < now.date || (today && left <= 0)
  const soon = today && !late && left <= 30
  const title = date < now.date ? "A data de recolha já passou"
    : today ? (late ? `Hora-limite de hoje atingida (${result.cutoff})` : soon ? `Faltam ${left} min para a hora-limite` : `Pedido para hoje: hora-limite ${result.cutoff}`)
    : `Pedido até às ${result.cutoff} no dia da recolha`
  const colors = late ? "border-red-300 bg-red-50 text-red-900" : soon ? "border-amber-300 bg-amber-50 text-amber-950" : "border-[var(--border-strong)] bg-[var(--surface-bg)] text-[var(--text-primary)]"
  const Icon = late || soon ? AlertTriangle : Clock
  return <div role={late || soon ? "alert" : "status"} aria-live="polite" className={`mt-3 flex items-start gap-2.5 rounded-lg border p-3 ${colors}`}>
    <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    <div className="min-w-0">
      <p className="text-xs font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed">{late && today ? "A Correos pode recusar a recolha para hoje. Escolha outra data. " : ""}Hora-limite {result.cutoff}{result.lastCall ? ` · última chamada ${result.lastCall}` : ""} · CP {postalCode}.</p>
      <p className="mt-1 text-[11px] opacity-80">Fonte: Correos Express (consultarHoraCorte) · sujeito à aceitação da transportadora.</p>
    </div>
  </div>
}
