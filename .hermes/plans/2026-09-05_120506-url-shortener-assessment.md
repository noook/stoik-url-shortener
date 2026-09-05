# URL Shortener (Technical Assessment) — Implementation Plan

**Goal:** Build a URL shortener as a take-home technical assessment: React front-end (learning React as you go), NestJS + TypeScript back-end, Postgres via Drizzle, pnpm monorepo, Docker Compose, token auth, and a documented answer to the short-code/domain uniqueness question.

**Status:** Planning only. Repo initialized at `~/work/url-shortener` (git init, `.gitignore`, stub `README.md`, first commit `95977db`). No app code yet — waiting on the open questions below before scaffolding.

**Mode note:** unlike a typical delegated build, the user will be writing the React code themselves to learn it, with the agent pairing/reviewing rather than autonomously generating the whole frontend. Backend/infra can be scaffolded more directly since the user is already comfortable there.

---

## 1. Requirements recap

### From the recruiter
- React front-end (user is new to React)
- One simple form to shorten a valid URL
- Clean/pleasant UI, Tailwind-based UI library
- Node + TypeScript backend, non-Express framework (Nest is fine)
- At least one shorten endpoint
- Working redirects
- Postgres

### Added by the user
- Docker Compose to run everything
- pnpm monorepo
- Drizzle ORM
- Shared types between front/back (+ optional generated/typed API client)
- Zod for all validation
- Logging / basic analytics on each click (ip, user agent, time, ...)
- Token auth, provisioned via a CLI command (not necessarily JWT)
- Links have start/end date + a name (defaults to the long URL)
- Custom short code, or auto-generated with configurable length
- A real, explainable answer to: short-code collisions, and two different "domains" reusing the same short code

---

## 2. Proposed architecture

### 2.1 Repo layout (pnpm workspaces, no Turborepo needed at this size)

```
url-shortener/
├── apps/
│   ├── api/                 # NestJS backend
│   └── web/                 # React frontend (Vite)
├── packages/
│   └── shared/               # Zod schemas + inferred TS types (+ typed API client)
├── docker-compose.yml         # postgres + api + web, one-command run
├── docker-compose.dev.yml     # optional: hot-reload dev variant
├── pnpm-workspace.yaml
├── package.json               # root scripts (dev, build, lint, docker:up)
├── .env.example
├── docs/
│   └── adr/0001-domain-and-shortcode-uniqueness.md
└── README.md
```

### 2.2 Data model (Drizzle + Postgres)

- `domains` — `id, hostname, is_default`. Even for a single-domain demo, links reference a domain row; this is what makes the uniqueness story real instead of hand-waved.
- `links` — `id, domain_id (FK), short_code, name, destination_url, custom (bool), start_at, end_at, created_at, api_token_id (FK, creator), is_active`.
  - **Unique constraint on `(domain_id, short_code)`**, not on `short_code` alone.
- `api_tokens` — `id, name, token_hash, created_at, last_used_at, revoked_at`. Plaintext token is shown once at creation time (CLI), only the hash is stored.
- `click_events` — `id, link_id (FK), ip, user_agent, referrer, occurred_at`.

**Collision / uniqueness story (also written up as an ADR, not just code):**
- Short codes are generated with `nanoid` (url-safe alphabet), default length configurable (e.g. 7), retried on unique-violation up to N times before failing loudly — collisions are expected to be astronomically rare at this scale, so "generate + retry on conflict" is preferable to pre-checking existence.
- Custom aliases go through the same uniqueness path (`Zod` validates the shape, e.g. `^[a-zA-Z0-9_-]{3,32}$`, then DB constraint is the real source of truth — never trust the app-level check alone under concurrency).
- The `(domain_id, short_code)` composite key is what answers "what if two users pick the same code" — they simply can't collide *within* a domain (DB enforces it, app returns 409), and they're *allowed* to collide *across* domains, because the domain is part of the identity of a short link, not just cosmetic. Redirect resolution therefore needs `(request_host, short_code)`, not `short_code` alone.

### 2.3 Backend (NestJS + TypeScript)

- **Validation:** Zod schemas live in `packages/shared`, consumed by Nest via a custom `ZodValidationPipe` (or `nestjs-zod`) instead of `class-validator` DTOs — single source of truth shared with the frontend.
- **ORM:** Drizzle with `postgres-js` (or `node-postgres`) driver, migrations via `drizzle-kit`, run automatically on API container start (or a documented `pnpm db:migrate` step).
- **Auth:** a Nest guard reads `Authorization: Bearer <token>`, hashes it, looks it up in `api_tokens`, checks `revoked_at`. Token provisioning via a Nest CLI command (using `nest-commander`), e.g.:
  ```
  pnpm --filter api cli token:create --name "recruiter-demo"
  ```
  prints the plaintext token once — never stored or logged in clear.
- **Draft endpoints** (to confirm once frontend scope is settled — see Q2):
  - `POST /api/links` — create (protected)
  - `GET /api/links` — list, paginated (protected)
  - `GET /api/links/:id` — detail + click count (protected)
  - `PATCH /api/links/:id` — update name/dates/active (protected)
  - `DELETE /api/links/:id` — deactivate/delete (protected)
  - `GET /:code` — public redirect; 404/410 if inactive or outside start/end window; logs a `click_events` row (fire-and-forget so it never slows the redirect)
  - `POST /api/links/check-alias` — optional, live-validate a custom alias before submit (nice UX touch for the form)

### 2.4 Frontend (React + Vite + TypeScript)

- **UI library:** recommend **shadcn/ui** (Radix primitives, Tailwind-native, code is copied into your repo not installed as an opaque dependency — good for actually *learning* the components while you learn React). Alternatives considered: HeroUI (Tailwind-based, more "install and go"), Mantine (not Tailwind — dropped per your requirement), DaisyUI (plain Tailwind classes/plugin, fastest to start but least "polished" out of the box).
- **Form:** `react-hook-form` + `@hookform/resolvers/zod`, validating against the same shared Zod schema the backend uses.
- **API client:** a thin typed `fetch` wrapper in `packages/shared` (or a dedicated `packages/api-client`), typed from the shared Zod schemas; optionally paired with `@tanstack/react-query` for loading/error states and caching — gives you "polished UX" (spinners, disabled states, toasts) almost for free and it's a good on-ramp into React data-fetching patterns.
- **Pages:** shorten form + result (copy-to-clipboard, QR code optional nice-to-have); a second "My Links" authenticated view is optional — see Q2.

### 2.5 Docker Compose

- Services: `postgres`, `api` (Nest, runs migrations on boot), `web` (built React app served via nginx, or `vite preview`).
- `docker compose up` should be the single command that gets the recruiter a working app end to end.
- Dev-loop question: do you want to develop *inside* Docker (hot-reload volumes) or just run `pnpm dev` locally day-to-day and treat Compose as the "final, run-it-like-prod" packaging? Defaulting to the latter (simpler) unless you say otherwise.

### 2.6 Logging / analytics

- Every redirect writes a `click_events` row (ip, user agent, referrer, timestamp) — async, non-blocking.
- Link detail view/endpoint surfaces a basic count + last-clicked timestamp. Not building a full analytics dashboard (charts etc.) — flag if you want one.
- Structured app logs (Nest's built-in Logger is enough; no need for an external log stack for an assessment).

---

## 3. Open questions (blocking — need your call before scaffolding)

1. **UI library** — shadcn/ui (recommended) vs HeroUI vs DaisyUI?
2. **Frontend scope** — literally just the one shorten form + result (matches the brief most literally), or also a lightweight authenticated "My Links" list/manage view so the CRUD endpoints and auth actually get exercised in the UI too?
3. **Domain/uniqueness depth** — implement it for real (seed 2+ domains, let the form pick a target domain, so the conflict handling is demonstrably working), or single domain in the running app + a written ADR explaining how it'd extend to multiple domains?
4. **Live demo hosting** — Compose-local only (matches the brief exactly, simplest), or also deploy somewhere reachable (e.g. a small VPS/Fly.io/Railway) so the recruiter can click a link without running anything?
5. **Effort/testing level** — solid core + a handful of key tests (redirect logic, conflict handling, token auth) as a good signal without over-building; minimal tests and focus on feature breadth instead; or a heavier suite matching your normal professional bar?

## 4. Non-blocking defaults (will proceed with these unless you object)

- Plain pnpm workspaces, no Turborepo/Nx — not enough packages to need it yet.
- Vite + React (not Next.js) — no SSR/file-routing need for a single-form app.
- Hand-rolled typed fetch client + optional react-query, not tRPC/ts-rest — keeps the "shared types" story simple while still learning plain React data fetching.
- `nest-commander` for the token-generation CLI command.
- Repo name/scope: `url-shortener`, packages namespaced `@url-shortener/*`.

---

## 5. Rough phased roadmap (once questions are answered)

1. Scaffold monorepo: `pnpm-workspace.yaml`, root `package.json`, `packages/shared` skeleton with first Zod schema.
2. Scaffold `apps/api`: Nest project, Drizzle config + first migration (`domains`, `links`, `api_tokens`, `click_events`), health check endpoint.
3. Token CLI command + auth guard; manually verify with `curl`.
4. `POST /api/links` + `GET /:code` redirect — the minimal end-to-end slice, tested with `curl` before touching the frontend.
5. Remaining CRUD endpoints + click logging.
6. Scaffold `apps/web`: Vite + React + Tailwind + chosen UI library; wire up the single form against the shared schema and the real API (this is the main "learn React" stretch — pairing mode, not autonomous generation).
7. Optional: "My Links" view, custom alias live-check, QR code, copy-to-clipboard polish.
8. Docker Compose for the full stack; verify a clean `docker compose up` from scratch works.
9. `docs/adr/0001-domain-and-shortcode-uniqueness.md` write-up + top-level README (endpoints, setup, token generation, architecture rationale) — this doc is a big part of what a recruiter actually reads.
10. Light test pass depending on answer to Q5.

## 6. Files likely to change first (once scaffolding starts)

- `pnpm-workspace.yaml`, root `package.json`
- `packages/shared/src/schemas/link.ts`, `packages/shared/src/index.ts`
- `apps/api/src/**` (Nest modules: links, redirect, auth, analytics)
- `apps/api/drizzle/**` (schema + migrations)
- `apps/web/src/**` (App shell, ShortenForm component)
- `docker-compose.yml`, `.env.example`
