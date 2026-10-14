# Step 1 — CTT reconciliation access — 14 October 2026

## Problem and resulting behavior

The reconciliation actions previously required only a login, and their shipment
and history queries used the admin client without tenant filters. The sample and
upload actions also opened or parsed spreadsheets before checking access.

All four exported actions now require the existing `Faturação & Contas Correntes`
permission. The existing authorization helper allows administrators without an
explicit permission entry. Clients, anonymous users, and employees without this
permission cannot read reconciliation data, upload data, load a sample, or read
history. Missing tenant context is rejected rather than replaced with a default.
Authorization is performed before action input processing and outside processing
error handlers so login redirects and permission denials remain intact.

The page checks access before loading history and shows an access-restricted
message to employees without financial permission. The backend independently
checks every action, so bypassing the page cannot authorize a request.

Shipment, client-name, client audit-record, and history queries all use the
authenticated tenant. Client-name lookups only request IDs referenced by the
selected shipments, in batches of 200, and retain the latest stored short/legal
name when available. They no longer use the general client display loader's
unscoped audit queries and display defaults.

Each successful reconciliation audit entry records the authenticated actor's
user ID and tenant. Supabase insert errors now return failure rather than a
misleading success. Database failure details are not returned in reconciliation
results. Price comparisons, tolerances, and metric formulas were not changed.

## Files

- `app/actions/reconciliacao-ctt.ts`: permission guards, tenant-scoped queries,
  client-name lookup, actor logging, and explicit database error handling.
- `app/ops/tesouraria/reconciliacao/page.tsx`: access-restricted message before
  history loading for staff without financial permission.
- `tests/reconciliation-security.test.cjs`: 11 regression tests using the actual
  authorization helper with mocked sessions and isolated databases/filesystems.
- `package.json`: includes the reconciliation tests in `npm run test:security`.
- Security notes: mark this authorization item addressed while retaining the
  remaining audit scope.

## Validation

- `npm run test:security`: 37 tests passed (26 existing and 11 reconciliation tests).
- Installed TypeScript executable, `tsc --noEmit`: passed.
- `npm run build`: passed.
- Lint comparison for changed/added code: errors decreased from 9 to 6, warnings
  remained at zero, and no individual file's diagnostic count increased. The
  remaining errors are legacy typing annotations in the reconciliation module.
- `git diff --check`: passed.

The tests cover all four exported actions, anonymous callers, clients with a
claimed financial permission, unprivileged staff, impersonation, missing tenant
context, finance employees, administrators, two tenants with overlapping client
identifiers, every upload entry path, database read failures, and audit-write
failures. Unauthorized requests perform no reconciliation queries, file reads,
workbook parsing, or audit writes. Tests use fixtures and make no live integration
calls or production database changes.

## Operational checks and remaining scope

Before deployment verification, exercise the page and direct actions in staging
with a finance employee, an employee without financial permission, a client, and
an administrator. Confirm both ordinary and impersonated sessions. Compare a
known statement against the previous result to confirm the unchanged calculation
formulas and stored client names.

The existing authentication context still identifies a single hardcoded tenant;
membership-based tenant resolution remains a later task. This change scopes reads
to that trusted context but does not implement multi-tenant membership management.
The existing 25,000-shipment cap, pagination, duplicate tracking handling, malformed
upload/size limits, and tax/period reconciliation still require a separate review.
Financial sample files remain under `public/`; protecting their loading actions
does not protect static download URLs. Private anonymized fixtures remain pending.

No SQL migration is needed for this step. No prices, balances, fiscal documents,
carrier operations, or deployment settings were changed. The billing cron is the
next separate step; it still needs to reject requests when `CRON_SECRET` is missing.
