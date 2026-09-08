# Homepage Ads (Backend Ad-Proxy) Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Show two ads on the homepage only (one horizontal, one vertical), fetched server-side by the API from a third-party ad service, so the private auth token never reaches the browser.

**Architecture:** New Nest `AdsModule` (`GET /api/ads?width=&height=`) proxies to the external ads API, attaching a server-held bearer token and forwarding the requested creative size. The React app calls this endpoint twice on the homepage — once per slot (vertical sidebar, horizontal footer) — via a small `AdSlot` component built on the existing `react-query` + `ofetch`-based client pattern already used for links/domains. No ad content or token is ever hardcoded client-side.

**Tech Stack:** NestJS (existing `ConfigModule`, `ApiTokenAuthGuard` pattern for guards is *not* reused here — ads endpoint is for the authenticated dashboard, calling out from the server), Zod (shared schema), `ofetch` (already the API's likely HTTP client choice — confirm below), React + `@tanstack/react-query`, existing shadcn/ui primitives.

---

## 1. Requirements recap

- Ads appear **only on the homepage** (`/` → `LinksListPage`, the admin links list — this is the only "homepage" the app has).
- The **API**, not the browser, fetches ads from the external service (`https://stoik-technical-test-js-admin.vercel.app/api/ads` by default) — this keeps the private ad-service token server-side only.
- Two ads per homepage load: **one horizontal**, **one vertical** — each requested with an explicit `width`/`height` so the ad service can return an appropriately sized creative.
- Layout placement: **vertical ad in a side rail**, **horizontal ad in the footer**.
- Each ad renders as a **clickable image** (`<a href={link} target="_blank" rel="noopener noreferrer"><img src={imageUrl} /></a>`).
- Ad-service token is **configurable via a back-end env var**; the ad-service **URL should also be configurable** (with the given URL as the default).

---

## 2. Current context / assumptions

- Repo: `~/work/stoik/url-shortener` (pnpm monorepo — `apps/api` NestJS, `apps/web` React/Vite, `packages/shared` Zod schemas + `ofetch` client + typed endpoint map).
- Existing pattern to mirror: `DomainsModule`/`DomainsController` — a thin, guarded, read-only proxy-ish module (`GET /api/domains`) is architecturally the closest existing analog to what an ads module needs to be.
- Homepage = `LinksListPage`, rendered inside `AppLayout` (`apps/web/src/components/app-layout.tsx`) via the `/` route in `App.tsx`. `AppLayout` wraps **every** authenticated page (list, detail, create) in one constrained-width column (`PAGE_WIDTH = max-w-6xl`) — it is **not** homepage-specific, so ads must not be added there directly or they'd leak onto every page.
- Shared schemas live in `packages/shared/src/schemas/*.ts`, barrel-exported from `packages/shared/src/index.ts`; the typed endpoint map lives in `packages/shared/src/api-endpoints.ts` on top of `packages/shared/src/client.ts` (`ofetch`-based).
- `.env.example` at repo root and `apps/api/.env.example` currently list `DATABASE_URL`, `PORT`, `WEB_ORIGIN` — new ad-related vars belong in both, following that pattern.
- The `/api/links`, `/api/domains` controllers use `@UseGuards(ApiTokenAuthGuard)` since they're operator-facing CRUD. The ads endpoint is called by the *authenticated dashboard* too (it's the logged-in admin's homepage), so it should sit behind the same guard for consistency, not be public.
- Assumption open for confirmation: is `LinksListPage` truly "the homepage" the task means, or does the assessment eventually get a public-facing page? Per the existing plan (`docs/adr` + main plan file), this app has no public marketing page — the links list is the only authenticated landing screen. **Proceeding on that assumption**; flag if wrong.

---

## 3. Proposed approach

### 3.1 Backend: `AdsModule`

New module mirroring `DomainsModule`'s shape, but calling out to an external HTTP API instead of the DB.

- `apps/api/src/ads/ads.module.ts` — registers controller + service, imports `ConfigModule` (already global, no explicit import needed thanks to `isGlobal: true` in `AppModule`).
- `apps/api/src/ads/ads.service.ts` — `fetchAd(width: number, height: number): Promise<Ad>`:
  - Reads `ADS_API_URL` (default `https://stoik-technical-test-js-admin.vercel.app/api/ads`) and `ADS_API_TOKEN` (required, no default) via `ConfigService`.
  - Calls the external API with the token attached (`Authorization: Bearer ${token}` — confirm exact header shape once the ad service's actual auth contract is visible; likely candidates: `Authorization: Bearer`, `X-Api-Key`. **Needs a live check against the real endpoint before implementation** — the provided context couldn't fetch `https://stoik-technical-test-js-admin.vercel.app/api/ads` directly, so its exact request contract (query param names for width/height, auth header name) is unconfirmed. Verify by hitting it manually first, e.g. `curl -H "Authorization: Bearer $TOKEN" "$URL?width=728&height=90"`.
  - Passes `width`/`height` through as query params on the outbound request.
  - Validates/parses the response with the shared `adSchema` (see 3.2) before returning it — never trust the third party's shape blindly.
  - On failure (network error, non-2xx, bad shape), throws a `BadGatewayException` (502) — the frontend slot should then simply render nothing (fail open, ads are decorative, never block the page).
- `apps/api/src/ads/ads.controller.ts`:
  ```ts
  @Controller("api/ads")
  @UseGuards(ApiTokenAuthGuard)
  export class AdsController {
    constructor(private readonly adsService: AdsService) {}

    @Get()
    async getAd(@ZodQuery(adQuerySchema) query: AdQuery): Promise<Ad> {
      return this.adsService.fetchAd(query.width, query.height);
    }
  }
  ```
- Register `AdsModule` in `apps/api/src/app.module.ts`'s `imports`.

### 3.2 Shared schema (`packages/shared`)

- `packages/shared/src/schemas/ad.ts`:
  ```ts
  import { z } from "zod";

  export const adSchema = z.object({
    id: z.string(),
    imageUrl: z.url(),
    link: z.url(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  });
  export type Ad = z.infer<typeof adSchema>;

  export const adQuerySchema = z.object({
    width: z.coerce.number().int().positive(),
    height: z.coerce.number().int().positive(),
  });
  export type AdQuery = z.infer<typeof adQuerySchema>;
  ```
  (Use whatever the project's actual Zod version's URL validator is — check `link.ts`/`domain.ts` for the existing convention, e.g. `z.string().url()` vs `z.url()`, and match it exactly rather than guessing.)
- Export from `packages/shared/src/index.ts`: `export * from "./schemas/ad.js";`
- Add to `packages/shared/src/api-endpoints.ts`:
  ```ts
  ads: {
    /** GET /api/ads - server-side proxy to the third-party ad API; token never reaches the browser. */
    get: (params: { width: number; height: number }) =>
      client<Ad>("/ads", { query: params }),
  },
  ```

### 3.3 Backend env vars

- `apps/api/.env.example` — add:
  ```
  # Third-party ad service the API proxies ad requests to (never called from the browser).
  ADS_API_URL=https://stoik-technical-test-js-admin.vercel.app/api/ads
  ADS_API_TOKEN=changeme
  ```
- Root `.env.example` — mirror the same two vars if root env is what Docker Compose actually consumes (check `docker-compose.yml`'s `api` service `environment`/`env_file` block first to see which file is authoritative, and add there too).
- `docker-compose.yml` — add `ADS_API_URL`/`ADS_API_TOKEN` to the `api` service's environment passthrough (however the existing vars like `DATABASE_URL` are wired — `env_file` vs explicit `environment:` list).

### 3.4 Frontend: `AdSlot` component

- `apps/web/src/components/ad-slot.tsx`:
  ```tsx
  import { useQuery } from "@tanstack/react-query";
  import { apiEndpoints } from "@/lib/api-client"; // match existing import path convention

  interface AdSlotProps {
    width: number;
    height: number;
    className?: string;
  }

  export function AdSlot({ width, height, className }: AdSlotProps) {
    const { data: ad } = useQuery({
      queryKey: ["ad", width, height],
      queryFn: () => apiEndpoints.ads.get({ width, height }),
      retry: false,
      staleTime: 5 * 60 * 1000,
    });

    if (!ad) return null; // fail open - no ad, no broken layout, no error UI

    return (
      <a
        href={ad.link}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={className}
      >
        <img
          src={ad.imageUrl}
          alt="Advertisement"
          width={ad.width}
          height={ad.height}
          className="max-w-full h-auto"
        />
      </a>
    );
  }
  ```
  (Confirm the actual import path/name for the configured `apiEndpoints` instance used elsewhere, e.g. check how `links-list-page.tsx` calls `client.links.list(...)` today and match that exact pattern instead of inventing a new one.)

### 3.5 Homepage layout placement

`AppLayout` is shared by every authenticated route, so ads must be scoped to `/` only — not injected into `AppLayout` itself. Two options, pick based on how much layout disruption is acceptable:

- **Option A (recommended, minimal disruption):** Add the ads *inside* `LinksListPage` only:
  - A `<footer>`-styled `<AdSlot width={728} height={90} />` (horizontal, e.g. IAB "leaderboard" 728×90) placed after the links table/pagination, before the page's closing tag.
  - A vertical `<AdSlot width={160} height={600} />` (IAB "wide skyscraper") placed in a `flex`/`grid` side column next to the links table, e.g. wrap the existing list content and the ad in a `grid grid-cols-[1fr_160px] gap-6` container, hidden below a breakpoint (`hidden lg:block` on the aside) so it doesn't crowd the table on narrow screens.
  - This keeps `AppLayout`'s `max-w-6xl` constraint honest for every other page, and only `LinksListPage` widens its own internal grid to accommodate the rail.
- **Option B:** Add an optional `showAds` flag/wrapper at the route level (`App.tsx`) that renders a homepage-specific layout variant around `AppLayout`'s `Outlet` content. More invasive for no real benefit here since there's only one page that needs ads — go with Option A unless the user pushes back.

Pick concrete ad sizes only as an example; confirm the two exact sizes with the user before hardcoding literals in the component calls (recommendation above is standard IAB sizes as a sane default: 728×90 horizontal, 160×600 vertical).

---

## 4. Step-by-step plan

1. **Verify the real ad API contract manually** (`curl`) — confirm query param names (`width`/`height` vs `w`/`h`), auth header shape, and response shape actually matches the example in the task (`id`, `imageUrl`, `link`, `width`, `height`). Do this before writing the service so `AdsService` isn't built against a guessed contract.
2. Add `packages/shared/src/schemas/ad.ts` + export from `packages/shared/src/index.ts`. Run `pnpm --filter @url-shortener/shared build` (or whatever the existing build/typecheck command is) to confirm it compiles.
3. Add `ads` entry to `packages/shared/src/api-endpoints.ts`.
4. Scaffold `apps/api/src/ads/ads.module.ts`, `ads.service.ts`, `ads.controller.ts`; register in `app.module.ts`.
5. Add `ADS_API_URL`/`ADS_API_TOKEN` to `apps/api/.env.example`, root `.env.example` (if applicable), and `docker-compose.yml`.
6. Manually verify with `curl` against the running local API: `curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/ads?width=728&height=90"` returns a valid `Ad` shape.
7. Build `apps/web/src/components/ad-slot.tsx`.
8. Wire two `AdSlot` usages into `apps/web/src/pages/links-list-page.tsx` per §3.5 Option A (side rail + footer).
9. Manual visual check: load `/` in the browser, confirm both ads render as clickable images, confirm they do **not** appear on `/links/new` or `/links/:id`.
10. Targeted test: a Nest e2e/unit test for `AdsService`/`AdsController` — mock the outbound `fetch`/`ofetch` call, assert the token is attached and never leaked into the response payload, assert width/height are forwarded, assert a non-2xx upstream response surfaces as a handled error rather than a crash.
11. Update `docs/progress-log.md` with a `[Progress]` entry once implemented, and `README.md`'s env var table if one exists.

---

## 5. Files likely to change

- Create: `apps/api/src/ads/ads.module.ts`
- Create: `apps/api/src/ads/ads.service.ts`
- Create: `apps/api/src/ads/ads.controller.ts`
- Create (maybe): `apps/api/src/ads/ads.service.spec.ts` / `apps/api/test/ads.e2e-spec.ts`
- Modify: `apps/api/src/app.module.ts` (register `AdsModule`)
- Modify: `apps/api/.env.example`, root `.env.example`, `docker-compose.yml` (+ `docker-compose.homelab.yml` if it also enumerates env vars)
- Create: `packages/shared/src/schemas/ad.ts`
- Modify: `packages/shared/src/index.ts`, `packages/shared/src/api-endpoints.ts`
- Create: `apps/web/src/components/ad-slot.tsx`
- Modify: `apps/web/src/pages/links-list-page.tsx`

---

## 6. Tests / validation

- Backend: mocked-fetch unit test on `AdsService` (token attached, params forwarded, response validated/rejected against `adSchema`, upstream failure handled).
- Backend: e2e test on `GET /api/ads` — asserts guard rejects unauthenticated calls (matches existing `auth-guard.e2e-spec.ts` pattern) and a happy-path call returns the shape.
- Manual: `curl` against real ad service once, `curl` against local proxy once, then browser check for placement/clickability on `/` vs other routes.

---

## 7. Risks, tradeoffs, and open questions

1. **Ad service contract unconfirmed** — the task's context couldn't fetch `https://stoik-technical-test-js-admin.vercel.app/api/ads` (no content extracted). Query param names, auth header format, and whether `width`/`height` are required or optional on that endpoint are assumptions until verified live. **Do step 1 before writing `AdsService` for real.**
2. **Exact ad pixel sizes** — task says "one horizontal, one vertical" but doesn't give exact dimensions. Proposed IAB-standard defaults (728×90, 160×600) are a reasonable placeholder; confirm with the user or just pick something reasonable and document the choice — not worth blocking on.
3. **Fail-open behavior** — decided ads should never break the page (no ad = render nothing, no error banner). Flag if the user wants a visible fallback/placeholder instead.
4. **Caching** — proxy currently does a live upstream call per `AdSlot` render (2 calls per homepage load, `staleTime` softens repeat navigations within the query-client's lifetime but not across page reloads). If the ad service has rate limits, consider a short server-side cache (e.g. in-memory, 30-60s) in `AdsService` — not in this plan's initial scope, flag if needed.
5. **Guard choice** — proxy endpoint reuses `ApiTokenAuthGuard` since it's only ever called from the authenticated dashboard. If ads should ever render on a logged-out page, this needs revisiting (currently there's no logged-out page that needs ads, so this is consistent with the actual homepage being an authenticated screen).
