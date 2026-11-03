import type { CalendarEvent, CalendarViewer } from "../types";
import { addDays, daysBetween, eventTimes, todayKey } from "./dates";

export type CalendarReminder = {
  key: string;
  title: string;
  body: string;
  date: string;
  event: CalendarEvent;
};
const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Lisbon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function clockParts(now: Date) {
  const parts = clockFormatter.formatToParts(now);
  const part = (type: string) =>
    Number(parts.find((value) => value.type === type)?.value);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
  };
}
/** Convert a Lisbon wall-clock appointment without depending on the browser/server timezone. */
export function lisbonEventTimestamp(
  date: string,
  time: string,
): number | null {
  const target = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(target)) return null;
  let guess = target;
  for (let index = 0; index < 3; index++) {
    const p = clockParts(new Date(guess));
    const represented = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    if (represented === target) return guess;
    guess += target - represented;
  }
  // A local time skipped by the spring clock change has no real instant.
  return null;
}
export function isPersonalCalendarEvent(
  event: CalendarEvent,
  viewer: CalendarViewer,
) {
  return (
    !event.holiday_country &&
    (event.creator_id === viewer.id ||
      (!!viewer.email &&
        event.creator_email?.toLowerCase() === viewer.email.toLowerCase()) ||
      (!!viewer.collaboratorId && event.collab_id === viewer.collaboratorId))
  );
}
export function dueCalendarReminders(
  events: CalendarEvent[],
  holidays: CalendarEvent[],
  viewer: CalendarViewer,
  now = new Date(),
): CalendarReminder[] {
  const today = todayKey(now),
    tomorrow = addDays(today, 1),
    result: CalendarReminder[] = [];
  for (const event of events) {
    if (event.all_day || !isPersonalCalendarEvent(event, viewer)) continue;
    for (const day of [today, tomorrow]) {
      if (day < event.start_date || day > event.end_date) continue;
      const start = eventTimes(event).start,
        instant = lisbonEventTimestamp(day, start);
      if (instant === null) continue;
      const minutes = Math.ceil((instant - now.getTime()) / 60000);
      if (minutes < 0 || minutes > 60) continue;
      result.push({
        key: `event:${event.id}:${day}:${start}:${event.updated_at}`,
        title: minutes
          ? `Evento dentro de ${minutes} min`
          : "O evento começa agora",
        body: `${event.title} · ${start}`,
        date: day,
        event,
      });
    }
  }
  const clock = clockParts(now);
  if (clock.hour >= 10)
    for (const event of holidays) {
      if (daysBetween(today, event.start_date) !== 3) continue;
      result.push({
        key: `holiday:${event.id}:${today}`,
        title: "Feriado dentro de 3 dias",
        body: `${event.title}. Verifique as recolhas e expedições.`,
        date: event.start_date,
        event,
      });
    }
  return result;
}
export function upcomingPersonalEvents(
  events: CalendarEvent[],
  viewer: CalendarViewer,
  now = new Date(),
) {
  const today = todayKey(now),
    tomorrow = addDays(today, 1);
  return events
    .flatMap((event) => {
      if (!isPersonalCalendarEvent(event, viewer)) return [];
      for (const day of [today, tomorrow]) {
        if (day < event.start_date || day > event.end_date) continue;
        const instant = event.all_day
          ? lisbonEventTimestamp(day, "09:00")
          : lisbonEventTimestamp(day, eventTimes(event).start);
        if (instant === null || (!event.all_day && instant < now.getTime()))
          continue;
        return [
          {
            event,
            day,
            instant,
            soon: !event.all_day && instant - now.getTime() <= 3600000,
          },
        ];
      }
      return [];
    })
    .sort((a, b) => a.instant - b.instant)
    .slice(0, 10);
}
