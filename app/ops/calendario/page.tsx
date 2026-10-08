import * as React from "react"
import { TeamCalendar } from "../components/TeamCalendar"

export const metadata = {
  title: "Calendário | Linke TMS",
}

export default function CalendarioPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-theme(spacing.16))] p-6 max-w-[1600px] mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Calendário de Operações</h1>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          Gerencie e visualize apontamentos, notas e eventos da equipa de administração.
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <TeamCalendar />
      </div>
    </div>
  )
}
