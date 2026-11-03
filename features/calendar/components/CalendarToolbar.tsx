"use client";
import {
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  Plus,
  CalendarDays,
  Bell,
  BellRing,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CalendarView } from "../types";
import { periodTitle } from "../lib/dates";
import s from "./calendar.module.css";
const views: { id: CalendarView; label: string }[] = [
  { id: "month", label: "Mês" },
  { id: "week", label: "Semana" },
  { id: "day", label: "Dia" },
  { id: "agenda", label: "Agenda" },
];
export function CalendarToolbar({
  view,
  date,
  onView,
  onNavigate,
  onToday,
  onNew,
  onToggleSidebar,
  reminders,
}: {
  view: CalendarView;
  date: string;
  onView: (view: CalendarView) => void;
  onNavigate: (direction: number) => void;
  onToday: () => void;
  onNew: () => void;
  onToggleSidebar: () => void;
  reminders: {
    enabled: boolean;
    label: string;
    loading: boolean;
    toggle: () => Promise<void>;
  };
}) {
  return (
    <div className={s.toolbar}>
      <div className={s.actions}>
        <button
          className={s.iconButton}
          aria-label="Mostrar ou ocultar filtros do calendário"
          onClick={onToggleSidebar}
        >
          <PanelLeft size={17} />
        </button>
        <button className={s.action} onClick={onToday}>
          <CalendarDays size={14} />
          Hoje
        </button>
        <button
          className={s.action}
          aria-label={reminders.label}
          aria-pressed={reminders.enabled}
          disabled={reminders.loading}
          onClick={() => void reminders.toggle()}
          title="Os seus eventos até uma hora antes e feriados três dias antes. Os avisos do navegador funcionam enquanto o calendário estiver aberto."
        >
          {reminders.enabled ? (
            <BellRing size={14} className="text-[#38664b]" />
          ) : (
            <Bell size={14} />
          )}
          <span className="hidden 2xl:inline">{reminders.label}</span>
        </button>
      </div>
      <div className={s.period}>
        <button
          className={s.iconButton}
          aria-label="Período anterior"
          onClick={() => onNavigate(-1)}
        >
          <ChevronLeft size={16} />
        </button>
        <h2 aria-live="polite">{periodTitle(view, date)}</h2>
        <button
          className={s.iconButton}
          aria-label="Período seguinte"
          onClick={() => onNavigate(1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className={`${s.actions} ${s.toolbarView}`}>
        <ToggleGroup
          type="single"
          value={view}
          aria-label="Vista do calendário"
          onValueChange={(value) => {
            if (value) onView(value as CalendarView);
          }}
        >
          {views.map((item) => (
            <ToggleGroupItem key={item.id} value={item.id}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <button className={`${s.action} ${s.primary}`} onClick={onNew}>
          <Plus size={15} />
          <span className="hidden xl:inline">Novo evento</span>
          <span className="xl:hidden">Novo</span>
        </button>
      </div>
    </div>
  );
}
