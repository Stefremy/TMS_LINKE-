const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createLoader } = require("./helpers/load-typescript.cjs");
const load = createLoader({ zod: require("zod") });
const { calendarEventSchema } = load("features/calendar/schema.ts");
const { expandCalendarEvent, groupCalendarRows } = load(
  "features/calendar/lib/events.ts",
);
const { shiftEvent } = load("features/calendar/lib/dates.ts");
const value = () => ({
  title: "Férias",
  description: "",
  collab_id: "collaborator",
  event_date: "2026-12-30",
  end_date: "2027-01-02",
  all_day: true,
  time: "09:00",
  end_time: "10:00",
  shipment_tracking_number: "",
});
test("one shared group expands across years and regroups into a complete event", () => {
  const rows = expandCalendarEvent(value(), "group", {
    id: "user",
    email: "owner@example.pt",
  });
  assert.equal(rows.length, 4);
  assert.equal(rows[0].event_date, "2026-12-30");
  assert.equal(rows[3].event_date, "2027-01-02");
  assert.ok(
    rows.every((r) => r.group_id === "group" && r.all_day && r.time === null),
  );
  const events = groupCalendarRows(
    rows.map((r, i) => ({ ...r, id: String(i) })),
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].start_date, "2026-12-30");
  assert.equal(events[0].end_date, "2027-01-02");
});
test("legacy matching titles remain separate events and all-day is inferred safely", () => {
  const rows = ["2026-01-01", "2026-01-02"].map((event_date, i) => ({
    id: String(i),
    event_date,
    title: "Reunião",
    collab_id: "a",
    time: i ? "09:00" : null,
  }));
  const events = groupCalendarRows(rows);
  assert.equal(events.length, 2);
  assert.equal(events[0].all_day, true);
  assert.equal(events[1].all_day, false);
  assert.ok(events.every((e) => e.legacy));
});
test("client and server schema rejects impossible dates, reversed dates/times and >366 days", () => {
  for (const patch of [
    { event_date: "2026-02-30" },
    { end_date: "2026-12-29" },
    { end_date: "2028-01-01" },
    { all_day: false, time: "13:00", end_time: "12:00" },
    { all_day: false, time: "25:00" },
  ])
    assert.equal(
      calendarEventSchema.safeParse({ ...value(), ...patch }).success,
      false,
    );
  assert.equal(
    calendarEventSchema.safeParse({
      ...value(),
      event_date: "2024-01-01",
      end_date: "2024-12-31",
    }).success,
    true,
  );
});
test("drag moves the whole range and preserves duration; midnight overflow is rejected", () => {
  const event = {
    ...groupCalendarRows(
      expandCalendarEvent(
        { ...value(), all_day: false, time: "09:00", end_time: "10:00" },
        "g",
        { id: "u", email: "x" },
      ).map((r, i) => ({ ...r, id: String(i) })),
    )[0],
  };
  const moved = shiftEvent(event, 2, 30);
  assert.equal(moved.start_date, "2027-01-01");
  assert.equal(moved.end_date, "2027-01-04");
  assert.equal(moved.time, "09:30–10:30");
  assert.throws(() => shiftEvent(event, 0, -600), /mesmo dia/);
});
