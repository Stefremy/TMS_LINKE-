"use client";
import Link from "next/link";
import { CalendarDays, Plus, Package } from "lucide-react";
import type { CalendarCollaborator, CalendarEvent } from "../types";
import { dateRange, eventsOnDay, formatDate } from "../lib/dates";
import { EventChip } from "./EventChip";
import s from "./calendar.module.css";
export function AgendaView({
  start,
  end,
  events,
  collaborators,
  onOpen,
  onNew,
}: {
  start: string;
  end: string;
  events: CalendarEvent[];
  collaborators: CalendarCollaborator[];
  onOpen: (event: CalendarEvent) => void;
  onNew: (date: string) => void;
}) {
  const groups = dateRange(start, end)
    .map((day) => ({ day, entries: eventsOnDay(events, day) }))
    .filter((group) => group.entries.length);
  if (!groups.length)
    return (
      <div className={s.empty}>
        <span className="rounded-xl border border-[var(--border-subtle)] p-4 text-[var(--text-secondary)]">
          <CalendarDays size={26} />
        </span>
        <h3>Espaço para novos planos</h3>
        <p>Não existem eventos neste período com os filtros selecionados.</p>
        <button
          className={`${s.action} ${s.primary}`}
          onClick={() => onNew(start)}
        >
          <Plus size={14} />
          Criar evento
        </button>
      </div>
    );
  return (
    <div className={s.agenda}>
      {groups.map(({ day, entries }) => (
        <section
          key={day}
          className={s.agendaDay}
          aria-label={formatDate(day, { dateStyle: "full" })}
        >
          <h3 className={s.agendaDate}>
            {formatDate(day, { weekday: "short" })}
            <strong>{Number(day.slice(8))}</strong>
            {formatDate(day, { month: "short" })}
          </h3>
          <div>
            {entries.map((event) => (
              <div key={event.id} className={s.agendaEvent}>
                <div className="min-w-0 flex-1">
                  <EventChip event={event} onOpen={onOpen} />
                  {event.shipment_tracking_number && (
                    <Link
                      className={`${s.guide} mt-1`}
                      href={`/ops/envios?search=${encodeURIComponent(event.shipment_tracking_number)}`}
                    >
                      <Package size={11} />
                      {event.shipment_tracking_number}
                    </Link>
                  )}
                </div>
                <span className={s.person}>
                  {event.holiday_country
                    ? event.holiday_country === "PT"
                      ? "Portugal"
                      : "Espanha"
                    : collaborators.find((c) => c.id === event.collab_id)
                        ?.name || "Colaborador indisponível"}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
