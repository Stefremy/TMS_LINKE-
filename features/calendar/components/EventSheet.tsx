"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { useForm } from "@tanstack/react-form";
import {
  CalendarDays,
  Clock,
  User,
  Package,
  Pencil,
  Trash2,
  Loader2,
  AlignLeft,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  canManageEvent,
  collaboratorColor,
  type CalendarCollaborator,
  type CalendarEvent,
  type CalendarViewer,
} from "../types";
import {
  calendarDefaults,
  calendarEventSchema,
  type CalendarEventValues,
} from "../schema";
import { eventValues } from "../lib/events";
import { formatDate } from "../lib/dates";
import {
  CalendarMutationError,
  useCalendarMutation,
} from "../hooks/useCalendarEvents";
import s from "./calendar.module.css";
type Props = {
  viewer: CalendarViewer;
  collaborators: CalendarCollaborator[];
  event?: CalendarEvent;
  draft?: { date: string; time?: string };
  onClose: () => void;
  migrationRequired: boolean;
};
export function EventSheet({
  viewer,
  collaborators,
  event,
  draft,
  onClose,
  migrationRequired,
}: Props) {
  const [editing, setEditing] = useState(!event),
    [deleting, setDeleting] = useState(false);
  const mutation = useCalendarMutation(`${viewer.tenantId}:${viewer.id}`),
    editable = !!event && canManageEvent(event, viewer);
  const title = event
    ? editing
      ? "Editar evento"
      : event.title
    : "Novo evento";
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <SheetContent
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(e) => {
          if (mutation.isPending) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (mutation.isPending) e.preventDefault();
        }}
      >
        <div className="pr-8">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
            Calendário da equipa
          </p>
          <SheetTitle className="text-xl font-semibold tracking-tight">
            {title}
          </SheetTitle>
          <SheetDescription className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
            {editing
              ? "Preencha os dados do compromisso. Um período de vários dias é guardado como um único evento."
              : "Detalhes e pessoas envolvidas neste compromisso."}
          </SheetDescription>
        </div>
        {migrationRequired && (
          <p role="status" className={`${s.notice} mt-4`}>
            Os eventos estão disponíveis para consulta. A edição estará
            disponível quando o novo calendário for ativado.
          </p>
        )}
        {editing ? (
          <EventEditor
            key={event?.id || `${draft?.date}:${draft?.time}`}
            initial={
              event
                ? eventValues(event)
                : calendarDefaults(
                    draft!.date,
                    viewer.collaboratorId || "",
                    draft?.time,
                  )
            }
            collaborators={collaborators}
            pending={mutation.isPending}
            disabled={migrationRequired}
            onCancel={() => (event ? setEditing(false) : onClose())}
            onSave={async (values) => {
              await mutation.mutateAsync(
                event
                  ? { kind: "update", event, values }
                  : { kind: "create", values },
              );
              onClose();
            }}
          />
        ) : (
          event && (
            <div className="mt-8 space-y-7">
              <div className={s.eventDetail}>
                <CalendarDays size={17} />
                <div>
                  {formatDate(event.start_date, { dateStyle: "long" })}
                  {event.end_date !== event.start_date && (
                    <> — {formatDate(event.end_date, { dateStyle: "long" })}</>
                  )}
                  <small>
                    {event.start_date === event.end_date
                      ? "Um dia"
                      : "Período de vários dias"}
                  </small>
                </div>
              </div>
              <div className={s.eventDetail}>
                <Clock size={17} />
                <div>{event.all_day ? "Todo o dia" : event.time}</div>
              </div>
              <div className={s.eventDetail}>
                <User size={17} />
                <div className="flex items-center gap-2">
                  <span
                    className={s.dot}
                    style={{
                      background:
                        event.color || collaboratorColor(event.collab_id),
                    }}
                  />
                  {event.holiday_country
                    ? event.holiday_country === "PT"
                      ? "Portugal"
                      : "Espanha"
                    : collaborators.find(
                        (person) => person.id === event.collab_id,
                      )?.name || "Colaborador indisponível"}
                </div>
              </div>
              {event.description && (
                <div className={s.eventDetail}>
                  <AlignLeft size={17} />
                  <p className="whitespace-pre-wrap break-words">
                    {event.description}
                  </p>
                </div>
              )}
              {event.shipment_tracking_number && (
                <div className={s.eventDetail}>
                  <Package size={17} />
                  <Link
                    className={s.guide}
                    href={`/ops/envios?search=${encodeURIComponent(event.shipment_tracking_number)}`}
                  >
                    Ver envio {event.shipment_tracking_number} →
                  </Link>
                </div>
              )}
              <p className="border-t border-[var(--border-subtle)] pt-4 text-[11px] text-[var(--text-secondary)]">
                {event.holiday_country
                  ? "Referência de feriado"
                  : `Criado por ${event.creator_email || "utilizador indisponível"}`}
                {event.legacy && " · Registo do calendário anterior"}
              </p>
              {editable && !migrationRequired && (
                <div className={s.sheetFooter}>
                  <button
                    className={s.action}
                    onClick={() => setDeleting(true)}
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </button>
                  <button
                    className={`${s.action} ${s.primary}`}
                    onClick={() => setEditing(true)}
                  >
                    <Pencil size={14} />
                    Editar evento
                  </button>
                </div>
              )}
            </div>
          )
        )}
        <Dialog
          open={deleting}
          onOpenChange={(open) => {
            if (!mutation.isPending) setDeleting(open);
          }}
        >
          <DialogContent>
            <DialogTitle className="text-lg font-semibold">
              Eliminar este evento?
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-[var(--text-secondary)]">
              Todos os dias deste evento serão eliminados. Esta ação não pode
              ser desfeita.
            </DialogDescription>
            <div className={s.sheetFooter}>
              <DialogClose asChild>
                <button className={s.action} disabled={mutation.isPending}>
                  Cancelar
                </button>
              </DialogClose>
              <button
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                disabled={mutation.isPending}
                onClick={async () => {
                  if (event)
                    try {
                      await mutation.mutateAsync({ kind: "delete", event });
                      onClose();
                    } catch {}
                }}
              >
                {mutation.isPending && (
                  <Loader2
                    size={13}
                    className="animate-spin motion-reduce:animate-none"
                  />
                )}
                Eliminar evento
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
function EventEditor({
  initial,
  collaborators,
  onSave,
  onCancel,
  pending,
  disabled,
}: {
  initial: CalendarEventValues;
  collaborators: CalendarCollaborator[];
  onSave: (value: CalendarEventValues) => Promise<void>;
  onCancel: () => void;
  pending: boolean;
  disabled: boolean;
}) {
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({}),
    [serverError, setServerError] = useState("");
  const node = useRef<HTMLFormElement>(null),
    lock = useRef(false);
  const form = useForm({
    defaultValues: initial,
    validators: { onSubmit: calendarEventSchema },
    onSubmit: async ({ value }) => {
      if (lock.current || disabled) return;
      lock.current = true;
      setServerErrors({});
      setServerError("");
      try {
        await onSave(value);
      } catch (error) {
        if (error instanceof CalendarMutationError) {
          setServerErrors(
            Object.fromEntries(
              error.fieldErrors.map((issue) => [issue.field, issue.message]),
            ),
          );
          setServerError(error.message);
        } else setServerError("Não foi possível guardar o evento.");
        requestAnimationFrame(() =>
          node.current
            ?.querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus(),
        );
      } finally {
        lock.current = false;
      }
    },
  });
  type StringField = Exclude<keyof CalendarEventValues, "all_day">;
  const field = (name: StringField, label: string, type = "text") => (
    <form.Field name={name}>
      {(api) => {
        const error =
          serverErrors[name] ||
          api.state.meta.errors
            .map((e) => (typeof e === "string" ? e : e?.message))
            .filter(Boolean)
            .join(" ");
        const props = {
          id: `calendar-${name}`,
          name,
          value: api.state.value,
          onBlur: api.handleBlur,
          onChange: (
            event: React.ChangeEvent<
              HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
            >,
          ) => {
            api.handleChange(event.target.value);
            setServerErrors((errors) => ({ ...errors, [name]: "" }));
            if (
              name === "event_date" &&
              event.target.value > form.getFieldValue("end_date")
            )
              form.setFieldValue("end_date", event.target.value);
          },
          "aria-invalid": !!error,
          "aria-describedby": error ? `calendar-${name}-error` : undefined,
          className: s.input,
        };
        return (
          <div className={s.field}>
            <label htmlFor={props.id}>{label}</label>
            {name === "description" ? (
              <textarea {...props} rows={4} maxLength={4000} />
            ) : name === "collab_id" ? (
              <select {...props}>
                <option value="">Selecionar colaborador…</option>
                {collaborators.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...props}
                type={type}
                maxLength={
                  name === "title"
                    ? 160
                    : name === "shipment_tracking_number"
                      ? 80
                      : undefined
                }
                autoComplete="off"
              />
            )}
            {error && (
              <p
                id={`calendar-${name}-error`}
                className={s.fieldError}
                role="alert"
              >
                {error}
              </p>
            )}
          </div>
        );
      }}
    </form.Field>
  );
  return (
    <form
      ref={node}
      className={s.sheetForm}
      onSubmit={async (event) => {
        event.preventDefault();
        await form.handleSubmit();
        requestAnimationFrame(() =>
          node.current
            ?.querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus(),
        );
      }}
    >
      <fieldset
        disabled={pending || disabled}
        className="space-y-5 disabled:opacity-60"
      >
        {field("title", "Título")}
        {field("description", "Descrição (opcional)")}
        {field("collab_id", "Colaborador")}
        <div className={s.formGrid}>
          {field("event_date", "Data de início", "date")}
          {field("end_date", "Data de fim", "date")}
        </div>
        <form.Field name="all_day">
          {(api) => (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border-subtle)] p-3">
              <label htmlFor="calendar-all-day" className="text-xs font-medium">
                Todo o dia
              </label>
              <Switch
                id="calendar-all-day"
                checked={api.state.value}
                onCheckedChange={api.handleChange}
              />
            </div>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.all_day}>
          {(allDay) =>
            !allDay && (
              <div className={s.formGrid}>
                {field("time", "Hora de início", "time")}
                {field("end_time", "Hora de fim", "time")}
              </div>
            )
          }
        </form.Subscribe>
        {field("shipment_tracking_number", "Número de guia (opcional)")}
      </fieldset>
      {serverError && (
        <p role="alert" className={s.fieldError}>
          {serverError}
        </p>
      )}
      <div className={s.sheetFooter}>
        <button
          type="button"
          className={s.action}
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar
        </button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <button
              type="submit"
              disabled={pending || submitting || disabled}
              className={`${s.action} ${s.primary} disabled:opacity-50`}
            >
              {(pending || submitting) && (
                <Loader2
                  size={13}
                  className="animate-spin motion-reduce:animate-none"
                />
              )}
              {pending || submitting ? "A guardar…" : "Guardar evento"}
            </button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
