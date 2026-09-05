# URL Shortener (Technical Assessment) — Implementation Plan

**Goal:** Build a URL shortener as a take-home technical assessment: React front-end (learning React as you go), NestJS + TypeScript back-end, Postgres via Drizzle, pnpm monorepo, Docker Compose, token auth, and a real (not hand-waved) answer to the short-code/domain uniqueness question.

**Status:** Planning complete. All architectural decisions locked in (see §2 and §2.2). Repo initialized at `~/work/stoik/url-shortener` (git init, `.gitignore`, stub `README.md`, relocated from `~/work/url-shortener` once the `stoik` naming was confirmed). Ready to scaffold — only a couple of low-stakes naming/config details remain (§4), to be settled during the build, not before it.

**Traceability:** every planning step, question, answer, and steering instruction is also logged chronologically in `docs/progress-log.md`, cross-referenced with commit hashes, specifically so the full project history can be handed to the recruiter at the end. Update that file whenever a decision is made or the user redirects scope — this plan file holds the current state, the progress log holds the history of how it got there.

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

## 2. Decisions locked in (round 2 clarification)

| Topic | Decision |
|---|---|
| UI library | **shadcn/ui** (Radix + Tailwind, code copied into repo — best for learning) |
| Frontend scope | 4 screens: **token login**, **links list (paginated)**, **link detail** (click logs / analytics), **create link form → redirects to that link's detail page on success** |
| Multi-domain / uniqueness | **Implemented for real**: seed 2+ domains, create-link form lets you pick a target domain, so `(domain_id, short_code)` conflict handling is demonstrably live, not just an ADR |
| Deployment | Everything self-hosted on the homelab, single Docker Compose stack: API, Postgres, and the built React app all live there, no Cloudflare split |
| Domains | Two real `*.nook.sh` subdomains as the seeded "link domains" (e.g. `go1.nook.sh` / `go2.nook.sh`, exact names TBD), routed through the existing Traefik + Tartiflette tunnel setup; a separate public `*.nook.sh` subdomain serves the React app |
| Token storage | Real httpOnly-cookie session (see §2.1) — no SSR needed for this, it's just the API setting `Set-Cookie` on login and the SPA calling `fetch` with `credentials: 'include'` afterward |
| Testing | Solid core + targeted tests: redirect resolution, `(domain, code)` conflict handling, token auth guard — not a full suite |

### 2.1 Frontend screens, detailed

1. **Login** — a single field to paste the API token issued by the CLI command. On submit, call a lightweight `GET /api/session` (or similar) with that bearer token to validate it before storing, so a bad paste fails fast with a clear error instead of silently breaking later calls.
2. **Links list** — paginated table/cards: name, short code, domain, destination (truncated), status (active / scheduled / expired based on start/end date), click count. Link through to detail. Create button.
3. **Link detail** — full link info + edit (name, dates, active toggle) + a click log view (ip, user agent, referrer, timestamp) with basic aggregates (total clicks, last click). This is the "analytics" surface.
4. **Create link** — form: destination URL, name (optional, defaults to the URL), domain picker (the 2+ seeded domains), custom alias (optional) or auto-generate with a configurable length, start/end date (optional). On success, navigate to that link's detail page.

**Token storage: httpOnly-cookie session (decided).** The CLI-provisioned bearer token is what proves a person *may* create a session, but the browser never touches it directly:

- `POST /api/auth/session` (login screen) takes the pasted CLI token, validates it against `api_tokens`, and on success sets a **separate, short-lived session cookie** — `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`), `Domain=.nook.sh` so it's shared correctly across the app subdomain and the API subdomain since both live under `*.nook.sh` — this makes it same-site for cookie purposes despite being different hostnames, so `SameSite=Lax/Strict` is enough without needing `SameSite=None` + full CSRF-token machinery. A lightweight CSRF check (e.g. a custom header the browser can't be tricked into sending cross-site, like `X-Requested-With`) on state-changing requests is still cheap insurance.
- The session is server-side state (a `sessions` table or a signed/opaque cookie value looked up server-side — signed opaque cookie is simplest here, no extra table needed), separate from the long-lived CLI token itself. Logout just clears the cookie (and server-side session row, if using one).
- The React app never stores the token or session id in JS-reachable storage at all (no `localStorage`/`sessionStorage`) — every API call goes out through the shared `ofetch`-based client configured with `credentials: 'include'`, and the browser handles the cookie.
- Because frontend and API are on different `*.nook.sh` subdomains but the same registrable domain, CORS still needs `credentials: true` + an explicit `Access-Control-Allow-Origin` (the frontend's exact origin, not `*`) on the API side for cookies to flow.

### 2.2 Tooling decisions (unjs / Vue-ecosystem steering)

**HTTP client: `ofetch` everywhere, not native `fetch`.** Used on both sides — the shared typed API client (`packages/shared` or `packages/api-client`) is built on `ofetch` rather than a hand-rolled `fetch` wrapper. It's from the unjs family (built by the Nuxt/UnJS team, also what Nuxt's own `$fetch` is built on), and gives real ergonomics over raw `fetch` for free: automatic JSON parsing/stringifying, throwing on non-2xx by default (no more manually checking `res.ok`), built-in retry and timeout options, and interceptor hooks (`onRequest`, `onResponseError`, etc.) — useful here for e.g. redirecting to `/login` on a 401 from any call in one place, or attaching the CSRF header uniformly. Works identically in the Nest backend (for any outbound calls it might need) and the React frontend.

**Other unjs tools adopted:**
- **`ufo`** — for all URL parsing/joining/validation on the backend (parsing the incoming `Host` header, validating and normalizing a submitted destination URL before it's stored, building the final short link for display). More correct than hand-rolled string splitting or bare `new URL()` for edge cases, and it's what H3/Nitro use internally — a natural fit for a URL-shortener's core operation.
- **`consola`** — for backend console output during CLI commands (`token:create`, `domain:add`) and local dev logging, instead of plain `console.log`. Nest's built-in `Logger` remains the logger for request-lifecycle/application logging; `consola` is specifically nicer for one-off CLI script output (colored levels, prompts if needed later).

**Considered, not adopted (and why):**
- `nitro` / `h3` as the backend framework — the recruiter's brief explicitly asks for a framework of choice with Nest named as acceptable, and the user is already comfortable with Nest; swapping to Nitro would mean learning a new backend framework *and* a new frontend one in the same assessment, which isn't the goal.
- `unstorage` for caching/session storage — genuinely a good fit for the session-cookie lookup (`unstorage`'s key-value abstraction over Postgres/Redis/memory), but adds a dependency for a problem a single Drizzle-backed `sessions` table (or signed opaque cookie, see §2.1) already solves simply. Worth a mention in the README as a "how I'd scale this" note rather than building it.
- `citty` for the CLI — `nest-commander` was already decided for the token/domain CLI commands specifically because it integrates with Nest's DI container (reusing the same services/repositories as the HTTP layer); `citty` is unjs's own CLI builder but doesn't get you that DI reuse.

**Vue-ecosystem tooling in the React app:** the most honest answer here is that most of Vue's ecosystem strength (VueUse's composables, Pinia) is built on Vue's specific reactivity primitives and doesn't transplant into React's rendering model — bringing them over would mean fighting React's idioms rather than learning them, which works against the stated goal of actually learning React. Where a Vue/Nuxt-origin tool *does* offer real framework-agnostic value with official React bindings, it's used:
- **`@unhead/react`** for `<head>` management (page titles, meta) — `unhead` originated in the Vue/Nuxt ecosystem (it's what powers `useHead` in Nuxt) but is framework-agnostic at its core with first-class React bindings, and is arguably the more modern/actively maintained choice here over the long-unmaintained `react-helmet`.
- `ofetch` and `ufo` above are also unjs-family rather than React or Vue specific, which is exactly why they fit on both the Nest backend and the React frontend without friction.
- If, once building starts, a genuine like-for-like need shows up (e.g. a headless UI/state pattern with real dual bindings), it'll be flagged then rather than forced now.

**Redirect status code: `302 Found`, not `301 Moved Permanently` (resolves the open technical question).** A `301` is heuristically cacheable by browsers even without explicit caching headers — once a browser has cached one for a given short code, it rewrites the request locally on all future visits and **never contacts the server again** for that visitor. That breaks two of this project's stated requirements at once: click logging (`click_events` never gets written for a cached visitor, since `GET /:code` never reaches the API) and link editing/expiry (a cached visitor keeps going to the old destination even after the link is updated, deactivated, or its end date passes). `302` (and `307`, which additionally preserves the request method) are not cached by default, so every click reaches the server. **Decision: `GET /:code` always responds `302`,** regardless of how "permanent" the link feels conceptually to the person who created it — that's a business-level distinction, not an HTTP caching directive, and HTTP's caching semantics for `301` actively work against this app's requirements. This is worth calling out explicitly in the README/ADR since it's a common naive mistake (routing libraries and tutorials often reach for `301` by default because "permanent redirect" sounds right for a URL shortener).

---

## 3. Proposed architecture

### 3.1 Repo layout (pnpm workspaces, no Turborepo needed at this size)

```
url-shortener/                 # lives at stoik/url-shortener
├── apps/
│   ├── api/                 # NestJS backend
│   └── web/                 # React frontend (Vite)
├── packages/
│   └── shared/               # Zod schemas + inferred TS types + ofetch-based API client
├── docker-compose.yml         # postgres + api + web, one-command run
├── docker-compose.dev.yml     # optional: hot-reload dev variant
├── pnpm-workspace.yaml
├── package.json               # root scripts (dev, build, lint, docker:up)
├── .env.example
├── docs/
│   ├── adr/0001-domain-and-shortcode-uniqueness.md
│   ├── progress-log.md         # chronological plan/question/answer/steering log for hand-off
│   ├── adding-a-domain.md      # generic: how to point a new domain at a running instance
│   └── homelab-deployment-notes.md  # personal: how *I* deploy this (Traefik labels, tunnel) — not a project requirement
└── README.md
```

### 3.2 Data model (Drizzle + Postgres)

- `domains` — `id, hostname, is_default`. Seeded with **2+ real rows** (e.g. two homelab subdomains) since multi-domain handling is being demoed live, not just documented.
- `links` — `id, domain_id (FK), short_code, name, destination_url, custom (bool), start_at, end_at, created_at, api_token_id (FK, creator), is_active`.
  - **Unique constraint on `(domain_id, short_code)`**, not on `short_code` alone.
- `api_tokens` — `id, name, token_hash, created_at, last_used_at, revoked_at`. Plaintext token is shown once at creation time (CLI), only the hash is stored.
- `click_events` — `id, link_id (FK), ip, user_agent, referrer, occurred_at`.

**Collision / uniqueness story (also written up as an ADR, and demonstrated live via the domain picker):**
- Short codes are generated with `nanoid` (url-safe alphabet), default length configurable (e.g. 7), retried on unique-violation up to N times before failing loudly — collisions are expected to be astronomically rare at this scale, so "generate + retry on conflict" is preferable to pre-checking existence.
- Custom aliases go through the same uniqueness path (`Zod` validates the shape, e.g. `^[a-zA-Z0-9_-]{3,32}$`, then DB constraint is the real source of truth — never trust the app-level check alone under concurrency).
- The `(domain_id, short_code)` composite key answers "what if two users pick the same code": they can't collide *within* a domain (DB enforces it, app returns 409), and they're *allowed* to collide *across* domains, because the domain is part of the identity of a short link, not just cosmetic. Redirect resolution needs `(request_host, short_code)`, not `short_code` alone — the redirect handler resolves the domain from the incoming `Host` header, which is also why 2 real seeded domains matter for the demo (you can hit the same code on both and land on different destinations).

### 3.3 Backend (NestJS + TypeScript)

- **Validation:** Zod schemas live in `packages/shared`, consumed by Nest via a custom `ZodValidationPipe` (or `nestjs-zod`) instead of `class-validator` DTOs — single source of truth shared with the frontend.
- **ORM:** Drizzle with `postgres-js` (or `node-postgres`) driver, migrations via `drizzle-kit`, run automatically on API container start (or a documented `pnpm db:migrate` step).
- **Auth:** a Nest guard reads `Authorization: Bearer ***` (login-time only; day-to-day auth is the session cookie, see §2.1), hashes it, looks it up in `api_tokens`, checks `revoked_at`. Token provisioning via a Nest CLI command (using `nest-commander`), e.g.:
  ```
  pnpm --filter api cli token:create --name "recruiter-demo"
  ```
  prints the plaintext token once — never stored or logged in clear. A matching `pnpm --filter api cli domain:add --hostname go2.nook.sh` command provisions a new row in `domains` the same way (see `docs/adding-a-domain.md` for the full new-domain procedure, infra + app). A `POST /api/auth/session` endpoint lets the frontend exchange a pasted token for the session cookie on login.
- **Endpoints (draft):**
  - `POST /api/auth/session` — exchange a CLI token for a session cookie (login screen)
  - `GET /api/domains` — list seeded domains, for the create-link picker (protected)
  - `POST /api/links` — create (protected)
  - `GET /api/links` — list, paginated (protected)
  - `GET /api/links/:id` — detail + click stats (protected)
  - `PATCH /api/links/:id` — update name/dates/active (protected)
  - `DELETE /api/links/:id` — deactivate/delete (protected)
  - `GET /api/links/:id/clicks` — paginated click log for the detail view (protected)
  - `GET /:code` — public redirect on the matched domain host; responds **`302`** always (see §2.2 — never `301`, so click logging and edits/expiry keep working for repeat visitors); 404/410 if inactive or outside start/end window; logs a `click_events` row (fire-and-forget so it never slows the redirect)
  - `POST /api/links/check-alias` — optional, live-validate a custom alias before submit

### 3.4 Frontend (React + Vite + TypeScript)

- Vite + React + TypeScript, Tailwind, **shadcn/ui** components.
- **Form:** `react-hook-form` + `@hookform/resolvers/zod`, validating against the same shared Zod schema the backend uses.
- **API client:** built on **`ofetch`** (see §2.2) in `packages/shared` (or a dedicated `packages/api-client`), typed from the shared Zod schemas, configured once with `credentials: 'include'` and an `onResponseError` hook (e.g. redirect to `/login` on 401); paired with `@tanstack/react-query` for loading/error states, pagination, and caching — gives "polished UX" (spinners, disabled states, toasts) largely for free and doubles as a solid on-ramp into React data-fetching patterns.
- **`<head>` management:** `@unhead/react` for page titles per screen (see §2.2).
- **Routing:** `react-router` for the 4 screens (login, list, detail, create) with a simple auth guard redirecting to login when no valid session cookie is present (checked via a `GET /api/auth/session` call, not by reading a client-side value, since the cookie is httpOnly).

### 3.5 Docker Compose

- Services: `postgres`, `api` (Nest, runs migrations + domain seed on boot), `web` (built React app served via nginx, or `vite preview`) — final split of what runs where (homelab vs Cloudflare) covered in the deployment questions below.
- `docker compose up` should be the single command that gets a full local stack running end to end, independent of wherever it's ultimately deployed.
- Dev-loop: default is developing locally with `pnpm dev` day to day, treating Compose as the "run it like prod" packaging — flag if you'd rather develop inside Docker with hot-reload volumes instead.

### 3.6 Logging / analytics

- Every redirect writes a `click_events` row (ip, user agent, referrer, timestamp) — async, non-blocking.
- Link detail view/endpoint surfaces click count + last-clicked timestamp + a paginated raw click log. Not building a full charts/dashboard analytics product — flag if you want one.
- Structured app logs via Nest's built-in Logger — no external log stack needed for an assessment.

---

## 4. Remaining open questions (non-blocking, can be decided during build)

1. **Exact subdomain names** for the two seeded link domains and the frontend (e.g. `go1.nook.sh` / `go2.nook.sh` / `shorten.nook.sh` — placeholders, pick real ones whenever convenient, easy to change later since they're just seed data + a `domain:add` CLI call).
2. **Homelab Compose integration** (personal setup, not a project requirement — see `docs/homelab-deployment-notes.md`): add this as a new stack under `/opt/stacks/` alongside the existing `traefik`/`cloudflared`/`umami` setup, with Traefik labels for the 2 API-domain subdomains + 1 frontend subdomain, routed through the active "Tartiflette" tunnel. These labels are the user's own choice as the person responsible for his deployment, and are documented separately from the project's generic `docker-compose.yml` so the repo doesn't imply Traefik is required to run it. Since the user's homelab access is read-only/no-sudo via `docker-host-lan`, the actual privileged deploy step (`docker compose up` on the host) will need to be run by the user, not the agent — matches the existing arrangement for other homelab services.
3. **CSRF header enforcement detail** — deferred by the user (not yet decided how to explain it in detail); revisit before implementing the auth screens, once the user has had a chance to think through/discuss the mechanics.

## 5. Non-blocking defaults (will proceed with these unless you object)

- Plain pnpm workspaces, no Turborepo/Nx — not enough packages to need it yet.
- Vite + React (not Next.js) — no SSR/file-routing need here.
- `ofetch`-based typed client + react-query, not tRPC/ts-rest — keeps "shared types" simple while still learning plain React data fetching.
- `nest-commander` for the token- and domain-provisioning CLI commands.
- Repo name/scope: `stoik/url-shortener` (Stoik being the recruiting company), packages namespaced `@url-shortener/*`.

---

## 6. Rough phased roadmap (once remaining questions are answered)

1. Scaffold monorepo: `pnpm-workspace.yaml`, root `package.json`, `packages/shared` skeleton with first Zod schema + `ofetch`-based client shell.
2. Scaffold `apps/api`: Nest project, Drizzle config + first migration (`domains`, `links`, `api_tokens`, `click_events`), seed script for the 2 domains, health check endpoint.
3. Token CLI command + `domain:add` CLI command + auth guard + session-cookie endpoint; verify manually with `curl`.
4. `POST /api/links` + `GET /:code` redirect (host-aware, `302` always) — the minimal end-to-end slice, tested with `curl` against both seeded domains before touching the frontend.
5. Remaining CRUD endpoints + click logging + click-log pagination endpoint.
6. Scaffold `apps/web`: Vite + React + Tailwind + shadcn/ui + `@unhead/react`; build the 4 screens against the shared schema and the real API (this is the main "learn React" stretch — pairing mode, not autonomous generation). Suggested build order: login → create (redirect to detail) → detail → list.
7. Docker Compose for the full stack (API, Postgres, built React app all in one homelab Compose stack); verify a clean `docker compose up` from scratch works locally.
8. Write `docs/adding-a-domain.md` (generic: DNS/reverse-proxy step + `domain:add` CLI step, framework-agnostic) and `docs/homelab-deployment-notes.md` (explicitly personal: Traefik labels, Tartiflette tunnel routing, marked as "how I deploy this," not a project requirement).
9. Deploy to the homelab per the user's own notes from step 8; since agent homelab access is read-only, the user runs the actual privileged `docker compose up` there.
10. `docs/adr/0001-domain-and-shortcode-uniqueness.md` write-up + top-level README (endpoints, setup, token generation, architecture rationale, hardening notes e.g. the token-storage tradeoff, the 301-vs-302 redirect decision) — this doc is a big part of what a recruiter actually reads.
11. Targeted test pass: redirect resolution (incl. cross-domain same-code case, and asserting the `302` status specifically), `(domain, code)` conflict → 409, auth guard rejects missing/invalid/revoked tokens/sessions.

Keep `docs/progress-log.md` updated at every planning/question/decision/steering point through all of the above, each entry paired with the commit that landed it.

## 7. Files likely to change first (once scaffolding starts)

- `pnpm-workspace.yaml`, root `package.json`
- `packages/shared/src/schemas/link.ts`, `packages/shared/src/schemas/domain.ts`, `packages/shared/src/client.ts` (`ofetch` instance), `packages/shared/src/index.ts`
- `apps/api/src/**` (Nest modules: links, redirect, auth, domains, analytics; `cli/token-create.command.ts`, `cli/domain-add.command.ts`)
- `apps/api/drizzle/**` (schema + migrations + seed)
- `apps/web/src/**` (routes: login, links, links/:id, links/new; shared layout/auth guard; `@unhead/react` head config)
- `docker-compose.yml`, `.env.example`
- `docs/adr/0001-domain-and-shortcode-uniqueness.md`
- `docs/adding-a-domain.md`, `docs/homelab-deployment-notes.md`
- `docs/progress-log.md` (already created, kept updated throughout)
