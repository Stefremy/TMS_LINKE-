"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchCalendarEventRange } from "@/app/actions/calendar";
import type { CalendarEvent, CalendarViewer } from "../types";
import { addDays, todayKey } from "../lib/dates";
import { calendarHolidays } from "../lib/holidays";
import { dueCalendarReminders } from "../lib/reminders";
import { calendarQueryKey } from "./useCalendarEvents";
const CHANGE = "linke-calendar-reminders-change";
function subscribe(callback: () => void) {
  window.addEventListener(CHANGE, callback);
  window.addEventListener("storage", callback);
  window.addEventListener("focus", callback);
  return () => {
    window.removeEventListener(CHANGE, callback);
    window.removeEventListener("storage", callback);
    window.removeEventListener("focus", callback);
  };
}
const serverSnapshot = () => "loading:false";
export function useCalendarReminders(
  viewer: CalendarViewer,
  countries: string[],
  onOpen: (event: CalendarEvent, date: string) => void,
) {
  const scope = `${viewer.tenantId}:${viewer.id}`,
    preferenceKey = `linke-calendar-reminders:${scope}`,
    deliveredKey = `${preferenceKey}:delivered`;
  const state = useSyncExternalStore(
    subscribe,
    () => {
      if (!("Notification" in window)) return "unsupported:false";
      try {
        return `${Notification.permission}:${localStorage.getItem(preferenceKey) === "true"}`;
      } catch {
        return `${Notification.permission}:false`;
      }
    },
    serverSnapshot,
  );
  const [permission, preference] = state.split(":"),
    enabled = permission === "granted" && preference === "true";
  const today = todayKey(),
    tomorrow = addDays(today, 1),
    sent = useRef(new Set<string>());
  const query = useQuery({
    queryKey: calendarQueryKey(scope, today, tomorrow),
    queryFn: () => fetchCalendarEventRange(today, tomorrow),
    enabled,
    staleTime: 30000,
    refetchInterval: enabled ? 60000 : false,
    refetchIntervalInBackground: true,
    retry: 1,
  });
  useEffect(() => {
    if (enabled && query.error)
      toast.error("Não foi possível atualizar os lembretes do calendário.");
  }, [enabled, query.error]);
  const holidays = calendarHolidays(
    addDays(today, 3),
    addDays(today, 3),
  ).filter((event) => countries.includes(event.holiday_country!));
  useEffect(() => {
    if (!enabled || !query.data) return;
    function check() {
      const now = new Date();
      const reminders = dueCalendarReminders(
        query.data!.events,
        holidays,
        viewer,
        now,
      );
      let delivered: Record<string, number> = {};
      try {
        delivered = JSON.parse(localStorage.getItem(deliveredKey) || "{}");
        if (
          !delivered ||
          typeof delivered !== "object" ||
          Array.isArray(delivered)
        )
          delivered = {};
      } catch {
        delivered = {};
      }
      for (const reminder of reminders) {
        if (sent.current.has(reminder.key) || delivered[reminder.key]) continue;
        try {
          const notification = new Notification(reminder.title, {
            body: reminder.body,
            tag: `${scope}:${reminder.key}`,
            icon: "/favicon.ico",
          });
          notification.onclick = () => {
            window.focus();
            onOpen(reminder.event, reminder.date);
            notification.close();
          };
          sent.current.add(reminder.key);
          delivered[reminder.key] = now.getTime();
        } catch {
          /* The browser may revoke permission while the calendar is open. */
        }
      }
      try {
        localStorage.setItem(
          deliveredKey,
          JSON.stringify(
            Object.fromEntries(
              Object.entries(delivered)
                .filter(
                  ([, at]) =>
                    Number.isFinite(at) && now.getTime() - at < 14 * 86400000,
                )
                .slice(-500),
            ),
          ),
        );
      } catch {
        /* Keep the in-memory deduplication when storage is unavailable. */
      }
    }
    check();
    const interval = window.setInterval(check, 60000);
    return () => window.clearInterval(interval);
  }, [enabled, query.data, deliveredKey, holidays, viewer, scope, onOpen]);
  async function toggle() {
    if (permission === "unsupported") {
      toast.info(
        "Este navegador não suporta notificações. Consulte os lembretes no sino do TMS.",
      );
      return;
    }
    if (permission === "denied") {
      toast.info(
        "As notificações estão bloqueadas. Pode permiti-las nas definições deste site no navegador.",
      );
      return;
    }
    try {
      if (
        !enabled &&
        Notification.permission !== "granted" &&
        (await Notification.requestPermission()) !== "granted"
      ) {
        window.dispatchEvent(new Event(CHANGE));
        return;
      }
      localStorage.setItem(preferenceKey, String(!enabled));
      window.dispatchEvent(new Event(CHANGE));
      toast.success(
        enabled
          ? "Lembretes do navegador desativados."
          : "Lembretes ativos enquanto o calendário estiver aberto.",
      );
    } catch {
      toast.error("Não foi possível ativar os lembretes neste navegador.");
    }
  }
  return {
    enabled,
    toggle,
    label:
      permission === "unsupported"
        ? "Lembretes indisponíveis"
        : permission === "denied"
          ? "Lembretes bloqueados"
          : enabled
            ? "Lembretes ativos"
            : "Ativar lembretes",
    loading: permission === "loading",
  };
}
