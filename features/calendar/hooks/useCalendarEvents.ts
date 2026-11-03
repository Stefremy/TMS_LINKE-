"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarEventRange,
  updateCalendarEvent,
} from "@/app/actions/calendar";
import type { CalendarEvent, CalendarRangeData } from "../types";
import type { CalendarEventValues } from "../schema";
export const calendarQueryKey = (
  viewerId: string,
  start: string,
  end: string,
) => ["calendar-events", viewerId, start, end] as const;
export function useCalendarEvents(
  viewerId: string,
  start: string,
  end: string,
) {
  return useQuery({
    queryKey: calendarQueryKey(viewerId, start, end),
    queryFn: () => fetchCalendarEventRange(start, end),
    staleTime: 30000,
    retry: 1,
  });
}
export class CalendarMutationError extends Error {
  constructor(
    message: string,
    public fieldErrors: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "CalendarMutationError";
  }
}
type Change =
  | { kind: "create"; values: CalendarEventValues }
  | { kind: "update"; event: CalendarEvent; values: CalendarEventValues }
  | { kind: "delete"; event: CalendarEvent };
export function useCalendarMutation(viewerId: string) {
  const client = useQueryClient(),
    prefix = ["calendar-events", viewerId];
  return useMutation({
    mutationFn: async (change: Change) => {
      const result =
        change.kind === "delete"
          ? await deleteCalendarEvent(change.event.id, change.event.updated_at)
          : change.kind === "update"
            ? await updateCalendarEvent(
                change.event.id,
                change.values,
                change.event.updated_at,
              )
            : await addCalendarEvent(change.values);
      if (!result.success)
        throw new CalendarMutationError(result.error, result.fieldErrors || []);
      return result;
    },
    onMutate: async (change) => {
      await client.cancelQueries({ queryKey: prefix });
      const snapshots = client.getQueriesData<CalendarRangeData>({
        queryKey: prefix,
      });
      if (change.kind !== "create")
        for (const [key, data] of snapshots) {
          if (!data) continue;
          const rest = data.events.filter(
            (event) => event.id !== change.event.id,
          );
          if (change.kind === "update") {
            const value = change.values,
              next = {
                ...change.event,
                ...value,
                start_date: value.event_date,
                end_date: value.end_date,
                time: value.all_day
                  ? null
                  : value.end_time
                    ? `${value.time}–${value.end_time}`
                    : value.time,
              };
            if (
              next.start_date <= String(key[3]) &&
              next.end_date >= String(key[2])
            )
              rest.push(next);
          }
          client.setQueryData(key, { ...data, events: rest });
        }
      return { snapshots };
    },
    onError: (error, _change, context) => {
      for (const [key, data] of context?.snapshots || [])
        client.setQueryData(key, data);
      toast.error(error.message);
    },
    onSuccess: (_data, change) => {
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("linke-calendar-events-changed"));
      toast.success(
        change.kind === "delete"
          ? "Evento eliminado."
          : change.kind === "create"
            ? "Evento criado."
            : "Evento atualizado.",
      );
    },
    onSettled: () => client.invalidateQueries({ queryKey: prefix }),
  });
}
