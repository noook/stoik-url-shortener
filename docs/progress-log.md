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

### [Steering] Frontend kickoff decision + Zod v4 + unplugin-icons
User picked how to start the frontend: agent scaffolds the Vite+React+Tailwind+
shadcn skeleton and wires the API client/routing plumbing, then hands off
screen-by-screen for pairing. Also, mid-scaffold, corrected the Zod version -
use v4 everywhere (not v3), and later asked that any icon usage go through
**unplugin-icons with the Lucide set preferred**, rather than pulling in
`lucide-react` directly for app-level icon usage (it stays as a transitive
shadcn dependency for the components' own internals, e.g. Select's chevron -
that's not being swapped out).

### [Progress] Zod v4 migration across the whole monorepo
Bumped `zod` to `^4.5.4` in `packages/shared`, `apps/api`, and `apps/web`.
Replaced every deprecated v3-style chained string validator
(`z.string().uuid()`, `z.string().url()`) with v4's top-level equivalents
(`z.uuid()`, `z.url()`) across all shared schemas - not just "still works,
ignore the deprecation," actually moved off the old API per the explicit
instruction to avoid deprecated APIs, especially with Zod.
Verified for real: clean build on all three packages, and a live `curl` test
against `/api/links` with a malformed UUID confirmed Zod v4's error shape is
what's actually running (`code: "invalid_format"`, not v3's
`"invalid_string"`).
Commit: `645a81a` — "feat(web): scaffold Vite+React+TS app; migrate whole
monorepo to Zod v4 (non-deprecated APIs)"

### [Progress] Step 6 (part 1) — apps/web scaffold, shadcn/ui, plumbing
Scaffolded `apps/web` via `create-vite` (React 19 + TS + Vite 8/Rolldown,
`oxlint` by default). Wired Tailwind v4 (`@tailwindcss/vite`, CSS-first, no
separate config file) and initialized shadcn/ui (`radix-nova` preset),
installing `button`, `input`, `label`, `card`, `table`, `badge`, `select`.
Added `unplugin-icons` + `@iconify-json/lucide` per the steering above, wired
into `vite.config.ts` with the `jsx`/`react` compiler (needed peer deps
`@svgr/core` + `@svgr/plugin-jsx`, not obvious from the top-level install
error message - had to look up the React-specific peer requirement).

Built the core plumbing: `lib/api-client.ts` (shared `ofetch` instance,
`credentials: 'include'`, redirects to `/login` on 401), `lib/auth.tsx` (auth
context that always asks `GET /api/auth/session` - never reads a client-side
value, since the auth cookie is httpOnly by design), `components/require-auth.tsx`
(route guard), `components/app-layout.tsx` (header/logout shell, using a real
`~icons/lucide/log-out` icon to prove the icon pipeline end-to-end, not just
configured), and the router in `App.tsx` (`/login` public, everything else
behind the guard + layout). Left four page stub files
(`login-page.tsx`, `links-list-page.tsx`, `link-detail-page.tsx`,
`create-link-page.tsx`) each with a comment describing exactly what it needs
to do and which already-installed tool to reach for - these are what get
handed off for pairing next, not built autonomously (per the user's stated
preference to learn React by writing it himself with the agent reviewing).

Fixed one real shadcn CLI quirk: with only `references` (no direct
`compilerOptions`) in the root `tsconfig.json`, the CLI wrote generated
component files to a literal `./@/` directory instead of resolving the `@/*`
alias to `src/`. Added `paths` directly to the root tsconfig (without
`baseUrl`, since that option is deprecated as of the TypeScript version in use
here) and moved the misplaced files by hand.

Verified for real: `pnpm build` (both `tsc -b` and `vite build`) clean,
`pnpm lint` (oxlint) clean bar a couple of pre-existing shadcn-generated-file
warnings, dev server boots and a real browser screenshot confirms the app
renders with Tailwind styles applied and correctly redirects to `/login` with
no session present.
Commit: `51b529a` — "feat(web): shadcn/ui setup, unplugin-icons (lucide), app
plumbing (auth context, route guard, layout, router, page stubs)"

### [Steering] Login screen: shadcn's react-hook-form + Field pattern
User pointed at shadcn's official React Hook Form guide
(https://ui.shadcn.com/docs/forms/react-hook-form) and asked the agent to
build the login screen's markup following that pattern - the newer
`Field`/`FieldLabel`/`FieldContent`/`FieldDescription`/`FieldError` components
(not the older `Form`/`FormField` API, which explains why an earlier
`shadcn add form` found nothing to install - that component doesn't exist in
the newer registry version this project is on).

### [Progress] Login screen built
Added the shadcn `field` component (`npx shadcn add field`, landed correctly
in `src/components/ui/` this time - the earlier path-alias bug from initial
setup is fixed). Built `login-page.tsx` using `react-hook-form`'s `Controller`
+ `zodResolver` against the *already-existing* shared `createSessionSchema`
from `packages/shared` (no new schema needed - the backend's session-exchange
schema doubles as the frontend form's validation schema, exactly the "shared
types between front/back" requirement in practice). On submit, calls
`useAuth().login(token)` and navigates to `/` on success, or shows an inline
error read from the real API response on failure.

Verified for real in a live browser (not just a build check): submitted a
fabricated token, confirmed the genuine 401 from the API surfaces as "That
token isn't valid or has been revoked."; submitted the real
`recruiter-demo` token from earlier CLI testing, confirmed a real redirect to
`/` with the layout showing the correct token name and a working logout
button (rendering the `~icons/lucide/log-out` icon correctly in the browser,
not just at build time). Clean `vite build` + `tsc -b` + `oxlint` (only the
same pre-existing warnings from earlier, nothing new).
Commit: `e457637` — "feat(web): build login screen with react-hook-form +
shadcn Field pattern"

### [Answer] Login screen confirmed working
User confirmed the login screen works after trying it themselves.

### [Steering] Bearer-token auth requirement reaffirmed
User clarified the API must work standalone, not just from the web client -
auth should never rely solely on the cookie session. Verified the existing
`ApiTokenAuthGuard` already satisfies this (checks a plain `Authorization:
Bearer <token>` header with no cookie present, confirmed live with `curl`) -
no code change needed, this was already the design from the earlier
auth-simplification round.

### [Idea for later] Rate limiting - candidate topic for the next interview round
User flagged API rate limiting as a topic to bring up or explore in a follow-up
interview round - not something to build now, just noted for later
consideration/discussion.

### [Steering] Web layout: constrain content width, coherent shell
User is coming from Nuxt UI and found the current layout unsatisfactory on an
ultrawide (21:9) monitor - content spreads edge-to-edge with no constraint.
Asked for a coherent layout with content constrained toward the center of the
screen, closer to what a component-library-driven layout (like Nuxt UI) gives
by default.

### [Progress] Links list screen built
Paginated table view of `GET /api/links` - name, short link, truncated
destination, status badge (mapped from the shared `LinkStatus` type to
distinct badge variants per status), click count, with prev/next pagination.
Verified against the 200-link seeded dataset in a real browser: correct
pagination counts (203 total / 11 pages), status badges rendering correctly
across all four states, and click-through to a link's detail route working.

### [Progress] Link detail screen: data layer + one worked inline-edit field
Per the user's stated preference to learn React by writing it himself with
the agent pairing, not autonomously: wired up the full data layer in
`link-detail-page.tsx` (`GET /api/links/:id` and `GET /api/links/:id/clicks`
via `useQuery`, a shared `updateMutation` via `useMutation` that PATCHes and
writes the response straight back into the `["link", id]` query cache) and
built one field - inline-editable `name` - as a fully worked example of the
pattern: `react-hook-form` + `zodResolver` against the shared
`updateLinkSchema` (same shared-schema trick as the login form), saving
on blur. Left the active-toggle, start/end date fields, and paginated click
log table as a detailed pairing note in the file (which existing pieces to
reuse - `links-list-page.tsx`'s status badge/short-link markup, the
already-installed shadcn `Switch` component - and specific gotchas: the
Zod `z.input` vs. inferred-output type split needed for `react-hook-form`
when a schema uses `z.coerce.date()`, and the click-endpoint's response
shape not including a `total`, which affects whether the pager can show a
page count or only prev/next).

Verified for real in a live browser (not just a build check): opened a
seeded link's detail page, edited its name inline, confirmed the PATCH
persisted after a full page reload, then reverted the test edit. Added the
shadcn `switch` component (`npx shadcn add switch`) ahead of the toggle
field the user will build next.

### [Progress] Link detail screen completed: active toggle, date fields, click log
Finished the remaining pieces left as a pairing note in the previous entry.
Extracted the status badge (`STATUS_BADGE` map) and hover-to-copy short link
(with its `group/row` vs. standalone `group/copy` hover variants) out of
`links-list-page.tsx` into shared components
(`components/link-status-badge.tsx`, `components/short-link-copy.tsx`) and
reused both on the detail page and the list, rather than duplicating the
markup a second time.

`ActiveToggle` binds the shadcn `Switch` directly to `isActive`, calling
`updateMutation.mutate({ isActive })` from `onCheckedChange` - no form
needed for a single boolean. `DateFields` handles `startAt`/`endAt` with
`<Input type="datetime-local">`; empty input clears a date (submits `null`,
which `updateLinkSchema` accepts). `ClickLogTable` renders `clicksData.items`
(time, IP, referrer, user agent) with prev/next-only pagination, since
`GET /api/links/:id/clicks` doesn't return a `total` to compute a page count
from.

One real bug caught and fixed during live testing: initially reused the
shared `updateLinkSchema` (with `z.coerce.date()`) as the date fields' own
react-hook-form resolver. Since react-hook-form validates against a Zod
schema's *output* type, the resolver coerced the raw `datetime-local` string
into an actual `Date` before `onSubmit` saw it - fine on the first save, but
a second validation pass (e.g. a later blur) then re-ran the same coercion
on an already-a-`Date` value and failed. Fixed by giving `DateFields` its
own tiny string-only local schema for the two raw inputs, converting to
`Date` by hand before calling the shared `onSave` - `updateLinkSchema`
remains the single source of truth for what the API itself accepts.

Verified for real in a live browser, not just a build check: toggled
`isActive` off and back on (status badge updated live both times, confirmed
via the API response between toggles); set an end date via the UI, confirmed
it persisted through a fresh API fetch, cleared it back to `null`, confirmed
that persisted too; set a start date in the future and confirmed the status
badge correctly flipped to "scheduled", then cleared it back to null and
watched it return to "active"; paged the click log table forward from a
link with 58 real seeded clicks and confirmed different rows loaded and the
prev button enabled. Reverted every test edit back to the original data
afterward. Clean `tsc -b --noEmit`.

### [Progress] Create-link screen built
Built `create-link-page.tsx`: destination URL, optional name, domain picker
(shadcn `Select`, populated from `GET /api/domains`, defaulting to the
account's default domain), optional custom short code (blank generates
one), optional start/end dates. On success, navigates to the new link's
detail page (`/links/:id`) - reusing the screen just finished.

Same pattern as `DateFields` on the detail page: a local form-only Zod
schema for the raw string inputs rather than reusing the shared
`createLinkSchema` directly, since that schema's `z.coerce.date()` and its
`alias`/`autoLength` discriminated union are awkward to bind to plain form
fields (a blank date input, a blank alias input meaning "auto-generate").
A `toCreateLinkInput` function converts a valid form submission into the
real `CreateLinkInput` shape - `createLinkSchema` remains the actual
contract the API validates against regardless of what the form does.

Verified for real in a live browser: created a link with an
auto-generated code (confirmed navigation to its detail page, correct data,
empty click log); created a second link with a custom alias (confirmed the
exact short code landed); attempted to reuse that alias and confirmed the
API's real 409 conflict message ("Short code ... is already in use on
...") surfaces verbatim in the form, not a generic error; confirmed
client-side Zod validation blocks an invalid URL before submission; and
confirmed Cancel navigates back to the links list without submitting.
Deactivated both test links afterward via the existing DELETE endpoint
(which deactivates rather than hard-deletes, per its current behavior) so
they don't pollute the seeded 200-link dataset. Clean `tsc -b --noEmit`.

### [Progress] Docker Compose for full-stack deploy
Added `docker-compose.yml` (three services: `postgres`, `api`, `web`) plus
multi-stage `Dockerfile`s for the API (`apps/api/Dockerfile`) and web
(`apps/web/Dockerfile`, built assets served by nginx). The web container's
nginx reverse-proxies `/api/*` to the `api` service (`apps/web/nginx.conf`)
so the browser sees everything as same-origin, matching the Vite dev
server's own `/api` proxy closely enough that the httpOnly auth cookie
needs no CORS configuration to work in either mode. The API image's
entrypoint (`apps/api/docker-entrypoint.sh`) runs pending Drizzle
migrations against `DATABASE_URL` before starting the server, so the schema
is always current on a fresh deploy with no separate migration step or
container to keep in sync.

Config is `.env`-driven (`.env.example` at the repo root) - Postgres
credentials, and optional host port overrides for cases where 3000/8080 are
already taken. Root `package.json` already had `docker:up`/`docker:down`
scripts wired to `docker compose up --build`/`down`.

One real bug caught only by actually building and running the stack, not by
reading the Compose file: Postgres 18's image expects its data at
`/var/lib/postgresql`, not the `/var/lib/postgresql/data` subpath used by
earlier major versions - mounting the named volume at the old path made the
container refuse to start ("Error: in 18+, these Docker images are
configured to store database data in a format which is compatible with
pg_ctlcluster..."). Fixed by moving the volume mount up one level.

Verified for real, not just `docker compose config`: built both images
clean, brought the full stack up on isolated ports (3001/8081, so it didn't
collide with the running dev servers on 3000/5173), confirmed migrations
ran automatically in the API container's logs, issued a token and
registered a domain via `docker exec ... node dist/cli.js` inside the
running API container, logged into the web app served entirely by nginx
(no dev-server assets involved), created a link through the full UI flow,
confirmed the public redirect endpoint 302s to the right destination with
the correct Host-header domain resolution, and confirmed the click counter
incremented afterward - the entire stack's real request path exercised
once, end to end. Tore the smoke-test stack down afterward
(`docker compose down -v`) and removed the local `.env` used for it.

### [Progress] Domain and homelab-deployment docs written
Added the two docs planned early on
(`docs/adding-a-domain.md`, `docs/homelab-deployment-notes.md`).

`docs/adding-a-domain.md` is the generic, project-level reference: adding a
domain has two required parts (infra routing + registering the hostname in
the app's own `domains` table via `domain:add`), both needed since the
redirect handler does a strict `(hostname, code)` lookup - infra alone
won't make a short code resolve, and the app-level row alone won't route
real traffic. Includes the CLI usage against both a local dev instance and
a running Docker Compose deployment (`docker compose exec api node
dist/cli.js domain:add ...`), and a curl-based verification step with the
three possible outcomes (302/404/410).

`docs/homelab-deployment-notes.md` is explicitly marked at the top as the
author's own personal setup, not a project requirement - Traefik labels,
the personal Cloudflare Tunnel routing, and the Postgres 18 volume-mount
gotcha already fixed in the project's own `docker-compose.yml` (repeated
here since a stale personal compose file might get copied in by habit).
Kept clearly separate from the generic `docker-compose.yml` and the
adding-a-domain doc so a reviewer isn't left thinking Traefik-specific
config is part of the actual project spec.

### [Progress] ADR 0001 and top-level README written
Wrote `docs/adr/0001-domain-and-shortcode-uniqueness.md`, documenting the
short-code/domain uniqueness design decided early on (composite unique
index on `(domain_id, short_code)`, the redirect handler's strict
`(hostname, code)` resolution, per-domain conflict handling on create) plus
two smaller decisions folded in from the same reasoning pass: `302` over
`301` for redirects (caching breaks click logging and live edits), and the
token-as-credential auth design (no separate session layer on top of the
long-lived API token - an httpOnly cookie already satisfies the actual
stated requirement of keeping it out of reach of page JS).

Wrote the top-level `README.md`: project overview, an "architecture at a
glance" section linking into the ADR rather than re-explaining it, local
setup instructions, Docker Compose instructions, and a project structure
map. Verified the local setup commands against the actual npm scripts
rather than assuming - `pnpm --filter api drizzle-kit migrate` doesn't work
as an npm-script alias (needs `pnpm --filter api exec drizzle-kit
migrate`), and `cli`/the seed scripts run from `dist/`, so a build step is
required for local (non-Docker) setup - corrected before finalizing
rather than leaving unverified command examples in a deliverable doc.

### [Progress] Targeted test pass: redirect resolution, conflict handling, auth guard
Added a real e2e suite (`apps/api/test/`, run against the actual dev
Postgres, no mocking - `AppModule`'s real `DatabaseModule` is used as-is)
covering the three areas planned early on:

- `redirect.e2e-spec.ts` - the `(domain, code)` redirect resolution from
  ADR 0001: 302 for an active link, 404 for an unknown code, 404 for a code
  that exists but on a *different* domain (proving identity really is
  per-domain, not global), the identical code resolving to two different
  destinations on two different domains, 410 for a deactivated link, 410
  for an expired link, 404 for a not-yet-started link, and a click event
  actually landing in the DB after a successful redirect.
- `links-conflict.e2e-spec.ts` - the create-time conflict handling: a
  409 on a duplicate alias within the same domain, the identical alias
  succeeding on a different domain, `isAliasAvailable`'s per-domain
  scoping (same check the `check-alias` endpoint uses), a 404 for a
  nonexistent `domainId`, and confirming two auto-generated codes on the
  same domain don't collide.
- `auth-guard.e2e-spec.ts` - `ApiTokenAuthGuard` against a real protected
  route: no token (401), a fabricated token (401), a valid token via
  Bearer (200), a valid token via the httpOnly cookie (200), both present
  at once (200), and a token rejected after being revoked (200 before,
  401 after) - covers the "must work standalone via Bearer, not just the
  cookie-based web client" requirement reaffirmed earlier in this log.

Test domains use a random per-run hostname suffix so repeated runs (or
future CI runs) never collide with each other's leftover rows from a
previous run - confirmed by running the suite twice in a row, both green,
no manual cleanup needed between runs. `pnpm --filter api test:e2e`: 4
files, 20 tests, all passing against the real database. `pnpm --filter api
lint` clean on both `src/` and the new `test/` files. Confirmed the running
dev servers were unaffected by the test run afterward.

### [Steering] Two standing conventions: no deprecated Zod v4 APIs, prefer Intl.* for formatting
User asked for two adjustments going forward: never use a deprecated Zod v4
API (e.g. the old chained `.string().url()`/`.string().uuid()`/etc. forms -
Zod v4 moved these to top-level `z.url()`/`z.uuid()`, which the shared
schemas already use throughout `packages/shared`, confirmed by an audit -
no deprecated forms found), and prefer `Intl.DateTimeFormat` (and other
`Intl.*` APIs) over ad-hoc formatting (`Date`'s own `getFullYear`/`getMonth`/etc.
getters, or locale-dependent-but-unconfigurable `toLocaleString()`) wherever
something needs formatting for display.

Applied the second one immediately: extracted `apps/web/src/lib/date-format.ts`
with `formatDateTime` (an `Intl.DateTimeFormat` instance with explicit
`dateStyle`/`timeStyle`, used by the click log table) and `toDatetimeLocal`
(now built on `Intl.DateTimeFormat('en-CA', ...).formatToParts()` rather than
manual `getFullYear`/`getMonth`/`padStart` calls, still producing the exact
`"yyyy-MM-ddTHH:mm"` string `<input type="datetime-local">` expects).
`fromDatetimeLocal` also moved there for colocation. `link-detail-page.tsx`
now imports all three instead of defining local versions.

Verified for real in a live browser, not just a type check: reloaded the
link detail page and confirmed the click log's `formatDateTime` output
renders correctly; set a start date through the actual `datetime-local`
input, confirmed it round-trips (`toDatetimeLocal(fromDatetimeLocal(x))`
same value) through a full page reload, then reverted the test edit. Also
checked the `Intl.DateTimeFormat('en-CA', { hour12: false })` midnight edge
case (some engines are documented to emit `"24"` instead of `"00"` for
midnight in 24-hour mode) directly in the browser - this runtime emits
`"00"`, and the code defensively normalizes `"24"` anyway in case a
different engine differs. Clean `tsc -b --noEmit` and `oxlint` (no new
warnings).

### [Steering] Bump minimum Node to 26+
User asked to prefer Node 26+ over 22 going forward, since 22 is now
considered old. Updated `package.json`'s `engines.node` (`>=22` ->
`>=26`), both Dockerfiles' base image (`node:22-slim` -> `node:26-slim`),
and the README's stated requirement.

One real compatibility issue caught only by actually rebuilding the images,
not by bumping the tag and assuming it'd work: `corepack enable` failed
outright on `node:26-slim` (`corepack: not found`) - Corepack was removed
from Node core as of the v25/v26 line and has to be installed explicitly
now (`npm install -g corepack@latest && corepack enable`). Fixed in both
Dockerfiles.

Verified for real: rebuilt both images clean under Node 26, brought the
full compose stack up (migrations ran automatically, same as before),
confirmed `node --version` inside the running API container reports v26,
issued a token and registered a domain via the CLI inside the container,
and confirmed the web app + API-via-proxy respond correctly. Local dev
servers (still on the locally-installed Node 22, unaffected since there's
no `engine-strict` setting) confirmed unaffected afterward. Tore the
smoke-test stack down and cleaned up the local `.env` used for it.

### [Steering] Reverse proxy: Traefik, not a hand-written nginx proxy_pass
User asked for Traefik to handle the reverse-proxy role in Docker Compose,
aligning with the rest of their infrastructure (personal homelab already
runs everything behind Traefik - see `docs/homelab-deployment-notes.md`),
rather than the project inventing its own nginx-based proxying just for
this one deployment. Follow-up clarified web serving stays on nginx
specifically (lighter/more reliable as a static file server than adding a
Node-based static server dependency) - only the *proxy* role moves to
Traefik, not the whole `web` container.

Added a `traefik` service to `docker-compose.yml` (Docker label-based
service discovery, `--providers.docker.exposedbydefault=false` so only
explicitly-labeled services get a route) and gave `api`/`web` their own
`traefik.*` labels (`PathPrefix(\`/api\`)` on `api` with a higher explicit
priority, `PathPrefix(\`/\`)` catch-all on `web`) instead of a manual
`nginx.conf` `location /api/ { proxy_pass ... }` block. `apps/web/nginx.conf`
is now a plain static file server (just the SPA `try_files` fallback) -
nginx still serves the built React bundle, it just no longer does any
proxying, which is now entirely Traefik's job.

One real compatibility issue caught only by actually bringing the stack
up, not by writing the labels and assuming it'd work: `traefik:v3.1`
against this host's Docker Engine failed immediately with "client version
1.24 is too old. Minimum supported API version is 1.40" - Docker Engine
29 raised its minimum supported API version, and older Traefik releases
hardcode API 1.24 in their Docker-provider client rather than negotiating
it. Traefik 3.6.1+ added automatic API version negotiation, fixing this;
bumped the image tag to `traefik:v3.6`.

Also updated `docs/homelab-deployment-notes.md`: the project's own bundled
`traefik` service (path-based routing on one shared port, meant for
running the stack standalone) is explicitly distinguished from the
author's actual homelab's separate, shared, always-on Traefik instance
(host-based `Host()` routing across many projects) - deploying there means
dropping the bundled service entirely and switching the `api`/`web` labels
from `PathPrefix` to `Host()` rules, not running two Traefik instances.

Verified for real in a live browser and via curl, not just `docker compose
config`: rebuilt both images, brought up all four containers (postgres,
api, web, traefik), confirmed `/`, `/api/*` (401 with no auth, as
expected), and a client-side SPA route (`/links/:id`, a hard-refreshed
deep link) all route correctly through Traefik on one published port,
logged into the web app and created a link through the full UI end to end,
confirmed the created link persisted via a fresh API fetch, and confirmed
the public redirect endpoint still 302s correctly from the API's own
directly-published port (the redirect route is intentionally not proxied
through the web/API split, since it's the public-facing short-link surface,
not part of the app). Tore the smoke-test stack down and cleaned up the
local `.env` afterward; confirmed the running dev servers were unaffected.

### [Steering] Typed per-endpoint API client, not a single generic method
User pointed out the shared `api<T>(url, options)` pattern made every call
site responsible for two things that should live in one place: the literal
URL string (which breaks silently everywhere it's duplicated if a route
path ever changes) and the response type generic (same problem, just for
shapes instead of paths).

Added `packages/shared/src/api-endpoints.ts`: `createApiEndpoints(client)`
wraps the raw `ApiClient` (client.ts, unchanged) in a plain object of
per-endpoint methods matching the actual NestJS routes 1:1 -
`api.auth.getSession()`, `api.auth.login(input)`, `api.auth.logout()`,
`api.domains.list()`, `api.links.list(params)`, `api.links.get(id)`,
`api.links.create(input)`, `api.links.update(id, patch)`,
`api.links.deactivate(id)`, `api.links.checkAlias(params)`,
`api.links.listClicks(id, params)`. Each method's URL and response type are
now defined exactly once; every call site gets both for free through
inference, with nothing to keep in sync if a route changes. Deliberately
a factory returning a plain object (not a class) - no state beyond the
wrapped client, nothing to instantiate beyond calling it once.

`apps/web/src/lib/api-client.ts` now calls `createApiEndpoints(rawClient)`
and exports the typed object as `api`; every call site across
`links-list-page.tsx`, `link-detail-page.tsx`, `create-link-page.tsx`, and
`lib/auth.tsx` was rewritten from `api<T>("/url", opts)` to the
corresponding `api.resource.method(...)` call - no leftover raw calls
anywhere (`grep`-confirmed). Also fixed `clickEventPageSchema` while in
there: it declared a `total` field the real `GET /links/:id/clicks`
response has never actually returned (the click log has always been
prev/next-only, per the earlier link-detail-screen work) - removed the
unused field so the shared schema matches the API's real shape.

Verified for real, not just a type check: rebuilt `packages/shared`,
`apps/api`, and `apps/web` clean (`tsc -b --noEmit` on web, `nest build` on
api, `tsc -p` on shared), then exercised the whole app live in the
browser through the new typed methods - logged in (`api.auth.login`),
loaded the links list (`api.links.list`), opened a link's detail page
(`api.links.get` + `api.links.listClicks`, including a real click event
from earlier e2e runs rendering correctly), and created a new link
end-to-end (`api.links.create`, correct redirect to the new detail page) -
then deactivated that test link afterward. Clean `pnpm lint` and
`pnpm test` (unit) across all workspaces, `pnpm --filter api test:e2e`
still 20/20 green.

Also fixed a pre-existing unrelated gap noticed while running the repo-wide
lint for this change: `packages/shared`'s `lint` script called `oxlint`
without it ever being a declared devDependency, so `pnpm lint` at the repo
root has been silently failing on that workspace. Added `oxlint` to
`packages/shared`'s devDependencies to match `apps/api`'s version.
