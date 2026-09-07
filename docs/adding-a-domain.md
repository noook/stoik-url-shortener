# Adding a domain

A "domain" here is a hostname the redirect service will answer for -
e.g. `go.example.com`. Short codes are unique per domain, not globally
(see `docs/adr/0001-domain-and-shortcode-uniqueness.md`), so the app needs
to know about a hostname before any link on it can resolve.

Adding one has two parts: pointing real traffic at the running instance
(infra), and registering the hostname in the app's own `domains` table so
the redirect handler and the create-link form know it exists (app). Both
are required - the app step alone won't route real requests, and the infra
step alone will hit a 404 in the redirect handler since it does a strict
`(hostname, code)` lookup.

## 1. Infra: point the hostname at this instance

Generic requirement, however you host it:

- Add a DNS record for the new hostname pointing at wherever the `api`
  container/service is reachable (see your deployment's own docs for the
  exact target - this project doesn't prescribe a specific reverse proxy or
  hosting setup).
- Make sure whatever sits in front of the API (reverse proxy, load
  balancer, or nothing at all if the API is directly exposed) forwards
  requests for that hostname to the API's redirect endpoint (`GET /:code` -
  see `apps/api/src/links/redirect.controller.ts`). The redirect route has
  no `/api` prefix, unlike the rest of the API, since a short link is
  meant to be typed directly as `https://your-domain.example/AbC123`.
  This same domain is also expected to serve the admin dashboard under
  `/admin` (see `docker-compose.yml`'s `web` router) - a reverse proxy
  fronting this project needs both `/admin` (dashboard) and everything
  else, including the bare root (redirect service), routed correctly; see
  that compose file's `api`/`web` labels for the reference split.
- If you're running the API behind TLS termination, the domain needs a
  valid certificate before real users see it, same as any other domain -
  no code changes here.

## 2. App: register the hostname

Once traffic can reach the API for the new hostname, tell the app about it
so short codes on it actually resolve. Two ways to do this:

**CLI (recommended - works against any running instance, including a
Docker container):**

```sh
# Local dev:
pnpm --filter api cli domain:add --hostname go.example.com [--default]

# Against a running Docker Compose deployment:
docker compose exec api node dist/cli.js domain:add --hostname go.example.com [--default]
```

`--default` marks it as the domain pre-selected in the create-link form's
domain picker. There can be more than one domain marked default in the
data model (nothing enforces exclusivity at the DB level) but only makes
sense to have one in practice - the create-link screen just picks the
first one it finds.

**Directly in the database**, if the CLI isn't reachable for some reason:
insert a row into the `domains` table with the hostname and an `is_default`
boolean - see `apps/api/src/database/schema.ts` for the exact column names.
The CLI path is preferred since it goes through the same
`DomainsService.add` the app itself uses, including the
`onConflictDoNothing` safety against duplicate hostnames.

## 3. Verify

```sh
curl -i https://go.example.com/some-short-code
```

Should return a `302` to the link's destination if the code exists on that
domain, a `404` (styled HTML page) if the domain is registered but the code
doesn't exist on it (or the domain itself isn't registered yet), or a `410
Gone` if the link is deactivated or has expired. `curl -i https://go.example.com/`
(bare root, no code) should `302` to `/admin`, where the dashboard is served
- see `RedirectController` in `apps/api/src/links/redirect.controller.ts`.
