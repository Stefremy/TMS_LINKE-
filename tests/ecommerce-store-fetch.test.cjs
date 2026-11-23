const { test } = require("node:test")
const assert = require("node:assert/strict")
const { createLoader } = require("./helpers/load-typescript.cjs")

function storeModule({ dns = {}, responses = [] } = {}) {
  const calls = []
  const api = createLoader({
    "node:dns/promises": { async lookup(host) { return (dns[host] || ["203.0.113.10"]).map(address => ({ address, family: address.includes(":") ? 6 : 4 })) } },
    async fetch(url, init = {}) {
      calls.push({ url: String(url), init, headers: Object.fromEntries(new Headers(init.headers)) })
      const next = responses.shift() || { status: 200 }
      return new Response(next.body ?? "{}", { status: next.status, headers: next.location ? { location: next.location } : {} })
    },
  })("lib/ecommerce/store-fetch.ts")
  return { api, calls }
}

test("only public https store addresses are accepted", async () => {
  const { api } = storeModule({ dns: { "intranet.example.pt": ["10.0.0.5"], "mixed.example.pt": ["203.0.113.7", "127.0.0.1"], "v6.example.pt": ["fd00::1"] } })
  for (const bad of ["http://loja.pt", "https://localhost/wp-json", "https://127.0.0.1", "https://169.254.169.254/latest/meta-data", "https://[::1]/",
    "https://192.168.1.10", "https://100.64.0.1", "https://db.internal", "https://loja.pt:8080", "https://user:pw@loja.pt",
    "https://intranet.example.pt", "https://mixed.example.pt", "https://v6.example.pt", "https://[::ffff:10.0.0.1]/", "nada"]) {
    await assert.rejects(api.assertPublicStoreUrl(bad), err => err.name === "StoreUrlError", bad)
  }
  assert.equal((await api.assertPublicStoreUrl("https://encantoperfeito.pt/wp-json")).hostname, "encantoperfeito.pt")
  assert.equal((await api.assertPublicStoreUrl("https://loja.myshopify.com:443/admin")).hostname, "loja.myshopify.com")
})

test("redirects are re-validated and secrets are not forwarded to another origin", async () => {
  const toPrivate = storeModule({ responses: [{ status: 302, location: "https://169.254.169.254/latest" }] })
  await assert.rejects(toPrivate.api.storeFetch("https://loja.pt/api", { headers: { Authorization: "Basic x" } }), /não é um endereço público/)
  assert.equal(toPrivate.calls.length, 1, "the private address is never requested")

  const www = storeModule({ responses: [{ status: 301, location: "https://www.loja.pt/api" }, { status: 301, location: "/api/v2" }, { status: 200 }] })
  const res = await www.api.storeFetch("https://loja.pt/api", { headers: { Authorization: "Basic x", "X-Shopify-Access-Token": "t", "User-Agent": "LinkeTMS/2.0" } })
  assert.equal(res.status, 200)
  assert.equal(www.calls[0].headers.authorization, "Basic x")
  assert.equal(www.calls[1].headers.authorization, undefined, "dropped when leaving the original origin")
  assert.equal(www.calls[1].headers["x-shopify-access-token"], undefined)
  assert.equal(www.calls[1].headers["user-agent"], "LinkeTMS/2.0")
  assert.equal(www.calls[2].url, "https://www.loja.pt/api/v2")
  assert.ok(www.calls.every(call => call.init.redirect === "manual"))

  const loop = storeModule({ responses: Array.from({ length: 5 }, () => ({ status: 302, location: "https://loja.pt/again" })) })
  await assert.rejects(loop.api.storeFetch("https://loja.pt/again"), /demasiadas vezes/)
})

test("a store pointed at an internal address cannot be tested or synced, and http:// is upgraded", async () => {
  const fetches = []
  const { fakeSupabase } = require("./helpers/fake-supabase.cjs")
  const db = fakeSupabase({ audit_log: [{ tenant_id: "t", action: "client_ecommerce_store", created_at: "2026-11-01T00:00:00Z",
    details: { id: "s1", client_id: "c1", name: "X", platform: "woocommerce", store_url: "https://169.254.169.254", credentials: { consumer_key: "ck_1", consumer_secret: "cs_1" }, is_active: true } }] }, null, { persistInserts: true })
  const api = createLoader({
    "@/lib/supabase/server": { createAdminClient: () => db.client },
    "@/lib/auth/context": { async requireClientAccess(id) { return { tenant_id: "t", role: "client", client_id: id, user: { id: "u" } } } },
    async fetch(url) { fetches.push(String(url)); return new Response("{}", { status: 200 }) },
  })("app/actions/client-ecommerce.ts")
  const tested = await api.testStoreConnectionAction("c1", { platform: "woocommerce", store_url: "http://10.0.0.8", credentials: { consumer_key: "ck_a", consumer_secret: "cs_b" } })
  assert.equal(tested.success, false); assert.match(tested.error, /não é um endereço público/)
  const synced = await api.syncStoreOrdersAction("c1", "s1")
  assert.equal(synced.success, false); assert.match(synced.error, /não é um endereço público/)
  assert.deepEqual(fetches, [], "nothing was requested")
  const saved = await api.saveClientStoreAction("c1", { name: "Y", platform: "woocommerce", store_url: "http://loja-y.pt/", credentials: { consumer_key: "ck_y", consumer_secret: "cs_y" } })
  assert.equal(saved.store.store_url, "https://loja-y.pt")
})
