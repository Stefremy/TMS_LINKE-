import * as React from "react"
import { TeamCalendar } from "../components/TeamCalendar"

export const metadata = {
  title: "Calendário | Linke TMS",
}

export default function CalendarioPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-theme(spacing.16))] p-4 md:p-6 max-w-[1600px] mx-auto w-full gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Planeamento da equipa</p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Calendário</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Eventos internos e feriados que podem afetar operações em Portugal e Espanha.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <TeamCalendar />
      </div>
    </div>
  )
}
