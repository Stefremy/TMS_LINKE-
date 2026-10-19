"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Clock } from "lucide-react"
import { getCttPickupCutoff } from "@/lib/ctt-pickup-cutoff"

export function PickupCutoffNotice(props: { postalCode: string; country: string; destination: string; date: string; period: string }) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0)
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => { clearTimeout(first); clearInterval(timer) }
  }, [])
  if (!now) return <p className="mt-3 text-xs text-[var(--text-secondary)]">A verificar a hora-limite de recolha…</p>
  const notice = getCttPickupCutoff(props, now)
  const late = notice.state === "passed" || notice.state === "past"
  const warn = late || notice.state === "soon"
  const colors = late ? "border-red-300 bg-red-50 text-red-900" : notice.state === "soon" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-[var(--border-strong)] bg-[var(--surface-bg)] text-[var(--text-primary)]"
  const Icon = warn ? AlertTriangle : Clock
  return <div role={warn ? "alert" : "status"} aria-live="polite" className={`mt-3 flex items-start gap-2.5 rounded-lg border p-3 ${colors}`}>
    <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    <div className="min-w-0"><p className="text-xs font-semibold">{notice.title}</p><p className="mt-1 text-xs leading-relaxed">{notice.message}</p><p className="mt-1 text-[11px] opacity-80">{notice.ruleSource === "channel" ? "Tabela CTT por canal e destino" : notice.ruleSource === "postal" ? "Tabela CTT por código postal" : "Referência CTT"} · sujeito à aceitação e disponibilidade da transportadora.</p></div>
  </div>
}
