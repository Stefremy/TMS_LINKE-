"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useCalendarReminders } from "../hooks/useCalendarReminders";
import { useCalendarParams } from "../hooks/useCalendarParams";
import {
  useCalendarEvents,
  useCalendarMutation,
} from "../hooks/useCalendarEvents";
import { calendarHolidays } from "../lib/holidays";
import { eventValues } from "../lib/events";
import { navigateDate, visibleRange } from "../lib/dates";
import { collaboratorColors } from "../types";
import type {
  CalendarCollaborator,
  CalendarEvent,
  CalendarViewer,
} from "../types";
import { CalendarSidebar } from "./CalendarSidebar";
import { CalendarToolbar } from "./CalendarToolbar";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { AgendaView } from "./AgendaView";
import { EventSheet } from "./EventSheet";
import s from "./calendar.module.css";
const subscribe = (callback: () => void) => {
  const media = window.matchMedia("(max-width:767px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
};
const snapshot = () => window.matchMedia("(max-width:767px)").matches;
const subscribeHydration = () => () => {};
const hydratedSnapshot = () => true;
const serverSnapshot = () => false;
export function CalendarShell({
  today,
  viewer,
  collaborators,
  directoryError = "",
  initialError = "",
}: {
  today: string;
  viewer: CalendarViewer;
  collaborators: CalendarCollaborator[];
  directoryError?: string;
  initialError?: string;
}) {
  const { params, setParams, explicitView } = useCalendarParams(today);
  const hydrated = useSyncExternalStore(
      subscribeHydration,
      hydratedSnapshot,
      serverSnapshot,
    ),
    mobile = useSyncExternalStore(subscribe, snapshot, serverSnapshot),
    view = mobile && !explicitView ? "agenda" : params.view;
  const [collapsed, setCollapsed] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false);
  const [selection, setSelection] = useState<{
    event?: CalendarEvent;
    draft?: { date: string; time?: string };
  } | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const scope = `${viewer.tenantId}:${viewer.id}`,
    range = visibleRange(view, params.date),
    query = useCalendarEvents(scope, range.start, range.end),
    mutation = useCalendarMutation(scope);
  const coloredCollaborators = collaborators.map((person, index) => ({
    ...person,
    color: collaboratorColors[index % collaboratorColors.length],
  }));
  const colors = new Map(
    coloredCollaborators.map((person) => [person.id, person.color]),
  );
  const allEvents = [
    ...(query.data?.events || []),
    ...calendarHolidays(range.start, range.end).filter((event) =>
      params.holidays.includes(event.holiday_country!),
    ),
  ].map((event) => ({ ...event, color: colors.get(event.collab_id) }));
  const requestedEvent = params.event
    ? allEvents.find((event) => event.id === params.event)
    : undefined;
  const activeSelection =
    selection || (requestedEvent ? { event: requestedEvent } : null);
  const reminders = useCalendarReminders(
    viewer,
    params.holidays,
    (event, date) => {
      void setParams({ date });
      openEvent(event);
    },
  );
  const events = allEvents.filter(
    (event) =>
      (!!event.holiday_country ||
        !params.collab.length ||
        params.collab.includes(event.collab_id)) &&
      (!params.mine ||
        event.creator_id === viewer.id ||
        event.creator_email?.toLowerCase() === viewer.email.toLowerCase() ||
        (!!viewer.collaboratorId && event.collab_id === viewer.collaboratorId)),
  );
  useEffect(() => {
    if (query.error) toast.error(query.error.message);
  }, [query.error]);
  function openNew(date = params.date, time?: string) {
    previousFocus.current = document.activeElement as HTMLElement;
    setFiltersOpen(false);
    setSelection({ draft: { date, time } });
  }
  function openEvent(event: CalendarEvent) {
    previousFocus.current = document.activeElement as HTMLElement;
    setSelection({ event });
  }
  function closeEvent() {
    setSelection(null);
    void setParams({ event: null });
    requestAnimationFrame(() => {
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
      else document.getElementById("calendar-title")?.focus();
    });
  }
  const sidebarProps = {
    date: params.date,
    today,
    collaborators: coloredCollaborators,
    events: allEvents,
    holidays: params.holidays,
    onHolidays: (holidays: string[]) => void setParams({ holidays }),
    selection: params.collab,
    mine: params.mine,
    onSelection: (collab: string[]) => void setParams({ collab }),
    onMine: (mine: boolean) => void setParams({ mine }),
    onDate: (date: string) => {
      void setParams({ date });
      setFiltersOpen(false);
    },
    onNew: () => openNew(),
  };
  const viewProps = {
    date: params.date,
    today,
    events,
    viewer,
    onOpen: openEvent,
    onNew: openNew,
    onChange: async (event: CalendarEvent) => {
      await mutation.mutateAsync({
        kind: "update",
        event,
        values: eventValues(event),
      });
    },
  };
  return (
    <div className={s.shell}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Planeamento da equipa</p>
          <h1 id="calendar-title" tabIndex={-1}>
            Calendário
          </h1>
          <p>As pessoas, os compromissos e a operação no mesmo lugar.</p>
        </div>
        <span className="hidden items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-bg)] px-3 py-2 text-xs text-[var(--text-secondary)] sm:flex">
          <Users size={14} />
          {collaborators.length} colaboradores
        </span>
      </header>
      {directoryError && (
        <p role="alert" className={`${s.notice} ${s.error}`}>
          {directoryError}
        </p>
      )}
      {query.data?.migrationRequired && (
        <p role="status" className={s.notice}>
          Pré-visualização do novo calendário. Os eventos existentes estão
          disponíveis para consulta; a ativação disponibilizará a criação e
          edição de eventos.{" "}
          <Link href="/ops/calendario/legacy" className="underline">
            Usar calendário anterior
          </Link>
          .
        </p>
      )}
      <div className={s.frame}>
        {!collapsed && (
          <aside
            className={`${s.sidebar} hidden md:flex`}
            aria-label="Filtros do calendário"
          >
            <CalendarSidebar key={params.date.slice(0, 7)} {...sidebarProps} />
          </aside>
        )}
        <main className={s.main}>
          <CalendarToolbar
            reminders={reminders}
            view={view}
            date={params.date}
            onView={(view) => void setParams({ view })}
            onNavigate={(direction) =>
              void setParams({
                date: navigateDate(params.date, view, direction),
              })
            }
            onToday={() => void setParams({ date: today })}
            onNew={() => openNew()}
            onToggleSidebar={() =>
              mobile ? setFiltersOpen(true) : setCollapsed((value) => !value)
            }
          />
          {query.isPending ? (
            <div
              role="status"
              aria-label="A carregar eventos"
              className={s.skeleton}
            >
              {Array.from({ length: 35 }, (_, i) => (
                <div key={i}>
                  <span />
                </div>
              ))}
            </div>
          ) : query.isError ? (
            <div role="alert" className={s.empty}>
              <h3>O calendário está indisponível</h3>
              <p>{query.error?.message || initialError}</p>
              <button className={s.action} onClick={() => void query.refetch()}>
                <RefreshCw size={14} />
                Tentar novamente
              </button>
            </div>
          ) : view === "month" ? (
            <MonthView
              date={params.date}
              today={today}
              events={events}
              onOpen={openEvent}
              onNew={openNew}
              onDate={(date) => void setParams({ date })}
            />
          ) : view === "week" ? (
            <WeekView {...viewProps} />
          ) : view === "day" ? (
            <DayView {...viewProps} />
          ) : (
            <AgendaView
              start={range.start}
              end={range.end}
              events={events}
              collaborators={coloredCollaborators}
              onOpen={openEvent}
              onNew={openNew}
            />
          )}
          <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-4 py-3 text-[10px] text-[var(--text-secondary)]">
            <span>
              {events.length} {events.length === 1 ? "evento" : "eventos"} neste
              período · Hora de Lisboa
            </span>
            {hydrated && query.isFetching ? (
              <Loader2
                size={12}
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <span className="hidden sm:inline">
                {view === "week" || view === "day"
                  ? "Arraste para mover · Puxe a base para redimensionar"
                  : "Selecione um dia para criar um evento"}
              </span>
            )}
          </div>
        </main>
      </div>
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left">
          <SheetTitle className="font-semibold">O seu calendário</SheetTitle>
          <SheetDescription className="mb-6 mt-1 text-xs text-[var(--text-secondary)]">
            Datas, colaboradores e filtros.
          </SheetDescription>
          <div className="flex flex-col gap-6">
            <CalendarSidebar key={params.date.slice(0, 7)} {...sidebarProps} />
          </div>
        </SheetContent>
      </Sheet>
      {activeSelection && (
        <EventSheet
          key={
            activeSelection.event?.id ||
            `${activeSelection.draft?.date}:${activeSelection.draft?.time}`
          }
          {...activeSelection}
          viewer={viewer}
          collaborators={coloredCollaborators}
          onClose={closeEvent}
          migrationRequired={!!query.data?.migrationRequired}
        />
      )}
    </div>
  );
}
