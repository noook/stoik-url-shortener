import { createApiClient } from "@url-shortener/shared";

/**
 * Shared ofetch instance for the whole app. credentials: 'include' is set
 * inside createApiClient (see packages/shared) since auth is an httpOnly
 * cookie, never a token this app can read - see docs/adr/0001-*.md and the
 * plan's auth section for why.
 */
export const api = createApiClient({
  baseURL: "/api",
  onUnauthorized: () => {
    if (window.location.pathname !== "/login") {
      window.location.assign("/login");
    }
  },
});
