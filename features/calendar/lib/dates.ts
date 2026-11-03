import type { CalendarEvent, CalendarView } from "../types";
const DAY = 86400000;
export function isValidDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) >= 1900 &&
    Number(value.slice(0, 4)) <= 9998 &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
export function toDate(value: string): Date {
  if (!isValidDate(value)) throw new Error("Data inválida.");
  return new Date(`${value}T00:00:00Z`);
}
export function todayKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function addDays(value: string, days: number) {
  return dateKey(new Date(toDate(value).getTime() + days * DAY));
}
export function daysBetween(start: string, end: string) {
  return Math.round((toDate(end).getTime() - toDate(start).getTime()) / DAY);
}
export function dateRange(start: string, end: string): string[] {
  const length = daysBetween(start, end) + 1;
  if (length < 1 || length > 366)
    throw new Error("Escolha um período de até 366 dias.");
  return Array.from({ length }, (_, i) => addDays(start, i));
}
export function startOfWeek(value: string) {
  return addDays(value, -((toDate(value).getUTCDay() + 6) % 7));
}
export function startOfMonth(value: string) {
  return `${value.slice(0, 7)}-01`;
}
export function endOfMonth(value: string) {
  const d = toDate(startOfMonth(value));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return addDays(dateKey(d), -1);
}
export function monthDays(value: string) {
  const first = startOfWeek(startOfMonth(value)),
    last = addDays(startOfWeek(endOfMonth(value)), 6);
  return dateRange(first, last);
}
export function visibleRange(view: CalendarView, value: string) {
  if (view === "month") {
    const days = monthDays(value);
    return { start: days[0], end: days[days.length - 1] };
  }
  if (view === "week") {
    const start = startOfWeek(value);
    return { start, end: addDays(start, 6) };
  }
  if (view === "agenda") return { start: value, end: addDays(value, 29) };
  return { start: value, end: value };
}
export function navigateDate(
  value: string,
  view: CalendarView,
  direction: number,
) {
  if (view === "month") {
    const d = toDate(startOfMonth(value));
    d.setUTCMonth(d.getUTCMonth() + direction);
    return `${dateKey(d).slice(0, 7)}-${String(Math.min(Number(value.slice(8)), Number(endOfMonth(dateKey(d)).slice(8)))).padStart(2, "0")}`;
  }
  return addDays(
    value,
    direction * (view === "week" ? 7 : view === "agenda" ? 30 : 1),
  );
}
export function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "UTC",
    ...options,
  }).format(toDate(value));
}
export function periodTitle(view: CalendarView, value: string) {
  if (view === "month")
    return formatDate(value, { month: "long", year: "numeric" });
  if (view === "day")
    return formatDate(value, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  const range = visibleRange(view, value);
  return `${formatDate(range.start, { day: "numeric", month: "short" })} — ${formatDate(range.end, { day: "numeric", month: "short", year: "numeric" })}`;
}
export function eventsOnDay(events: CalendarEvent[], day: string) {
  return events
    .filter((e) => e.start_date <= day && e.end_date >= day)
    .sort(
      (a, b) =>
        Number(b.all_day) - Number(a.all_day) ||
        (a.time || "").localeCompare(b.time || "") ||
        a.title.localeCompare(b.title, "pt-PT"),
    );
}
export function timeMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function minutesTime(minutes: number) {
  const m = Math.min(1439, Math.max(0, minutes));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export function eventTimes(event: Pick<CalendarEvent, "time">) {
  const [start = "09:00", end = ""] = (event.time || "").split(/[–—-]/);
  return { start: start || "09:00", end };
}
export function shiftEvent(
  event: CalendarEvent,
  days: number,
  minutes = 0,
): CalendarEvent {
  if (event.all_day)
    return {
      ...event,
      start_date: addDays(event.start_date, days),
      end_date: addDays(event.end_date, days),
      time: null,
    };
  const times = eventTimes(event),
    start = timeMinutes(times.start),
    end = times.end ? timeMinutes(times.end) : Math.min(start + 60, 1439);
  if (start + minutes < 0 || end + minutes > 1439)
    throw new Error(
      "O evento tem de terminar no mesmo dia. Ajuste as horas no formulário.",
    );
  return {
    ...event,
    start_date: addDays(event.start_date, days),
    end_date: addDays(event.end_date, days),
    time: event.all_day
      ? null
      : `${minutesTime(start + minutes)}–${minutesTime(end + minutes)}`,
  };
}
