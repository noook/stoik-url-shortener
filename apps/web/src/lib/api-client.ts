import { createApiClient, createApiEndpoints } from "@url-shortener/shared";

/**
 * Shared ofetch instance for the whole app. credentials: 'include' is set
 * inside createApiClient (see packages/shared) since auth is an httpOnly
 * cookie, never a token this app can read - see docs/adr/0001-*.md and the
 * plan's auth section for why.
 */
const rawClient = createApiClient({
  baseURL: "/api",
  onUnauthorized: () => {
    // Raw browser navigation, not a React Router link - needs the full
    // /admin-prefixed path (see vite.config.ts's `base` / App.tsx's
    // `basename`), not the in-app route path React Router itself uses.
    if (window.location.pathname !== "/admin/login") {
      window.location.assign("/admin/login");
    }
  },
});

/**
 * Typed, per-endpoint API methods (`api.links.list()`, `api.links.get(id)`,
 * etc.) built once here on top of the raw client - see
 * packages/shared/src/api-endpoints.ts. Callers never write a URL string or
 * a response type generic by hand; both live in exactly one place, so a
 * route path or response shape change only needs updating there, not at
 * every call site across the app.
 */
export const api = createApiEndpoints(rawClient);
