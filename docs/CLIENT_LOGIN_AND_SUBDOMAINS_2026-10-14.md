# Client login and future subdomains — 14 October 2026

Subsequent step: client invitations and self-service password setup are documented in [CLIENT_INVITATIONS_2026-10-14.md](./CLIENT_INVITATIONS_2026-10-14.md). The user has not confirmed an existing deployment/public URL. These invitations need that deployment and a configured public portal origin before real external-client testing.

## Implemented locally

Clients have a dedicated login at `/app/login`, with **Área do Cliente**,
**Entrar na minha loja**, account support and wording about shipments. Desktop
shows an introduction alongside the form; mobile puts the form first. The team
login stays at `/login`, labelled **Equipa Linke · Operações**.

Opening `/app/stef-store` without a session redirects to the client login and
carries the store path through authentication. Only local, known portal paths are
accepted. External URLs, Ops paths, traversal and login loops are rejected. The
store pages continue to verify ownership independently after authentication.

The login action resolves the authenticated user through the existing server
context, checks that its user ID matches the password-authenticated user, and
rejects unresolved/unassigned client accounts. Neither the form nor its return
path can assign a role. A client using the team form is now refused: the newly
authenticated browser session is closed with local scope, that project's auth
cookie/chunks and presentation/support cookies are cleared, and the user returns
to `/login?error=client_portal`. The form explains that this entrance is for the
Linke team and provides a link to `/app/login`; no credentials are carried in that
link. Cookie cleanup also runs if the provider's sign-out fails. Other browser
sessions and other Supabase projects' cookies are preserved. Staff using the
client form retain their staff identity for support.

Existing sessions redirect from either login page using that same context. Staff
can view `/app/login?preview=true` or `/login?preview=true` to review the public design without logging
out. These only show the generic forms; they grant no access and load no customer
profiles. Clients cannot use preview to bypass their normal portal redirect.

A client already signed into their store remains redirected to their own portal
when opening Ops or its login page. This does not authenticate a client through
the staff form or grant staff permissions. To test rejection of a new login,
start signed out in a private browser window and submit the client credentials
at `/login`; login should remain available through `/app/login`.

Authentication failure messages do not reveal provider details, emails or
passwords in logs. A small host-local cookie remembers which login to show after
logout; it is not an authorization source. Logout also clears the staff's selected
store cookie. No passwords, roles, memberships or database schemas were changed.

## Suggested domain arrangement

The owner has `toke.pt` available and intends to recover `linke.pt` later. Hosting
and DNS configuration are not yet specified. Recommended future arrangement:

| Audience | Provisional address | Later address |
| --- | --- | --- |
| Client portal | `app.toke.pt` | `app.linke.pt` |
| Linke Ops | `ops.toke.pt` | `ops.linke.pt` |

These addresses are proposals, not configured live services. Current client paths
remain `/app/<storeSlug>` until host routing is deliberately configured. A subdomain
separates the browser origin and can separate sessions, but does not itself
separate database permissions, service-role credentials or server actions.

For deployment, bind allowed hosts to the intended route groups: the client host
should not serve Ops routes, while the staff host requires staff access. Retain
permission/ownership checks on every underlying action and API regardless of host.
Keep authentication cookies host-only rather than sharing them with the whole
`.toke.pt` domain. Staff may then need a separate sign-in on the client host to
provide support; sharing authentication across hosts needs a deliberate design.

A single codebase can remain while routing/hosting enforce those boundaries. Two
deployments can reduce exposed staff routes and separate operational settings;
neither arrangement removes the need for the pending database and action audit.
Migration to Linke's domain should preserve store IDs, slugs and account assignments,
and update the configured public origins/authentication return URLs at deployment.
Do not assume that ownership of a domain also grants access to its current DNS or
the former developers' hosting configuration.

Source references:

- [Next.js data-security guidance](https://nextjs.org/docs/app/guides/data-security):
  actions need independent authorization; page/routing checks alone do not protect
  mutations.
- [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie):
  omitting `Domain` restricts a cookie to the host that set it; setting a parent
  domain makes it available to its subdomains.
- [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side):
  browser/server sessions are transported through cookies.

## Validation

- Initial separate-login step: `npm run test:security` had 87 passing tests. After invitations and rejection of client sign-in through Ops, the suite has 105 passing tests, including 13 login tests. These cover server-verified roles, forged form fields, cookie cleanup, provider sign-out failure, staff admission and unchanged client-portal access.
- `tsc --noEmit`: passed.
- `npm run build`: passed; the existing parent-lockfile warning remains.
- Lint on new/changed login pages, actions, helper and tests: passed. Middleware
  retains its existing unused-variable warning.
- `git diff --check`: passed.
- Local anonymous HTTP check: store requests redirect to `/app/login` with a safe
  store return path. Client login remains public; anonymous Ops uses `/login`.
- Chrome visual verification: desktop and 390px mobile layouts; no horizontal
  overflow at 390px. No real passwords were entered or login credentials changed.
- Ops rejection notice was visually verified through staff preview, without submitting real credentials. Added notice spacing keeps it clear of the logo. No customer password or real session was used to test the rejection flow; authentication/provider behavior was checked with isolated fixtures.

No DNS change, deployment, public-origin change or subdomain-wide cookie sharing
was performed. Remaining security audit work is unchanged, including role fallback
consolidation, client-safe cost fields, tariff redaction and deployed RLS checks.
