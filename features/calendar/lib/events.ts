import type { CalendarEvent, CalendarRow, CalendarViewer } from "../types";
import type { CalendarEventValues } from "../schema";
import { dateRange, eventTimes } from "./dates";
export function expandCalendarEvent(
  event: CalendarEventValues,
  groupId: string,
  actor: CalendarViewer,
) {
  return dateRange(event.event_date, event.end_date).map((event_date) => ({
    group_id: groupId,
    event_date,
    title: event.title.trim(),
    description: event.description.trim() || null,
    collab_id: event.collab_id,
    all_day: event.all_day,
    creator_id: actor.id,
    creator_email: actor.email,
    time: event.all_day
      ? null
      : event.end_time
        ? `${event.time}–${event.end_time}`
        : event.time,
    shipment_tracking_number: event.shipment_tracking_number || null,
  }));
}
export function groupCalendarRows(rows: CalendarRow[]): CalendarEvent[] {
  const grouped = new Map<string, CalendarEvent>();
  for (const row of rows) {
    const id = row.group_id || row.id,
      old = grouped.get(id);
    if (old) {
      old.start_date =
        old.start_date < row.event_date ? old.start_date : row.event_date;
      old.end_date =
        old.end_date > row.event_date ? old.end_date : row.event_date;
      continue;
    }
    grouped.set(id, {
      id,
      title: row.title,
      description: row.description || "",
      start_date: row.event_date,
      end_date: row.event_date,
      time: row.time || null,
      all_day: row.all_day ?? !row.time,
      collab_id: row.collab_id,
      creator_email: row.creator_email || null,
      creator_id: row.creator_id || null,
      updated_at: row.updated_at || row.created_at || "",
      shipment_tracking_number: row.shipment_tracking_number || null,
      legacy: !row.group_id,
    });
  }
  return [...grouped.values()].sort(
    (a, b) =>
      a.start_date.localeCompare(b.start_date) ||
      (a.time || "").localeCompare(b.time || ""),
  );
}
export function eventValues(event: CalendarEvent): CalendarEventValues {
  const times = eventTimes(event);
  return {
    title: event.title,
    description: event.description,
    collab_id: event.collab_id,
    event_date: event.start_date,
    end_date: event.end_date,
    all_day: event.all_day,
    time: times.start,
    end_time: times.end,
    shipment_tracking_number: event.shipment_tracking_number || "",
  };
}
export function applyOptimisticEvent(
  events: CalendarEvent[],
  next: CalendarEvent,
) {
  return events.map((event) => (event.id === next.id ? next : event));
}
