const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./helpers/load-typescript.cjs");
function harness() {
  const event = {
    id: "event",
    title: "Reunião",
    description: "",
    start_date: "2026-11-30",
    end_date: "2026-11-30",
    all_day: true,
    time: null,
    collab_id: "person",
    updated_at: "version",
  };
  const november = [
      "calendar-events",
      "tenant:user",
      "2026-11-01",
      "2026-11-30",
    ],
    december = ["calendar-events", "tenant:user", "2026-12-01", "2026-12-31"];
  const before = [
    { events: [event], migrationRequired: false },
    { events: [], migrationRequired: false },
  ];
  const cache = new Map([
      [november, before[0]],
      [december, before[1]],
    ]),
    invalidations = [];
  const client = {
    cancelQueries: async () => {},
    getQueriesData: () => [...cache],
    setQueryData: (key, value) => cache.set(key, value),
    invalidateQueries: async (value) => invalidations.push(value),
  };
  const api = createLoader({
    "@tanstack/react-query": {
      useQueryClient: () => client,
      useMutation: (options) => options,
    },
    sonner: { toast: { error() {}, success() {} } },
    "@/app/actions/calendar": {
      addCalendarEvent: async () => ({
        success: false,
        error: "Título inválido.",
        fieldErrors: [{ field: "title", message: "Indique o título." }],
      }),
    },
  })("features/calendar/hooks/useCalendarEvents.ts");
  return {
    event,
    november,
    december,
    before,
    cache,
    invalidations,
    options: api.useCalendarMutation("tenant:user"),
  };
}
test("optimistic movement updates both cached ranges and restores both snapshots on failure", async () => {
  const h = harness(),
    change = {
      kind: "update",
      event: h.event,
      values: {
        event_date: "2026-12-01",
        end_date: "2026-12-02",
        all_day: true,
      },
    };
  const context = await h.options.onMutate(change);
  assert.equal(h.cache.get(h.november).events.length, 0);
  assert.equal(h.cache.get(h.december).events[0].start_date, "2026-12-01");
  h.options.onError(new Error("Conflict"), change, context);
  assert.equal(h.cache.get(h.november), h.before[0]);
  assert.equal(h.cache.get(h.december), h.before[1]);
  await h.options.onSettled();
  assert.deepEqual(h.invalidations, [
    { queryKey: ["calendar-events", "tenant:user"] },
  ]);
});
test("server validation failures retain field errors for the event form", async () => {
  const h = harness();
  await assert.rejects(
    () => h.options.mutationFn({ kind: "create", values: {} }),
    (error) =>
      error.name === "CalendarMutationError" &&
      error.fieldErrors[0].field === "title",
  );
});
