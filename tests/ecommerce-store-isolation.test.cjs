const { test } = require("node:test")
const assert = require("node:assert/strict")
const { createLoader } = require("./helpers/load-typescript.cjs")
const { fakeSupabase } = require("./helpers/fake-supabase.cjs")

// Linke is one organization (tenant) with many clients: a store id alone must never grant access.
const T = "tenant-linke"
const A = "client-a", B = "client-b"
const B_STORE = "store-b"
const B_SECRET = { consumer_key: "ck_victim_key_123456", consumer_secret: "cs_victim_secret_987654" }

function harness() {
  const tables = { audit_log: [
    { id: "r1", tenant_id: T, action: "client_ecommerce_store", created_at: "2026-11-01T10:00:00Z",
      details: { id: B_STORE, client_id: B, tenant_id: T, name: "Loja B", platform: "woocommerce", store_url: "https://loja-b.pt", credentials: B_SECRET, is_active: true, created_at: "2026-11-01T10:00:00Z" } },
  ] }
  const db = fakeSupabase(tables, null, { persistInserts: true })
  const fetches = []
  const load = createLoader({
    "@/lib/supabase/server": { createAdminClient: () => db.client },
    // The session is allowed to act for the client it names (the real check is requireClientAccess).
    "@/lib/auth/context": { async requireClientAccess(clientId) { return { tenant_id: T, role: "client", client_id: clientId, user: { id: `u-${clientId}` } } } },
    "next/cache": { revalidatePath() {} },
    async fetch(url, init = {}) {
      fetches.push({ url: String(url), init })
      if (String(url).includes("/wp-json/wc/v3/orders")) return new Response("[]", { status: 200, headers: { "content-type": "application/json" } })
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
    },
  })
  return { tables, db, fetches, api: load("app/actions/client-ecommerce.ts") }
}
const leaked = (value) => JSON.stringify(value).includes(B_SECRET.consumer_secret) || JSON.stringify(value).includes(B_SECRET.consumer_key)

test("another client of the same tenant cannot test, save, sync or update a store it does not own", async () => {
  const h = harness()
  const masked = { consumer_key: "ck_vict••••••••", consumer_secret: "cs_••••••••" }

  const tested = await h.api.testStoreConnectionAction(A, { platform: "woocommerce", store_url: "https://attacker.example", credentials: masked, existingStoreId: B_STORE })
  assert.equal(tested.success, false)
  const saved = await h.api.saveClientStoreAction(A, { id: B_STORE, name: "Minha", platform: "woocommerce", store_url: "https://attacker.example", credentials: masked })
  assert.equal(saved.success, false); assert.match(saved.error, /Loja não encontrada/)
  const synced = await h.api.syncStoreOrdersAction(A, B_STORE)
  assert.equal(synced.success, false)
  const tracked = await h.api.updateStoreOrderTrackingAction(A, B_STORE, "501", "EQ1PT")
  assert.equal(tracked.success, false)

  assert.equal(h.fetches.length, 0, "the victim's credentials were never sent anywhere")
  assert.equal(h.tables.audit_log.length, 1, "no record was created with the victim's store id")
  assert.equal([tested, saved, synced, tracked].some(leaked), false)
  assert.deepEqual(await h.api.getClientStoresAction(A), [])
})

test("the owner keeps working, and a forged record with the owner's store id is ignored", async () => {
  const h = harness()
  h.tables.audit_log.push({ id: "forged", tenant_id: T, action: "client_ecommerce_store", created_at: "2026-11-20T10:00:00Z",
    details: { id: B_STORE, client_id: A, name: "Forjada", platform: "woocommerce", store_url: "https://attacker.example", credentials: { consumer_key: "ck_x", consumer_secret: "cs_x" }, is_active: true } })
  const synced = await h.api.syncStoreOrdersAction(B, B_STORE)
  assert.equal(synced.success, true, synced.error)
  assert.ok(h.fetches.length > 0 && h.fetches.every(f => f.url.startsWith("https://loja-b.pt/")), "the owner's own store is used")
  const stores = await h.api.getClientStoresAction(B)
  assert.equal(stores.length, 1); assert.equal(stores[0].store_url, "https://loja-b.pt"); assert.equal(leaked(stores), false)
})

test("saving returns masked credentials, editing keeps the saved secrets, and a deleted store can no longer sync", async () => {
  const h = harness()
  const created = await h.api.saveClientStoreAction(A, { name: "Loja A", platform: "woocommerce", store_url: "loja-a.pt",
    credentials: { consumer_key: "ck_aaaaaaaaaaaa", consumer_secret: "cs_bbbbbbbbbbbbbb" } })
  assert.equal(created.success, true)
  assert.doesNotMatch(JSON.stringify(created), /cs_bbbbbbbbbbbbbb|ck_aaaaaaaaaaaa/)
  const edited = await h.api.saveClientStoreAction(A, { id: created.store.id, name: "Loja A2", platform: "woocommerce", store_url: "loja-a.pt", credentials: created.store.credentials })
  assert.equal(edited.success, true, edited.error)
  const stored = h.tables.audit_log.filter(r => r.details?.id === created.store.id && r.action === "client_ecommerce_store").at(-1)
  assert.equal(stored.details.credentials.consumer_secret, "cs_bbbbbbbbbbbbbb", "masked fields keep the saved secret")
  assert.equal((await h.api.syncStoreOrdersAction(A, created.store.id)).success, true)
  await new Promise(resolve => setTimeout(resolve, 5)) // records are ordered by created_at; keep them distinct in the fixture
  assert.equal((await h.api.deleteClientStoreAction(A, created.store.id)).success, true)
  const afterDelete = await h.api.syncStoreOrdersAction(A, created.store.id)
  assert.equal(afterDelete.success, false)
})
