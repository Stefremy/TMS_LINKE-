"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  requireEmployee,
  LINKE_TENANT_ID,
  type AuthContext,
} from "@/lib/auth/context";
import {
  listStaffAuthUsers,
  loadStaffDirectory,
} from "@/lib/auth/staff-directory";
import {
  calendarEventSchema,
  type CalendarEventValues,
} from "@/features/calendar/schema";
import {
  dateRange,
  endOfMonth,
  isValidDate,
} from "@/features/calendar/lib/dates";
import {
  expandCalendarEvent,
  groupCalendarRows,
} from "@/features/calendar/lib/events";
import type {
  CalendarActionResult,
  CalendarCollaborator,
  CalendarEvent,
  CalendarRangeData,
  CalendarRow,
} from "@/features/calendar/types";

export type CalendarEventInsert = {
  title: string;
  description?: string;
  time?: string;
  event_date: string;
  end_date?: string;
  end_time?: string;
  all_day?: boolean;
  collab_id: string;
  creator_email?: string;
  shipment_tracking_number?: string;
};
const migrationError =
  "A edição do novo calendário ainda não está ativa. Utilize o calendário anterior ou contacte um administrador.";
function missingSchema(code?: string) {
  return ["PGRST202", "PGRST204", "42703", "42883"].includes(code || "");
}
async function directory(
  context: AuthContext,
): Promise<CalendarCollaborator[]> {
  const db = createAdminClient();
  const profiles = await loadStaffDirectory(
    db,
    context.tenant_id,
    await listStaffAuthUsers(db),
  );
  return profiles
    .filter((profile) => profile.status !== "Inativo")
    .map(({ id, name, email }) => ({ id, name, email }));
}
/** Same trusted staff directory as the employee editor; no salary/access/private fields leave this action. */
export async function fetchCalendarCollaborators() {
  return directory(await requireEmployee());
}

async function dailyRows(
  context: AuthContext,
  start: string,
  end: string,
): Promise<CalendarRow[]> {
  const db = createAdminClient();
  let result = await db
    .from("calendar_events")
    .select("*")
    .eq("tenant_id", context.tenant_id)
    .gte("event_date", start)
    .lte("event_date", end)
    .order("event_date")
    .limit(20000);
  if (
    missingSchema(result.error?.code) &&
    context.tenant_id === LINKE_TENANT_ID
  ) {
    // Before migration this single-tenant table is still protected by the session's RLS.
    result = await (
      await createClient()
    )
      .from("calendar_events")
      .select("*")
      .gte("event_date", start)
      .lte("event_date", end)
      .order("event_date")
      .limit(20000);
  }
  if (result.error || (result.data?.length || 0) >= 20000)
    throw new Error(
      "Não foi possível consultar todos os eventos. Atualize o calendário.",
    );
  return result.data || [];
}
/** Retains the zero-based month signature used by the original calendar. */
export async function fetchCalendarEvents(year: number, month: number) {
  const context = await requireEmployee();
  if (
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 9998 ||
    !Number.isInteger(month) ||
    month < 0 ||
    month > 11
  )
    throw new Error("Período inválido.");
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return dailyRows(context, start, endOfMonth(start));
}
export async function fetchCalendarEventRange(
  start: string,
  end: string,
): Promise<CalendarRangeData> {
  const context = await requireEmployee();
  dateRange(start, end);
  const { data, error } = await createAdminClient().rpc(
    "calendar_read_groups",
    { p_tenant: context.tenant_id, p_start: start, p_end: end },
  );
  if (missingSchema(error?.code))
    return {
      events: groupCalendarRows(await dailyRows(context, start, end)),
      migrationRequired: true,
    };
  if (error)
    throw new Error("Não foi possível consultar os eventos. Tente novamente.");
  return {
    events: ((data || []) as CalendarEvent[]).map((event) => ({
      ...event,
      description: event.description || "",
      legacy: false,
    })),
    migrationRequired: false,
  };
}
async function saveCalendarEvent(
  input: CalendarEventInsert,
  groupId?: string,
  expected?: string,
): Promise<CalendarActionResult> {
  const context = await requireEmployee();
  const parsed = calendarEventSchema.safeParse({
    ...input,
    description: input.description || "",
    end_date: input.end_date || input.event_date,
    all_day: input.all_day ?? !input.time,
    time: input.time || "",
    end_time: input.end_time || "",
    shipment_tracking_number: input.shipment_tracking_number || "",
  });
  if (!parsed.success)
    return {
      success: false as const,
      error: "Verifique os campos assinalados.",
      fieldErrors: parsed.error.issues.map((issue) => ({
        field: String(issue.path[0]),
        message: issue.message,
      })),
    };
  if (
    groupId &&
    (!/^[0-9a-f-]{36}$/i.test(groupId) ||
      !expected ||
      !Number.isFinite(Date.parse(expected)))
  )
    return {
      success: false as const,
      error: "Atualize o calendário antes de alterar o evento.",
    };
  const values = parsed.data;
  if (
    !(await directory(context)).some((person) => person.id === values.collab_id)
  )
    return {
      success: false as const,
      error: "Selecione um colaborador ativo desta empresa.",
      fieldErrors: [
        {
          field: "collab_id",
          message: "Selecione um colaborador ativo desta empresa.",
        },
      ],
    };
  const db = createAdminClient();
  if (values.shipment_tracking_number) {
    const guide = values.shipment_tracking_number;
    const results = await Promise.all(
      ["tracking_number", "carrier_tracking_number"].map((column) =>
        db
          .from("shipments")
          .select("id")
          .eq("tenant_id", context.tenant_id)
          .eq(column, guide)
          .limit(1),
      ),
    );
    if (!results.some((result) => !result.error && result.data?.length))
      return {
        success: false as const,
        error: "A guia não foi encontrada nesta empresa.",
        fieldErrors: [
          {
            field: "shipment_tracking_number",
            message: "A guia não foi encontrada nesta empresa.",
          },
        ],
      };
  }
  const { data, error } = await db.rpc("calendar_save_group", {
    p_tenant: context.tenant_id,
    p_actor: context.user.id,
    p_email: context.user.email || "",
    p_admin: context.role === "admin",
    p_group: groupId || randomUUID(),
    p_create: !groupId,
    p_expected: expected || null,
    p_event: values,
  });
  if (
    missingSchema(error?.code) &&
    !groupId &&
    context.tenant_id === LINKE_TENANT_ID &&
    !values.shipment_tracking_number
  ) {
    // Keep the original create action usable until the reviewed migration is deployed.
    const legacy = expandCalendarEvent(values, randomUUID(), {
      id: context.user.id,
      email: context.user.email || "",
      tenantId: context.tenant_id,
      isAdmin: context.role === "admin",
      collaboratorId: context.colaborador_id,
    }).map(
      ({ title, description, time, event_date, collab_id, creator_email }) => ({
        title,
        description,
        time,
        event_date,
        collab_id,
        creator_email,
      }),
    );
    const saved = await (
      await createClient()
    )
      .from("calendar_events")
      .insert(legacy)
      .select();
    if (saved.error)
      return {
        success: false,
        error: "Não foi possível guardar o evento. Tente novamente.",
      };
    revalidatePath("/ops/calendario");
    return {
      success: true,
      data: saved.data?.[0],
      events: saved.data || [],
      event: groupCalendarRows(saved.data || [])[0],
    };
  }
  if (error)
    return {
      success: false as const,
      error: missingSchema(error.code)
        ? migrationError
        : error.code === "40001" || error.code === "42501"
          ? error.message
          : "Não foi possível guardar o evento. Atualize o calendário antes de repetir.",
    };
  const rows = (data || []) as CalendarRow[];
  revalidatePath("/ops/calendario");
  return {
    success: true as const,
    data: rows[0],
    events: rows,
    event: groupCalendarRows(rows)[0],
  };
}
export async function addCalendarEvent(event: CalendarEventInsert) {
  return saveCalendarEvent(event);
}
export async function updateCalendarEvent(
  groupId: string,
  event: CalendarEventValues,
  expectedUpdatedAt: string,
) {
  return saveCalendarEvent(event, groupId, expectedUpdatedAt);
}
export async function deleteCalendarEvent(
  groupId: string,
  expectedUpdatedAt: string,
): Promise<CalendarActionResult> {
  const context = await requireEmployee();
  if (
    !/^[0-9a-f-]{36}$/i.test(groupId) ||
    !isValidDate(expectedUpdatedAt.slice(0, 10))
  )
    return {
      success: false as const,
      error: "Atualize o calendário antes de eliminar o evento.",
    };
  const { error } = await createAdminClient().rpc("calendar_delete_group", {
    p_tenant: context.tenant_id,
    p_actor: context.user.id,
    p_email: context.user.email || "",
    p_admin: context.role === "admin",
    p_group: groupId,
    p_expected: expectedUpdatedAt,
  });
  if (error)
    return {
      success: false as const,
      error: missingSchema(error.code)
        ? migrationError
        : error.code === "40001" || error.code === "42501"
          ? error.message
          : "Não foi possível eliminar o evento.",
    };
  revalidatePath("/ops/calendario");
  return { success: true as const };
}
