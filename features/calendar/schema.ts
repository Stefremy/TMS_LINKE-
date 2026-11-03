import { z } from "zod";
import { daysBetween, isValidDate } from "./lib/dates";
const date = z.string().refine(isValidDate, "Indique uma data válida.");
const time = z
  .string()
  .refine(
    (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
    "Indique uma hora válida.",
  );
export const calendarEventSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Indique o título.")
      .max(160, "Use até 160 caracteres."),
    description: z.string().trim().max(4000, "Use até 4000 caracteres."),
    collab_id: z.string().trim().min(1, "Selecione o colaborador."),
    event_date: date,
    end_date: date,
    all_day: z.boolean(),
    time,
    end_time: time,
    shipment_tracking_number: z
      .string()
      .trim()
      .max(80, "Use até 80 caracteres.")
      .regex(/^[\p{L}\p{N} /_-]*$/u, "Indique um número de guia válido."),
  })
  .superRefine((event, ctx) => {
    if (isValidDate(event.event_date) && isValidDate(event.end_date)) {
      const duration = daysBetween(event.event_date, event.end_date);
      if (duration < 0)
        ctx.addIssue({
          code: "custom",
          path: ["end_date"],
          message:
            "A data de fim deve ser igual ou posterior à data de início.",
        });
      if (duration > 365)
        ctx.addIssue({
          code: "custom",
          path: ["end_date"],
          message: "Escolha um período de até 366 dias.",
        });
    }
    if (
      !event.all_day &&
      (!event.time || (event.end_time && event.end_time <= event.time))
    )
      ctx.addIssue({
        code: "custom",
        path: ["end_time"],
        message: "A hora de fim deve ser posterior à hora de início.",
      });
  });
export type CalendarEventValues = z.infer<typeof calendarEventSchema>;
export function calendarDefaults(
  day: string,
  collaboratorId = "",
  time = "",
): CalendarEventValues {
  return {
    title: "",
    description: "",
    collab_id: collaboratorId,
    event_date: day,
    end_date: day,
    all_day: !time,
    time: time || "09:00",
    end_time: time
      ? `${time.slice(0, 2) === "23" ? "23:59" : String(Number(time.slice(0, 2)) + 1).padStart(2, "0") + ":00"}`
      : "10:00",
    shipment_tracking_number: "",
  };
}
