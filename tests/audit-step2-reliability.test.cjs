const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { timingSafeEqual } = require("node:crypto")
const zod = require("zod")
const { PGlite } = require("@electric-sql/pglite")
const { createLoader } = require("./helpers/load-typescript.cjs")
const { fakeSupabase } = require("./helpers/fake-supabase.cjs")

const T = "33333333-3333-4333-8333-333333333333"
const CLIENT_ID = "11111111-1111-4111-8111-111111111111"
const SHIPMENT_ID = "55555555-5555-4555-8555-555555555555"

async function createTrackingDb() {
  const db = new PGlite()
  await db.exec(`
    DO $$ BEGIN
      CREATE ROLE anon NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE ROLE authenticated NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE ROLE service_role NOLOGIN;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TYPE public.shipment_status AS ENUM (
      'rascunho', 'pendente', 'aguarda_correcao', 'recolha',
      'atribuido_motorista', 'recolhido', 'entrada_rede',
      'em_distribuicao', 'entregue', 'incidencia', 'devolvido', 'cancelado'
    );

    CREATE TABLE public.shipments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      tracking_number text,
      carrier_tracking_number text,
      status public.shipment_status NOT NULL DEFAULT 'pendente',
      ops_substatus text,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE public.tracking_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL,
      shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
      event_code text NOT NULL,
      description text NOT NULL,
      timestamp timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX idx_tracking_events_unique_event
      ON public.tracking_events (shipment_id, event_code, timestamp);

    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT SELECT ON public.shipments, public.tracking_events TO service_role;
  `)

  const migrationSql = fs.readFileSync(
    "supabase/migrations/20261110130000_atomic_ctt_tracking_webhook.sql",
    "utf8",
  )
  await db.exec(migrationSql)
  // Prove the migration SQL is safe and idempotent when re-executed
  await db.exec(migrationSql)

  await db.query(
    "INSERT INTO public.shipments (id, tenant_id, tracking_number, status) VALUES ($1, $2, $3, 'pendente')",
    [SHIPMENT_ID, T, "DA000123456PT"],
  )
  return db
}

function pgliteTrackingAdapter(db) {
  return {
    from(table) {
      const filters = []
      const orConditions = []
      let maxRows = null
      async function execSelect() {
        if (table !== "shipments") return { data: null, error: { message: `Unsupported table ${table}` } }
        const clauses = []
        const params = []
        for (const [col, val] of filters) {
          params.push(val)
          clauses.push(`${col} = $${params.length}`)
        }
        if (orConditions.length > 0) {
          const orSql = orConditions.map(([col, val]) => {
            params.push(val)
            return `${col} = $${params.length}`
          }).join(" OR ")
          clauses.push(`(${orSql})`)
        }
        const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : ""
        const limitSql = maxRows !== null ? `LIMIT ${Number(maxRows)}` : ""
        const res = await db.query(
          `SELECT id, tenant_id, status::text AS status, tracking_number, carrier_tracking_number FROM public.shipments ${whereSql} ${limitSql}`,
          params,
        )
        return { data: res.rows, error: null }
      }
      const q = {
        select() { return q },
        eq(col, val) { filters.push([col, val]); return q },
        or(expr) {
          for (const part of String(expr).split(",")) {
            const m = /^([a-zA-Z0-9_]+)\.eq\.(.+)$/.exec(part.trim())
            if (m) orConditions.push([m[1], m[2]])
          }
          return q
        },
        limit(n) { maxRows = n; return q },
        then(resolve, reject) { return execSelect().then(resolve, reject) },
        async single() {
          maxRows = 1
          const res = await execSelect()
          return res.data?.[0]
            ? { data: res.data[0], error: null }
            : { data: null, error: { code: "PGRST116", message: "Not found" } }
        },
        async maybeSingle() { return q.single() },
      }
      return q
    },
    async rpc(name, params) {
      assert.equal(name, "apply_ctt_tracking_webhook_event")
      await db.exec("SET ROLE service_role")
      try {
        const res = await db.query(
          "SELECT public.apply_ctt_tracking_webhook_event($1::uuid, $2::uuid, $3::text, $4::text, $5::public.shipment_status, $6::timestamptz) AS result",
          [
            params.p_shipment_id,
            params.p_tenant_id,
            params.p_event_code,
            params.p_description,
            params.p_target_status,
            params.p_event_timestamp,
          ],
        )
        return { data: res.rows[0].result, error: null }
      } finally {
        await db.exec("RESET ROLE")
      }
    },
  }
}

test("R-01 SQL apply_ctt_tracking_webhook_event: restricts privileges, deduplicates retries, blocks regression and preserves terminal states", async () => {
  const db = await createTrackingDb()

  for (const role of ["anon", "authenticated"]) {
    await db.exec(`SET ROLE ${role}`)
    await assert.rejects(
      db.query(
        "SELECT public.apply_ctt_tracking_webhook_event($1::uuid, $2::uuid, 'EMA', 'Aceitação CTT', 'entrada_rede'::public.shipment_status, '2026-11-10T10:00:00Z'::timestamptz)",
        [SHIPMENT_ID, T],
      ),
      /permission denied/i,
    )
    await db.exec("RESET ROLE")
  }

  await db.exec("SET ROLE service_role")

  // 1. Fresh in-transit update advances status from pendente -> entrada_rede
  const r1 = await db.query(
    "SELECT public.apply_ctt_tracking_webhook_event($1::uuid, $2::uuid, 'EMA', 'Aceitação CTT', 'entrada_rede'::public.shipment_status, '2026-11-10T10:00:00Z'::timestamptz) AS res",
    [SHIPMENT_ID, T],
  )
  assert.equal(r1.rows[0].res.applied, true)
  assert.equal(r1.rows[0].res.duplicate, false)
  assert.equal(r1.rows[0].res.status_updated, true)
  assert.equal((await db.query("SELECT status::text FROM public.shipments WHERE id = $1", [SHIPMENT_ID])).rows[0].status, "entrada_rede")

  // 2. Duplicate retry does not insert another row and reports status_updated=false
  const rDup = await db.query(
    "SELECT public.apply_ctt_tracking_webhook_event($1::uuid, $2::uuid, 'EMA', 'Aceitação CTT', 'entrada_rede'::public.shipment_status, '2026-11-10T10:00:00Z'::timestamptz) AS res",
    [SHIPMENT_ID, T],
  )
  assert.equal(rDup.rows[0].res.applied, false)
  assert.equal(rDup.rows[0].res.duplicate, true)
  assert.equal(rDup.rows[0].res.status_updated, false)
  assert.equal((await db.query("SELECT count(*)::int AS c FROM public.tracking_events WHERE shipment_id = $1", [SHIPMENT_ID])).rows[0].c, 1)

  // 3. Out-of-order older event is stored in audit trail but does not regress shipment status
  const rOld = await db.query(
    "SELECT public.apply_ctt_tracking_webhook_event($1::uuid, $2::uuid, 'EMO', 'Chegada ao Nó Cliente', 'pendente'::public.shipment_status, '2026-11-10T09:00:00Z'::timestamptz) AS res",
    [SHIPMENT_ID, T],
  )
  assert.equal(rOld.rows[0].res.applied, true)
  assert.equal(rOld.rows[0].res.duplicate, false)
  assert.equal(rOld.rows[0].res.status_updated, false)
  assert.equal(rOld.rows[0].res.status, "entrada_rede")
  assert.equal((await db.query("SELECT status::text FROM public.shipments WHERE id = $1", [SHIPMENT_ID])).rows[0].status, "entrada_rede")

  // 4. Delivered advances shipment to terminal state 'entregue'
  const rDel = await db.query(
    "SELECT public.apply_ctt_tracking_webhook_event($1::uuid, $2::uuid, 'EMI', 'Entrega Conseguida', 'entregue'::public.shipment_status, '2026-11-10T12:00:00Z'::timestamptz) AS res",
    [SHIPMENT_ID, T],
  )
  assert.equal(rDel.rows[0].res.status_updated, true)
  assert.equal((await db.query("SELECT status::text FROM public.shipments WHERE id = $1", [SHIPMENT_ID])).rows[0].status, "entregue")

  // 5. Late non-terminal incident after delivery does not overwrite terminal 'entregue'
  const rLate = await db.query(
    "SELECT public.apply_ctt_tracking_webhook_event($1::uuid, $2::uuid, 'EMH', 'Entrega Não Conseguida', 'incidencia'::public.shipment_status, '2026-11-10T13:00:00Z'::timestamptz) AS res",
    [SHIPMENT_ID, T],
  )
  assert.equal(rLate.rows[0].res.applied, true)
  assert.equal(rLate.rows[0].res.status_updated, false)
  assert.equal(rLate.rows[0].res.status, "entregue")
  assert.equal((await db.query("SELECT status::text FROM public.shipments WHERE id = $1", [SHIPMENT_ID])).rows[0].status, "entregue")

  // 6. Unknown shipment fails cleanly without inserting orphaned rows
  const rMissing = await db.query(
    "SELECT public.apply_ctt_tracking_webhook_event($1::uuid, $2::uuid, 'EMA', 'Aceitação CTT', 'entrada_rede'::public.shipment_status, '2026-11-10T14:00:00Z'::timestamptz) AS res",
    ["99999999-9999-4999-8999-999999999999", T],
  )
  assert.equal(rMissing.rows[0].res.applied, false)
  assert.equal(rMissing.rows[0].res.reason, "not_found")
  await db.exec("RESET ROLE")
})

test("R-01 CTT webhook processor & route: maps em_transito -> entrada_rede and sends notification emails once per fresh status change", async () => {
  const db = await createTrackingDb()
  const supabaseAdapter = pgliteTrackingAdapter(db)
  const notifications = []

  const load = createLoader({
    "./ctt-soap-client": { CTTSoapClient: class {} },
    "fast-xml-parser": require("fast-xml-parser"),
    "@/lib/services/ctt/ctt-soap-client": { CTTSoapClient: class {} },
    "@supabase/supabase-js": { createClient: () => supabaseAdapter },
    "node:crypto": { timingSafeEqual },
    "next/server": {
      NextResponse: {
        json(body, init) { return { status: init?.status ?? 200, body } },
      },
    },
    "@/lib/email/tracking-notifications": {
      async sendTrackingEmailNotification(shipmentId, type, extra) {
        notifications.push({ shipmentId, type, extra })
      },
    },
  })

  const { toDbShipmentStatus, processCttWebhookEvent } = load("lib/services/tracking/ctt-webhook.ts")
  assert.equal(toDbShipmentStatus("em_transito"), "entrada_rede")
  assert.equal(toDbShipmentStatus("em_distribuicao"), "em_distribuicao")
  assert.equal(toDbShipmentStatus("entregue"), "entregue")

  // Transit event maps "em_transito" -> "entrada_rede" cleanly in real Postgres enum
  const transitOutcome = await processCttWebhookEvent(supabaseAdapter, {
    tracking_number: "DA000123456PT",
    eventCode: "EMA",
    eventDate: "2026-11-10T10:00:00Z",
  })
  assert.equal(transitOutcome.status, "updated")
  assert.equal(transitOutcome.tms_status, "entrada_rede")
  assert.equal(transitOutcome.shouldNotify, null)

  // HTTP POST webhook route authentication + duplicate suppression
  const prevSecret = process.env.CTT_WEBHOOK_SECRET
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.CTT_WEBHOOK_SECRET = "webhook-secret-test-123"
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.invalid"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"

  try {
    const { POST } = load("app/api/webhooks/ctt/tracking/route.ts")

    const unauthRes = await POST(
      new Request("https://app.linke.pt/api/webhooks/ctt/tracking", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
        body: "{}",
      }),
    )
    assert.equal(unauthRes.status, 401)

    const badJsonRes = await POST(
      new Request("https://app.linke.pt/api/webhooks/ctt/tracking", {
        method: "POST",
        headers: { authorization: "Bearer webhook-secret-test-123" },
        body: "{not-json",
      }),
    )
    assert.equal(badJsonRes.status, 400)

    const emzPayload = JSON.stringify({
      events: [
        { tracking_number: "DA000123456PT", eventCode: "EMZ", eventDate: "2026-11-10T11:00:00Z" },
      ],
    })
    const firstRes = await POST(
      new Request("https://app.linke.pt/api/webhooks/ctt/tracking", {
        method: "POST",
        headers: { authorization: "Bearer webhook-secret-test-123" },
        body: emzPayload,
      }),
    )
    assert.equal(firstRes.status, 200)
    assert.equal(firstRes.body.results[0].status, "updated")
    assert.equal(notifications.length, 1)
    assert.equal(notifications[0].type, "in_transit")

    // Exact duplicate webhook retry triggers 0 extra notifications
    const duplicateRes = await POST(
      new Request("https://app.linke.pt/api/webhooks/ctt/tracking", {
        method: "POST",
        headers: { authorization: "Bearer webhook-secret-test-123" },
        body: emzPayload,
      }),
    )
    assert.equal(duplicateRes.status, 200)
    assert.equal(duplicateRes.body.results[0].status, "duplicate")
    assert.equal(notifications.length, 1)

    // Delivered event followed by late incident keeps 'entregue' and suppresses false incident alert
    await POST(
      new Request("https://app.linke.pt/api/webhooks/ctt/tracking", {
        method: "POST",
        headers: { authorization: "Bearer webhook-secret-test-123" },
        body: JSON.stringify({
          events: [{ tracking_number: "DA000123456PT", eventCode: "EMI", eventDate: "2026-11-10T12:00:00Z" }],
        }),
      }),
    )
    const lateIncidentRes = await POST(
      new Request("https://app.linke.pt/api/webhooks/ctt/tracking", {
        method: "POST",
        headers: { authorization: "Bearer webhook-secret-test-123" },
        body: JSON.stringify({
          events: [{ tracking_number: "DA000123456PT", eventCode: "EMH", eventDate: "2026-11-10T13:00:00Z" }],
        }),
      }),
    )
    assert.equal(lateIncidentRes.status, 200)
    assert.equal(lateIncidentRes.body.results[0].status, "recorded_out_of_order")
    assert.equal(notifications.length, 1)
  } finally {
    if (prevSecret === undefined) delete process.env.CTT_WEBHOOK_SECRET
    else process.env.CTT_WEBHOOK_SECRET = prevSecret
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl
    if (prevKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey
  }
})

test("R-02 E-commerce fulfillment sync: persists failures with timeout signal, supports retry, and awaits result inside submitShipmentFormAction", async () => {
  const storeId = "store-wc-1"
  const tables = {
    audit_log: [
      {
        id: "audit-store-1",
        tenant_id: T,
        action: "client_ecommerce_store",
        created_at: "2026-11-10T08:00:00Z",
        details: {
          id: storeId,
          client_id: CLIENT_ID,
          platform: "woocommerce",
          store_name: "Minha Loja WC",
          store_url: "https://loja.example.invalid",
          credentials: { consumer_key: "ck_test", consumer_secret: "cs_test" },
          is_active: true,
        },
      },
      {
        id: "audit-orders-1",
        tenant_id: T,
        action: "client_ecommerce_synced_orders",
        created_at: "2026-11-10T08:30:00Z",
        details: {
          store_id: storeId,
          client_id: CLIENT_ID,
          synced_at: "2026-11-10T08:30:00Z",
          orders_count: 1,
          orders: [
            {
              id: "501",
              store_id: storeId,
              store_name: "Minha Loja WC",
              order_number: "#1001",
            },
          ],
        },
      },
    ],
  }
  const db = fakeSupabase(tables, null, { persistInserts: true })
  const fetchCalls = []
  let failOrderUpdate = true

  const loadEcommerce = createLoader({
    "@/lib/supabase/server": { createAdminClient: () => db.client },
    "@/lib/auth/context": {
      async requireClientAccess(clientId) {
        assert.equal(clientId, CLIENT_ID)
        return { tenant_id: T, role: "client", client_id: CLIENT_ID, user: { id: "u-1" } }
      },
    },
    "next/cache": { revalidatePath() {} },
    async fetch(url, init = {}) {
      fetchCalls.push({ url: String(url), method: init.method || "GET", hasSignal: Boolean(init.signal) })
      if (String(url).includes("/wp-json/wc/v3/orders?") && (!init.method || init.method === "GET")) {
        return new Response(
          JSON.stringify([
            {
              id: 501,
              number: "1001",
              status: "processing",
              total: "29.90",
              currency: "EUR",
              date_created: "2026-11-10T09:00:00Z",
              billing: { first_name: "Ana", last_name: "Silva", email: "ana@example.pt", phone: "910000001", address_1: "Rua 1", city: "Porto", postcode: "4000-001", country: "PT" },
              line_items: [{ name: "Artigo", quantity: 1, total: "29.90" }],
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }
      if (String(url).endsWith("/wp-json/wc/v3/orders/501") && init.method === "PUT") {
        assert.equal(Boolean(init.signal), true, "Expected AbortSignal timeout on order fulfillment PUT")
        if (failOrderUpdate) {
          return new Response("Bad Gateway", { status: 502 })
        }
        return new Response(JSON.stringify({ id: 501, number: "1001", status: "completed" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }
      throw new Error(`Unexpected fetch URL: ${url} (${init.method})`)
    },
  })

  const ecommerceApi = loadEcommerce("app/actions/client-ecommerce.ts")

  // 1. Initial sync fails with HTTP 502 -> failure recorded durably
  const firstSync = await ecommerceApi.syncStoreOrderForEmittedShipmentAction(CLIENT_ID, {
    shipmentId: SHIPMENT_ID,
    trackingCode: "DA999999999PT",
    orderRef: "1001",
  })
  assert.equal(firstSync.matched, true)
  assert.equal(firstSync.synced, false)
  assert.match(firstSync.error, /502/)

  const failures = await ecommerceApi.getClientFulfillmentSyncFailuresAction(CLIENT_ID)
  assert.equal(failures.length, 1)
  assert.equal(failures[0].order_number, "#1001")
  assert.equal(failures[0].tracking_code, "DA999999999PT")
  assert.equal(failures[0].status, "failed")

  // 2. Manual retry succeeds -> updates audit state to "synced" and clears failure banner list
  failOrderUpdate = false
  const retryRes = await ecommerceApi.retryClientFulfillmentSyncAction(CLIENT_ID, failures[0].sync_key)
  assert.equal(retryRes.success, true)
  assert.equal((await ecommerceApi.getClientFulfillmentSyncFailuresAction(CLIENT_ID)).length, 0)

  // 3. submitShipmentFormAction awaits store fulfillment sync and surfaces warning without failing emission
  const ctx = { tenant_id: T, role: "client", client_id: CLIENT_ID, user: { id: "u-1" }, permissions: [] }
  const client = { id: CLIENT_ID, short_name: "Minha Loja WC", is_active: true }
  const service = { id: "ctt-exp", code: "LK-CTT-EXP", name: "CTT Expresso", carrier_group: "ctt", is_active: true }
  const { shipmentDefaults } = createLoader({ zod })("components/shipments/form/schema.ts")
  const values = {
    ...shipmentDefaults(client),
    senderName: "Origem",
    senderAddress: "Rua A",
    senderCity: "Porto",
    senderPostal: "4000-001",
    senderPhone: "910000001",
    recipientName: "Ana",
    recipientAddress: "Rua B",
    recipientCity: "Lisboa",
    recipientCountry: "PT",
    recipientPostal: "1000-001",
    recipientPhone: "910000002",
    weightKg: 1,
    volumesCount: 1,
    lengthCm: 20,
    widthCm: 15,
    heightCm: 10,
    serviceId: "ctt-exp",
    parcelWeightsKg: [],
    observations: "Encomenda #1001",
  }

  let syncResolvedBeforeReturn = false
  const formApi = createLoader({
    zod,
    "@/lib/auth/context": { requireUser: async () => ctx },
    "@/lib/supabase/server": { createAdminClient: () => db.client },
    "./shipments": {
      async emitClientGuiaAction() {
        return { success: true, id: "ship-emitted-1", guia: "DA777888999PT" }
      },
    },
    "@/lib/pricing/shipment-pricing-context": {
      async loadShipmentPricingContext() { return { client, service } },
    },
    "@/lib/client-portal/suspension": {
      async readPortalAccess() { return { suspended: false, blocked: false } },
    },
    "@/app/actions/client-ecommerce": {
      async syncStoreOrderForEmittedShipmentAction(cid, params) {
        assert.equal(cid, CLIENT_ID)
        assert.equal(params.orderRef, "1001")
        assert.equal(params.trackingCode, "DA777888999PT")
        await new Promise((r) => setTimeout(r, 15))
        syncResolvedBeforeReturn = true
        return { matched: true, synced: false, error: "Timeout na loja", orderNumber: "1001" }
      },
    },
  })("app/actions/shipment-form.ts")

  const submitRes = await formApi.submitShipmentFormAction(values, CLIENT_ID)
  assert.equal(submitRes.success, true)
  assert.equal(syncResolvedBeforeReturn, true, "submitShipmentFormAction must await store fulfillment sync")
  assert.match(submitRes.dbWarning || "", /1001/)
})

