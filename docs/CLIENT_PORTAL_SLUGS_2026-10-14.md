# Store addresses — 14 October 2026

## How to use it

Open a client from Ops and choose **Aceder à Loja**. The browser now shows the
store address rather than only `/app`. Sidebar buttons keep that address when
opening shipments, recipients or invoices.

The existing Stef Store record has the commercial name **Stefano Pereira**, so
its automatic address is `/app/stefano-pereira`. To choose `/app/stef-store`, edit
the client in Ops, open **Identidade & Geral**, enter `stef-store` in **Endereço
da área do cliente**, and save. No client record was changed during implementation
or browser verification.

Clients can open only the store attached to their login. A guessed address for a
different store is refused. Ops/admin can open any valid Linke store and keep
their staff identity. The **Sessão Operador TMS** banner remains for staff;
clients receive **Terminar sessão** and no staff navigation in the portal header.

## Routing and access

- New routes: `/app/[storeSlug]`, `/criar-guia`, `/envios`, `/destinatarios`,
  `/faturas` and `/recolhas` beneath it. Recolhas keeps its previous behavior of
  returning to the dashboard; this change does not add a new pickup workflow.
- Every page and the store layout independently await the store authorization
  helper. Page protection is not delegated only to a cached parent layout.
- The server reads the verified account and company, then builds a scoped catalog
  of persisted clients and their latest stored details. Deleted clients are
  excluded. Client accounts are also refused inactive stores; staff can inspect
  their own company's inactive stores for support.
- Reads are paginated in batches of 1000. A database failure stops routing; demo
  display records cannot establish portal ownership.
- Store names are normalized to lowercase URL names. Optional `portal_slug`
  values are stored in existing client details, so no SQL migration is required.
  Duplicate names, aliases and reserved route names get an immutable client-ID
  suffix. Later collisions can change a formerly unsuffixed address; use distinct
  address names when distributing permanent customer links. There is no separate
  database uniqueness constraint for aliases in this implementation.
- A client's assigned immutable ID must match the resolved store. Slugs never
  change roles or grant ownership. Staff requests use the URL's store on new pages
  rather than the last browser-wide selection cookie.
- `/app` and its old subpages redirect to the account's own store or the staff's
  selected store. Staff without a selection return to the Ops client list.
  Supported top-up success/cancellation feedback survives the redirect.
- `/app/selecionar` validates the company/store before setting the legacy selection
  cookie. Old `?clientId=` links pass through this route rather than allowing
  middleware to write an unchecked cookie. Redirect destinations are restricted
  to known portal sections; caller-supplied external destinations are ignored.
- Recipient and invoice pages use explicit URL-derived client IDs. Shipment list
  and statement reads also constrain the verified company. Existing actions keep
  their own client/staff guards; financial permissions are not expanded.
- Cache invalidation now targets the store route patterns or the `/app` layout,
  so updates refresh the new pages. Logout clears the legacy selection cookie.

## Validation

- `npm run test:security`: 75 tests passed, including 16 new slug/access tests.
- `tsc --noEmit`: passed.
- `npm run build`: passed. The existing parent-lockfile warning remains.
- Lint on portal routes/components, client actions, login, middleware and new
  helpers/tests: 56 existing errors and 66 warnings before; the same totals after
  the change. New slug helpers, routes, shell and tests have no lint errors.
- `git diff --check`: passed.
- Original local HTTP check without a login redirected to `/login`. The subsequent
  client-login implementation now redirects to `/app/login?next=/app/stef-store`
  (with the return path URL-encoded).
- Existing staff login in Chrome: selecting the actual Stef Store resolves to
  `/app/stefano-pereira`; the history link resolves to its `/envios` page. Browser
  verification reads existing records and does not create shipments or payments.

The isolated checks cover two client logins, employees/admins, foreign companies,
unknown/deleted/inactive stores, duplicate/reserved names, explicit aliases,
pagination, database failures, wrong-store page calls, tab-independent staff store
selection, legacy redirects, restricted selector cookies and alias save permission.
No real customer login credentials were changed or used for the negative tests.

## Remaining work

This implements store addresses and their reviewed page/access boundaries, not a
complete certification of the portal. Canonical role/account mapping, internal
buying-price redaction, tariff redaction bypass, remaining privileged billing
actions, deployed database policies and public financial fixtures still need
their separate hardening work. No deployment was published.
