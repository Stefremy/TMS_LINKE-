const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const { PGlite } = require("@electric-sql/pglite")
const { createLoader } = require("./helpers/load-typescript.cjs")

function makeNextResponseMock() {
  return {
    NextResponse: {
      json(body, init = {}) {
        return new Response(JSON.stringify(body), {
          status: init.status || 200,
          headers: { "Content-Type": "application/json", ...(init.headers || {}) },
        })
      },
    },
  }
}

test("authorizeCommunicationsApi enforces 401, 429, granular RBAC, config admin separation and same-origin", async () => {
  let currentAuthState = { context: null, rateLimited: false }
  const load = createLoader({
    "next/server": makeNextResponseMock(),
    "@/lib/auth/context": {
      getAuthContextState: async () => currentAuthState,
    },
  })
  const { authorizeCommunicationsApi } = load("lib/services/communications/api-auth.ts")
  const { PERMISSIONS } = load("lib/auth/permissions.ts")

  const req = new Request("https://tms.example.com/api/ops/communications/chat", {
    method: "POST",
    headers: { origin: "https://tms.example.com" },
  })

  // 1. Rate-limited returns 429
  currentAuthState = { context: null, rateLimited: true }
  let res = await authorizeCommunicationsApi(req)
  assert.equal(res.ok, false)
  assert.equal(res.response.status, 429)

  // 2. Unauthenticated or client returns 401
  currentAuthState = { context: null, rateLimited: false }
  res = await authorizeCommunicationsApi(req)
  assert.equal(res.ok, false)
  assert.equal(res.response.status, 401)

  currentAuthState = { context: { role: "client", permissions: [] }, rateLimited: false }
  res = await authorizeCommunicationsApi(req)
  assert.equal(res.ok, false)
  assert.equal(res.response.status, 401)

  // 3. Employee without communications/support/shipments/clients permission is denied (403)
  currentAuthState = {
    context: { role: "employee", permissions: [PERMISSIONS.reports], user: { email: "ops@linke.pt" } },
    rateLimited: false,
  }
  res = await authorizeCommunicationsApi(req)
  assert.equal(res.ok, false)
  assert.equal(res.response.status, 403)

  // 4. Support employee can use communications routes, but NOT config mutation (403)
  currentAuthState = {
    context: { role: "employee", permissions: [PERMISSIONS.support], user: { email: "suporte@linke.pt" } },
    rateLimited: false,
  }
  res = await authorizeCommunicationsApi(req, { checkOrigin: true })
  assert.equal(res.ok, true)

  const configDenied = await authorizeCommunicationsApi(req, { requireConfigAdmin: true, checkOrigin: true })
  assert.equal(configDenied.ok, false)
  assert.equal(configDenied.response.status, 403)

  // 5. Cross-origin POST is rejected (403)
  const evilReq = new Request("https://tms.example.com/api/ops/communications/sms", {
    method: "POST",
    headers: { origin: "https://evil.example.net" },
  })
  const originDenied = await authorizeCommunicationsApi(evilReq, { checkOrigin: true })
  assert.equal(originDenied.ok, false)
  assert.equal(originDenied.response.status, 403)

  // 6. Admin can access everything (including config mutations on same origin)
  currentAuthState = { context: { role: "admin", permissions: [] }, rateLimited: false }
  const adminRes = await authorizeCommunicationsApi(req, { requireConfigAdmin: true, checkOrigin: true })
  assert.equal(adminRes.ok, true)
})

test("SQL hardening migration locks sync_whatsapp_logs_sequence to service_role only and is idempotent", async (t) => {
  const db = await PGlite.create()
  t.after(() => db.close())

  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
    CREATE TABLE public.shipments (id uuid PRIMARY KEY);
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  `)

  const baseMigration = fs.readFileSync(
    "supabase/migrations/20261109120000_whatsapp_sms_communications.sql",
    "utf8"
  )
  const hardeningMigration = fs.readFileSync(
    "supabase/migrations/20261110120000_harden_sync_whatsapp_logs_sequence.sql",
    "utf8"
  )

  await db.exec(baseMigration)
  await db.exec(hardeningMigration)
  await db.exec(hardeningMigration)

  for (const role of ["anon", "authenticated"]) {
    await db.exec(`SET ROLE ${role}`)
    await assert.rejects(db.exec("SELECT public.sync_whatsapp_logs_sequence()"), /permission denied/)
    await db.exec("RESET ROLE")
  }

  await db.exec("SET ROLE service_role")
  await db.exec("SELECT public.sync_whatsapp_logs_sequence()")
  await db.exec("RESET ROLE")
})

test("S-01 isCronAuthorized: rejects legacy secret, rejects ?secret= query param, and enforces RBAC on staff sessions", async () => {
  const { timingSafeEqual } = require("node:crypto")
  const prevCronSecret = process.env.CRON_SECRET
  let authCtx = null

  const { PERMISSIONS } = createLoader({})("lib/auth/permissions.ts")
  const load = createLoader({
    "node:crypto": { timingSafeEqual },
    "@/lib/auth/context": {
      async getAuthContext() { return authCtx },
    },
  })
  const { isCronAuthorized } = load("lib/services/communications/cron-auth.ts")

  try {
    const legacySecret = ["a1f411e2e71db8c7761be008ecb324f3", "911d5ababe90fcb6953e3a196c9f53e6"].join("")
    process.env.CRON_SECRET = "strong-test-cron-secret-value-123"

    // Legacy hardcoded secret is always rejected everywhere
    assert.equal(await isCronAuthorized(new Request(`https://app.linke.pt/api/cron/x`, { headers: { authorization: `Bearer ${legacySecret}` } })), false)
    assert.equal(await isCronAuthorized(new Request(`https://app.linke.pt/api/cron/x`, { headers: { "x-cron-secret": legacySecret } })), false)
    assert.equal(await isCronAuthorized(new Request(`https://app.linke.pt/api/cron/x?secret=${legacySecret}`)), false)

    // Query parameter ?secret= is rejected even with valid CRON_SECRET
    assert.equal(await isCronAuthorized(new Request(`https://app.linke.pt/api/cron/x?secret=${process.env.CRON_SECRET}`)), false)

    // Valid Bearer and x-cron-secret headers succeed
    assert.equal(await isCronAuthorized(new Request("https://app.linke.pt/api/cron/x", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })), true)
    assert.equal(await isCronAuthorized(new Request("https://app.linke.pt/api/cron/x", { headers: { "x-cron-secret": process.env.CRON_SECRET } })), true)

    // Length-mismatched secret returns false without throwing
    assert.equal(await isCronAuthorized(new Request("https://app.linke.pt/api/cron/x", { headers: { authorization: "Bearer short" } })), false)

    // Session fallback requires /ops/comunicacoes RBAC
    authCtx = { role: "client", permissions: [] }
    assert.equal(await isCronAuthorized(new Request("https://app.linke.pt/api/cron/x")), false)

    authCtx = { role: "employee", permissions: [PERMISSIONS.reports] }
    assert.equal(await isCronAuthorized(new Request("https://app.linke.pt/api/cron/x")), false)

    authCtx = { role: "employee", permissions: [PERMISSIONS.support] }
    assert.equal(await isCronAuthorized(new Request("https://app.linke.pt/api/cron/x")), true)

    authCtx = { role: "admin", permissions: [] }
    assert.equal(await isCronAuthorized(new Request("https://app.linke.pt/api/cron/x")), true)

    // With CRON_SECRET unset and no session, always fail closed
    delete process.env.CRON_SECRET
    authCtx = null
    assert.equal(await isCronAuthorized(new Request("https://app.linke.pt/api/cron/x")), false)
  } finally {
    if (prevCronSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = prevCronSecret
  }
})
