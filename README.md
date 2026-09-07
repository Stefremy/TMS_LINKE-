# TMS LINKE

Internal Transportation Management System for Linke (parcel ops in Portugal / Iberia).

This README is the source of truth for humans and for Antigravity / coding bots. Follow it before writing code.

## Aim

Build a multi-carrier shipping ops platform so Linke can:

- Receive shipment orders from business clients (PMEs)
- Create labels / guias with CTT Expresso (and later Correos Express)
- Book recolhas
- Track status through to delivery
- Later invoice clients (faturação) and open self-serve tenant access

**Phase 1 (now): company use only.** One operator tenant (`LINKE`). Staff run ops. Clients get a scoped admin in the same UI and submit orders into the Linke inbox. Do not build public signup, SaaS billing, or a second app.

Phase 2: extra tenants (`tenant_id`), client fiscal details, AT documentos de transporte, certified invoicing.

## Product rules

1. One UI, two sessions. Same screens for Linke staff and for a client. Scope data by `tenant_id`. Change buttons by role.
2. One `shipments` row. Client **Enviar** does not copy the order. It sets `status = pendente` and the row appears on the Linke main inbox.
3. Clients never call CTT. Linke holds `AuthenticationID`, `ClientId`, `ContractId`. Server-side carrier adapter only.
4. Put `tenant_id` on every business table from day one, even with a single tenant.
5. Follow the existing Linke portal mockups for structure: sidebar + dense Envios table (Envios e Serviços), Recolhas, Planeamento, Rastreio, Tickets. Do not invent a new visual language.

## UI structure (follow mockups)

Shell:

- Sidebar: Envios e Serviços, Recolhas, Planeamento, Rastreio, Tickets
- Top bar: tenant context. Staff: all clients + **Abrir cliente**. Client: their company name only
- Main: filters + envios table + row actions
- Primary CTA: **Novo envio**

Routes (same Next.js app):

- `/ops` — Linke staff
- `/app` — client admin (same Envios table, scoped)
- Staff **Abrir cliente** sets `active_tenant_id` cookie, redirects to `/app`, shows banner “A ver {CLIENT} · Sair”

Envios table columns:

- Date
- Cliente (staff only)
- Remetente / Destinatário
- TRK
- Weight
- Serviço (carrier + product)
- Estado
- Price (staff: buy + surcharge; client: their sell price only)
- Actions

## Roles

| Role | Login | Can do |
|------|--------|--------|
| `staff_admin` | `/ops` | All tenants, CTT create/close, recolhas, Abrir cliente |
| `staff_ops` | `/ops` | Process inbox, labels, assign driver |
| `staff_driver` | `/ops` | Today’s recolhas + status |
| `client_owner` / `client_ops` | `/app` | Draft, edit, Enviar, cancel before network, view tracking |

Client must not see other clients, CTT credentials, buy rates, or ops-only substatus (`ctt_error`, etc.).

## Shipment states

Shared `status` for both UIs:

`rascunho` → `pendente` → `aguarda_correcao` → `recolha` / `atribuido_motorista` → `recolhido` → `entrada_rede` → `em_distribuicao` → `entregue`

Also: `incidencia`, `devolvido`, `cancelado` (cancel only before `entrada_rede`).

Who sets what:

- Client: `rascunho`, Enviar → `pendente`, resend from `aguarda_correcao`, `cancelado` while still with Linke
- Linke: correction request, recolha, motorista, CTT label, close lot
- CTT events map into status (do not show raw codes as the badge):
  - `EMP` recolhido
  - `EMA` entrada_rede
  - `EMZ` em_distribuicao
  - `EMI` entregue
  - `EMH` incidencia (+ reason)
  - `EMV` / `EMM` devolvido

Optional `ops_substatus` is staff-only.

## Data model (minimum)

- `tenants` — first row: LINKE (the operator)
- `clients` — CACTO, DETAILER, FRM-PT, TUDO, … belong to LINKE until Phase 2 promotes them to tenants
- `users` + `memberships` (user, tenant, role)
- `staff_profiles` — `is_staff` in auth `app_metadata`
- `shipments` + `packages`
- `recolhas`
- `tracking_events`
- `audit_log` (Abrir cliente / impersonation)

Every business table: `tenant_id`, timestamps. Unique keys start with `tenant_id`.

Auth: Supabase Auth + RLS. Client JWT has `tenant_id`. Staff stay themselves; they switch `active_tenant_id`. Never silently swap to the client’s user JWT without an audit row and a visible banner.

## CTT Expresso (Phase 1 carrier)

SOAP / WCF, not REST. Docs live in the project Space (not yet in this repo):

- SGEE CTTX WS Aplicações Próprias V1.8 — `CompleteShipment`, `CreateShipment`, `CloseShipment`
- RecolhasWS V1.4 — `MarcarRecolha` / `NewOfferPickUp`, `CompletePickUp`
- ReferenciasWS V1.0 — pickup points
- Track & Trace event/reason/situation codes

Auth per call: `AuthenticationID` (GUID) + `ClientId` + `ContractId`. `DistributionChannelId = 99` (EMS).

Preferred flow for warehouse:

1. Client Enviar → `pendente`
2. Staff validates
3. `CreateShipment` → store TRK, `DeliveryNoteId`, label/guia bytes
4. End of day `CloseShipment` (one certificado per product type) → `entrada_rede`
5. Recolhas: `NewOfferPickUp` when CTT collects; Linke motorista is a separate internal recolha

`CompleteShipment` = create + print + close in one call (use only when you need that).
`CompletePickUp` creates objects + pickup and prints nothing — avoid for Phase 1 labels.

CTT “guia de transporte” is the carrier label, not the AT documento. Field `ATCode` (256) is for Autoridade Tributária. Phase 1: nullable. Phase 2: communicate to AT first, then pass the code.

Products: ERS 24, ERS 48, D+1, D+2, D+5 via `SubProductId`.
PT address: `PTZipCode3` + `PTZipCode4`. `ClientReference` max 21 chars.
`HasSenderInformation = false` uses Linke’s default expedidor in CTT — valid for company-originated parcels. Client-originated parcels send sender address.

Secrets in env / tenant settings, never in the client browser.

## Stack

- TypeScript
- Next.js (App Router) on Vercel
- Supabase (Postgres, Auth, RLS)
- One repo, one app

Suggested layout:

```
app/
  ops/          # staff
  app/          # client
  login/
components/     # shared Envios table, filters, status badge
lib/
  ctt/          # SOAP adapter
  supabase/
  shipments/    # state machine
supabase/migrations/
```

## Build order (Antigravity)

Do this in order. Stop after each slice is runnable.

1. Next.js app + README (this file) + env example
2. Supabase migrations: tenants, clients, users/memberships, shipments, RLS
3. Seed tenant `LINKE` + a few clients (CACTO, DETAILER)
4. Auth: staff vs client; middleware for `/ops` vs `/app`
5. Envios list UI matching mockups (filters, status badge, pagination)
6. Novo envio + rascunho + Enviar → staff inbox
7. Staff actions: aceitar, aguarda_correcao, cancel
8. CTT SOAP client in test/QA: CreateShipment + persist TRK/label
9. CloseShipment end-of-day
10. Recolhas module (internal first, then CTT NewOfferPickUp)
11. Tracking event ingest + badge mapping
12. Abrir cliente (tenant switch + audit + banner)

Do **not** start with: SaaS billing, Stripe, public signup, Correos, AT webservice, certified faturação, trip optimiser, claims product, 170 carriers.

## Conventions

- Language: UI in Portuguese (pt-PT). Code and comments in English.
- Money in EUR. Weight stored in grams (CTT `Weight` is int).
- No nested repos. No commit of `.env` or CTT credentials.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`

## Env (do not commit secrets)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CTT_AUTHENTICATION_ID=
CTT_CLIENT_ID=
CTT_CONTRACT_ID=
CTT_WS_BASE_URL=
```

## Status of this repo

Empty at first commit except this README. Implement from the build order above. If mockup screenshots are added under `docs/mockups/`, treat them as UI source of truth over any invented layout.
