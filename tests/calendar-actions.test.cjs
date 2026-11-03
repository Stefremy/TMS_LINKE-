const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { createLoader } = require("./helpers/load-typescript.cjs");
const tenant = "11111111-1111-1111-1111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
const values = {
  title: "Reunião",
  description: "",
  event_date: "2026-11-03",
  end_date: "2026-11-04",
  all_day: true,
  time: "",
  end_time: "",
  collab_id: "person",
  shipment_tracking_number: "",
};
function harness(allowed = true, role = "employee") {
  const calls = [],
    context = {
      tenant_id: tenant,
      user: { id: "authenticated-user", email: "real@example.pt" },
      role,
      colaborador_id: "person",
    };
  const db = {
    rpc: async (name, params) => {
      calls.push({ name, params });
      return {
        data: [
          {
            id,
            group_id: id,
            event_date: "2026-11-03",
            title: "Reunião",
            collab_id: "person",
            updated_at: "2026-11-03T10:00:00Z",
          },
        ],
        error: null,
      };
    },
  };
  const load = createLoader({
    zod: require("zod"),
    "node:crypto": { randomUUID: () => id },
    "next/cache": { revalidatePath() {} },
    "@/lib/auth/context": {
      LINKE_TENANT_ID: tenant,
      requireEmployee: async () => {
        if (!allowed) throw Error("denied");
        return context;
      },
    },
    "@/lib/supabase/server": { createAdminClient: () => db },
    "@/lib/auth/staff-directory": {
      listStaffAuthUsers: async () => [],
      loadStaffDirectory: async () => [
        {
          id: "person",
          name: "Pessoa",
          email: "person@example.pt",
          status: "Ativo",
          salary: 9999,
          permissions: ["private"],
        },
      ],
    },
  });
  return { calls, api: load("app/actions/calendar.ts") };
}
test("every calendar action authenticates staff before querying or mutating", async () => {
  const h = harness(false);
  for (const run of [
    () => h.api.fetchCalendarEvents(2026, 10),
    () => h.api.fetchCalendarEventRange("2026-11-01", "2026-11-30"),
    () => h.api.addCalendarEvent(values),
    () => h.api.updateCalendarEvent(id, values, "2026-11-03T10:00:00Z"),
    () => h.api.deleteCalendarEvent(id, "2026-11-03T10:00:00Z"),
    () => h.api.fetchCalendarCollaborators(),
  ])
    await assert.rejects(run, /denied/);
  assert.equal(h.calls.length, 0);
});
test("mutations derive tenant, actor, creator and admin status from the session", async () => {
  const h = harness();
  const result = await h.api.addCalendarEvent({
    ...values,
    creator_email: "forged@example.pt",
    p_admin: true,
  });
  assert.equal(result.success, true);
  const p = h.calls[0].params;
  assert.equal(p.p_actor, "authenticated-user");
  assert.equal(p.p_email, "real@example.pt");
  assert.equal(p.p_admin, false);
  assert.equal(p.p_tenant, tenant);
  assert.equal(p.p_event.creator_email, undefined);
  assert.equal(p.p_event.p_admin, undefined);
  await h.api.updateCalendarEvent(id, values, "2026-11-03T10:00:00Z");
  assert.equal(h.calls[1].params.p_create, false);
  await h.api.deleteCalendarEvent(id, "2026-11-03T10:00:00Z");
  assert.equal(h.calls[2].name, "calendar_delete_group");
});
test("staff directory exposes only calendar-safe fields and invalid ranges never reach storage", async () => {
  const h = harness();
  assert.deepEqual(await h.api.fetchCalendarCollaborators(), [
    { id: "person", name: "Pessoa", email: "person@example.pt" },
  ]);
  assert.equal(
    (await h.api.addCalendarEvent({ ...values, collab_id: "unknown" })).success,
    false,
  );
  assert.equal(
    (await h.api.addCalendarEvent({ ...values, end_date: "2028-01-01" }))
      .success,
    false,
  );
  await assert.rejects(
    () => h.api.fetchCalendarEventRange("2026-01-01", "2028-01-01"),
    /366/,
  );
  assert.equal(h.calls.length, 0);
});

test("the original create action remains usable before the grouping migration is deployed", async () => {
  let inserted;
  const tenant = "11111111-1111-1111-1111-111111111111";
  const context = {
    tenant_id: tenant,
    user: { id: "user", email: "real@example.pt" },
    role: "employee",
    colaborador_id: "person",
  };
  const api = createLoader({
    zod: require("zod"),
    "node:crypto": { randomUUID: () => id },
    "next/cache": { revalidatePath() {} },
    "@/lib/auth/context": {
      LINKE_TENANT_ID: tenant,
      requireEmployee: async () => context,
    },
    "@/lib/supabase/server": {
      createAdminClient: () => ({
        rpc: async () => ({ data: null, error: { code: "PGRST202" } }),
      }),
      createClient: async () => ({
        from: () => ({
          insert: (rows) => {
            inserted = rows;
            return {
              select: async () => ({
                data: rows.map((row, index) => ({ ...row, id: String(index) })),
                error: null,
              }),
            };
          },
        }),
      }),
    },
    "@/lib/auth/staff-directory": {
      listStaffAuthUsers: async () => [],
      loadStaffDirectory: async () => [
        {
          id: "person",
          name: "Pessoa",
          email: "person@example.pt",
          status: "Ativo",
        },
      ],
    },
  })("app/actions/calendar.ts");
  const result = await api.addCalendarEvent(values);
  assert.equal(result.success, true);
  assert.equal(inserted.length, 2);
  assert.ok(
    inserted.every(
      (row) =>
        row.creator_email === "real@example.pt" &&
        !Object.hasOwn(row, "group_id") &&
        !Object.hasOwn(row, "tenant_id"),
    ),
  );
});
