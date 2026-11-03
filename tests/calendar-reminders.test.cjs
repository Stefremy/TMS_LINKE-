const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./helpers/load-typescript.cjs");
const r = createLoader({})("features/calendar/lib/reminders.ts");
const dates = createLoader({})("features/calendar/lib/dates.ts");
const viewer = {
  id: "owner",
  email: "owner@example.test",
  collaboratorId: "staff",
  tenantId: "tenant",
  isAdmin: false,
};
const event = (overrides = {}) => ({
  id: "event",
  title: "Recolha",
  start_date: "2026-11-03",
  end_date: "2026-11-03",
  time: "11:00–12:00",
  all_day: false,
  creator_id: "owner",
  creator_email: null,
  collab_id: "other",
  updated_at: "v1",
  ...overrides,
});
test("operational calendar notifications authenticate and include only personal events even when other alerts fail", async () => {
  let rangeCalls = 0;
  const today = dates.todayKey();
  const load = (denied) =>
    createLoader({
      "@/lib/auth/context": {
        requireEmployee: async () => {
          if (denied) throw new Error("Forbidden");
          return {
            user: { id: viewer.id, email: viewer.email },
            tenant_id: viewer.tenantId,
            role: "employee",
            colaborador_id: viewer.collaboratorId,
          };
        },
      },
      "@/lib/supabase/server": {
        createAdminClient: () => {
          throw new Error("Other alerts unavailable");
        },
      },
      "@/app/actions/clientes": {},
      "@/app/actions/ctt": {},
      "./calendar": {
        fetchCalendarEventRange: async (start, end) => {
          rangeCalls++;
          assert.equal(start, today);
          assert.equal(end, dates.addDays(today, 1));
          return {
            events: [
              event({ all_day: true, start_date: today, end_date: today }),
              event({
                id: "assigned",
                creator_id: "another",
                collab_id: viewer.collaboratorId,
                all_day: true,
                start_date: today,
                end_date: today,
              }),
              event({
                id: "unrelated",
                creator_id: "another",
                all_day: true,
                start_date: today,
                end_date: today,
              }),
            ],
          };
        },
      },
    })("app/actions/notifications.ts");
  await assert.rejects(
    load(true).getOperationalNotificationsAction(),
    /Forbidden/,
  );
  assert.equal(rangeCalls, 0);
  const notifications = await load(false).getOperationalNotificationsAction();
  assert.equal(notifications.length, 2);
  assert.ok(
    notifications.every(
      (item) =>
        item.type === "calendar" &&
        item.id.startsWith(`calendar-${viewer.id}-`) &&
        item.link.includes("event="),
    ),
  );
});
test("Lisbon appointment instants respect summer, winter and nonexistent spring times", () => {
  assert.equal(
    r.lisbonEventTimestamp("2026-07-01", "11:00"),
    Date.parse("2026-07-01T10:00Z"),
  );
  assert.equal(
    r.lisbonEventTimestamp("2026-11-03", "11:00"),
    Date.parse("2026-11-03T11:00Z"),
  );
  assert.equal(r.lisbonEventTimestamp("2026-03-29", "01:30"), null);
});
test("only personal timed events enter the one-hour reminder window", () => {
  const now = new Date("2026-11-03T10:00Z");
  assert.equal(r.dueCalendarReminders([event()], [], viewer, now).length, 1);
  assert.equal(
    r.dueCalendarReminders([event({ time: "11:01" })], [], viewer, now).length,
    0,
  );
  assert.equal(
    r.dueCalendarReminders(
      [
        event({ time: "09:00" }),
        event({ all_day: true }),
        event({ creator_id: "another" }),
      ],
      [],
      viewer,
      now,
    ).length,
    0,
  );
  assert.equal(
    r.isPersonalCalendarEvent(
      event({ creator_id: "another", collab_id: "staff" }),
      viewer,
    ),
    true,
  );
  assert.equal(
    r.isPersonalCalendarEvent(
      event({ creator_id: null, creator_email: "OWNER@EXAMPLE.TEST" }),
      viewer,
    ),
    true,
  );
  assert.equal(
    r.isPersonalCalendarEvent(event({ holiday_country: "PT" }), viewer),
    false,
  );
});
test("midnight and multi-day occurrences have stable distinct reminder identities", () => {
  const e = event({
    start_date: "2026-11-02",
    end_date: "2026-11-04",
    time: "00:15",
  });
  const a = r.dueCalendarReminders(
    [e],
    [],
    viewer,
    new Date("2026-11-02T23:30Z"),
  );
  const b = r.dueCalendarReminders(
    [e],
    [],
    viewer,
    new Date("2026-11-03T23:30Z"),
  );
  assert.equal(a[0].date, "2026-11-03");
  assert.notEqual(a[0].key, b[0].key);
  assert.equal(
    a[0].key,
    r.dueCalendarReminders([e], [], viewer, new Date("2026-11-02T23:40Z"))[0]
      .key,
  );
});
test("holiday reminders start at 10 Lisbon time exactly three days ahead", () => {
  const holidays = [
    event({ id: "holiday", start_date: "2026-11-06", holiday_country: "PT" }),
  ];
  assert.equal(
    r.dueCalendarReminders([], holidays, viewer, new Date("2026-11-03T09:59Z"))
      .length,
    0,
  );
  assert.equal(
    r.dueCalendarReminders([], holidays, viewer, new Date("2026-11-03T10:00Z"))
      .length,
    1,
  );
  assert.equal(
    r.dueCalendarReminders([], holidays, viewer, new Date("2026-11-04T10:00Z"))
      .length,
    0,
  );
});
test("bell includes personal today/tomorrow events and advances ongoing groups to their next occurrence", () => {
  const now = new Date("2026-11-03T12:00Z");
  const result = r.upcomingPersonalEvents(
    [
      event({ all_day: true }),
      event({ id: "past" }),
      event({ id: "group", end_date: "2026-11-04" }),
      event({ id: "soon", time: "12:30" }),
      event({ id: "other", creator_id: "another" }),
    ],
    viewer,
    now,
  );
  assert.deepEqual(
    result.map((x) => x.event.id),
    ["event", "soon", "group"],
  );
  assert.equal(result[1].soon, true);
  assert.equal(result[2].day, "2026-11-04");
});
