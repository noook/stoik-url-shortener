# URL Shortener — Technical Assessment

A URL shortener with multi-domain link management, click analytics, and
CLI-provisioned token auth. Built as a take-home technical assessment.

- **`apps/api`** — NestJS + Drizzle + Postgres. Link CRUD, redirects, click
  tracking, cookie-or-Bearer-token auth.
- **`apps/web`** — React + Vite + shadcn/ui + TanStack Query + React Hook
  Form/Zod. Login, links list, link detail, create-link screens.
- **`packages/shared`** — Zod schemas shared between frontend and backend,
  so form validation and API validation are guaranteed to agree.

Full history of how this was built — decisions, questions asked and
answered, and what landed when — is in [`docs/progress-log.md`](docs/progress-log.md).

## Architecture at a glance

- **pnpm workspace monorepo.** One `pnpm install` at the root, workspace
  packages resolve to each other via `workspace:*`.
- **Shared validation, not duplicated validation.** `packages/shared`'s Zod
  schemas back both the NestJS `ZodValidationPipe` and the React forms'
  `zodResolver` — a change to a schema updates client and server validation
  together, and both actually enforce the same rules because it's the same
  code.
- **A typed method per API endpoint, not a single generic `api<T>(url)`
  call.** `packages/shared/src/api-endpoints.ts` wraps the raw `ofetch`
  client in `api.links.list()`, `api.links.get(id)`, `api.auth.login()`,
  etc. - one place per route for its URL and response type, matching the
  NestJS controllers 1:1. Every call site gets both through inference
  instead of writing a URL string and a response generic by hand at every
  call site.
- **Auth: a long-lived API token, not a session layered on top of one.**
  `token:create` issues a token via the CLI; the token itself is the
  credential. The web app exchanges it once for an httpOnly cookie holding
  that same token (`POST /api/auth/session`) so page-side JS never touches
  it; a `Bearer` header with the same token works identically for
  direct/CLI API use. See [ADR 0001](docs/adr/0001-domain-and-shortcode-uniqueness.md#related-decisions-folded-in-here)
  for the reasoning on why no separate session layer was added.
- **Short-code uniqueness is per domain, not global.** `(domain, code)` is
  a short link's real identity — the same code can exist on two different
  domains and resolve to two different destinations. See
  [ADR 0001](docs/adr/0001-domain-and-shortcode-uniqueness.md) for the full
  reasoning and its consequences.
- **Redirects are always `302`, never `301`.** A `301` gets cached by the
  browser and stops hitting the server on repeat visits, breaking click
  logging and link edits/expiry for that visitor. Also covered in ADR 0001.
- **Traefik, not a hand-written nginx `proxy_pass`, routes `/api/*` to the
  API and everything else to the web app.** The `docker-compose.yml`'s
  bundled `traefik` service discovers both targets via Docker labels on
  the `api`/`web` services - nginx inside the `web` container is a plain
  static file server (SPA fallback only), not a reverse proxy.

## Running locally

Requires Node 26+, pnpm, and a Postgres instance (or Docker).

```sh
pnpm install

# Postgres - either run your own and point DATABASE_URL at it, or:
docker run -d --name url-shortener-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=url_shortener -p 5432:5432 postgres:18-alpine

cp apps/api/.env.example apps/api/.env   # adjust DATABASE_URL if needed

pnpm --filter api build                  # cli.js and the seed scripts run from dist/
pnpm --filter api exec drizzle-kit migrate    # create the schema (reads schema.ts directly, no build needed)
pnpm --filter api seed                   # seed 2 demo domains
pnpm --filter api seed:links 200         # seed demo links (optional, any count)
pnpm --filter api cli token:create --name "local-dev"   # issue a token, shown once

pnpm dev   # runs both apps/api (port 3000) and apps/web (port 5173) in parallel
```

Open `http://localhost:5173`, paste the token from `token:create` into the
login screen.

## Running with Docker Compose

```sh
cp .env.example .env   # set a real POSTGRES_PASSWORD
pnpm docker:up          # docker compose up --build
```

Brings up Postgres, the API, the built web app served as static files by
nginx, and a bundled Traefik instance that routes `/api/*` to the API
service and everything else to the web service (via Docker label
discovery - see the `api`/`web` services' `traefik.*` labels and the
`traefik` service itself in `docker-compose.yml`). Migrations run
automatically on container start (`apps/api/docker-entrypoint.sh`) — no
separate migration step. Once it's up:

```sh
docker compose exec api node dist/cli.js token:create --name "demo"
docker compose exec api node dist/cli.js domain:add --hostname go1.localhost --default
```

Web app is on `http://localhost:8080` by default (see `.env.example` for
port overrides). `docs/homelab-deployment-notes.md` documents how the
author personally deploys this on their own homelab — that file is
explicitly **not** part of this project's requirements, kept separate on
purpose.

## Adding a domain

See [`docs/adding-a-domain.md`](docs/adding-a-domain.md) — two steps
(infra routing + registering the hostname via `domain:add`), both
required.

## Testing

```sh
pnpm test           # unit tests, all workspaces
pnpm --filter api test:e2e   # API integration tests
```

The targeted test pass covers the areas most likely to hide a real bug
rather than aiming for a full suite: redirect resolution (the `(domain,
code)` lookup from ADR 0001), short-code/domain conflict handling on
create, and the auth guard (cookie vs. Bearer, invalid/revoked token,
missing token). See `docs/progress-log.md` for what's actually covered as
of the latest commit.

## Project structure

```
apps/
  api/            NestJS backend
    src/
      auth/       Token auth (guard, service, CLI commands)
      domains/    Domain CRUD + the domain:add CLI command
      links/      Link CRUD, click tracking, the public redirect handler
      database/   Drizzle schema + connection module
      cli/        nest-commander entry point (token:create, domain:add)
      scripts/    One-off scripts (seed, seed-links) - not part of the Nest app
  web/            React frontend
    src/
      pages/      The 4 screens (login, links list, link detail, create-link)
      components/ Shared UI (shadcn primitives + a few app-level components)
      lib/        API client, auth context
packages/
  shared/         Zod schemas + types shared front/back, ofetch-based API
                  client factory + a typed method per endpoint (api-endpoints.ts)
docs/
  adr/            Architecture decision records
  progress-log.md Full build history
  adding-a-domain.md            Generic - how to point a new domain at a running instance
  homelab-deployment-notes.md   Personal - the author's own deployment, not a requirement
```
