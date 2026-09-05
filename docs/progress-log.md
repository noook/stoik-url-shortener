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
- use **Vue-ecosystem** tools in the React app where they fit better than React's
  usual defaults,
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
considered and explicitly not adopted, with reasons), `@unhead/react` in place of
`react-helmet` for page titles (a Vue/Nuxt-ecosystem tool with official React
bindings — the concrete, honest answer to "Vue tools where they fit," since plain
VueUse composables don't port to React's different reactivity model), the `302`
redirect decision, a `domain:add` CLI command mirroring `token:create`, and two new
planned docs: one generic (`docs/adding-a-domain.md`, infra + app steps to point a
new domain at a running instance) and one personal
(`docs/homelab-deployment-notes.md`, explicitly marked as reflecting the user's own
setup, not a project requirement).
Commit: pending (see below).

### [Progress] Repository relocated
Moved the repo from `~/work/url-shortener` to `~/work/stoik/url-shortener` per the
user's requested default naming (`stoik/url-shortener`, company name as parent
folder). Git history carried over unaffected (a plain directory move, no rewrite).
