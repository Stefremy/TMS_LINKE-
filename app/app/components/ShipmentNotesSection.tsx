"use client"

import * as React from "react"
import { MessageSquareText } from "lucide-react"
import { getShipmentNotesAction, type ShipmentNotes } from "@/app/actions/shipment-notes"

/** Observações / Referência / Notas internas block for the shipment detail ("Dados" tab). */
export function ShipmentNotesSection({ shipmentId }: { shipmentId: string }) {
  const [notes, setNotes] = React.useState<ShipmentNotes | null>(null)
  const [failed, setFailed] = React.useState(false)

  React.useEffect(() => {
    let active = true
    getShipmentNotesAction(shipmentId)
      .then(result => { if (active) { setNotes(result); setFailed(false) } })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [shipmentId])

  const row = (label: string, value: string, hint?: string) => (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">{label}{hint && <span className="ml-1.5 font-medium normal-case tracking-normal text-[var(--text-tertiary)]">{hint}</span>}</p>
      <p className={`whitespace-pre-line break-words text-sm ${value ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}`}>{value || "—"}</p>
    </div>
  )

  return (
    <section aria-label="Observações e referência" className="space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-bg)] p-4">
      <h4 className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]"><MessageSquareText className="h-4 w-4 text-[var(--accent)]" />Observações e referência</h4>
      {failed ? <p className="text-xs text-[var(--text-tertiary)]">Não foi possível carregar as observações.</p>
        : !notes ? <p className="text-xs text-[var(--text-tertiary)]">A carregar…</p>
        : <div className="grid gap-4 sm:grid-cols-2">
            {row("Observações para a transportadora", notes.observations)}
            {row("Referência", notes.reference, "interna")}
            {notes.internalNotes.length > 0 && <div className="sm:col-span-2">{row("Notas internas Ops", notes.internalNotes.join("\n\n"), "só visível à equipa")}</div>}
          </div>}
    </section>
  )
}
