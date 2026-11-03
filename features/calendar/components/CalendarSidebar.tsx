"use client";
import { useId, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { CalendarCollaborator, CalendarEvent } from "../types";
import { collaboratorColor } from "../types";
import {
  addDays,
  eventsOnDay,
  formatDate,
  monthDays,
  navigateDate,
  startOfMonth,
} from "../lib/dates";
import s from "./calendar.module.css";
export function CalendarSidebar({
  date,
  today,
  collaborators,
  events,
  selection,
  mine,
  onSelection,
  onMine,
  onDate,
  onNew,
  holidays,
  onHolidays,
}: {
  date: string;
  today: string;
  collaborators: CalendarCollaborator[];
  events: CalendarEvent[];
  selection: string[];
  mine: boolean;
  onSelection: (ids: string[]) => void;
  onMine: (value: boolean) => void;
  onDate: (day: string) => void;
  onNew: () => void;
  holidays: string[];
  onHolidays: (countries: string[]) => void;
}) {
  const id = useId(),
    [month, setMonth] = useState(startOfMonth(date)),
    days = monthDays(month);
  const checked = (id: string) => !selection.length || selection.includes(id);
  function toggle(id: string) {
    const next = (
      selection.length ? selection : collaborators.map((c) => c.id)
    ).filter((value) => value !== id);
    if (!checked(id)) next.push(id);
    onSelection(next.length ? next : ["__none__"]);
  }
  return (
    <>
      <button
        className={`${s.action} ${s.primary} ${s.fullWidth}`}
        onClick={onNew}
      >
        <Plus size={15} />
        Novo evento
      </button>
      <div>
        <div className={s.miniHeader}>
          <button
            className={s.iconButton}
            aria-label="Mês anterior no minicalendário"
            onClick={() => setMonth(navigateDate(month, "month", -1))}
          >
            <ChevronLeft size={14} />
          </button>
          <span>{formatDate(month, { month: "long", year: "numeric" })}</span>
          <button
            className={s.iconButton}
            aria-label="Mês seguinte no minicalendário"
            onClick={() => setMonth(navigateDate(month, "month", 1))}
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div className={s.miniGrid} aria-label="Escolher data">
          {["S", "T", "Q", "Q", "S", "S", "D"].map((day, index) => (
            <span
              key={index}
              className="text-center text-[10px] text-[var(--text-secondary)]"
            >
              {day}
            </span>
          ))}
          {days.map((day) => (
            <button
              key={day}
              tabIndex={
                day === date || (!days.includes(date) && day === month) ? 0 : -1
              }
              data-mini-day={day}
              className={`${s.miniDay} ${day.slice(0, 7) !== month.slice(0, 7) ? s.otherMonth : ""}`}
              data-selected={day === date}
              data-today={day === today}
              aria-label={formatDate(day, { dateStyle: "full" })}
              aria-pressed={day === date}
              onClick={() => {
                setMonth(startOfMonth(day));
                onDate(day);
              }}
              onKeyDown={(event) => {
                const delta = (
                  {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                  } as Record<string, number>
                )[event.key];
                if (delta) {
                  event.preventDefault();
                  const next = addDays(day, delta);
                  const button = document.querySelector<HTMLButtonElement>(
                    `[data-mini-day="${next}"]`,
                  );
                  if (button) button.focus();
                  else {
                    setMonth(startOfMonth(next));
                    requestAnimationFrame(() =>
                      document
                        .querySelector<HTMLButtonElement>(
                          `[data-mini-day="${next}"]`,
                        )
                        ?.focus(),
                    );
                  }
                }
              }}
            >
              {Number(day.slice(8))}
              {eventsOnDay(events, day).length > 0 && (
                <span className={s.miniMarker} />
              )}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className={s.filterTitle}>Calendários da equipa</h3>
        <div className={s.filterList}>
          <label className={s.filter}>
            <Checkbox
              checked={!selection.length}
              onCheckedChange={(value) =>
                onSelection(value ? [] : ["__none__"])
              }
            />
            Todos os colaboradores
          </label>
          {collaborators.map((person) => (
            <label key={person.id} className={s.filter}>
              <Checkbox
                checked={checked(person.id)}
                style={{
                  borderColor: person.color || collaboratorColor(person.id),
                  backgroundColor: checked(person.id)
                    ? person.color || collaboratorColor(person.id)
                    : undefined,
                }}
                onCheckedChange={() => toggle(person.id)}
              />
              <span
                className={s.dot}
                style={{
                  background: person.color || collaboratorColor(person.id),
                }}
              />
              <span className={s.truncate}>{person.name}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
        <label
          htmlFor={`${id}-mine`}
          className="text-xs"
          title="Eventos criados por mim ou atribuídos a mim"
        >
          Meus eventos
        </label>
        <Switch id={`${id}-mine`} checked={mine} onCheckedChange={onMine} />
      </div>
      <div>
        <h3 className={s.filterTitle}>Feriados e referências</h3>
        <div className={s.filterList}>
          {(["PT", "ES"] as const).map((country) => (
            <label key={country} className={s.filter}>
              <Checkbox
                checked={holidays.includes(country)}
                onCheckedChange={(checked) =>
                  onHolidays(
                    checked
                      ? [...holidays, country]
                      : holidays.filter((value) => value !== country),
                  )
                }
              />
              {country === "PT" ? "Portugal" : "Espanha"}
            </label>
          ))}
        </div>
      </div>
      <div className={s.legend}>
        <h3 className={s.filterTitle}>Legenda</h3>
        <p>
          <span className={s.dot} style={{ background: "#38664b" }} />A cor
          identifica o colaborador
        </p>
        <p>
          <CalendarDays size={12} />
          Os eventos de vários dias ficam ligados
        </p>
      </div>
      <p className={s.sidebarBottom}>
        Organize a equipa, as recolhas e as entregas num só calendário.
      </p>
    </>
  );
}
