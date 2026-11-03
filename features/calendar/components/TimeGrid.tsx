"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { toast } from "sonner";
import {
  canManageEvent,
  collaboratorColor,
  type CalendarEvent,
  type CalendarViewer,
} from "../types";
import {
  addDays,
  dateRange,
  daysBetween,
  eventTimes,
  eventsOnDay,
  formatDate,
  minutesTime,
  shiftEvent,
  timeMinutes,
} from "../lib/dates";
import s from "./calendar.module.css";
const keyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates, context },
) => {
  const column =
    context.activeNode?.closest("[data-time-day]")?.getBoundingClientRect()
      .width ||
    context.draggingNodeRect?.width ||
    100;
  const offsets: Record<string, { x: number; y: number }> = {
    ArrowLeft: { x: -column, y: 0 },
    ArrowRight: { x: column, y: 0 },
    ArrowUp: { x: 0, y: -30 },
    ArrowDown: { x: 0, y: 30 },
  };
  const delta = offsets[event.code];
  if (!delta) return undefined;
  event.preventDefault();
  return {
    x: currentCoordinates.x + delta.x,
    y: currentCoordinates.y + delta.y,
  };
};
function Slot({
  day,
  minute,
  onNew,
}: {
  day: string;
  minute: number;
  onNew: (date: string, time: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot:${day}:${minute}`,
    data: { day, minute },
  });
  return (
    <button
      ref={setNodeRef}
      data-time-slot={`${day}:${minute}`}
      onKeyDown={(event) => {
        const changes: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -30],
          ArrowDown: [0, 30],
        };
        const delta = changes[event.key];
        if (delta) {
          event.preventDefault();
          const next = minute + delta[1];
          if (next >= 0 && next < 1440)
            document
              .querySelector<HTMLButtonElement>(
                `[data-time-slot="${addDays(day, delta[0])}:${next}"]`,
              )
              ?.focus();
        }
      }}
      className={s.timeSlot}
      style={{ top: minute }}
      data-half={minute % 60 !== 0}
      data-over={isOver}
      aria-label={`Novo evento em ${formatDate(day, { dateStyle: "long" })} às ${minutesTime(minute)}`}
      onClick={() => onNew(day, minutesTime(minute))}
    />
  );
}
function TimedEvent({
  event,
  day,
  editable,
  onOpen,
  column,
  columns,
}: {
  event: CalendarEvent;
  day: string;
  editable: boolean;
  onOpen: (event: CalendarEvent) => void;
  column: number;
  columns: number;
}) {
  const {
    setNodeRef: setMoveRef,
    setActivatorNodeRef: setMoveActivator,
    listeners: moveListeners,
    attributes: moveAttributes,
    transform,
    isDragging,
  } = useDraggable({
    id: `move:${event.id}:${day}`,
    data: { event, day, mode: "move" },
    disabled: !editable,
  });
  const {
    setNodeRef: setResizeRef,
    listeners: resizeListeners,
    attributes: resizeAttributes,
    transform: resizeTransform,
    isDragging: isResizing,
  } = useDraggable({
    id: `resize:${event.id}:${day}`,
    data: { event, day, mode: "resize" },
    disabled: !editable,
  });
  const times = eventTimes(event),
    start = timeMinutes(times.start),
    end = times.end ? timeMinutes(times.end) : Math.min(start + 60, 1439);
  const resizeDelta = resizeTransform
    ? Math.round(resizeTransform.y / 15) * 15
    : 0;
  const style = {
    top: start,
    height: Math.max(24, end - start + resizeDelta),
    left: `calc(${(column * 100) / columns}% + 3px)`,
    width: `calc(${100 / columns}% - 6px)`,
    "--event-color": event.color || collaboratorColor(event.collab_id),
    zIndex: isDragging || isResizing ? 40 : 3,
    transform: transform
      ? `translate3d(${transform.x}px, ${Math.round(transform.y / 15) * 15}px, 0)`
      : undefined,
    opacity: isDragging ? 0.8 : 1,
  } as CSSProperties;
  return (
    <div className={s.timedEvent} ref={setMoveRef} style={style}>
      <button
        ref={setMoveActivator}
        {...moveListeners}
        {...moveAttributes}
        className={s.timedMain}
        aria-label={`${event.title}, ${event.time}${editable ? ". Prima espaço e use as setas para mover." : ""}`}
        onClick={() => onOpen(event)}
      >
        <strong className={s.truncate}>{event.title}</strong>
        <span className="text-[9px] opacity-70">{event.time}</span>
      </button>
      {editable && (
        <button
          ref={setResizeRef}
          {...resizeListeners}
          {...resizeAttributes}
          className={s.resizeHandle}
          aria-label={`Alterar hora de fim de ${event.title}. Prima espaço e use as setas verticais.`}
        />
      )}
    </div>
  );
}
function AllDayEntry({
  event,
  day,
  viewer,
  onOpen,
}: {
  event: CalendarEvent;
  day: string;
  viewer: CalendarViewer;
  onOpen: (event: CalendarEvent) => void;
}) {
  const editable = canManageEvent(event, viewer);
  const { setNodeRef, listeners, attributes, transform } = useDraggable({
    id: `all-day:${event.id}:${day}`,
    data: { event, day, mode: "move" },
    disabled: !editable,
  });
  const {
    setNodeRef: setResizeRef,
    listeners: resizeListeners,
    attributes: resizeAttributes,
  } = useDraggable({
    id: `all-day-resize:${event.id}:${day}`,
    data: { event, day, mode: "resize-days" },
    disabled: !editable,
  });
  return (
    <div
      ref={setNodeRef}
      className="relative"
      style={{
        transform: transform
          ? `translate3d(${transform.x}px,${transform.y}px,0)`
          : undefined,
        zIndex: transform ? 40 : undefined,
      }}
    >
      <button
        {...listeners}
        {...attributes}
        className={s.chip}
        style={
          {
            "--event-color": event.color || collaboratorColor(event.collab_id),
            touchAction: "none",
            paddingRight: 12,
          } as CSSProperties
        }
        onClick={() => onOpen(event)}
        aria-label={`${event.title}, todo o dia${editable ? ". Prima espaço e use as setas para mover." : ""}`}
      >
        <span className={s.truncate}>{event.title}</span>
      </button>
      {editable && day === event.end_date && (
        <button
          ref={setResizeRef}
          {...resizeListeners}
          {...resizeAttributes}
          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r bg-black/5 touch-none"
          aria-label={`Alterar data de fim de ${event.title}. Prima espaço e use as setas horizontais.`}
        />
      )}
    </div>
  );
}
function AllDayColumn({
  day,
  entries,
  viewer,
  onOpen,
  onNew,
}: {
  day: string;
  entries: CalendarEvent[];
  viewer: CalendarViewer;
  onOpen: (event: CalendarEvent) => void;
  onNew: (day: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `all-day-slot:${day}`,
    data: { day, minute: 0, allDay: true },
  });
  return (
    <div
      ref={setNodeRef}
      data-time-day={day}
      className={s.allDayCell}
      style={isOver ? { background: "var(--calendar-muted)" } : undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) onNew(day);
      }}
    >
      {entries.map((event) => (
        <AllDayEntry
          key={event.id}
          day={day}
          event={event}
          viewer={viewer}
          onOpen={onOpen}
        />
      ))}
      <button
        className="sr-only focus:not-sr-only"
        onClick={() => onNew(day)}
        aria-label={`Evento de dia inteiro em ${day}`}
      >
        Adicionar evento
      </button>
    </div>
  );
}
function layout(events: CalendarEvent[]) {
  const groups: {
    event: CalendarEvent;
    start: number;
    end: number;
    column: number;
    columns: number;
  }[][] = [];
  let group: (typeof groups)[number] = [],
    end = 0;
  for (const event of events) {
    const times = eventTimes(event),
      start = timeMinutes(times.start),
      finish = times.end ? timeMinutes(times.end) : Math.min(start + 60, 1439);
    if (group.length && start >= end) {
      groups.push(group);
      group = [];
      end = 0;
    }
    let column = 0;
    while (group.some((entry) => entry.column === column && entry.end > start))
      column++;
    group.push({ event, start, end: finish, column, columns: 1 });
    end = Math.max(end, finish);
  }
  if (group.length) groups.push(group);
  return groups.flatMap((entries) => {
    const count = Math.max(...entries.map((e) => e.column)) + 1;
    return entries.map((e) => ({ ...e, columns: count }));
  });
}
export function TimeGrid({
  days,
  today,
  events,
  viewer,
  onOpen,
  onNew,
  onChange,
}: {
  days: string[];
  today: string;
  events: CalendarEvent[];
  viewer: CalendarViewer;
  onOpen: (event: CalendarEvent) => void;
  onNew: (date: string, time?: string) => void;
  onChange: (event: CalendarEvent) => Promise<void>;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 7 * 60;
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );
  async function endDrag({ active, over, delta }: DragEndEvent) {
    const data = active.data.current,
      target = over?.data.current;
    if (!data || !target || (!delta.x && !delta.y)) return;
    const event = data.event as CalendarEvent;
    if (!canManageEvent(event, viewer)) return;
    try {
      let next: CalendarEvent;
      if (data.mode === "resize-days") {
        dateRange(event.start_date, String(target.day));
        next = { ...event, end_date: String(target.day) };
      } else if (data.mode === "resize") {
        const times = eventTimes(event),
          start = timeMinutes(times.start),
          end = times.end ? timeMinutes(times.end) : Math.min(start + 60, 1439),
          finish = end + Math.round(delta.y / 15) * 15;
        if (finish <= start || finish > 1439)
          throw new Error(
            "A hora de fim deve ser posterior ao início e terminar no mesmo dia.",
          );
        next = { ...event, time: `${times.start}–${minutesTime(finish)}` };
      } else
        next = shiftEvent(
          event,
          daysBetween(String(data.day), String(target.day)),
          event.all_day ? 0 : Math.round(delta.y / 15) * 15,
        );
      if (
        next.start_date === event.start_date &&
        next.end_date === event.end_date &&
        next.time === event.time
      )
        return;
      await onChange(next);
    } catch (error) {
      if (error instanceof Error && !(error.name === "CalendarMutationError"))
        toast.error(error.message);
    }
  }
  return (
    <DndContext
      id="calendar-time-grid"
      sensors={sensors}
      collisionDetection={(args) => {
        const pointer = pointerWithin(args);
        return pointer.length ? pointer : closestCenter(args);
      }}
      onDragEnd={(event) => void endDrag(event)}
      accessibility={{
        announcements: {
          onDragStart: () => "Evento selecionado para mover ou redimensionar.",
          onDragOver: ({ over }) =>
            over
              ? "Posição de destino selecionada."
              : "Fora da área do calendário.",
          onDragEnd: ({ over }) =>
            over ? "Movimento concluído." : "Movimento cancelado.",
          onDragCancel: () => "Movimento cancelado.",
        },
        screenReaderInstructions: {
          draggable:
            "Para mover ou redimensionar, prima espaço. Use as setas e prima espaço para confirmar ou Escape para cancelar.",
        },
      }}
    >
      <div
        ref={scroll}
        className={s.timeScroller}
        style={
          {
            "--days": days.length,
            "--time-width": days.length === 1 ? "300px" : "630px",
          } as CSSProperties
        }
      >
        <div className={s.timeHeader}>
          <div aria-hidden />
          <>
            {days.map((day) => (
              <div key={day}>
                <span className="capitalize">
                  {formatDate(day, { weekday: "short" })}
                </span>
                <strong data-today={day === today}>
                  {Number(day.slice(8))}
                </strong>
              </div>
            ))}
          </>
        </div>
        <div className={s.allDayRow}>
          <div className={s.allDayLabel}>
            Todo
            <br />o dia
          </div>
          {days.map((day) => (
            <AllDayColumn
              key={day}
              day={day}
              entries={eventsOnDay(events, day).filter(
                (event) => event.all_day,
              )}
              viewer={viewer}
              onOpen={onOpen}
              onNew={onNew}
            />
          ))}
        </div>
        <div className={s.timeBody}>
          <div className={s.timeLabels}>
            {Array.from({ length: 24 }, (_, hour) => (
              <span
                key={hour}
                className={s.timeLabel}
                style={{ top: hour * 60 }}
              >
                {String(hour).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {days.map((day) => (
            <div key={day} data-time-day={day} className={s.timeDay}>
              {Array.from({ length: 48 }, (_, i) => (
                <Slot key={i} day={day} minute={i * 30} onNew={onNew} />
              ))}
              {layout(
                eventsOnDay(events, day).filter((event) => !event.all_day),
              ).map(({ event, column, columns }) => (
                <TimedEvent
                  key={event.id}
                  event={event}
                  day={day}
                  column={column}
                  columns={columns}
                  editable={canManageEvent(event, viewer)}
                  onOpen={onOpen}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </DndContext>
  );
}
