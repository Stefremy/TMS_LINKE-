"use client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import type { CalendarEvent } from "../types";
import { addDays, eventsOnDay, formatDate, monthDays } from "../lib/dates";
import { EventChip } from "./EventChip";
import s from "./calendar.module.css";
export function MonthView({
  date,
  today,
  events,
  onNew,
  onOpen,
  onDate,
}: {
  date: string;
  today: string;
  events: CalendarEvent[];
  onNew: (date: string) => void;
  onOpen: (event: CalendarEvent) => void;
  onDate: (date: string) => void;
}) {
  const days = monthDays(date),
    weeks = Array.from({ length: days.length / 7 }, (_, i) =>
      days.slice(i * 7, i * 7 + 7),
    );
  return (
    <div className={s.monthScroller}>
      <div
        role="grid"
        aria-label={formatDate(date, { month: "long", year: "numeric" })}
      >
        <div role="row" className={s.weekdays}>
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => (
            <div key={day} role="columnheader">
              {day}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div role="row" className={s.monthRow} key={week[0]}>
            {week.map((day) => {
              const entries = eventsOnDay(events, day);
              return (
                <div
                  role="gridcell"
                  aria-label={formatDate(day, { dateStyle: "full" })}
                  aria-selected={day === date}
                  data-today={day === today}
                  key={day}
                  className={s.dayCell}
                  onClick={(event) => {
                    if (!(event.target as HTMLElement).closest("button,a"))
                      onNew(day);
                  }}
                >
                  <button
                    tabIndex={day === date ? 0 : -1}
                    data-calendar-day={day}
                    className={`${s.dayNumber} ${day.slice(0, 7) !== date.slice(0, 7) ? s.otherMonth : ""}`}
                    data-today={day === today}
                    onClick={() => onNew(day)}
                    aria-label={`Criar evento em ${formatDate(day, { dateStyle: "full" })}`}
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
                        const next = addDays(day, delta),
                          node = document.querySelector<HTMLButtonElement>(
                            `[data-calendar-day="${next}"]`,
                          );
                        if (node) node.focus();
                        else {
                          onDate(next);
                          requestAnimationFrame(() =>
                            document
                              .querySelector<HTMLButtonElement>(
                                `[data-calendar-day="${next}"]`,
                              )
                              ?.focus(),
                          );
                        }
                      }
                    }}
                  >
                    {Number(day.slice(8))}
                  </button>
                  <div className={s.events}>
                    {entries.slice(0, 3).map((event) => (
                      <EventChip event={event} key={event.id} onOpen={onOpen} />
                    ))}
                  </div>
                  {entries.length > 3 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className={s.more}
                          aria-label={`Ver mais ${entries.length - 3} eventos de ${formatDate(day, { dateStyle: "long" })}`}
                        >
                          +{entries.length - 3} mais
                        </button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <p className="mb-2 text-xs font-semibold capitalize">
                          {formatDate(day, { dateStyle: "full" })}
                        </p>
                        <div className="space-y-1">
                          {entries.map((event) => (
                            <PopoverClose key={event.id} asChild>
                              <button
                                className="block w-full rounded-md p-2 text-left text-xs hover:bg-[var(--surface-muted)]"
                                onClick={() => onOpen(event)}
                              >
                                {event.all_day ? "Todo o dia" : event.time} ·{" "}
                                {event.title}
                              </button>
                            </PopoverClose>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
