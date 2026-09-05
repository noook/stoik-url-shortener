# Project Progress Log

This file is the chronological record of planning, decisions, questions, answers, and
steering for the Stoik URL Shortener technical assessment. It exists so the full path
from project creation to hand-off can be reconstructed and shared with the recruiter —
nothing here is prose written after the fact to look good, it is a running log kept
during the actual work. Cross-reference with `git log` — each meaningful step is also
a commit, so the two trails corroborate each other.

Entries are append-only, in chronological order, tagged by type:

- `[Planning]` — architecture/approach proposed by the agent
- `[Question]` — a question the agent asked, needing the user's decision
- `[Answer]` — the user's answer/decision
- `[Steering]` — the user redirecting or adding scope unprompted
- `[Decision]` — a decision that's now considered locked
- `[Progress]` — actual implementation work landing (once building starts)

---

## 2026-09-05

### [Steering] Kickoff
User requested a new technical-assessment project: a URL shortener, for a company
called Stoik. Gave the recruiter's stated requirements (React frontend, learn React
along the way; single shorten form; clean Tailwind-based UI; Node+TypeScript backend,
non-Express framework, Nest preferred; at least one shorten endpoint; working
redirects; Postgres) plus a longer list of self-imposed requirements (Docker Compose,
pnpm monorepo, Drizzle ORM, shared front/back types + optional API client, Zod
validation everywhere, click logging/basic analytics, CLI-provisioned token auth,
link start/end dates + name, custom or auto short codes, and a real answer to the
short-code/domain-conflict question). Explicitly asked for planning first, no code,
questions to refine scope, repo initialized under `work/`.

### [Progress] Repository initialized
Created git repo at `~/work/url-shortener` (later moved, see below), with `.gitignore`
and a placeholder `README.md`.
Commit: `95977db` — "chore: initialize repository"

### [Planning] Plan v1 drafted
Proposed: pnpm monorepo (`apps/api` Nest, `apps/web` React/Vite, `packages/shared` Zod
schemas + types), Drizzle/Postgres data model (`domains`, `links`, `api_tokens`,
`click_events`) with a **unique constraint on `(domain_id, short_code)`** as the answer
to the conflict question, `nest-commander` CLI for token issuance, Zod-driven
validation shared front/back, Docker Compose for the full stack.
Commit: `dab10e7` — "docs: add technical assessment plan"

### [Question] Round 1 (5 questions)
Asked about: UI library choice, frontend surface (how much beyond the one form),
depth of the multi-domain/uniqueness demo, deployment target, and testing effort.

### [Answer] Round 1
- UI library: **shadcn/ui**
- Frontend surface: **4 screens** — token login, paginated links list, link detail
  (click logs/analytics), create-link form redirecting to the new link's detail page
- Multi-domain: **implemented for real** (seed 2+ domains, pick one in the create form)
- Deployment: homelab-hosted, possibly Cloudflare for the frontend — left open
- Testing: solid core + a handful of key tests, not a full suite

### [Planning] Plan v2 — incorporated round 1 answers
Added the 4-screen frontend breakdown, an initial token-storage proposal
(in-memory + `sessionStorage`, cookie-session flagged as a documented stretch goal
rather than built), and 3 follow-up deployment/security questions.
Commit: `1016835` — "docs: refine plan with round 2 decisions"

### [Question] Round 2 (3 questions)
Asked about: homelab-only vs. homelab+Cloudflare split, what the seeded link domains
should actually be, and whether the in-memory+sessionStorage token approach was
acceptable or a real httpOnly-cookie session should be built instead.

### [Answer] Round 2
- Deployment: **fully self-hosted on the homelab**, single Compose stack (API,
  Postgres, built React app all together) — no Cloudflare split
- Domains: **two real `*.nook.sh` subdomains** for the seeded link domains, a third
  `*.nook.sh` subdomain serves the React app
- Token storage: user doesn't need SSR, just wants the token **secured in the
  browser** — read as: build the real httpOnly-cookie session, not the
  sessionStorage compromise

### [Planning] Plan v3 — finalized decisions
Locked in the homelab-only deployment, the real subdomain scheme, and the httpOnly
cookie-session design (separate short-lived session cookie issued after validating
the CLI token, `SameSite=Lax` since app+API share the `nook.sh` registrable domain,
lightweight custom-header CSRF check as cheap insurance). Downgraded the remaining
open items (exact subdomain names, homelab Compose folder/Traefik wiring, CSRF detail)
to non-blocking, decidable during the build.
Commit: `6f56751` — "docs: finalize plan decisions (deployment, domains, token
storage)"

### [Steering] Hand-off traceability + tooling direction
User asked for this progress log itself (to reconstruct and hand the full history to
the recruiter later), and for commits to keep marking progress going forward. Also
asked to:
- use **ofetch** instead of the native `fetch` API,
- use other **unjs** tools where relevant,
- consider tooling choices beyond React's usual defaults where a better fit exists,
and asked a technical question: does a permanent (301) redirect still reach the
server to log the click?

### [Question] Answered inline: 301 vs click logging
**No — not reliably, and this matters here.** A `301` is *heuristically cacheable* by
browsers even with no `Cache-Control` header at all (Chrome/Firefox/Safari all do
this in practice). Once a browser has cached a `301` for a given short link, it
rewrites the request locally and **never asks the server again** for that visitor —
so no request lands on `GET /:code`, no `click_events` row gets written, and if the
link's destination or active window is later changed, that cached visitor keeps
going to the old destination regardless. `302 Found` (and `307 Temporary Redirect`,
which is the same idea but preserves the HTTP method) are not cached by default —
every click re-hits the server, which is exactly what's needed for both accurate
click logging and for edits/expiry to actually take effect for repeat visitors.
**Decision: the app issues `302` for all `GET /:code` redirects, unconditionally —
"permanent" in the marketing sense (a link the user considers long-lived) is not the
same as HTTP's `301 Moved Permanently`, and the latter is actively wrong for a
service whose stated requirements include analytics and editable links.** Folded
into the plan as an explicit decision (see plan v4).

### [Answer] Round 3 (leftover items from plan v3 §4)
1. Subdomain ease-of-configuration: user wants a documented note on what's needed to
   point a new domain at a running API instance — treated as two distinct concerns
   (infra-level DNS/reverse-proxy routing, vs. the app-level `domains` table row that
   scopes short-code uniqueness) that need separate, explicit documentation.
2. Traefik labels: user's own choice, tied to *his* personal homelab deployment, not
   a generic requirement of the project — should be documented as "how I personally
   deploy this," kept clearly separate from the project's own generic
   `docker-compose.yml`, not presented as *the* required way to run it.
3. CSRF mechanics: **deferred** — user isn't sure yet how to explain it in detail,
   revisit before implementing the auth screens.

### [Planning] Plan v4 — tooling substitutions + redirect status + doc requirements
Updated the plan with: ofetch as the shared API client's HTTP layer, a short list of
adopted/considered unjs utilities (`ufo`, `consola`; `unstorage`/`citty`/`h3`/`nitro`
considered and explicitly not adopted, with reasons), the `302` redirect decision, a
`domain:add` CLI command mirroring `token:create`, and two new planned docs: one
generic (`docs/adding-a-domain.md`, infra + app steps to point a new domain at a
running instance) and one personal (`docs/homelab-deployment-notes.md`, explicitly
marked as reflecting the user's own setup, not a project requirement).
Commit: `2927fae` — "docs: add progress log; adopt ofetch/unjs tooling, unhead, 302
redirect decision; relocate under stoik/" (an early draft of the plan behind this
commit included a page-title library suggestion that didn't fit the intended scope
of the tooling request and was replaced in the next round, see below).

### [Progress] Repository relocated
Moved the repo from `~/work/url-shortener` to `~/work/stoik/url-shortener` per the
user's requested default naming (`stoik/url-shortener`, company name as parent
folder). Git history carried over unaffected (a plain directory move, no rewrite).

---

## Later session — tooling correction round

### [Steering] Correction: per-tool rationale required, h3/nitro framing fixed, build-tooling scope clarified
User corrected three things from the previous round:
1. **h3/nitro framing was off.** The plan's earlier wording explained staying with
   Nest partly in terms of unfamiliarity with the alternative, which wasn't the
   right framing for the comparison — corrected to a straightforward requirement-fit
   argument (brief names Nest explicitly, Nest's DI/guards/CLI batteries map onto
   this project's actual needs with less custom wiring).
2. **Per-tool justification requested**: for every unjs tool mentioned, explain
   concretely why it would or wouldn't be used — explicitly not "because it looks
   cool," genuinely the right tool for the specific job or not.
3. **Scope clarified: build tooling, not framework packages.** The prior framing was
   replaced with a plain build/lint/format tooling framing — Vite (Rolldown),
   Vitest, oxlint, Prettier/oxfmt — evaluated purely as build tooling choices for a
   React app.

### [Planning] Plan v5 — corrected tooling section, per-tool rationale, build-tooling section
Rewrote plan §2.2 into an explicit per-tool pass over the unjs catalogue: `ofetch`
(adopted — concrete `fetch` ergonomics win) and `ufo` (adopted, backend only — URL
parsing correctness, matches h3/Nitro's own approach) both kept; `consola` narrowed
to CLI-output-only scope, explicitly not replacing Nest's own request-lifecycle
`Logger`; `unstorage` and `citty` reconsidered and still not adopted, each with a
concrete reason tied to what the project actually needs rather than tool prestige;
the `h3`/`nitro` framework question rewritten around requirement fit (Nest is named
in the brief, its DI/guards/CLI batteries cover this project's actual needs with
less custom wiring).

Added new plan §2.3 for build/lint/format tooling: Vite 8's Rolldown bundler (the
default now, no separate decision needed), Vitest for frontend tests (shares Vite's
pipeline, avoids a second toolchain), `oxlint` adopted as a fast first-pass linter
paired with a slim `eslint-plugin-react-hooks`-only ESLint layer (oxlint's rule
coverage for React hooks/type-aware checks isn't there yet, keeping that one gap
covered rather than dropping hook-correctness checking), and a formatter (`oxfmt`)
explicitly deferred — still beta, not worth formatting churn risk mid-assessment —
using Prettier for now with a note to revisit once it's stable.
Commit: `d5bbbeb` — "docs: correct tooling plan - per-tool unjs rationale, Nitro/h3
familiarity, VoidZero/Vite scope instead of Vue packages" (residual framing from
this round still needed one more pass, see below).

### [Steering] Follow-up correction: h3/nitro framing still present, doc-update lag flagged
User pointed out the doc still framed the h3/nitro choice around familiarity even
after the v5 pass, and flagged more generally that recent instructions weren't
landing in the documents as quickly as expected — a fair signal to be more careful
that every steering instruction is reflected in the actual project files, not just
acknowledged in conversation.

### [Planning] Plan v6 — h3/nitro reframed around requirement fit only
Rewrote the `h3`/`nitro` paragraph in plan §2.2 to argue purely from requirement fit
and project scope (brief names Nest, Nest's batteries match this project's actual
needs, backend build time stays focused on what's genuinely new here). Renamed plan
§2.3 to plain "Build/lint/format tooling" to keep the section framed purely as a
build-tooling evaluation.
Commit: `c6ffb8d` — "docs: reframe h3/nitro choice on requirement fit, drop
familiarity/ecosystem framing from docs"

---

## Build phase — following the roadmap (plan §7)

### [Steering] Start building
User asked to start working according to the plan.

### [Progress] Step 1 — monorepo skeleton + packages/shared
Scaffolded `pnpm-workspace.yaml` (`apps/*`, `packages/*`), root `package.json` with
workspace-wide scripts, `tsconfig.base.json` shared by all packages. Built out
`packages/shared`: Zod schemas for short codes, domains, links (create/update/list/
detail, including the compound custom-alias-vs-auto-length validation and the
start-before-end-date refinement), click events, and the session/auth exchange;
plus the `ofetch`-based `createApiClient` factory (credentials included, a single
`onUnauthorized` hook point for 401s — no token ever touches JS-reachable storage,
per the plan's cookie-session decision). Verified with `tsc -p tsconfig.json`,
clean build (needed to add `"lib": ["DOM"]` since `ofetch`'s `FetchResponse` extends
the native `Response` type).
Commit: `ece272e` — "feat(shared): scaffold pnpm monorepo, packages/shared with Zod
schemas + ofetch client shell"

### [Progress] Step 2 — apps/api scaffold: NestJS + Drizzle/Postgres
Scaffolded `apps/api` via the Nest CLI (which, as of the current CLI version,
already defaults new projects to `oxlint` + Vitest — matching the plan's tooling
decisions with no extra setup needed). Added Drizzle ORM (`postgres-js` driver),
`drizzle-kit` for migrations, the four-table schema (`domains`, `links`,
`api_tokens`, `click_events`) with the `(domain_id, short_code)` unique index that
answers the conflict question, a Nest `DatabaseModule` exposing the Drizzle
instance via DI, `@nestjs/config` for env handling, cookie-parser + credentialed
CORS wiring in `main.ts` (exact `WEB_ORIGIN`, not a wildcard, since the session
cookie needs it), and a `GET /health` endpoint that does a real `select 1` through
Drizzle. Added a `pnpm seed` script (using `consola` for its output, per the
plan's narrow-scope decision on that tool) that seeds the two link domains from a
`SEED_DOMAINS` env var, defaulting to placeholder hostnames.

Verified for real, not just "should work": ran Postgres via Docker locally,
generated + applied the first Drizzle migration, ran the seed script and confirmed
both domain rows landed correctly via `psql`, booted the Nest API and hit
`GET /health` for a genuine `{"status":"ok"}` round-trip through the DB. Clean
`nest build` and `oxlint` pass.
Commit: `cdcb2cd` — "feat(api): scaffold NestJS app with Drizzle/Postgres, health
check, domain seed script"

### [Progress] Step 3 — token CLI, domain:add CLI, session-cookie auth
Built the `ApiTokensService` (hash-only storage, `sha256` over a `crypto.randomBytes`
token — plaintext shown once), the `token:create` and `domain:add` `nest-commander`
CLI commands (both run inside Nest's DI container, reusing the exact same services
the HTTP layer uses), the signed opaque `SessionCodec` (HMAC-signed cookie payload,
no `sessions` table needed — see plan §2.1), the `SessionAuthGuard`, and the
`AuthController` (`POST /api/auth/session`, `POST /api/auth/logout`,
`GET /api/auth/session`) plus a first protected endpoint (`GET /api/domains`) to
prove the guard actually gates something.

Real gotcha hit and fixed: `tsx` (esbuild-based) doesn't emit the
`design:paramtypes` decorator metadata Nest's DI container needs, so running the
CLI via `tsx src/cli.ts` silently failed instance resolution with no useful error
at the top level. Switched the `cli`/`seed` package scripts to run the real
`tsc`-compiled `dist/` output instead (`node dist/cli.js`) — same fix needed for
`packages/shared`'s `package.json` `exports`, which pointed straight at `src/*.ts`
(fine for `tsx`/bundler resolution, but plain `node` running compiled JS needs a
real `dist/index.js`), so that package now builds to `dist` and is consumed from
there.

Verified for real: ran `token:create`, confirmed only a 64-char hash landed in
`api_tokens` (never the plaintext) via `psql`; ran `domain:add` for a third
domain, confirmed via `psql`; booted the API and drove the full auth lifecycle
with `curl`: bad token → 401, real token → 201 with a genuine `HttpOnly;
SameSite=Lax` `Set-Cookie`, `GET /api/domains` without the cookie → 401, with the
cookie → 200 with the real seeded domain list, logout clears the cookie, and the
same protected call after logout → 401 again. Clean `nest build` + `oxlint`.
Commit: `13fbca4` — "feat(api): token CLI, domain:add CLI, session-cookie auth
(guard + login/logout/session endpoints)"

### [Steering] Three simplifications to the data model and auth
User raised three points after reviewing the auth/data-model work:
1. **Links don't belong to a token/creator.** An instance is provisioned for a
   pool of people sharing access, not per-user accounts, so a link isn't really
   "owned" by whichever token created it — it belongs to the instance as a
   whole. `api_token_id` on `links` was unnecessary.
2. **`custom` boolean on `links` is redundant.** A custom alias is just whatever
   the person typed into the short-code field; the API already knows whether it
   received an explicit code or generated one itself, at the moment of creation
   — no separate stored flag needed for that.
3. **The session layer was overkill.** The user's actual requirement was only
   that the token be unreadable by page-side JavaScript — an httpOnly cookie
   already gives that, whether it holds a signed session payload or the token
   itself directly. Since the token is already long-lived server-side, there was
   no separate expiry/rotation need that would have justified a session layer
   on top.

### [Planning] Plan revised: session-free auth, instance-scoped links
Updated plan §2.1 (auth now: httpOnly cookie holds the actual API token, no
signed session payload, no session-vs-token distinction, 30-day browser-side
cookie lifetime, same guard also accepts a plain `Authorization: Bearer` header),
added §2.1.1 explaining why `links` has no creator/ownership column, updated
§4.2's data model (`links` drops `custom` and `api_token_id`), §4.3's auth guard
description, and corrected the `unstorage` "not adopted" reasoning in §2.2 (there
is no session-storage concern left to abstract at all, rather than "a table
already solves it").

### [Progress] Implemented the simplification
Removed the `SessionCodec`/signed-cookie machinery entirely, replaced
`SessionAuthGuard` with `ApiTokenAuthGuard` (reads the token straight from an
httpOnly cookie or a bearer header, looks it up by hash — one guard, no session
concept), simplified `AuthController` to just set/clear that cookie. Dropped
`custom` and `api_token_id` from the `links` schema, generated and applied the
Drizzle migration.

Verified for real: ran the new migration against the dev Postgres, confirmed via
`psql` that both columns are gone; rebuilt and re-ran the full auth lifecycle
with `curl` — login sets a cookie containing the actual token, `GET /api/domains`
works both via that cookie and via a raw `Authorization: Bearer` header, and
fails with no auth at all. Clean `nest build` + `oxlint`.
Commit: `f490c51` — "refactor(api): simplify auth to cookie-held token (no
session layer), links belong to instance not creator, custom short codes are
just user input"

### [Progress] Step 4 — links CRUD, click logging, host-aware 302 redirect
Built `LinksService` (create with alias-or-auto-generate path, `nanoid` +
retry-on-conflict for generated codes, list/detail with click stats, update,
soft-deactivate, alias availability check, and the redirect-resolution query
keyed on `(hostname, short_code)`), `ClickEventsService` (fire-and-forget click
recording, paginated click log), `LinksController` (full protected CRUD +
`check-alias`), and the public, unauthenticated `RedirectController` handling
`GET /:code` - always `302`, `404` for unknown codes, `410 Gone` for
deactivated/expired links, `404` for not-yet-started (scheduled) links.

This is the slice that actually proves the core assessment requirement live,
not just on paper: created a link with alias `hello` on `go1.localhost`
(destination A), created the *same* alias `hello` on `go2.localhost`
(destination B) - both succeeded (201/201). Creating `hello` again on
`go1.localhost` correctly failed with 409. `GET /hello` with
`Host: go1.localhost` redirected (302) to destination A; the same path with
`Host: go2.localhost` redirected (302) to destination B - genuine per-domain
resolution, not a documented claim. Click count and last-click timestamp
updated correctly after each redirect. Deactivating a link via `PATCH` then
hitting its redirect returned `410 Gone` as designed.

Two real issues hit and fixed along the way:
- **Host-infra hiccup, not a code bug:** OrbStack's Docker daemon became
  unresponsive mid-session (`docker ps` hung, the running API process stopped
  answering requests). Restarted OrbStack, confirmed the Postgres container's
  data survived (`docker start` on the same container, data intact), restarted
  the API. Noting this since it's the kind of thing worth being aware of when
  running through this locally, not an application defect.
- **Nest `@UsePipes` at the method level applies to every parameter, not just
  `@Body()`.** `PATCH /api/links/:id` had `@UsePipes(new ZodValidationPipe(...))`
  on the method while also taking `@Param('id')` - the pipe ran against the
  `id` string too, failing with a confusing "Expected object, received string"
  on every request. Fixed by moving the pipe onto the `@Body()` parameter
  decorator directly (`@Body(new ZodValidationPipe(schema)) body: unknown`)
  instead of the method-level `@UsePipes`, which only matters when a handler
  mixes a validated body with other params. Re-verified PATCH works correctly
  after the fix.

Clean `nest build` + `oxlint` after both fixes.
Commit: `2a92565` — "feat(api): links CRUD + click logging + host-aware 302
redirect (end-to-end slice)"

