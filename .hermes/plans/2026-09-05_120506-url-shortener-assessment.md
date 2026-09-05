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
| Token storage | Long-lived API token stored in an httpOnly cookie (see §2.1) — no separate session layer, no SSR needed; the API sets `Set-Cookie` on login and the SPA calls `fetch` with `credentials: 'include'` afterward |
| Testing | Solid core + targeted tests: redirect resolution, `(domain, code)` conflict handling, token auth guard — not a full suite |

### 2.1 Frontend screens, detailed

1. **Login** — a single field to paste the API token issued by the CLI command. On submit, call a lightweight `GET /api/session` (or similar) with that bearer token to validate it before storing, so a bad paste fails fast with a clear error instead of silently breaking later calls.
2. **Links list** — paginated table/cards: name, short code, domain, destination (truncated), status (active / scheduled / expired based on start/end date), click count. Link through to detail. Create button.
3. **Link detail** — full link info + edit (name, dates, active toggle) + a click log view (ip, user agent, referrer, timestamp) with basic aggregates (total clicks, last click). This is the "analytics" surface.
4. **Create link** — form: destination URL, name (optional, defaults to the URL), domain picker (the 2+ seeded domains), an optional short-code field (leave blank to auto-generate at a configurable length, fill it in to request that exact custom alias — whichever the person actually typed, no separate "is this custom" toggle), start/end date (optional). On success, navigate to that link's detail page.

**Token storage: httpOnly cookie holding the token itself (revised, simpler than the original plan).** The only actual requirement was keeping the token out of reach of page-side JavaScript — not building a full session-management layer, and not scoping links to individual people (this instance serves one pool of people sharing an API, not per-user accounts, see §2.1.1). So:

- `POST /api/auth/session` (login screen) takes the pasted CLI token, validates it against `api_tokens`, and on success sets that same token as an `HttpOnly`, `SameSite=Lax` cookie with a long (30-day) browser-side lifetime — the token itself has no separate expiry, this is just how long the browser holds onto it before someone would need to paste it again.
- No separate session table, no signed session payload, no session-vs-token distinction at all — the guard reads the cookie, looks up the token by hash, done. One less moving part than a session layer, for the same practical protection (page JS can't read an httpOnly cookie either way).
- The React app never stores the token in JS-reachable storage (no `localStorage`/`sessionStorage`) — every API call goes out through the shared `ofetch`-based client configured with `credentials: 'include'`, and the browser handles the cookie. The same guard also accepts a plain `Authorization: Bearer <token>` header, so `curl`/CLI/API-client use isn't cookie-only.
- Logout just clears the cookie. Revoking a token (setting `revoked_at`) invalidates every browser session using it immediately, with no separate step needed.
- Because frontend and API are on different `*.nook.sh` subdomains but the same registrable domain, CORS still needs `credentials: true` + an explicit `Access-Control-Allow-Origin` (the frontend's exact origin, not `*`) on the API side for cookies to flow.

### 2.1.1 Links belong to the instance, not to the token that created them

Revised from the original plan: an instance of this app is provisioned for one pool of people who all share access (there's no per-user account system, just API tokens used as an access credential), so a link isn't really "owned" by whichever token created it — it belongs to the instance as a whole. `links` therefore has no `api_token_id` column. Anyone with a valid token for the instance can see, edit, or deactivate any link. This is a smaller, more honest data model for what's actually being described, and it also means revoking a token later never needs to touch existing links (no orphaned-ownership question to answer).

### 2.2 Tooling decisions (unjs, evaluated tool-by-tool)

**Ground rule: pick each tool for what it actually solves here, not because it's part of a family.** Going through the unjs catalogue tool by tool below, with an honest yes/no per tool — the goal is the right tool for the job, not maximal unjs adoption for its own sake.

**`ofetch` — adopted.** Used as the shared API client's HTTP layer, both sides. Concrete win over native `fetch`: automatic JSON parse/stringify, throws on non-2xx by default (no manual `res.ok` checks scattered everywhere), and interceptor hooks (`onRequest`/`onResponseError`) give one place to redirect to `/login` on a 401 or attach a CSRF header — real ergonomics, not just "a cooler fetch." It's what Nuxt's own `$fetch` is built on, but the reason to use it here is the API, not the pedigree.

**`ufo` — adopted, backend only.** Used for parsing the incoming `Host` header and validating/normalizing a submitted destination URL before it's stored. Concretely better than hand-rolled string splitting or bare `new URL()` for edge cases (trailing slashes, query/hash handling, IDN hosts), and it's already what H3/Nitro use internally for exactly this class of problem — a URL shortener's core job is URL handling, so this is a direct fit, not an add-on.

**`consola` — adopted, narrow scope.** Used only for the CLI commands' own console output (`token:create`, `domain:add` — the plaintext-token banner, prompts, colored status lines) and local dev scripts. **Not** used for request-lifecycle logging — Nest's built-in `Logger` stays the logger for the actual application/click-analytics logging, since that's already idiomatic Nest and swapping it for `consola` there would be replacing a working thing with a different working thing for no functional gain. This is the "don't over-engineer it" line: two logging tools, each doing the one job it's actually better at.

**`unstorage` — considered, not adopted.** Could offer a key-value abstraction if a session-storage layer existed, but there isn't one to abstract — the auth model is a direct token-hash lookup against the existing `api_tokens` table (see §2.1), so there's no separate storage concern this would actually solve here. Nothing to introduce it for.

**`citty` — considered, not adopted.** Unjs's own CLI builder. Not used because `nest-commander` was already the right choice for `token:create`/`domain:add` specifically because it runs inside Nest's DI container and reuses the exact same services/repositories the HTTP layer uses — no duplicate data-access code between the API and the CLI. `citty` doesn't get you that DI reuse, so switching would mean re-implementing the same logic twice for a stylistic gain, which is exactly the over-engineering to avoid.

**`h3` / `nitro` as the backend framework — not adopted.** A real option, not a formality: the recruiter's brief names a framework of choice with Nest explicitly called out as acceptable and Express explicitly ruled out, so Nest satisfies the brief directly. Staying with Nest because: (1) it maps directly onto this project's actual requirements — the DI container, guards, pipes, and `nest-commander` for the CLI cover the auth guard, Zod validation pipe, and CLI-provisioned tokens with less custom wiring than composing the equivalent by hand on h3; (2) it keeps backend build time focused on the one thing that's genuinely new in this assessment (React), rather than spending time evaluating a second framework choice that isn't required by the brief. Nest's completeness for this specific scope is the deciding factor, not a lack of alternatives worth considering.

### 2.3 Build/lint/format tooling

- **Vite (with Rolldown) — adopted.** Vite 8 (stable since March 2026) ships Rolldown as its default bundler — this isn't a separate opt-in anymore, it's just what `vite` is now. Chosen over Webpack/CRA-style tooling because a single form-heavy SPA has no need for Webpack's configuration surface, and Vite's dev-server startup/HMR speed is a direct, felt benefit while learning React (fast feedback loop matters more when every pattern is new).
- **Vitest — adopted** for the frontend's targeted tests (component/unit level). Shares config and transform pipeline with Vite, so there's no second toolchain to configure separately; on the backend, Nest's default Jest setup stays as-is (already wired into `nest-commander`/Nest's testing module, no reason to introduce a second test runner for the API side).
- **`oxlint` — considered, adopted as a fast first-pass linter, not a full replacement for framework-aware rules.** As of late 2026 it's genuinely fast and stable enough for daily use (50-100x ESLint's speed on typical repos), but its React-specific and type-aware rule coverage is still thinner than ESLint's mature plugin ecosystem (`eslint-plugin-react-hooks` in particular is the one most worth keeping). Plan: `oxlint` as the fast everyday/pre-commit pass, a slim ESLint config layered on top scoped to just the React-hooks rules `oxlint` doesn't fully cover yet — avoids the "run two full linters forever" trap while not giving up hook-dependency correctness checking, which matters a lot for someone new to React.
- **Formatter (`oxfmt`) — considered, not adopted yet.** Still in beta as of this plan (entered beta Feb 2026, not GA) — fine for a side project, not worth the risk of formatting churn mid-assessment. Using **Prettier** for now (boring, stable, universally understood by any reviewer), with a note in the README that swapping to `oxfmt` once it's stable is a natural, low-risk future change.
- **`pnpm` stays the package manager** (already decided) — no substitution question here.

This keeps the "right tool for the job" bar: adopted where there's a concrete, current, stable win (Vite/Rolldown, Vitest, ofetch, ufo), narrowly scoped where a tool is good but not universally better (oxlint next to a slim ESLint layer, consola only for CLI output), and explicitly deferred where the tool itself isn't ready yet (oxfmt).

**Redirect status code: `302 Found`, not `301 Moved Permanently` (resolves the open technical question).** A `301` is heuristically cacheable by browsers even without explicit caching headers — once a browser has cached one for a given short code, it rewrites the request locally on all future visits and **never contacts the server again** for that visitor. That breaks two of this project's stated requirements at once: click logging (`click_events` never gets written for a cached visitor, since `GET /:code` never reaches the API) and link editing/expiry (a cached visitor keeps going to the old destination even after the link is updated, deactivated, or its end date passes). `302` (and `307`, which additionally preserves the request method) are not cached by default, so every click reaches the server. **Decision: `GET /:code` always responds `302`,** regardless of how "permanent" the link feels conceptually to the person who created it — that's a business-level distinction, not an HTTP caching directive, and HTTP's caching semantics for `301` actively work against this app's requirements. This is worth calling out explicitly in the README/ADR since it's a common naive mistake (routing libraries and tutorials often reach for `301` by default because "permanent redirect" sounds right for a URL shortener).

---

## 4. Proposed architecture

### 4.1 Repo layout (pnpm workspaces, no Turborepo needed at this size)

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

### 4.2 Data model (Drizzle + Postgres)

- `domains` — `id, hostname, is_default`. Seeded with **2+ real rows** (e.g. two homelab subdomains) since multi-domain handling is being demoed live, not just documented.
- `links` — `id, domain_id (FK), short_code, name, destination_url, start_at, end_at, created_at, is_active`. No `api_token_id`/creator column — links belong to the instance, not to whichever token created them (see §2.1.1).
  - **Unique constraint on `(domain_id, short_code)`**, not on `short_code` alone.
- `api_tokens` — `id, name, token_hash, created_at, last_used_at, revoked_at`. Plaintext token is shown once at creation time (CLI), only the hash is stored.
- `click_events` — `id, link_id (FK), ip, user_agent, referrer, occurred_at`.

**Collision / uniqueness story (also written up as an ADR, and demonstrated live via the domain picker):**
- Short codes are generated with `nanoid` (url-safe alphabet), default length configurable (e.g. 7), retried on unique-violation up to N times before failing loudly — collisions are expected to be astronomically rare at this scale, so "generate + retry on conflict" is preferable to pre-checking existence.
- A custom alias is simply whatever the person typed into the short-code field on the create form — there's no separate boolean distinguishing "custom" from "generated"; the API either received an explicit code from the client or generated one itself, and both go through the exact same uniqueness path afterward (`Zod` validates the shape, e.g. `^[a-zA-Z0-9_-]{3,32}$`, then the DB constraint is the real source of truth — never trust the app-level check alone under concurrency).
- The `(domain_id, short_code)` composite key answers "what if two users pick the same code": they can't collide *within* a domain (DB enforces it, app returns 409), and they're *allowed* to collide *across* domains, because the domain is part of the identity of a short link, not just cosmetic. Redirect resolution needs `(request_host, short_code)`, not `short_code` alone — the redirect handler resolves the domain from the incoming `Host` header, which is also why 2 real seeded domains matter for the demo (you can hit the same code on both and land on different destinations).

### 4.3 Backend (NestJS + TypeScript)

- **Validation:** Zod schemas live in `packages/shared`, consumed by Nest via a custom `ZodValidationPipe` (or `nestjs-zod`) instead of `class-validator` DTOs — single source of truth shared with the frontend.
- **ORM:** Drizzle with `postgres-js` (or `node-postgres`) driver, migrations via `drizzle-kit`, run automatically on API container start (or a documented `pnpm db:migrate` step).
- **Auth:** a Nest guard reads the API token from an `HttpOnly` cookie (browser) or an `Authorization: Bearer <token>` header (curl/CLI/API-client use), hashes it, looks it up in `api_tokens`, checks `revoked_at` — see §2.1's revised, session-free approach. Token provisioning via a Nest CLI command (using `nest-commander`), e.g.:
  ```
  pnpm --filter api cli token:create --name "recruiter-demo"
  ```
  prints the plaintext token once — never stored or logged in clear. A matching `pnpm --filter api cli domain:add --hostname go2.nook.sh` command provisions a new row in `domains` the same way (see `docs/adding-a-domain.md` for the full new-domain procedure, infra + app). A `POST /api/auth/session` endpoint lets the frontend exchange a pasted token for that same token set as an httpOnly cookie on login.
- **Endpoints (draft):**
  - `POST /api/auth/session` — exchange a CLI token for the httpOnly auth cookie (login screen)
  - `GET /api/domains` — list seeded domains, for the create-link picker (protected)
  - `POST /api/links` — create (protected)
  - `GET /api/links` — list, paginated (protected)
  - `GET /api/links/:id` — detail + click stats (protected)
  - `PATCH /api/links/:id` — update name/dates/active (protected)
  - `DELETE /api/links/:id` — deactivate/delete (protected)
  - `GET /api/links/:id/clicks` — paginated click log for the detail view (protected)
  - `GET /:code` — public redirect on the matched domain host; responds **`302`** always (see §2.2 — never `301`, so click logging and edits/expiry keep working for repeat visitors); 404/410 if inactive or outside start/end window; logs a `click_events` row (fire-and-forget so it never slows the redirect)
  - `POST /api/links/check-alias` — optional, live-validate a custom alias before submit

### 4.4 Frontend (React + Vite + TypeScript)

- Vite (Rolldown-powered by default in Vite 8, see §2.3) + React + TypeScript, Tailwind, **shadcn/ui** components.
- **Form:** `react-hook-form` + `@hookform/resolvers/zod`, validating against the same shared Zod schema the backend uses.
- **API client:** built on **`ofetch`** (see §2.2) in `packages/shared` (or a dedicated `packages/api-client`), typed from the shared Zod schemas, configured once with `credentials: 'include'` and an `onResponseError` hook (e.g. redirect to `/login` on 401); paired with `@tanstack/react-query` for loading/error states, pagination, and caching — gives "polished UX" (spinners, disabled states, toasts) largely for free and doubles as a solid on-ramp into React data-fetching patterns.
- **Routing:** `react-router` for the 4 screens (login, list, detail, create) with a simple auth guard redirecting to login when no valid session cookie is present (checked via a `GET /api/auth/session` call, not by reading a client-side value, since the cookie is httpOnly).
- **Lint/format:** `oxlint` + a slim `eslint-plugin-react-hooks`-only ESLint layer, Prettier for formatting (see §2.3 for why not `oxfmt` yet).

### 4.5 Docker Compose

- Services: `postgres`, `api` (Nest, runs migrations + domain seed on boot), `web` (built React app served via nginx, or `vite preview`) — final split of what runs where (homelab vs Cloudflare) covered in the deployment questions below.
- `docker compose up` should be the single command that gets a full local stack running end to end, independent of wherever it's ultimately deployed.
- Dev-loop: default is developing locally with `pnpm dev` day to day, treating Compose as the "run it like prod" packaging — flag if you'd rather develop inside Docker with hot-reload volumes instead.

### 4.6 Logging / analytics

- Every redirect writes a `click_events` row (ip, user agent, referrer, timestamp) — async, non-blocking.
- Link detail view/endpoint surfaces click count + last-clicked timestamp + a paginated raw click log. Not building a full charts/dashboard analytics product — flag if you want one.
- Structured app logs via Nest's built-in Logger — no external log stack needed for an assessment.

---

## 5. Remaining open questions (non-blocking, can be decided during build)

1. **Exact subdomain names** for the two seeded link domains and the frontend (e.g. `go1.nook.sh` / `go2.nook.sh` / `shorten.nook.sh` — placeholders, pick real ones whenever convenient, easy to change later since they're just seed data + a `domain:add` CLI call).
2. **Homelab Compose integration** (personal setup, not a project requirement — see `docs/homelab-deployment-notes.md`): add this as a new stack under `/opt/stacks/` alongside the existing `traefik`/`cloudflared`/`umami` setup, with Traefik labels for the 2 API-domain subdomains + 1 frontend subdomain, routed through the active "Tartiflette" tunnel. These labels are the user's own choice as the person responsible for his deployment, and are documented separately from the project's generic `docker-compose.yml` so the repo doesn't imply Traefik is required to run it. Since the user's homelab access is read-only/no-sudo via `docker-host-lan`, the actual privileged deploy step (`docker compose up` on the host) will need to be run by the user, not the agent — matches the existing arrangement for other homelab services.
3. **CSRF header enforcement detail** — deferred by the user (not yet decided how to explain it in detail); revisit before implementing the auth screens, once the user has had a chance to think through/discuss the mechanics.

## 6. Non-blocking defaults (will proceed with these unless you object)

- Plain pnpm workspaces, no Turborepo/Nx — not enough packages to need it yet.
- Vite + React (not Next.js) — no SSR/file-routing need here.
- `ofetch`-based typed client + react-query, not tRPC/ts-rest — keeps "shared types" simple while still learning plain React data fetching.
- `nest-commander` for the token- and domain-provisioning CLI commands.
- Repo name/scope: `stoik/url-shortener` (Stoik being the recruiting company), packages namespaced `@url-shortener/*`.

---

## 7. Rough phased roadmap (once remaining questions are answered)

1. Scaffold monorepo: `pnpm-workspace.yaml`, root `package.json`, `packages/shared` skeleton with first Zod schema + `ofetch`-based client shell.
2. Scaffold `apps/api`: Nest project, Drizzle config + first migration (`domains`, `links`, `api_tokens`, `click_events`), seed script for the 2 domains, health check endpoint.
3. Token CLI command + `domain:add` CLI command + auth guard + session-cookie endpoint; verify manually with `curl`.
4. `POST /api/links` + `GET /:code` redirect (host-aware, `302` always) — the minimal end-to-end slice, tested with `curl` against both seeded domains before touching the frontend.
5. Remaining CRUD endpoints + click logging + click-log pagination endpoint.
6. Scaffold `apps/web`: Vite + React + Tailwind + shadcn/ui, `oxlint` + slim ESLint hooks-layer + Prettier, Vitest for component tests; build the 4 screens against the shared schema and the real API (this is the main "learn React" stretch — pairing mode, not autonomous generation). Suggested build order: login → create (redirect to detail) → detail → list.
7. Docker Compose for the full stack (API, Postgres, built React app all in one homelab Compose stack); verify a clean `docker compose up` from scratch works locally.
8. Write `docs/adding-a-domain.md` (generic: DNS/reverse-proxy step + `domain:add` CLI step, framework-agnostic) and `docs/homelab-deployment-notes.md` (explicitly personal: Traefik labels, Tartiflette tunnel routing, marked as "how I deploy this," not a project requirement).
9. Deploy to the homelab per the user's own notes from step 8; since agent homelab access is read-only, the user runs the actual privileged `docker compose up` there.
10. `docs/adr/0001-domain-and-shortcode-uniqueness.md` write-up + top-level README (endpoints, setup, token generation, architecture rationale, hardening notes e.g. the token-storage tradeoff, the 301-vs-302 redirect decision, the tool-by-tool unjs/Vite rationale) — this doc is a big part of what a recruiter actually reads.
11. Targeted test pass: redirect resolution (incl. cross-domain same-code case, and asserting the `302` status specifically), `(domain, code)` conflict → 409, auth guard rejects missing/invalid/revoked tokens/sessions.

Keep `docs/progress-log.md` updated at every planning/question/decision/steering point through all of the above, each entry paired with the commit that landed it.

## 8. Files likely to change first (once scaffolding starts)

- `pnpm-workspace.yaml`, root `package.json`
- `packages/shared/src/schemas/link.ts`, `packages/shared/src/schemas/domain.ts`, `packages/shared/src/client.ts` (`ofetch` instance), `packages/shared/src/index.ts`
- `apps/api/src/**` (Nest modules: links, redirect, auth, domains, analytics; `cli/token-create.command.ts`, `cli/domain-add.command.ts`)
- `apps/api/drizzle/**` (schema + migrations + seed)
- `apps/web/src/**` (routes: login, links, links/:id, links/new; shared layout/auth guard)
- `apps/web/.oxlintrc.json`, `apps/web/eslint.config.js` (hooks-only), `.prettierrc`
- `docker-compose.yml`, `.env.example`
- `docs/adr/0001-domain-and-shortcode-uniqueness.md`
- `docs/adding-a-domain.md`, `docs/homelab-deployment-notes.md`
- `docs/progress-log.md` (already created, kept updated throughout)
