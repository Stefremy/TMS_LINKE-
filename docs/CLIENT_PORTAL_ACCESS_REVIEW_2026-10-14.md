# Client portal architecture review — 14 October 2026

## Agreed access model

Each client login belongs to exactly one store/client account. Linke Ops staff
can open any Linke client store for operational support, while retaining their
staff identity. Clients must never access Ops screens or execute Ops-only actions.
Financial and administrative capabilities remain subject to their existing
permissions, even when a staff member can browse all Linke stores.

Linke is the tenant/company. Stores are client accounts inside Linke; a store slug
is a readable URL identifier, not a separate tenant or a password.

## Assessment

The existing Next.js/Supabase architecture is a reasonable foundation. Keep the
separate `/app` client portal and `/ops` backoffice and evolve their shared server
authorization layer. A rewrite or microservice split is not needed to implement
this access model. The reviewed client data/action boundaries are not yet complete.

This was a repository review plus isolated execution of actual TypeScript modules
using mocked sessions, databases, and integration dependencies. No production
exploit test, login change, schema migration, real financial operation, or live
API call was performed. Deployed Supabase policies have not been inspected.

## Existing strengths

- `app/ops/layout.tsx:25` requires staff access on the server; middleware also
  redirects accounts with a client role away from `/ops`.
- `app/app/layout.tsx:23` requires login and obtains the selected client from the
  server authentication context.
- `lib/auth/context.ts:142` rejects normal client accounts in `requireEmployee`.
- Shipment listing forces a client's session-assigned client ID even if another
  ID is submitted (`lib/services/shipments/shipment-fetcher.ts:20`).
- Shipment creation uses the client's session identity and authoritative server
  pricing. Financial PDF routes now enforce ownership and financial permissions.
- Staff store selection has a dedicated route and an impersonation banner. The
  client role ignores staff impersonation cookies.

## Implementation progress — 14 October 2026

The first implementation covers reimbursement tools and the saved-recipient
address book. Clients are denied reimbursement operations; finance employees and
administrators retain them. Clients can save, edit and delete only their own
store's recipients, while Ops can manage any Linke store's recipients. Reads and
mutations in these paths are constrained to the verified company.

See [the plain-language walkthrough and validation notes](CLIENT_PORTAL_STEP_1_2026-10-14.md).
This is a local code change, not a deployment. The remaining gaps below still need
their own changes; the entire client portal is not yet certified secure.

**Store URLs are now implemented locally:** `/app/[storeSlug]` and its shipment,
recipient and invoice pages validate the store against the signed-in account.
Old `/app` links redirect to the correct store. Ops can open company stores by URL,
independently of their last selection in another tab. The client edit form offers
an optional portal address. See [slug implementation notes](CLIENT_PORTAL_SLUGS_2026-10-14.md).
Canonical role resolution and internal-cost redaction remain outstanding.

**Distinct client login is now implemented locally:** anonymous `/app` requests
use `/app/login`, while Ops uses `/login`. Safe store paths survive authentication.
Login redirects now use the existing server authentication context; the legacy
role fallbacks inside that context still require their separate review. See
[login and subdomain notes](CLIENT_LOGIN_AND_SUBDOMAINS_2026-10-14.md).

## Original findings and current status

1. **Ops page protection does not protect every underlying action.**
   `app/actions/reembolsos.ts:131` only requires login for payout-status changes.
   A fixture client could mark another client's fixture payout summary paid.
   Batch reads, uploads, and deletion also need staff/financial permission checks
   and ownership/tenant constraints. This changes a stored status; the fixture
   check did not perform a real bank transfer.

   **Reimbursement paths addressed locally:** all five actions now check finance
   permission before resources, and their queries are company-scoped. This does
   not certify other Ops actions. In particular, the exported `internalEmitInvoice`
   helper in `app/actions/moloni.ts` still needs isolation from callable actions
   and review alongside its cron and billing entry points.

2. **Recipient mutations do not enforce record ownership.**
   `app/actions/destinatarios.ts:338` deletes by recipient ID and action without
   a client or tenant filter. The isolated client call reached that unscoped
   mutation and reported success. The update path at line 300 similarly finds an
   existing record by ID before replacing its details without checking its owner.

   **Addressed locally:** recipient listing, update and deletion now constrain
   company and client ownership; new client records use the session's store. Ops
   retain access to both stores. Internal cost removal remains part of item 3.

3. **Client shipment data includes internal costs.**
   `lib/services/shipments/shipment-fetcher.ts:15` reads full shipment rows and
   returns their fields, including `buy_price`, to client callers. Portal stats
   pass those rows through to the browser at `app/actions/shipments.ts:172`.
   Hiding the field in the rendered interface does not remove it from the response.

4. **A browser-supplied flag can bypass tariff redaction and client filtering.**
   `app/actions/servicos-linke.ts:514` sets `isClient` to false when
   `skipRedaction=true`, without requiring a staff role. With a mocked client
   session, the normal call returned only its own service with costs hidden; the
   flagged call returned both fixture stores' services and their cost prices.
   The same action is imported by the client shipment form.

5. **Role resolution is inconsistent and has permissive fallbacks.**
   Login and middleware use `user.app_metadata.role` while server authorization
   also consults staff records by email, client-user mappings, and hardcoded staff
   defaults. These paths can disagree. A failed staff lookup still accepts the
   metadata employee role in the fixture, so table-based status or permission
   changes cannot be confirmed during that failure. Resolve roles from one
   authoritative server-managed account mapping, preferably keyed by auth user
   ID, with an explicit strategy for existing accounts before removing fallbacks.

6. **Staff store context needs one consistent validation path.**
   `/app/selecionar` loads the requested client, but middleware can separately set
   the impersonation cookie from a raw `?clientId=` parameter. The authentication
   context accepts a staff selection cookie without validating the target there.
   Some client audit lookups lack tenant filters. Consolidate selection around a
   validated Linke-owned store and record the real staff actor in support actions.
   A browser-wide selection cookie is also shared across tabs; explicit store
   routes make simultaneous support sessions clearer.

7. **The client shell exposes a staff navigation link.**
   `app/app/layout.tsx:73` shows `Sair para o TMS` to clients as well as staff.
   Existing staff guards should block a normal client, but the client-facing flow
   should offer a real logout. Keep the return-to-Ops link for staff sessions only.

8. **Database policy verification remains necessary.**
   `supabase/migrations/20260924160000_rls_policies.sql:37` grants clients `FOR ALL`
   access to their own shipment rows. If equivalent write grants and policies are
   deployed without additional restrictions, financial/status fields may be
   writable through the database API outside the server pricing action. Verify
   the actual deployed grants, policies, and triggers before concluding that
   prices are protected at the database boundary. Service-role-backed actions
   independently require application authorization because their client bypasses
   ordinary RLS checks.

## Login and implemented slug flow

Use separate client and team login screens, with access determined by the
server's resolved account:

- Client linked to Store A: `/app` redirects to `/app/store-a`.
- Client linked to Store B: `/app` redirects to `/app/store-b`.
- Linke employee/admin: redirect to `/ops`.
- Account with no valid active access assignment: deny portal access.

Store pages now use `/app/[storeSlug]`, `/app/[storeSlug]/criar-guia`, and
`/app/[storeSlug]/envios`, with matching recipient and invoice pages. The slug
resolves to an immutable internal client ID in the signed-in company. Duplicate
or reserved names receive an ID suffix; no ambiguous alias chooses a store.
It does not set the caller's role or authorize ownership by itself. Existing stores
use their persisted commercial name until an optional `portal_slug` is saved in
their stored client details. Saving the store preserves the existing address on
later display-name edits, unless staff explicitly change the address field.

For every page and action, the server should obtain the verified user, authoritative
role, company, and linked client account. A client may only use the slug that maps
to their assigned client ID. A different store is denied, ideally with a generic
404. Staff can select any valid Linke store as requested by the owner, while
financial/admin operations continue to check their separate permissions.

Keep the real staff actor and the store being viewed as separate context fields.
Opening a store must not turn a staff account into a client account or mutate its
permanent login assignment. Log support actions with both identifiers. Distinguish
explicit account-access revocation from a commercial credit block: a depleted
wallet can block shipment creation without necessarily blocking login to top up.

## Recommended implementation order

1. Reimbursement-action and recipient-ownership fixes are implemented locally,
   with negative tests using two stores, direct action calls, forged IDs and
   anonymous callers. Continue reviewing remaining privileged Ops actions,
   including the callable billing helper, before treating this boundary as complete.
2. Return explicit client-safe shipment, tariff, and client-profile fields. A client
   must not control whether internal fields or another store's tariffs are returned.
3. Unify role/account resolution and staff store selection. Plan a compatibility
   check/backfill for existing logins before changing authorization sources.
4. Store slugs and legacy redirects are implemented locally, including independent
   page guards and wrong-store negative tests. Full role-source consolidation
   remains pending; this implementation uses the existing authentication helper.
5. Verify deployed RLS/grants, account revocation, logout, and recovery behavior;
   then perform staging browser checks for clients, Ops staff, and administrators.

## Target access matrix

| Signed-in account | Store A portal | Store B portal | Ops |
| --- | --- | --- | --- |
| Client assigned to A | Allowed | Denied | Denied |
| Client assigned to B | Denied | Allowed | Denied |
| Linke Ops staff | Allowed | Allowed | Allowed, subject to module permissions |
| Anonymous | Login required | Login required | Login required |

The architectural rule is the same for guessing a slug, editing a URL, supplying
a different ID to a server action, opening a PDF, or accessing a database API:
the server/database must enforce the caller's permitted scope.
