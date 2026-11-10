const test = require("node:test")
const assert = require("node:assert/strict")
const { createLoader } = require("./helpers/load-typescript.cjs")
const { fakeSupabase } = require("./helpers/fake-supabase.cjs")

test("NOT-002 PUDO configuration uses key/value schema on whatsapp_communications_config", async () => {
  const tables = {
    whatsapp_communications_config: [
      {
        key: "pudo_notifications",
        value: {
          INITIAL_PARCEL: { notified: true, updatedAt: "2026-11-10T08:00:00Z" },
        },
      },
    ],
  }
  const db = fakeSupabase(tables)

  const load = createLoader({
    "@/lib/supabase/server": { createAdminClient: () => db.client },
  })
  const { loadPudoNotifiedMap, setPudoShipmentNotified } = load(
    "lib/services/communications/shipment-sources.ts"
  )

  // Reads pre-existing notification state using key: 'pudo_notifications' and .value
  const initial = await loadPudoNotifiedMap()
  assert.equal(initial.INITIAL_PARCEL.notified, true)

  // Query checked key='pudo_notifications'
  const readQuery = db.queries.find((q) => q.table === "whatsapp_communications_config")
  assert.ok(readQuery)
  assert.deepEqual(
    readQuery.filters.find((f) => f.field === "key"),
    { field: "key", value: "pudo_notifications", kind: "eq" }
  )

  // Write new notification state
  const updated = await setPudoShipmentNotified("DA123456789PT", true)
  assert.equal(updated["DA123456789PT"].notified, true)

  // Verify upsert wrote key: 'pudo_notifications' with jsonb value
  const write = db.writes.find(
    (w) => w.table === "whatsapp_communications_config" && w.kind === "upsert"
  )
  assert.ok(write, "Expected upsert on whatsapp_communications_config")
  assert.equal(write.value.key, "pudo_notifications")
  assert.equal(write.value.value["DA123456789PT"].notified, true)
  assert.equal(write.value.value.INITIAL_PARCEL.notified, true)
})

test("NOT-003 & PERF-002 fetchUnifiedShipmentsByCategory: failed_XXX statuses do not mark shipment as notified, and queries filter by tracking_number", async () => {
  const trackingNumber = "DA999888777PT"
  const tables = {
    shipments: [
      {
        id: "ship-1",
        tracking_number: trackingNumber,
        carrier_tracking_number: trackingNumber,
        status: "em_distribuicao",
        sender_name: "Remetente",
        recipient_name: "Destinatario",
        recipient_phone: "912345678",
        created_at: "2026-11-10T08:00:00Z",
        updated_at: "2026-11-10T10:00:00Z",
      },
    ],
    whatsapp_logs: [
      {
        id: "log-1",
        tracking_number: trackingNumber,
        direction: "outbound",
        status: "failed_400", // Meta rejected template
        template_name: "order_distribuicao",
        created_at: "2026-11-10T09:00:00Z",
      },
    ],
    whatsapp_communications_config: [],
  }
  const db = fakeSupabase(tables)

  const load = createLoader({
    "@/lib/supabase/server": { createAdminClient: () => db.client },
  })
  const { fetchUnifiedShipmentsByCategory } = load(
    "lib/services/communications/shipment-sources.ts"
  )

  const result = await fetchUnifiedShipmentsByCategory("em_distribuicao", {
    sourceMode: "tms_linke",
  })

  assert.equal(result.rows.length, 1)
  const item = result.rows[0]
  // NOT-003: failed_400 must NOT mark alreadyNotified as true
  assert.equal(item.alreadyNotified, false, "Failed Meta status (failed_400) must not count as already notified")

  // PERF-002: Query inspected tracking keys specifically via .in()
  const logQueries = db.queries.filter((q) => q.table === "whatsapp_logs")
  assert.ok(logQueries.length > 0, "Expected targeted query on whatsapp_logs")
  const inFilter = logQueries[0].filters.find((f) => f.field === "tracking_number" && f.kind === "in")
  assert.ok(inFilter, "Expected whatsapp_logs query to filter by tracking_number in chunk")
  assert.ok(inFilter.value.includes(trackingNumber))

  // Now simulate successful delivery log
  tables.whatsapp_logs.unshift({
    id: "log-2",
    tracking_number: trackingNumber,
    direction: "outbound",
    status: "accepted",
    template_name: "order_distribuicao",
    created_at: "2026-11-10T11:00:00Z",
  })

  const successResult = await fetchUnifiedShipmentsByCategory("em_distribuicao", {
    sourceMode: "tms_linke",
  })
  assert.equal(successResult.rows[0].alreadyNotified, true)
})

test("NOT-004 sendGenericTemplateMessage treats successful SMS fallback as delivered", async () => {
  const fetchMock = async (url) => {
    const urlStr = String(url)
    if (urlStr.includes("graph.facebook.com")) {
      // Simulate Meta failing with HTTP 400
      return new Response(JSON.stringify({ error: { message: "Template rejected" } }), { status: 400 })
    }
    if (urlStr.includes("rest.clicksend.com")) {
      // ClickSend SMS succeeds
      return new Response(
        JSON.stringify({
          http_code: 200,
          response_code: "SUCCESS",
          response_msg: "Messages queued for delivery.",
          data: {
            messages: [{ message_id: "sms-msg-123", status: "SUCCESS" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    }
    throw new Error(`Unexpected fetch URL: ${urlStr}`)
  }

  const tables = {
    whatsapp_logs: [],
    whatsapp_communications_config: [],
  }
  const db = fakeSupabase(tables, null, { persistInserts: true })

  const load = createLoader({
    "@/lib/supabase/server": { createAdminClient: () => db.client },
    "@supabase/supabase-js": { createClient: () => db.client },
    fetch: fetchMock,
  })

  const { sendGenericTemplateMessage } = load("lib/services/communications/whatsapp-cloud.ts")

  const res = await sendGenericTemplateMessage({
    to: "912345678",
    templateName: "order_em_transporte",
    bodyVariables: ["Cliente", "Linke", "DA123456789PT"],
    config: {
      smsSendingEnabled: true,
      autoSmsFallbackEnabled: true,
      clicksendUsername: "test-user",
      clicksendApiKey: "test-key",
      whatsappAccessToken: "test-token",
      whatsappPhoneNumberId: "test-phone-id",
    },
  })

  assert.equal(res.ok, true, "Overall delivery must be true when SMS fallback succeeded")
  assert.equal(res.delivered, true)
  assert.equal(res.channelUsed, "sms")
  assert.equal(res.status, 200)
})

test("NOT-001 Dispatch lock prevents concurrent duplicate sends and avoids overwriting sent status with failed", async () => {
  const dateKey = "2026-11-10"
  const dispatchKey = `em_distribuicao|${dateKey}|DA555666777PT|351912345678`
  const tables = {
    whatsapp_dispatch_locks: [],
  }
  const db = fakeSupabase(tables, null, { persistInserts: true })

  // Simulate existing completed send
  tables.whatsapp_dispatch_locks.push({
    dispatch_key: dispatchKey,
    notification_type: "em_distribuicao",
    parcel_id: "DA555666777PT",
    recipient_phone: "351912345678",
    source_system: "tms_linke",
    status: "sent",
    run_date_key: dateKey,
    sent_at: "2026-11-10T10:00:00Z",
    created_at: "2026-11-10T10:00:00Z",
    updated_at: "2026-11-10T10:00:00Z",
  })

  let sendAttempted = false
  const load = createLoader({
    "@/lib/supabase/server": { createAdminClient: () => db.client },
    "./shipment-sources": {
      async fetchUnifiedShipmentsForAutoNotification() {
        return {
          rows: [
            {
              parcelId: "DA555666777PT",
              providerTrackingCode: "DA555666777PT",
              recipient: "Ana",
              sender: "Loja",
              finalClientPhone: "912345678",
              service: "Expresso",
              sourceSystem: "tms_linke",
            },
          ],
          sourcesUsed: ["tms_linke"],
          countsBySource: { tms_linke: 1, legacy_tms: 0, combinedDeduped: 1 },
          warnings: [],
        }
      },
    },
    "./whatsapp-cloud": {
      normalizeRecipient: (p) => (p ? `351${p}` : ""),
      async sendGenericTemplateMessage() {
        sendAttempted = true
        return { ok: true, delivered: true, channelUsed: "whatsapp", status: 200 }
      },
    },
    "./config": {
      async loadCommunicationsConfig() {
        return {
          autoNotificationEmDistribuicaoEnabled: true,
          whatsappAccessToken: "token",
          whatsappPhoneNumberId: "phone",
        }
      },
    },
  })

  const { runAutoNotificationByType } = load("lib/services/communications/auto-notifier.ts")

  const res = await runAutoNotificationByType({
    type: "em_distribuicao",
  })

  assert.equal(sendAttempted, false, "Must not attempt send if dispatch_key is already marked sent")
  assert.equal(res.sent, 0)
  assert.equal(res.skippedAlreadySent, 1)
})
