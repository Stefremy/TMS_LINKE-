import { Suspense } from "react";
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { requireOpsPageAccess } from "@/lib/auth/ops-page-access";
import { requireEmployee } from "@/lib/auth/context";
import {
  fetchCalendarCollaborators,
  fetchCalendarEventRange,
} from "@/app/actions/calendar";
import { CalendarProviders } from "@/features/calendar/components/CalendarProviders";
import { CalendarShell } from "@/features/calendar/components/CalendarShell";
import {
  isValidDate,
  todayKey,
  visibleRange,
} from "@/features/calendar/lib/dates";
import type { CalendarView } from "@/features/calendar/types";
export const metadata = { title: "Calendário | Linke TMS" };
export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOpsPageAccess("/ops/calendario");
  const context = await requireEmployee(),
    params = await searchParams,
    today = todayKey();
  const date =
    typeof params.date === "string" && isValidDate(params.date)
      ? params.date
      : today;
  const view = (
    ["month", "week", "day", "agenda"].includes(String(params.view))
      ? params.view
      : "month"
  ) as CalendarView;
  const range = visibleRange(view, date),
    client = new QueryClient();
  const [people, prefetch] = await Promise.allSettled([
    fetchCalendarCollaborators(),
    client.fetchQuery({
      queryKey: [
        "calendar-events",
        `${context.tenant_id}:${context.user.id}`,
        range.start,
        range.end,
      ],
      queryFn: () => fetchCalendarEventRange(range.start, range.end),
    }),
  ]);
  return (
    <div className="mx-auto w-full max-w-[1720px] p-3 md:p-6">
      <CalendarProviders>
        <HydrationBoundary state={dehydrate(client)}>
          <Suspense
            fallback={<p className="p-8 text-sm">A preparar o calendário…</p>}
          >
            <CalendarShell
              today={today}
              viewer={{
                id: context.user.id,
                tenantId: context.tenant_id,
                email: context.user.email || "",
                isAdmin: context.role === "admin",
                collaboratorId: context.colaborador_id,
              }}
              collaborators={people.status === "fulfilled" ? people.value : []}
              directoryError={
                people.status === "rejected"
                  ? "Não foi possível consultar os colaboradores. Atualize a página."
                  : ""
              }
              initialError={
                prefetch.status === "rejected"
                  ? "Não foi possível consultar os eventos."
                  : ""
              }
            />
          </Suspense>
        </HydrationBoundary>
      </CalendarProviders>
    </div>
  );
}
