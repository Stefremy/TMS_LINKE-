# Client access — first implementation — 14 October 2026

## What this means in everyday language

Each client login belongs to one store. A client can maintain that store's delivery
address book. They cannot change another store's addresses or use the staff's
reimbursement tools, even if they obtain a record identifier or send a request
without using the visible buttons.

Ops can still help any Linke store with its addresses. Reimbursement history,
uploads, deletion and paid-status changes require financial permission, with
administrators allowed by the existing permission helper.

For example:

| Request | Result in the isolated checks |
| --- | --- |
| Store A edits its own saved delivery address | Allowed |
| Store A edits or deletes Store B's saved address | Refused |
| Store B edits its own saved delivery address | Allowed |
| Client opens reimbursement history or marks a reimbursement paid | Refused |
| Ops helps Store A or Store B with their addresses | Allowed |
| Staff without financial permission uses reimbursement tools | Refused |
| Finance employee or administrator uses Linke reimbursement tools | Allowed |
| Caller targets another company's record or an unrelated record type | Refused |

The app checks the logged-in account when it receives the request. Hiding buttons
or guessing URLs does not grant access. These changes rely on the existing
server authentication helper; consolidating its role sources remains separate work.

## Implementation

- `app/actions/reembolsos.ts`: all five actions authorize before file reads,
  parsing or database work. History, status updates and deletion constrain both
  company and record type. Status updates reject absent batch summaries and
  invalid paid-state input. Uploads fail when persistence fails, record the
  real actor, and use the same database ID returned to the upload interface.
- `app/ops/tesouraria/reembolsos/page.tsx`: employees without financial permission
  receive a restricted-access message before history is loaded.
- `lib/services/reembolsos/reembolso-reconciler.ts`: shipment matching is company
  scoped and lookup failures stop processing. Existing comparison formulas and
  rounding remain unchanged.
- `lib/services/clients/scoped-client-profiles.ts`: loads only referenced persisted
  company profiles and excludes deletion markers. It does not invent ownership
  or bank details from demo clients. It selects only known base-table columns;
  richer names and bank details come from scoped stored client data.
- `app/actions/destinatarios.ts`: list reads are scoped to company and the client's
  assigned store. Clients cannot select a different owner. Updates check ownership
  both on lookup and on the write; deletion applies the same constraints. Missing
  or inaccessible records do not report success. Saving a synthetic history
  address creates a fresh saved-recipient ID; ordinary supplied IDs must refer
  to accessible existing records. Ops retain company-wide address-book access.
- `tests/client-action-security.test.cjs`: isolated regression coverage with fake
  sessions, databases, carrier-file parsing and filesystem reads. The actual
  authentication and permission helpers are exercised with mocked dependencies.
- `tests/helpers/fake-supabase.cjs`: now applies update/delete filters to fixture
  rows and returns copies, so checks verify records stay unchanged on denied
  access rather than only checking which query methods were called.

## Validation

- `npm run test:security`: 59 tests passed, including 22 new client-action tests.
- `tsc --noEmit`: passed; the production build also passed its TypeScript check.
- `npm run build`: passed. The existing parent-lockfile warning remains.
- Lint across this step's changed and added code: 14 errors and 2 warnings before,
  5 errors and no warnings after. Remaining errors are existing `any` annotations
  in recipient listing and the reimbursement reconciler; new files are clean.
- `git diff --check`: passed.

No real client records, payments, shipment purchases, carrier services or fiscal
documents were modified. No database migration was added. These changes are local
and have not been deployed. Deployed database permissions have not been verified.

## What comes next

Remove internal buying prices from client responses and prevent clients from
disabling tariff filtering. Then consolidate login roles and staff store selection
before introducing store slugs. Other privileged Ops actions, especially the
exported billing helper in `app/actions/moloni.ts`, still need authorization review.

Financial files under `public/` remain independently downloadable if deployed;
authorization of their loading actions does not secure those static URLs. Private
anonymized fixtures, invoice concurrency, receipt validation, deployed database
policies, and the billing cron's missing-secret handling remain outstanding work.
