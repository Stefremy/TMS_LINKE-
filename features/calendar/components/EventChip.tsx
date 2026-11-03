"use client";
import type { CSSProperties } from "react";
import { Package } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { collaboratorColor, type CalendarEvent } from "../types";
import s from "./calendar.module.css";
export function EventChip({
  event,
  onOpen,
}: {
  event: CalendarEvent;
  onOpen: (event: CalendarEvent) => void;
}) {
  return (
    <Tooltip
      content={
        <>
          <strong>{event.title}</strong>
          <span className="block">
            {event.all_day ? "Todo o dia" : event.time}
            {event.description ? ` · ${event.description}` : ""}
          </span>
        </>
      }
    >
      <button
        type="button"
        className={s.chip}
        style={
          {
            "--event-color": event.color || collaboratorColor(event.collab_id),
          } as CSSProperties
        }
        onClick={() => onOpen(event)}
        aria-label={`${event.title}, ${event.all_day ? "todo o dia" : event.time}`}
      >
        {!event.all_day && (
          <span className={s.chipTime}>{event.time?.split("–")[0]}</span>
        )}
        <span className={s.truncate}>{event.title}</span>
        {event.shipment_tracking_number && (
          <Package
            aria-label="Com guia associada"
            size={11}
            className="ml-auto shrink-0"
          />
        )}
      </button>
    </Tooltip>
  );
}
