# TMS Linke — Technical Audit & Agent Handoff

**Project:** TMS Linke  
**Repository:** `Stefremy/TMS_LINKE-`  
**Primary stack:** Next.js 16, React 19, TypeScript, Supabase/Postgres, Stripe, Resend, CTT Expresso, Correos Express  
**Audit date:** 2026-10-07  
**Purpose:** Give an implementation agent a detailed, actionable handoff of the current findings, risks, recommended fixes, and acceptance criteria.

---

## 1. Executive Summary

The TMS already has a reasonably solid functional base. The strongest architectural decision currently in place is the move toward a **central tracking dispatcher** with normalized carrier events for CTT and Correos. That direction should be preserved.

The highest-priority work is now **security hardening and data-boundary correctness**, not a rewrite.

The most important issues are:

1. Production-looking CTT credentials/default identifiers are hardcoded in the public repository.
2. Several Server Actions use Supabase admin/service access without enforcing authorization first.
3. Some RLS policies are effectively open to any authenticated user.
4. The tracking cron endpoint can fail open if `CRON_SECRET` is missing.
5. Client-facing dashboard code may receive internal pricing/cost fields that should never reach a customer browser.
6. Client dashboard KPIs are calculated from only the latest 50 shipments and can become incorrect under employee impersonation.
7. Client-side automatic tracking sync duplicates the cron responsibility and has an interval cleanup bug.
8. Shipment list queries use `select("*")`, which can load large base64 labels/PDF data unnecessarily.
9. The application can generate fake CTT-looking object IDs when a real carrier identifier does not exist.
10. Stripe wallet/top-up crediting is vulnerable to an authorization gap and a lost-update race.
11. Tracking event deduplication is application-level only and can race.
12. Several operations still depend excessively on `audit_log` as a data source rather than as an audit trail.

The recommended implementation strategy is:

- **Phase 1:** P0 security fixes.
- **Phase 2:** Client portal correctness and query/performance cleanup.
- **Phase 3:** Tracking integrity and idempotency.
- **Phase 4:** Billing/Stripe transactional cleanup.
- **Phase 5:** CI, repo hygiene, and longer-term multi-tenant cleanup.

Do **not** rewrite the TMS from scratch.

---

# 2. Guardrails for the Implementation Agent

Before making changes:

- Create a dedicated branch from the latest `main`, for example `hardening/security-performance-2026-10-07`.
- Fetch the latest `main` before editing because the repository is actively changing.
- Do not commit real credentials, tokens, passwords, auth IDs, customer secrets, Stripe secrets, Supabase service keys, or carrier credentials.
- Do not put removed secrets into comments, migration files, fixtures, test snapshots, or commit messages.
- Removing a secret from the latest source code does **not** remove it from Git history.
- If secrets were committed publicly, the owner must rotate them. Git history cleanup is a separate operation and should not be performed casually because it rewrites repository history.
- Preserve the existing CTT/Correos tracking dispatcher architecture unless a concrete bug requires modification.
- Prefer small, reviewable commits grouped by concern.
- Do not mix major schema redesigns with unrelated UI cleanup in the same commit.
- Any Server Action using a service-role/admin Supabase client must authenticate and authorize the caller before accessing data.
- Do not trust middleware alone for Server Action security.
- Client identity must be based on stable IDs, not names or fuzzy sender matching.
- Do not expose buy price, margins, internal carrier cost, internal markup, credentials, or operational secrets to the customer portal.

---

# 3. Priority Matrix

| Priority | Area | Risk |
|---|---|---|
| P0 | Hardcoded CTT credentials/default identifiers | Critical secret exposure |
| P0 | Server Actions using admin client without auth | Critical authorization bypass |
| P0 | Permissive / missing RLS | Critical cross-tenant data exposure |
| P0 | Cron authentication fail-open | Critical unauthorized sync execution |
| P0/P1 | Internal pricing data sent to client portal | Sensitive commercial data leak |
| P1 | Dashboard stats limited to 50 rows | Incorrect business metrics |
| P1 | Employee impersonation stats bug | Wrong client data / incorrect portal |
| P1 | Browser tracking auto-sync + interval leak | Duplicated jobs and stale behavior |
| P1 | `select("*")` loading labels/base64/PDF | Performance and memory waste |
| P1 | Synthetic CTT object IDs | Data integrity / misleading tracking |
| P1 | Stripe top-up authorization | Potential credit manipulation |
| P1 | Stripe lost-update race | Incorrect wallet balance |
| P1 | Tracking event race dedup | Duplicate events |
| P1 | Destinatarios missing selected fields | Undefined values / broken UI |
| P2 | Fake carrier connectivity test | False operational confidence |
| P2 | `audit_log` used as fallback data store | Scalability and maintainability |
| P2 | Sequential tracking cron | Scaling bottleneck |
| P2 | Hardcoded tenant fallback | Multi-tenant architecture debt |
| P2 | Auth/profile resolution complexity | Maintainability |
| P2 | Repo contains large docs/DB/scratch files | Repo weight / deployment hygiene |
| P2 | Missing CI | Regression risk |

---

# 4. P0 — Hardcoded CTT Credentials / Production Defaults

## Affected areas

Observed in:

- `app/actions/ctt.ts`
- `app/actions/integracoes.ts`

The source contains fallback/default CTT identifiers that appear production-like.

## Risk

This is critical because the repository is public.

Even if the actual password is not exposed, contract numbers, client IDs, auth IDs, account identifiers, usernames, or other integration identifiers should not be committed if they are operational credentials.

Removing the values from the current branch is insufficient if they already exist in Git history.

## Required fix

### `app/actions/ctt.ts`

Refactor credential loading so that:

- credentials come only from environment variables or secure DB-backed configuration;
- missing required variables produce a clear server-side error;
- there are no production fallback values.

Preferred shape:

```ts
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
```

Then build the CTT credential object from required variables.

### `app/actions/integracoes.ts`

Remove all real-looking integration defaults.

When no connection exists, return empty or masked configuration values suitable for the UI.

Never return passwords or secrets to the browser.

For existing stored credentials:

- return only metadata such as `configured: true`;
- optionally return masked identifiers when useful;
- keep the actual secret server-side.

## Operational action required outside code

Rotate any CTT credentials/identifiers that are secret or security-sensitive.

If the owner wants to purge Git history later, treat that as a separate controlled task.

## Acceptance criteria

- No CTT secret or production credential appears in source.
- `.env.example` contains placeholders only.
- Missing credentials fail explicitly.
- Existing integration UI still reports configured/not configured.
- The browser never receives the raw integration password/secret.

---

# 5. P0 — Server Actions Using Admin/Service Client Without Authorization

## Core principle

`service_role` bypasses RLS.

Therefore:

> Every server path using an admin/service Supabase client must authenticate and authorize before data access.

Middleware is not enough because Server Actions can be called independently.

## Affected areas identified

### `app/actions/ctt.ts`

Examples include integration/configuration actions such as saving CTT connection details and toggling/deleting CTT configuration where applicable.

Require an admin or explicit integration-management permission.

### `app/actions/integracoes.ts`

Observed pattern:

- admin client used;
- tenant resolution may fall back to the Linke tenant;
- insufficient explicit authorization.

Required:

- read integration status: employee/admin;
- change integration settings: admin or dedicated permission;
- never return raw secrets.

### `app/actions/fornecedores.ts`

Supplier actions need explicit authorization.

Suggested model:

- read suppliers: employee;
- create/update/toggle/delete: employee with supplier-management permission or admin.

### `app/actions/destinatarios.ts`

Recipient history contains PII.

Require authorization before querying.

Do not make recipient directory/history available to unauthorized callers.

### `app/actions/servicos-linke.ts`

Internal service pricing must be protected.

Recommended split:

- internal action for employees/admins;
- client-safe action returning sell-only service information.

Do not let customers receive `cost_price`, `margin_pct`, internal markup, carrier buy cost, or other commercial internals.

### `app/actions/shipments.ts`

`syncActiveShipmentsBatchAction()` uses privileged access and should not remain an unauthenticated browser-callable background worker.

Recommended:

- background sync = cron only;
- manual sync = employee/admin permission;
- if clients need a refresh button, it should refresh DB state, not directly invoke privileged carrier-wide synchronization.

### `app/actions/stripe.ts`

`createTopUpCheckoutSession(clientId, amountEuro)` must verify ownership.

Required rules:

- client user may top up only their own `client_id`;
- employee/admin behavior must be explicitly permitted;
- never trust `clientId` provided by the browser without checking against auth context.

### `app/actions/notifications.ts`

Operational notifications should require employee access.

## Recommended helper pattern

Create or reuse centralized auth helpers such as:

```ts
const ctx = await requireUser();
```

or:

```ts
const ctx = await requireEmployee();
```

or:

```ts
const ctx = await requireAdmin();
```

For granular permissions:

```ts
await requirePermission("...");
```

Use the actual existing permission model in the repository. Do not invent new permission names without checking the current collaborator/permission definitions.

## Acceptance criteria

- Every privileged Server Action authenticates before using admin/service-role access.
- Client users cannot mutate another client’s records by passing a different ID.
- Unauthorized requests fail before the query executes.
- No function relies on a hardcoded tenant fallback as an authorization mechanism.

---

# 6. P0 — RLS Too Permissive or Missing

## Migrations observed

### Initial schema

`20260907164318_initial_schema.sql`

Policies were observed equivalent to `USING (true)` for integration-related tables.

### CTT integration

`20260908130000_ctt_integration.sql`

Tables including `carrier_connections` and `tenant_integrations` contain broad `FOR ALL` policies with `USING (true)` and `WITH CHECK (true)`.

### Billing

Tables such as `billing_statements` and `client_transactions` were observed without adequate RLS in the reviewed migration history.

## Risk

Any authenticated user could potentially access or mutate sensitive integration or billing records if direct Supabase access is possible.

## Recommended new migration

Create a new migration rather than editing old production migrations.

Example filename:

```text
supabase/migrations/20261007160000_security_hardening.sql
```

Tasks:

1. Enable RLS where missing.
2. Drop overly broad policies.
3. Prevent authenticated browser users from reading/writing credential tables directly.
4. Keep credential access backend-only where possible.
5. Add client-specific billing policies only if direct client access is intentionally required.
6. Prefer backend Server Actions for sensitive integration management.

## Important note

There is a custom `auth.role()` helper in the project.

This naming is potentially confusing because Supabase/Postgres already uses the concept of auth/database roles.

Longer-term recommendation: rename the custom app role helper to something like `auth.app_role()`.

Do this only after locating and updating every dependent policy.

## Acceptance criteria

- Integration credential tables are not broadly accessible to `authenticated`.
- Billing records are tenant/client isolated.
- Service-role backend continues to function.
- Existing client portal does not break.
- RLS behavior is covered by at least basic tests or documented manual checks.

---

# 7. P0 — Tracking Cron Authentication Fails Open

## Affected file

`app/api/cron/sync-tracking/route.ts`

Observed pattern:

```ts
const cronSecret = process.env.CRON_SECRET;

if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  // reject
}
```

If `CRON_SECRET` is missing, the endpoint continues.

## Risk

A configuration mistake can make a privileged background sync endpoint publicly executable.

## Required fix

Fail closed.

```ts
const cronSecret = process.env.CRON_SECRET;

if (!cronSecret) {
  return Response.json(
    { error: "CRON_SECRET is not configured" },
    { status: 503 }
  );
}

const authHeader = request.headers.get("authorization");

if (authHeader !== `Bearer ${cronSecret}`) {
  return Response.json(
    { error: "Unauthorized" },
    { status: 401 }
  );
}
```

No query-string secret fallback unless there is a specific operational requirement.

## Acceptance criteria

- Missing `CRON_SECRET` prevents execution.
- Incorrect bearer token returns 401.
- Correct Vercel cron request works.
- No sync executes before auth passes.

---

# 8. P0/P1 — Internal Service Pricing Leaks to Customer Portal

## Affected flow

`ClientDashboard` calls `getServicosLinkeAction()`.

The action returns service records containing internal pricing fields such as cost price, margin percentage, and internal markup/calculations.

Even if the UI does not render these values, sending them to the browser is still a data leak.

## Required architecture

Split the API boundary.

### Internal action

For Ops/Admin, `getServicosLinkeAction()` may return internal cost fields.

### Customer-safe action

Create something like `getClientAvailableServicesAction()` and return only fields the customer is authorized to know.

Example DTO:

```ts
type ClientServiceDTO = {
  id: string;
  name: string;
  carrier?: string;
  serviceCode?: string;
  sellPrice?: number;
  enabled: boolean;
};
```

No buy price or margin.

## Acceptance criteria

Inspect the browser/network payload. Client portal must not receive:

- `cost_price`;
- `buy_price`;
- `margin_pct`;
- global internal markup;
- carrier credentials;
- any internal financial calculation not intentionally customer-facing.

---

# 9. P1 — Customer Dashboard KPIs Are Incorrect

## Affected flow

`getClientPortalStatsAction()` calls a generic shipment fetcher.

The underlying query defaults to `limit(50)`.

Therefore dashboard KPIs represent only the latest 50 rows rather than the customer’s full shipment history.

## Additional impersonation bug

For an employee impersonating a client:

- generic fetch may load the latest 50 shipments globally;
- client filtering is then performed in application code;
- this means the employee may see stats based only on that client’s shipments that happen to be inside the global latest 50.

This can produce incomplete or apparently inconsistent dashboard data.

## Required fix

Do not calculate portal KPIs from a paginated shipment list.

Use database aggregate queries filtered by the effective client ID.

Example concepts:

```sql
COUNT(*)
COUNT(*) FILTER (WHERE status = 'delivered')
SUM(sell_price)
COUNT(*) FILTER (WHERE status IN (...))
```

Then fetch recent shipments separately.

## Important security rule

Do not use client name or sender name as a fallback identity. Use `client_id` only.

## Suggested action split

```text
getClientPortalStatsAction(clientId?)
getClientRecentShipmentsAction(clientId?, page, pageSize)
```

For customer users, `clientId` must come from auth context.

For employees, impersonated `clientId` must be validated against employee permissions.

## Acceptance criteria

- KPI counts match direct SQL for clients with >50 shipments.
- Employee impersonation returns full stats for the selected client.
- No global 50-row prefilter affects client totals.
- Switching between impersonated clients does not show stale KPI values.

---

# 10. P1 — Client-Side Tracking Polling Is Duplicating the Cron

## Affected file

`app/app/components/ClientDashboard.tsx`

Current behavior dynamically imports the tracking sync action and creates a 5-minute interval.

The cleanup callback is returned inside `.then(...)`, meaning React does not receive it as the `useEffect` cleanup.

Conceptually:

```ts
useEffect(() => {
  import(...).then(() => {
    const interval = setInterval(...);
    return () => clearInterval(interval);
  });
}, []);
```

The inner return does not clean up the React effect.

## Problems

- interval can survive remounts/client changes;
- duplicate background work;
- browser becomes responsible for carrier synchronization;
- cron already exists for this responsibility;
- more chances of CTT/Correos rate limit or race issues.

## Recommended fix

Remove automatic tracking synchronization from the customer browser.

Architecture:

```text
Vercel Cron
    ↓
Tracking Dispatcher
    ↓
CTT / Correos
    ↓
Normalized tracking events
    ↓
Database
    ↓
Customer portal reads current DB state
```

Optional manual button `Atualizar` should ideally re-fetch DB data.

If a carrier force-refresh is needed, make it a protected employee action or tightly scoped per shipment.

## Acceptance criteria

- No customer-side recurring carrier sync interval.
- Client dashboard refresh/remount does not create duplicate timers.
- Cron remains the normal tracking source.
- UI continues to update using normal data refresh/revalidation.

---

# 11. P1 — Shipment Queries Load Large Labels/PDFs

## Problem

Generic shipment queries use `.select("*")`.

The `shipments` row can include large fields such as:

- `ctt_label_base64`;
- `ctt_manifest_pdf`;
- potentially carrier label base64 data.

This happens even where the caller sets an `includeLabels: false` style option.

## Existing useful migration

A migration already created a metadata-oriented shipment view that excludes the large label payloads and exposes metadata such as whether a label exists.

Use that view where appropriate.

## Required fix

For shipment lists:

- use the metadata view; or
- define an explicit column list.

Example:

```ts
.select(`
  id,
  tracking_number,
  carrier_tracking_number,
  status,
  client_id,
  recipient_name,
  recipient_city,
  recipient_country,
  created_at,
  updated_at,
  sell_price,
  weight_kg
`)
```

Fetch label/PDF only when the user explicitly opens or downloads it.

## Acceptance criteria

- list endpoints do not return base64/PDF payloads;
- label download still works;
- shipment lists become significantly lighter;
- no unnecessary label content appears in Server Action payloads.

---

# 12. P1 — Synthetic/Fake CTT Tracking IDs

## Affected area

`lib/services/shipments/shipment-utils.ts`

A helper can generate a deterministic CTT-looking object ID when no real CTT ID exists.

There is also historical special-case behavior.

## Why this is dangerous

A generated identifier may look legitimate even though CTT never issued it.

This creates misleading customer tracking, support confusion, reconciliation problems, and difficult debugging when carrier data does not match TMS data.

## Required model

Maintain two identities:

### Linke internal tracking number

Example concept: `LTK...`, generated internally.

### Carrier tracking number

`carrier_tracking_number` must be a real value returned by CTT/Correos or `null`.

Never invent carrier tracking.

## Recommended refactor

Replace behavior such as `formatOrGenerateCttObjectId()` with a resolver that validates/normalizes a real ID but does not fabricate one.

Example concept:

```ts
resolveCarrierTrackingNumber(value): string | null
```

## Acceptance criteria

- no new shipment receives a fake carrier tracking identifier;
- existing internal tracking numbers still work;
- UI gracefully handles `carrier_tracking_number = null`;
- CTT API is never queried using a fabricated ID.

---

# 13. P1 — Stripe Top-Up Authorization

## Affected file

`app/actions/stripe.ts`

Observed flow accepts `clientId` and `amountEuro` and creates a top-up session.

The caller must not be allowed to choose another customer’s ID.

## Required fix

### For customer portal

Resolve the customer from authenticated context:

```ts
const ctx = await requireUser();

if (ctx.role === "client") {
  clientId = ctx.client_id;
}
```

Ignore or reject a browser-supplied different `clientId`.

### For employee/admin

Define the allowed use case explicitly.

If staff can create a top-up session for a customer, require the appropriate staff permission.

## Acceptance criteria

- Client A cannot create a top-up for Client B.
- Tampering with `clientId` in the request fails.
- Stripe metadata is derived from verified server-side identity.

---

# 14. P1 — Stripe Credit Race / Lost Update

## Existing good behavior

The Stripe webhook verifies the Stripe signature.

There is also an idempotent-style transaction state transition around payment status.

Keep this.

## Remaining race

Current balance update is conceptually:

1. read current balance;
2. calculate current + amount;
3. write new balance.

Two simultaneous successful top-ups can both read the same old balance and overwrite each other.

Example:

```text
balance = 100

payment A +50
payment B +30

A reads 100
B reads 100

A writes 150
B writes 130

Expected: 180
Actual: 130
```

## Required fix

Use an atomic Postgres transaction/RPC.

Preferred behavior:

```sql
UPDATE clients
SET wallet_balance = wallet_balance + p_amount
WHERE id = p_client_id;
```

The payment transaction record should also be marked paid atomically or guarded to prevent double-crediting.

## Domain recommendation

Do not overload a field named `credit_limit` as a wallet balance.

Long-term, `wallet_balance` and `credit_limit` should be separate concepts.

This schema rename is more invasive and may be deferred after the P0 fixes.

## Acceptance criteria

- concurrent successful top-ups cannot lose money;
- webhook replay does not double-credit;
- one transaction can be credited only once;
- resulting balance is mathematically correct under concurrency.

---

# 15. P1 — Tracking Event Deduplication Can Race

## Current model

`recordTrackingEvents()` loads existing events and avoids insertion when a similar event code/timestamp already exists.

This is useful but not concurrency-safe.

Two workers can:

1. read no existing matching event;
2. both insert it.

## Recommended approach

Move final idempotency enforcement into the database.

Best identifier order:

1. carrier-provided event ID, if available;
2. deterministic event fingerprint;
3. exact unique combination of shipment/event/timestamp.

Possible simple index:

```sql
CREATE UNIQUE INDEX ...
ON tracking_events (shipment_id, event_code, timestamp);
```

Before applying, inspect existing duplicates.

The current application logic considers events within approximately two minutes to be duplicates. That fuzzy condition is not represented exactly by a simple unique index.

Options:

- normalize carrier timestamps before persistence;
- create a deterministic fingerprint;
- use carrier event IDs where available.

## Acceptance criteria

- concurrent CTT/Correos sync cannot create duplicate canonical events;
- no migration fails due to existing duplicates;
- meaningful repeated carrier events at genuinely different times remain possible.

---

# 16. P1 — `getDestinatariosAction` Selects Fewer Fields Than It Reads

## Affected file

`app/actions/destinatarios.ts`

The query selects recipient fields but later logic references additional properties not included in the query.

Examples observed include fields conceptually such as:

- tracking number;
- CTT object ID;
- shipment status;
- service type;
- sell price;
- buy price;
- weight;
- sender name.

This can result in `undefined` values.

## Required fix

First determine which fields the feature actually needs.

Then either add only the required missing columns to the select or remove code that should not depend on them.

Do not automatically add sensitive financial fields if the recipient feature does not need them.

Also add explicit authorization because recipient data is PII.

## Acceptance criteria

- no `undefined` fields caused by select mismatch;
- recipient feature remains scoped to authorized staff;
- unnecessary internal price data is not loaded.

---

# 17. P2 — Carrier Connection Test Is a False Positive

## Affected area

A carrier connection test action returns success without making a real carrier request.

For CTT, the implementation appears to simulate latency and report online status.

## Risk

The operations UI can say the carrier is online while credentials are invalid, the carrier endpoint is unavailable, auth is rejected, or network connectivity is broken.

## Required fix

Implement a safe, lightweight real connectivity/authentication check.

Avoid creating real shipments.

If CTT has no harmless health endpoint, use the least side-effectful authenticated request available.

Return structured result:

```ts
{
  ok: boolean,
  carrier: "CTT",
  latencyMs?: number,
  errorCode?: string,
  message: string
}
```

Protect this action with staff/admin authorization.

## Acceptance criteria

- invalid credentials produce failure;
- unavailable carrier produces failure;
- successful auth produces success;
- UI does not fabricate online status.

---

# 18. P2 — `audit_log` Is Being Used as a Data Store

## Current issue

The audit table is used in several places not merely for auditing, but as a fallback/queryable business data store.

Examples found conceptually include:

- supplier/service/integration fallback state;
- shipment label lookup;
- incident resolution;
- notification dedup.

## Why this will hurt

Audit logs tend to grow indefinitely.

Large scans of JSON payloads cause increasing query cost, slow operations, difficult indexes, duplicated sources of truth, and reconciliation problems.

## Recommended principle

```text
Business table = source of truth
Audit log = immutable history
```

Do not use audit log to reconstruct ordinary current state unless it is explicitly an event-sourced domain.

## Specific improvement

A migration already created a targeted shipment label RPC.

Prefer indexed targeted access over loading many audit rows and filtering JSON in application code.

For incident lookup, use a real incident table/column or an indexed JSON predicate at minimum.

## Acceptance criteria

- common UI paths no longer scan large audit-log ranges;
- current state comes from normalized tables;
- audit log remains available for traceability.

---

# 19. P2 — Tracking Cron Is Sequential

## Current behavior

The main all-active-shipments tracking sync processes shipments largely one-by-one.

There is already another batch implementation that uses small concurrent chunks.

## Scaling risk

As shipment volume grows, a fully sequential cron can exceed function duration or leave many shipments stale.

## Recommended approach

Use bounded concurrency, for example 5–10 concurrent shipment syncs, but make the limit carrier-aware.

Requirements:

- do not flood CTT;
- do not flood Correos;
- retry transient failures with backoff;
- preserve per-shipment isolation;
- record errors without aborting the whole batch.

Potential architecture:

```text
active shipments
      ↓
group by carrier
      ↓
bounded worker pools
   ↙          ↘
 CTT         Correos
```

## Acceptance criteria

- one shipment failure does not abort the cron;
- function stays within runtime budget;
- carrier rate limits are respected;
- throughput improves measurably.

---

# 20. P2 — Hardcoded Linke Tenant Fallback

## Affected concept

Auth context contains a fixed Linke tenant UUID and some helpers can fall back to it.

## Current status

For a strictly single-tenant internal TMS this can work temporarily.

However, it becomes dangerous when a missing auth context silently resolves to the default tenant.

## Required short-term rule

Do not use default tenant fallback to compensate for missing authentication.

Privileged action should fail if user/tenant context is required and unavailable.

## Long-term SaaS model

Use proper membership relationships:

```text
users
organizations / tenants
memberships
roles
permissions
```

Avoid resolving employees by email or hardcoded lists when the product becomes multi-tenant.

---

# 21. P2 — Auth/Profile Resolution Complexity

## Current concept

Auth context resolves users from a mix of:

- Supabase user;
- app metadata;
- collaborator lookup by email;
- client users;
- hardcoded/default collaborators.

`cache()` helps reduce repeated work per request.

## Long-term recommendation

Normalize around a membership table keyed by Supabase user ID.

Example:

```text
auth.users.id
      ↓
memberships.user_id
memberships.tenant_id
memberships.client_id
memberships.role_id
```

Then permissions derive from membership/roles, not email.

This is not required before the P0 patch.

---

# 22. Existing Strength — Keep the Central Tracking Dispatcher

## Relevant files

- tracking dispatcher;
- CTT sync service;
- Correos sync service;
- tracking recorder.

The architecture already normalizes carrier states into common TMS statuses.

This is exactly the right direction for adding more carriers later.

Preserve the abstraction:

```text
Carrier raw API
      ↓
Carrier-specific mapper
      ↓
Normalized TrackingEvent
      ↓
Common recorder
      ↓
TMS shipment status
```

Do not spread carrier-specific status logic across pages/components.

## Correos

The current mapping covers concepts including delivered, distribution, returned, incident, in transit, and pending.

## Recommendation

Each future carrier should implement the same interface.

Example:

```ts
interface CarrierTrackingProvider {
  fetchTrackingEvents(
    shipment: Shipment
  ): Promise<NormalizedTrackingEvent[]>;
}
```

---

# 23. Existing Strength — Webhook Signature Verification

Keep the current security patterns already present:

- CTT webhook bearer/signature comparison using timing-safe equality;
- Stripe signature verification;
- Stripe payment state/idempotency checks.

The objective is to extend these standards to the rest of the privileged surface.

---

# 24. Shipment Public Tracking Privacy Review

The public tracking action uses a bounded exact lookup, which is good.

However, review the amount of personal data returned for anyone who knows a tracking reference.

Potentially exposed fields include recipient/sender names and locations.

Recommended principle:

- only expose what is operationally necessary;
- consider partial masking for names;
- never expose phone/email/full address in public tracking;
- keep lookup exact and rate-limit if abuse becomes a concern.

This is not currently ranked above the main P0 items but should be reviewed.

---

# 25. Shipment Lookup Uniqueness

The CTT webhook performs lookup by carrier/tracking and uses a single-row expectation.

If duplicate carrier tracking numbers exist unexpectedly, `.single()` can fail.

Recommended:

- enforce uniqueness where the business domain guarantees it;
- otherwise query deterministically and log an anomaly.

Potential index:

```sql
UNIQUE (carrier, carrier_tracking_number)
```

Only add after checking historical data and whether carriers can ever reuse numbers.

---

# 26. Performance Indexes Already Added

A recent performance migration already includes useful indexes for areas such as:

- shipments by created date;
- tenant + created date;
- client + created date;
- status;
- tracking;
- audit;
- recolhas.

Do not blindly add duplicate indexes.

Before creating another index:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'shipments';
```

Prefer query-specific compound indexes only when a real query plan warrants them.

Potential future examples:

```text
(status, created_at)
(client_id, status, created_at)
(carrier, status, updated_at)
```

Use `EXPLAIN ANALYZE` before and after.

---

# 27. Large Files and Repository Hygiene

Large tracked files observed include:

- large CTT API PDF documentation;
- `data/postal-codes.db` SQLite database;
- Correos documentation ZIP;
- duplicate carrier PDFs;
- scratch/test scripts.

## Postal code DB

`data/postal-codes.db` is currently functional and loaded by the postal-code service.

Do not remove it without replacing the feature.

Long-term options:

1. move postal codes to Postgres;
2. publish the DB as a versioned data artifact;
3. keep SQLite but exclude unnecessary documentation from application source.

## Carrier docs

API PDFs and ZIP documentation do not need to ship with the production application.

Move them to a private documentation repository, shared storage, internal docs, or Git LFS if repository storage is intentionally required.

## Scratch scripts

Move useful operational scripts into `/scripts`.

Delete obsolete scratch files after confirming they are not referenced.

---

# 28. Image Optimization

Image weight is not currently the largest performance problem.

The larger wins are:

- eliminating base64 labels from list queries;
- correcting dashboard queries;
- reducing audit scans;
- keeping docs/large DB artifacts out of deployment bundles.

For actual UI images:

- use `next/image`;
- prefer WebP/AVIF where applicable;
- keep SVG logos as SVG when appropriate;
- avoid converting every asset blindly.

---

# 29. Next.js / Vercel Runtime

The repository should explicitly define and test the supported Node runtime.

Recommended target: Node 22+.

Check current Vercel runtime support before changing production configuration.

Add an `engines` entry if appropriate:

```json
{
  "engines": {
    "node": ">=22"
  }
}
```

Only do this after verifying dependencies/build under that version.

---

# 30. CI Is Missing

The repository should have basic GitHub Actions CI.

Suggested file:

```text
.github/workflows/ci.yml
```

Recommended checks:

```text
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

Potential issue: the build must not require production secrets merely to compile.

Server-only env validation should happen at execution time for routes/features that need it, not necessarily at module import during build.

## Acceptance criteria

Every PR reports dependency installation, lint, type checking, and build status.

---

# 31. Recommended Implementation Sequence

## Phase 1 — Security hardening

Commit group:

```text
security: harden privileged actions and integration secrets
```

Tasks:

- remove hardcoded CTT credential defaults;
- add auth to privileged Server Actions;
- cron fail-closed;
- protect integration endpoints;
- protect Stripe top-up identity;
- stop sending internal service cost to client.

Then migration:

```text
security: tighten Supabase RLS policies
```

Tasks:

- integration tables;
- billing tables;
- broad `USING(true)` policies.

## Phase 2 — Client Portal Correctness

Commit:

```text
portal: fix client stats and shipment data boundaries
```

Tasks:

- aggregate stats directly by client ID;
- separate recent shipment pagination;
- fix employee impersonation path;
- remove fuzzy name-based identity;
- introduce client-safe service DTO.

## Phase 3 — Query Performance

Commit:

```text
perf: avoid heavy shipment payloads and audit scans
```

Tasks:

- replace shipment `select("*")`;
- use shipment metadata view;
- fetch labels on demand;
- replace large audit scans with indexed/current-state queries.

## Phase 4 — Tracking Integrity

Commit:

```text
tracking: remove synthetic carrier IDs and improve idempotency
```

Tasks:

- stop generating fake CTT IDs;
- add DB-level event idempotency;
- validate carrier tracking uniqueness assumptions;
- bounded concurrency in cron.

## Phase 5 — Stripe Transactional Balance

Commit:

```text
billing: make wallet credit atomic
```

Tasks:

- atomic RPC/transaction;
- prevent double credit;
- optionally introduce `wallet_balance`.

## Phase 6 — Engineering Hygiene

Commit:

```text
chore: add CI and clean repository layout
```

Tasks:

- GitHub Actions;
- move scripts;
- remove/move carrier documentation;
- define supported Node runtime.

---

# 32. Suggested Branch / PR Structure

Recommended branch:

```text
hardening/security-performance-2026-10-07
```

Potential PR title:

```text
Security and performance hardening for Linke TMS
```

PR description sections:

```text
## Security
## Client portal correctness
## Tracking integrity
## Performance
## Database migrations
## Manual verification
## Deployment notes
```

Avoid one giant unreviewable commit.

---

# 33. Manual Security Test Checklist

After P0 fixes, verify:

- unauthenticated caller cannot execute integration actions;
- client user cannot read integration credentials;
- client user cannot write service price configuration;
- client A cannot create Stripe top-up for client B;
- client A cannot request client B shipment stats;
- employee can access permitted Ops actions;
- admin can edit integrations;
- customer browser payload does not contain internal buy price or margins;
- cron without secret fails;
- cron with incorrect secret fails;
- cron with valid secret succeeds.

---

# 34. Client Portal Test Checklist

Use at least:

- one client with fewer than 50 shipments;
- one client with more than 50 shipments;
- one employee impersonating each client.

Verify:

- total shipments;
- delivered;
- in transit;
- pending/problem;
- total spend/relevant monetary KPI;
- recent shipments;
- client switch behavior;
- no first-seconds display of data from another client;
- no stale interval behavior.

---

# 35. Tracking Test Checklist

Test both CTT and Correos.

Scenarios:

- pending;
- picked up/accepted;
- in transit;
- out for delivery/distribution;
- delivered;
- incident;
- returned.

Verify:

- one canonical TMS status per event;
- no fake carrier ID;
- duplicate cron executions do not duplicate events;
- webhook + cron race does not produce duplicate events;
- email notification dedup still works;
- one carrier failure does not block the other carrier.

---

# 36. Stripe Test Checklist

Test in Stripe sandbox/test mode.

Scenarios:

- correct client top-up;
- tampered client ID;
- webhook replay;
- two simultaneous successful top-ups;
- failed payment;
- expired checkout session where relevant.

Expected:

- no cross-client credit;
- no duplicate credit;
- correct final balance;
- transaction state is consistent.

---

# 37. Database Migration Safety

Before RLS or unique index migrations:

1. inspect production-like data;
2. count duplicates;
3. back up critical tables;
4. write migration to be safe against existing data;
5. test on staging;
6. then deploy production.

For tracking duplicates, first run a diagnostic query before enforcing uniqueness.

Example concept:

```sql
SELECT
  shipment_id,
  event_code,
  timestamp,
  COUNT(*)
FROM tracking_events
GROUP BY shipment_id, event_code, timestamp
HAVING COUNT(*) > 1;
```

Do not delete historical records automatically without reviewing the result.

---

# 38. Architecture Target

The desired architecture should converge toward:

```text
                 ┌────────────────────┐
                 │   Customer Portal  │
                 └─────────┬──────────┘
                           │
                     safe DTOs only
                           │
                 ┌─────────▼──────────┐
                 │ Next.js Server/API │
                 │ Auth + Permission  │
                 └─────────┬──────────┘
                           │
                 ┌─────────▼──────────┐
                 │     Supabase       │
                 │ PostgreSQL + RLS   │
                 └─────────┬──────────┘
                           │
             ┌─────────────┴─────────────┐
             │                           │
    ┌────────▼─────────┐        ┌────────▼─────────┐
    │ Tracking Worker  │        │ Billing / Stripe │
    └────────┬─────────┘        └──────────────────┘
             │
       central dispatcher
             │
       ┌─────┴─────┐
       │           │
  ┌────▼────┐ ┌────▼────────┐
  │   CTT   │ │   Correos   │
  └─────────┘ └─────────────┘
```

The browser should not be a background tracking worker.

The audit log should not be the main application database.

Carrier credentials should not cross the backend boundary.

---

# 39. What NOT to Change Yet

Unless required by a specific bug:

- do not replace Supabase;
- do not rewrite Next.js;
- do not replace the central tracking dispatcher;
- do not move every query into a new abstraction layer;
- do not redesign the entire UI;
- do not rewrite Git history automatically;
- do not perform a full multi-tenant migration in the same PR as P0 security fixes;
- do not replace the postal-code SQLite feature until a tested alternative exists.

Focus first on correctness, isolation, and security.

---

# 40. Definition of Done for the Hardening Pass

The first hardening milestone is complete when all of the following are true:

- no real integration credentials are hardcoded;
- exposed credentials have been rotated by the owner;
- privileged Server Actions enforce auth/permissions;
- sensitive RLS policies are tightened;
- cron fails closed;
- client portal never receives internal service costs/margins;
- portal stats are calculated across the complete client dataset;
- employee impersonation returns correct isolated client data;
- browser no longer runs recurring carrier sync;
- shipment list queries exclude label/PDF payloads;
- no new synthetic carrier tracking IDs are created;
- Stripe top-up ownership is verified;
- tracking event persistence has a database idempotency strategy;
- CI checks lint/type/build;
- CTT and Correos still work end-to-end.

---

# 41. Notes to the Coding Agent

When you begin implementation, start by inspecting the current versions of these areas because the repository may have changed since this audit:

```text
app/actions/ctt.ts
app/actions/integracoes.ts
app/actions/fornecedores.ts
app/actions/destinatarios.ts
app/actions/servicos-linke.ts
app/actions/shipments.ts
app/actions/stripe.ts
app/actions/notifications.ts

app/api/cron/sync-tracking/route.ts
app/api/webhooks/ctt/tracking/route.ts
app/api/webhooks/stripe/route.ts

app/app/components/ClientDashboard.tsx

lib/auth/context.ts
lib/supabase/server.ts
lib/services/shipments/shipment-fetcher.ts
lib/services/shipments/shipment-utils.ts

tracking dispatcher / CTT / Correos sync services
tracking recorder

supabase/migrations/
```

For every proposed change:

1. state the exact issue;
2. show the smallest safe patch;
3. verify upstream/downstream callers;
4. update types;
5. run lint/typecheck/build;
6. test both employee and client role flows;
7. avoid leaking secrets in logs or screenshots.

---

# 42. Final Recommendation

Treat this as a **hardening and correctness sprint**, not a feature sprint.

The project already has enough structure to improve incrementally.

Highest-value order:

```text
AUTH / SECRETS / RLS
        ↓
CLIENT DATA ISOLATION
        ↓
PORTAL KPI CORRECTNESS
        ↓
QUERY PAYLOAD / PERFORMANCE
        ↓
TRACKING IDEMPOTENCY
        ↓
STRIPE ATOMICITY
        ↓
CI / REPO HYGIENE
```

Once these are stable, the TMS will be in a much better position to add more carriers, stronger billing/fiscal workflows, deeper ERP modules, more client self-service, and multi-tenant SaaS behavior.

The existing CTT/Correos dispatcher should remain the foundation for carrier expansion.
