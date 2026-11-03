const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");
const tenant = "11111111-1111-1111-1111-111111111111",
  owner = "22222222-2222-4222-8222-222222222222",
  other = "33333333-3333-4333-8333-333333333333",
  group = "44444444-4444-4444-8444-444444444444";
async function database() {
  const db = new PGlite();
  await db.exec(`create schema auth; create role anon; create role authenticated; create role service_role;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb);
 create function auth.role() returns text language sql as $$select 'authenticated'::text$$;
 create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;`);
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261008000000_calendar_events.sql",
      "utf8",
    ),
  );
  await db.query(
    "insert into calendar_events(id,title,event_date,collab_id,creator_email,time)values($1,'Antigo','2026-12-31','person','owner@example.pt',null)",
    [group],
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/20261103190000_calendar_groups.sql",
      "utf8",
    ),
  );
  return db;
}
const value = {
  title: "Evento",
  description: "",
  event_date: "2026-12-31",
  end_date: "2027-01-02",
  all_day: false,
  time: "09:00",
  end_time: "10:00",
  collab_id: "person",
  shipment_tracking_number: "",
};
async function save(
  db,
  actor,
  isAdmin,
  create,
  event = value,
  expected = null,
) {
  return (
    await db.query(
      "select calendar_save_group($1,$2,$3,$4,$5,$6,$7,$8) as rows",
      [
        tenant,
        actor,
        actor === owner ? "owner@example.pt" : "other@example.pt",
        isAdmin,
        group,
        create,
        expected,
        event,
      ],
    )
  ).rows[0].rows;
}
test("migration preserves daily legacy rows without guessing groups and closes client mutation access", async () => {
  const db = await database();
  try {
    const row = (await db.query("select * from calendar_events")).rows[0];
    assert.equal(row.group_id, group);
    assert.equal(row.all_day, true);
    assert.equal(row.title, "Antigo");
    assert.equal(row.tenant_id, tenant);
    const policies = (
      await db.query(
        "select policyname from pg_policies where tablename='calendar_events'",
      )
    ).rows;
    assert.deepEqual(
      policies.map((p) => p.policyname),
      ["calendar_staff_read"],
    );
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('authenticated','public.calendar_save_group(uuid,uuid,text,boolean,uuid,boolean,timestamp with time zone,jsonb)','execute') as allowed",
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});
test("group writes/deletes are atomic, owner/admin only, tenant scoped and version checked", async () => {
  const db = await database();
  try {
    await db.query("delete from calendar_events");
    const rows = await save(db, owner, false, true);
    assert.equal(rows.length, 3);
    const version = rows[0].updated_at;
    const range = (
      await db.query(
        "select calendar_read_groups($1,'2027-01-01','2027-01-01') as events",
        [tenant],
      )
    ).rows[0].events;
    assert.equal(range.length, 1);
    assert.equal(range[0].start_date, "2026-12-31");
    assert.equal(range[0].end_date, "2027-01-02");
    await assert.rejects(
      () =>
        save(db, other, false, false, { ...value, title: "Forged" }, version),
      /criador|administrador/,
    );
    assert.equal(
      (await db.query("select count(*)::int as count from calendar_events"))
        .rows[0].count,
      3,
    );
    const changed = await save(
      db,
      other,
      true,
      false,
      { ...value, event_date: "2027-01-05", end_date: "2027-01-06" },
      version,
    );
    assert.equal(changed.length, 2);
    assert.ok(changed.every((row) => row.creator_id === owner));
    await assert.rejects(
      () => save(db, owner, false, false, value, version),
      /alterado/,
    );
    await assert.rejects(
      () =>
        save(
          db,
          owner,
          false,
          false,
          { ...value, time: "25:00" },
          changed[0].updated_at,
        ),
      /hora/,
    );
    assert.equal(
      (
        await db.query(
          "select min(event_date)::text as first from calendar_events",
        )
      ).rows[0].first,
      "2027-01-05",
    );
    await assert.rejects(
      () =>
        db.query("select calendar_delete_group($1,$2,$3,false,$4,$5)", [
          tenant,
          other,
          "other@example.pt",
          group,
          changed[0].updated_at,
        ]),
      /criador|administrador/,
    );
    await db.query("select calendar_delete_group($1,$2,$3,false,$4,$5)", [
      tenant,
      owner,
      "owner@example.pt",
      group,
      changed[0].updated_at,
    ]);
    assert.equal(
      (await db.query("select count(*)::int as count from calendar_events"))
        .rows[0].count,
      0,
    );
  } finally {
    await db.close();
  }
});
test("unknown legacy creators are not editable by arbitrary employees", async () => {
  const db = await database();
  try {
    await db.query(
      "update calendar_events set creator_email=null,creator_id=null",
    );
    const version = (
      await db.query("select updated_at::text as version from calendar_events")
    ).rows[0].version;
    await assert.rejects(
      () => save(db, other, false, false, value, version),
      /criador|administrador/,
    );
  } finally {
    await db.close();
  }
});
