# TMS Linke — Technical Improvement Roadmap for Antigravity

## Context

You are working on the existing **TMS Linke** project.

Repository:

```text
TMS_LINKE-
```

This is an active application built with:

- Next.js
- React
- TypeScript
- Supabase
- Tailwind CSS
- CTT integration
- Moloni integration
- Stripe
- Resend
- internal Linke backoffice
- client portal

The application already contains working operational logic.

The objective is **NOT to rebuild the project**.

The objective is to evolve it into a secure, maintainable, production-grade logistics platform capable of supporting:

- multiple Linke clients
- multiple tenants in the future
- multiple carriers
- robust pricing
- billing
- tracking
- client integrations
- auditability
- operational resilience

The long-term architecture should remain a **modular monolith**, not microservices.

---

# 1. PRIMARY PRINCIPLES

Always follow these rules.

## 1.1 Preserve working functionality

Do not:

- rebuild the application from scratch
- replace Next.js
- replace Supabase
- redesign the UI unnecessarily
- rewrite major modules without understanding their current usage
- remove existing CTT functionality unless replacing broken implementation safely
- destroy production data
- reset the database
- edit historical migrations unnecessarily

Prefer incremental improvements.

---

## 1.2 Security first

The development order is:

```text
SECURITY
→ AUTHORIZATION
→ TENANT ISOLATION
→ DATA INTEGRITY
→ DOMAIN ARCHITECTURE
→ TESTING
→ RESILIENCE
→ OBSERVABILITY
→ APIs
→ NEW FEATURES
```

Do not prioritize new carrier integrations or visual features before critical security issues are addressed.

---

# 2. SECURITY AND AUTHORIZATION

This is the highest-priority block.

## 2.1 Remove clientId authorization bypass

The current application must not allow authorization through a URL parameter such as:

```text
?clientId=...
```

A `clientId` query parameter may identify a requested client but must **never authorize access**.

Client impersonation by Linke staff is still required.

Implement secure impersonation where:

1. employee is authenticated
2. employee belongs to the correct tenant
3. employee has explicit impersonation permission
4. requested client belongs to the tenant
5. impersonation is validated server-side
6. impersonation is logged in `audit_log`
7. changing a URL manually cannot provide access

---

## 2.2 Protect `/ops`

The complete `/ops` area must require an authenticated Linke employee.

A normal client must never access `/ops`.

Implement:

- route-level protection
- server-side authorization
- permission checks inside sensitive Server Actions

Do not rely exclusively on routing protection.

---

## 2.3 Central authorization layer

Create reusable server-only helpers.

Conceptually:

```ts
getAuthContext()
requireUser()
requireEmployee()
requireAdmin()
requirePermission(permission)
requireClientAccess(clientId)
getTenantContext()
```

The exact API may differ.

Authorization logic must not be duplicated across dozens of actions.

A trusted authorization context should resolve:

```text
user_id
tenant_id
client_id
employee_id
role
permissions
impersonation context
```

---

## 2.4 Stop using user_metadata for permissions

Do not use Supabase `user_metadata` as the source of truth for authorization.

Prefer:

```text
users
memberships
staff_profiles
tenants
clients
```

If JWT metadata is necessary, use server-controlled metadata such as:

```text
app_metadata
```

or secure custom claims.

Never trust user-editable metadata for:

- role
- tenant
- client
- permissions
- employee access level

---

## 2.5 Secure service role usage

Any code using:

```ts
createAdminClient()
```

must first authenticate and authorize the caller.

Remember:

```text
Supabase service_role bypasses RLS
```

Therefore service role access must never be considered authorization.

Audit every usage of `createAdminClient()`.

---

# 3. MULTI-TENANT ARCHITECTURE

The existing project already contains concepts such as:

```text
tenants
clients
memberships
users
shipments
packages
tracking_events
audit_log
```

Preserve and complete this model.

Expected relationship:

```text
User
 ↓
Membership
 ↓
Tenant
 ↓
Client
 ↓
Business Data
```

---

## 3.1 Remove hardcoded tenant/client IDs

Avoid logic such as:

```ts
const LINKE_TENANT_ID = "..."
const DEFAULT_FALLBACK_CLIENT_ID = "..."
```

Business operations should derive:

```text
tenant_id
client_id
user_id
```

from trusted server-side authentication context.

---

## 3.2 Tenant and client ownership

Every relevant business object should have ownership context.

Examples:

```text
shipments.tenant_id
shipments.client_id

recolhas.tenant_id
recolhas.client_id

billing_statements.tenant_id
billing_statements.client_id

transactions.tenant_id
transactions.client_id
```

where applicable.

---

# 4. SUPABASE RLS

Review Row Level Security for all business tables.

At minimum:

```text
tenants
clients
users
memberships
staff_profiles
shipments
packages
recolhas
tracking_events
audit_log
billing tables
client_transactions
```

Create new migrations for missing policies.

Do not modify previously applied migration history unless necessary.

Required guarantees:

```text
Client A cannot read Client B data.

Client A cannot modify Client B data.

Tenant A cannot access Tenant B data.

A manipulated request cannot bypass ownership rules.
```

Internal service-role operations must still perform application-level authorization.

---

# 5. DATA INTEGRITY

## 5.1 Never generate fake carrier tracking numbers

Carrier tracking numbers must only be stored when returned by the carrier.

Do not generate numbers that resemble real CTT tracking IDs.

If carrier tracking is unavailable use:

```ts
null
```

or an internal state:

```text
awaiting_carrier_reference
```

Keep Linke references separate from carrier tracking.

---

## 5.2 Separate Linke reference from carrier identifiers

Preferred model:

```text
linke_reference
carrier
carrier_tracking_number
carrier_shipment_id
```

Example:

```text
linke_reference:
LTK1425602

carrier:
CTT

carrier_tracking_number:
DB290719717PT

carrier_shipment_id:
carrier-specific internal ID
```

Never mix internal Linke references with external carrier tracking.

---

## 5.3 Define one source of truth

The current operational state of shipments must live in operational tables.

Recommended:

```text
shipments
packages
tracking_events
shipment_events
```

`audit_log` must be used for history/auditing, not as a substitute database.

Do not reconstruct the current shipment state from audit logs unless performing recovery tooling.

---

# 6. SHIPMENT STATE MACHINE

Formalize shipment lifecycle.

Suggested high-level states:

```text
draft
validated
awaiting_carrier
created
pickup_requested
collected
in_transit
out_for_delivery
delivered
incident
returning
returned
cancelled
```

Define permitted transitions.

Examples of transitions that should not occur accidentally:

```text
delivered → draft
cancelled → in_transit
returned → collected
```

Create domain-level transition validation.

Do not let arbitrary UI updates directly set any status.

---

# 7. DOMAIN ARCHITECTURE

The TMS should remain a modular monolith.

Preferred conceptual structure:

```text
app/
    routes
    UI
    Server Actions
    API routes

modules/
    shipments/
    pickups/
    clients/
    billing/
    tracking/
    employees/
    pricing/

integrations/
    ctt/
    moloni/
    stripe/
    resend/

lib/
    auth/
    db/
    audit/
    permissions/
    validation/
    observability/
```

Do not perform a huge folder migration in one commit.

Refactor incrementally.

---

# 8. REFACTOR LARGE SERVER ACTION FILES

Review large action files such as:

```text
app/actions/shipments.ts
app/actions/ctt.ts
app/actions/moloni.ts
app/actions/servicos-linke.ts
```

Server Actions should mainly:

```text
authenticate
authorize
validate
call domain/service
revalidate
return
```

Move reusable business logic into domain/service layers.

Avoid "god files".

---

# 9. CARRIER PROVIDER ARCHITECTURE

Carrier-specific logic must be isolated.

The existing CTT service structure should be preserved and improved.

Introduce a generic carrier abstraction.

Conceptually:

```ts
interface CarrierProvider {
  createShipment(...)
  cancelShipment(...)
  createPickup(...)
  getTracking(...)
  getLabel(...)
  validateShipment?(...)
}
```

Implement CTT using this abstraction first.

Future carriers may include:

```text
MRW
Correos
DHL
GLS
DPD
```

Do NOT implement them now.

Prepare the architecture only.

---

# 10. PRICING ENGINE

Create a dedicated pricing domain.

A final shipment price may include:

```text
carrier base cost
weight bracket
zone
fuel surcharge
special services
COD
remote area surcharge
additional weight
client-specific pricing
commercial discount
margin
VAT
```

Store pricing breakdown where practical.

Example:

```text
base_cost
fuel_surcharge
extras_cost
carrier_total
margin_amount
sell_price
vat_amount
final_price
```

Avoid having only:

```text
buy_price
sell_price
```

if the platform needs future financial analysis.

---

# 11. PRICE VERSIONING

Never silently overwrite historical tariff definitions.

Tariffs should be versioned.

Example:

```text
CTT Continental 2026 v1
valid_from: 2026-01-01
valid_to: 2026-03-31

CTT Continental 2026 v2
valid_from: 2026-04-01
valid_to: 2026-06-30
```

Shipments should retain the tariff/pricing context used at creation time.

Historical financial values must remain reproducible.

---

# 12. FINANCIAL LEDGER

Use an append-oriented client ledger.

Example:

```text
+100.00 wallet/top-up
-4.32 shipment
-1.60 COD fee
+15.00 credit
-6.70 shipment
```

Balance should be reproducible from transactions.

Use the existing `client_transactions` direction where possible.

Support transaction types such as:

```text
shipment_charge
credit
manual_adjustment
payment
refund
cod_fee
subscription
invoice_settlement
```

Transactions should be auditable.

---

# 13. IDEMPOTENCY

Critical external operations must be idempotent.

Examples:

```text
create shipment
cancel shipment
create pickup
issue invoice
charge payment
create Moloni document
```

Use idempotency keys.

Conceptually:

```text
shipment:create:<shipment-id>
pickup:create:<pickup-id>
invoice:create:<invoice-id>
```

Before repeating an operation, determine whether it already completed successfully.

Double-clicking "Create shipment" must never create duplicate carrier shipments.

---

# 14. BACKGROUND JOBS

Operations that should not depend entirely on browser requests include:

```text
tracking synchronization
email sending
carrier retries
Moloni synchronization
billing generation
document generation
webhook processing
pickup synchronization
scheduled operational tasks
```

Introduce a reliable job-processing pattern.

Avoid tightly coupling long-running carrier operations to UI requests.

---

# 15. RETRIES AND FAILURE HANDLING

Carrier failures are expected.

Implement controlled retry behavior.

Retryable examples:

```text
HTTP 500
HTTP 502
HTTP 503
timeout
temporary carrier outage
network failure
```

Non-retryable examples:

```text
invalid address
invalid postal code
invalid service
authentication failure caused by invalid credentials
invalid package parameters
```

Use exponential or progressive backoff.

Failed jobs should eventually move into an intervention state / dead-letter workflow.

---

# 16. WEBHOOK ARCHITECTURE

Prefer event-driven integrations when supported.

Conceptually:

```text
carrier
  ↓
webhook
  ↓
TMS
  ↓
shipment/tracking update
```

Polling can remain as fallback.

Webhook handlers should be:

- authenticated/verified where supported
- idempotent
- logged
- retry-safe

---

# 17. API VERSIONING

Prepare a stable Linke API.

Recommended base:

```text
/api/v1/
```

Potential endpoints:

```text
POST /api/v1/shipments
GET  /api/v1/shipments/:id
GET  /api/v1/tracking/:reference
POST /api/v1/pickups
```

Do not expose internal database structure directly.

API authentication, rate limits and tenant context must be explicit.

---

# 18. CLIENT WEBHOOKS

Prepare an outbound event/webhook architecture for business clients.

Possible events:

```text
shipment.created
shipment.collected
shipment.in_transit
shipment.incident
shipment.delivered
shipment.returned
```

Example payload:

```json
{
  "event": "shipment.delivered",
  "shipment_reference": "LTK1425602"
}
```

Webhook delivery should support:

```text
signature
retry
delivery status
failure history
idempotent event IDs
```

This does not need to be implemented immediately, but the architecture should not block it.

---

# 19. INPUT VALIDATION

Validate all external inputs.

At minimum:

```text
UUIDs
email
tenant IDs
client IDs
shipment IDs
dates
money
weight
dimensions
postal codes
tracking references
carrier
service
webhook payloads
```

Prefer a consistent validation strategy.

Zod may be introduced if justified.

Never trust browser-submitted identifiers without ownership checks.

---

# 20. SOFT DELETE

Avoid destructive deletes for operational records.

Prefer:

```text
deleted_at
deleted_by
delete_reason
```

for entities such as shipments where auditability matters.

User interfaces may hide deleted records while keeping historical evidence.

---

# 21. AUDIT LOG

Improve audit logging.

Audit events should ideally record:

```text
who
what
when
tenant
client
resource
resource ID
old value
new value
reason
IP where appropriate
user agent where appropriate
```

Important actions include:

```text
shipment deletion
price override
client impersonation
permission change
user credential change
billing adjustment
invoice cancellation
manual transaction
carrier override
```

Do not use `audit_log` as operational state.

---

# 22. OBSERVABILITY

Introduce production observability.

At minimum:

```text
structured logs
error reporting
integration health
job failures
carrier latency
API failures
tracking sync failures
billing failures
```

Consider a health endpoint.

Example:

```text
GET /api/health
```

Potential result:

```text
database: OK
CTT: OK
Moloni: OK
Email: OK
Jobs: OK
```

Do not expose secrets or sensitive internals in public health responses.

---

# 23. ERROR REFERENCES

Operational errors should generate a searchable reference.

Example:

```text
ERR-CTT-20260924-X82P
```

User-facing error:

```text
Não foi possível criar o envio.
Referência do erro: X82P
```

Internal logs must allow support staff to find the complete technical error.

---

# 24. RATE LIMITING

Introduce rate limiting for sensitive/public endpoints.

Especially:

```text
/login
password reset
public tracking
API endpoints
shipment creation
webhook endpoints
```

Use different limits depending on endpoint sensitivity.

---

# 25. FEATURE FLAGS

Prepare a simple feature flag mechanism.

Examples:

```text
MRW_ENABLED
NEW_PRICING_ENGINE
NEW_CLIENT_DASHBOARD
CLIENT_WEBHOOKS_ENABLED
```

This allows controlled rollout without risky full deployment.

Feature flags must not be used as security controls.

---

# 26. BACKUP AND DISASTER RECOVERY

Document the recovery model.

Define:

```text
RPO
RTO
backup frequency
restore procedure
responsible person/process
```

Ensure the project has a documented recovery path if the database or deployment fails.

---

# 27. GDPR / DATA PROTECTION

The TMS processes personal data such as:

```text
names
addresses
phone numbers
emails
delivery history
```

Prepare architecture and documentation for:

```text
data retention
data minimization
data export
anonymization
right-to-delete workflows
access logging
security incident response
```

Operational/logistics data required for legal/accounting obligations should not be blindly deleted.

---

# 28. TESTING

Create a proper testing foundation.

Add scripts such as:

```text
npm run typecheck
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
```

Prioritize tests for:

```text
authentication
authorization
tenant isolation
client isolation
shipment state transitions
shipment pricing
tariff versioning
shipment creation
carrier adapters
CTT mapping
tracking mapping
billing calculations
ledger calculations
idempotency
```

Critical security tests:

```text
Unauthenticated user cannot access /ops.

Client cannot access /ops.

Client A cannot read Client B shipments.

Client A cannot modify Client B resources.

Changing clientId in the URL does not grant authorization.

Employee without permission cannot execute privileged actions.

Service-role-backed actions cannot execute without authorization.
```

Do not aim for 100% coverage initially.

Cover critical business and security flows first.

---

# 29. CI / GITHUB ACTIONS

Create GitHub Actions CI.

For pull requests and main branch changes run:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

CI should fail if any critical step fails.

Do not expose production secrets to untrusted pull request builds.

---

# 30. CLEAN THE REPOSITORY

Review root-level debug/maintenance files.

Examples:

```text
check_client.js
check_clients.js
check_shipments.js
fetch_schema.js
query.js
patch_statement.js
scratch_ctt.ts
test.tsx
```

Do not delete blindly.

Classify them into:

```text
scripts/dev/
scripts/maintenance/
tests/
```

Delete only verified obsolete scratch files.

---

# 31. DOCUMENTATION

Replace generic project documentation.

Create documentation for:

```text
project overview
architecture
tech stack
local setup
environment variables
Supabase setup
database migrations
authentication
authorization
RBAC
multi-tenancy
RLS
shipment lifecycle
carrier integrations
pricing architecture
billing architecture
job architecture
testing
deployment
incident recovery
security principles
```

Provide:

```text
.env.example
```

with variable names only.

Never include real credentials.

---

# 32. RECOMMENDED CORE DOMAIN

The central Linke TMS domain should become clear and stable.

Core concepts:

```text
Tenant
Client
User
Membership
Permission
Shipment
Package
Pickup
Carrier
TrackingEvent
ShipmentEvent
Tariff
Price
Invoice
Transaction
AuditEvent
```

External systems should sit around this core.

Conceptually:

```text
             CTT
              │
MRW ───── Shipment Core ───── Correos
              │
           Pricing
              │
           Billing
              │
            Moloni
```

Avoid architecture where external integrations dictate the internal domain model.

---

# 33. IMPLEMENTATION PRIORITY

Use this order.

## P0 — Critical

```text
Authentication
Authorization
Remove clientId bypass
Protect /ops
Secure Server Actions
Secure createAdminClient usage
Tenant/client isolation
RLS
Remove fake tracking numbers
```

## P1 — Foundation

```text
Shipment source of truth
Shipment state machine
Carrier adapter
Pricing engine
Tariff versioning
Input validation
Tests
CI
```

## P2 — Reliability

```text
Idempotency
Background jobs
Retries
Webhook ingestion
Soft delete
Audit improvements
Observability
Error references
```

## P3 — Platform

```text
API v1
Client webhooks
Rate limiting
Feature flags
Financial ledger improvements
GDPR tooling
Backup/recovery documentation
```

## P4 — Expansion

Only after the foundation is stable:

```text
MRW
Correos
additional carriers
e-commerce integrations
ERP integrations
advanced automation
external SaaS customers
```

---

# 34. EXECUTION RULES

Before changing a file:

1. inspect the file
2. search for imports/usages
3. identify business impact
4. identify security impact
5. make the smallest safe change
6. add/update tests

After significant changes run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Fix regressions before continuing.

Do not knowingly leave the repository in a broken state.

---

# 35. GIT WORKFLOW

For significant refactors prefer:

```text
feature/refactor branch
→ focused commits
→ tests
→ pull request
→ review
→ merge
```

Avoid one giant commit containing unrelated changes.

Suggested branch examples:

```text
refactor/auth-foundation
refactor/tenant-context
feat/shipment-state-machine
feat/carrier-provider
feat/pricing-engine
feat/job-processing
```

---

# 36. FINAL REPORT REQUIRED

At the end of each major phase provide:

```text
1. Problems discovered
2. Files changed
3. Security issues fixed
4. Architecture changes
5. Database migrations added
6. Tests added
7. Breaking changes, if any
8. Remaining technical debt
9. Recommended next phase
```

Do not claim a problem is solved unless code, tests and build support that conclusion.

---

# FINAL TARGET

The final result should remain the existing **TMS Linke**, but evolve from an internal application into a robust logistics platform with:

```text
secure multi-tenancy
strong authorization
clean shipment domain
carrier abstraction
versioned pricing
financial traceability
reliable background processing
idempotent integrations
observability
stable APIs
auditability
automated testing
safe CI/CD
```

The goal is not complexity for its own sake.

Prefer the simplest architecture that provides strong operational reliability and allows the Linke TMS to grow without requiring a future rewrite.
