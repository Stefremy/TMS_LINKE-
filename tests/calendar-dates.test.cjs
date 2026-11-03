const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./helpers/load-typescript.cjs");
const d = createLoader({})("features/calendar/lib/dates.ts");
test("Gregorian dates reject rollover and preserve leap days", () => {
  assert.equal(d.isValidDate("2026-02-30"), false);
  assert.equal(d.isValidDate("2024-02-29"), true);
  assert.equal(d.isValidDate("2026-02-29"), false);
  assert.equal(d.addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(d.addDays("2026-12-31", 1), "2027-01-01");
});
test("weeks start Monday and month grids include adjacent months", () => {
  assert.equal(d.startOfWeek("2026-11-01"), "2026-10-26");
  assert.deepEqual(d.visibleRange("week", "2026-11-03"), {
    start: "2026-11-02",
    end: "2026-11-08",
  });
  const days = d.monthDays("2026-11-03");
  assert.equal(days[0], "2026-10-26");
  assert.equal(days.at(-1), "2026-12-06");
  assert.equal(days.length % 7, 0);
});
test("navigation clamps month ends and UTC days survive Lisbon DST transitions", () => {
  assert.equal(d.navigateDate("2024-01-31", "month", 1), "2024-02-29");
  assert.equal(d.navigateDate("2026-01-31", "month", 1), "2026-02-28");
  assert.equal(d.daysBetween("2026-03-28", "2026-03-30"), 2);
  assert.equal(d.daysBetween("2026-10-24", "2026-10-26"), 2);
  assert.equal(d.todayKey(new Date("2026-07-01T23:30:00Z")), "2026-07-02");
});
test("ranges are inclusive and capped at 366 days", () => {
  assert.equal(d.dateRange("2024-01-01", "2024-12-31").length, 366);
  assert.throws(() => d.dateRange("2024-01-01", "2025-01-01"), /366/);
  assert.throws(() => d.dateRange("2026-02-02", "2026-02-01"));
});
