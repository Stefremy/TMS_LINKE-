# Security hardening — 13 October 2026

This first implementation pass addresses financial PDF authorization and shipment
pricing failures, based on the supplied audit and local `main` at `a5e249d`.
It does not establish that production was exploited or that repository migrations
match the deployed database. No live carrier, Stripe, Moloni, or email operations
were used for verification.

## Financial documents

All four financial PDF routes use `lib/services/billing/document-access.ts`:

- `/api/statements/[id]/pdf`
- `/api/statements/[id]/proforma-pdf`
- `/api/statements/[id]/moloni-pdf`
- `/api/custom-invoices/[id]/pdf`

The helper checks the authenticated context before creating its admin client.
Clients can only retrieve their own documents. Administrators can retrieve
documents in their tenant. Employees need the existing `Faturação & Contas
Correntes` or `Acesso Total (Super-Admin)` permission. Impersonating a client does
not grant financial permission to an employee.

Every lookup filters by tenant, action, identifier, and client ownership when
applicable. Audit IDs, internal IDs, and document numbers remain supported.
Queries retrieve at most one matching row instead of scanning all statements.
Statement shipment enrichment also filters by tenant and client. Inaccessible
and missing documents share the same 404 response; database failures return a
generic 500 response. All financial responses use private, no-store caching.
PDF layout and existing tax calculations were not changed.

## Shipment pricing

`emitClientGuiaAction` and the legacy FormData creator now require persisted,
tenant-scoped client and service records. The new pricing-context loader does not
use hardcoded display defaults or silently recover from database failures.
Tenant-scoped `audit_log` service records remain supported. An explicit missing
service table or tenant column permits an audit-only lookup on legacy installations.
Read limits fail closed if reached, to avoid using an incomplete set of tariffs.

The submitted `calculatedPrice` is retained in the action input for UI
compatibility but is never used to determine the persisted price. Shipment
creation requires a configured zone and enabled weight tier in the selected
service. An unknown service ID cannot fall back to a submitted service name.
Client-specific service ownership and assigned service IDs are checked. Existing
client records are verified without upserting placeholder tenants or clients.

Carrier choice, service code, and connection ID come from the verified service.
Carrier creation requires a supported carrier and configured service code.
Invalid weight, volumes, dimensions, COD amounts, unavailable special services,
cross-carrier special services, and invalid monetary configuration stop creation
before any provider call or database mutation. Monetary results and special fees
are rounded to cents and checked for safe integer cent representation.

The existing configured base, fuel, and special-fee formulas remain in use.
Display-only quotation fallbacks retain their previous behavior, so a UI estimate
may still appear for a destination that the server refuses to create. This pass
does not introduce volumetric-weight rules or change negotiated price tables.

## Verification

Run:

```sh
npm ci --ignore-scripts
npm run test:security
npx tsc --noEmit
npm run build
npm run lint
```

The security suite executes the actual TypeScript route/action modules with
isolated database and integration mocks. Network access is forbidden by its test
loader. It covers all four PDF routes, anonymous access, ownership, tenant
isolation, financial permissions, identifier aliases, wildcard inputs, cache
headers, database errors, both carrier paths, forged prices, missing tariffs,
invalid shipment inputs, special services, legacy service storage, and the
FormData creation path. These tests do not replace staging integration checks.

The repository has existing lint violations in other modules and maintenance
scripts; compare changed-file diagnostics with the baseline rather than assuming
the whole repository is lint-clean.

Results for this pass:

- `npm run test:security`: 26 tests passed, including multiple negative cases per test.
- `npx tsc --noEmit`: passed using the installed TypeScript executable.
- `npm run build`: passed, including Next.js TypeScript checks and page generation.
- Focused lint for the new helpers and four PDF routes: passed.
- Repository-wide lint: failed with 869 errors and 473 warnings. Comparing changed
  and added code files against `HEAD` found no per-file increase: errors decreased
  from 65 to 42 and warnings remained at 7. New files have no lint diagnostics.
- `git diff --check`: passed.

The build reported an existing parent-directory lockfile warning. Dependencies
were installed from the existing lockfile with lifecycle scripts disabled; package
versions were not changed. No database migrations or deployments were performed.

## Before deployment

1. In staging, verify that each enabled client service has a persisted tariff,
   tenant ownership, and the intended carrier service code. Records present only
   as display defaults now correctly block shipment creation.
2. Test existing document links with two clients, an employee without financial
   permission, a finance employee, and an administrator. Verify ordinary and
   impersonated sessions.
3. Verify valid CTT and Correos quotes against the existing commercial tables,
   including fuel and special-service charges. Review pre-existing differences
   between frontend quotations and server formulas, especially additional-weight
   tiers and custom client overrides, as a separate financial task.
4. Purge previously cached financial PDF URLs from any shared CDN or proxy cache;
   new response headers cannot retroactively remove old cached responses.
5. Confirm the deployed authentication context resolves the correct tenant.
   The existing hardcoded single-tenant context remains unchanged in this pass.

## Remaining audit work

| Finding | Local assessment / remaining action |
| --- | --- |
| Submitted price surviving pricing failure | Fixed in both reviewed creation paths; test other dispatch/retry paths separately. |
| PDF access checks | Fixed for the four reviewed routes; external Moloni links and historical caches require operational review. |
| Financial files under `public/` | Tracked files confirmed; contents and actual public exposure unverified. CTT sample-loading actions currently depend on the spreadsheets. Replace with anonymized private fixtures before removing them; preserve evidence and Git history. |
| Non-atomic invoice/shipment association | Confirmed; transactional reservation and reconciliation after external emission still needed. |
| Receipt document ID and amount supplied by caller | Confirmed; authoritative document and outstanding-balance validation still needed. |
| Non-atomic credit reservation | Confirmed; clarify prepaid versus account-credit semantics before adding reservation and compensation. |
| Reconciliation authorization | Addressed on 14-10-2026: financial permission checks and tenant-scoped reads. See [step 1 notes](SECURITY_STEP_1_RECONCILIATION_2026-10-14.md); pagination and upload validation remain separate work. |
| Stripe credit recovery | Transaction is marked paid before balance RPC succeeds; failed credit can be skipped on retry. Atomic settlement/recovery still needed. |

This pass does not change the existing wallet-debit logic, issue or modify fiscal
documents, apply SQL migrations, publish a deployment, or rewrite Git history.
There is no database migration or schema rollback to apply. Code rollback means
reverting these changes, which would restore the vulnerabilities; forward fixes
are preferable if staging finds a compatibility issue.
