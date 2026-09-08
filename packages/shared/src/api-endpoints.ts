import type { ApiClient } from "./client.js";
import type { Domain } from "./schemas/domain.js";
import type {
  Link,
  LinkPage,
  CreateLinkInput,
  UpdateLinkInput,
} from "./schemas/link.js";
import type { ClickEventPage } from "./schemas/click-event.js";
import type { CreateSessionInput, SessionInfo } from "./schemas/auth.js";
import type { Ad } from "./schemas/ad.js";

/**
 * One typed method per API endpoint, built on top of a raw `ApiClient`
 * (see client.ts). This exists so callers never write a URL string or a
 * response generic by hand at the call site - both live in exactly one
 * place (here), matching the actual NestJS routes 1:1
 * (apps/api/src/**\/*.controller.ts). If a route's path or response shape
 * changes, this is the only file that needs updating - every caller across
 * the app keeps working through the same method name.
 *
 * Deliberately a plain object of closures over the client, not a class -
 * no state of its own beyond the client, so there's nothing to instantiate
 * beyond calling this factory once (see apps/web/src/lib/api-client.ts).
 */
export function createApiEndpoints(client: ApiClient) {
  return {
    auth: {
      /** GET /api/auth/session - throws (401) if there's no valid session. */
      getSession: () => client<SessionInfo>("/auth/session"),
      /** POST /api/auth/session - exchanges a CLI-issued token for the httpOnly session cookie. */
      login: (input: CreateSessionInput) =>
        client<SessionInfo>("/auth/session", { method: "POST", body: input }),
      /** POST /api/auth/logout - clears the session cookie. */
      logout: () => client<{ ok: true }>("/auth/logout", { method: "POST" }),
    },

    domains: {
      /** GET /api/domains */
      list: () => client<Domain[]>("/domains"),
    },

    links: {
      /** GET /api/links */
      list: (params: { page: number; pageSize: number }) =>
        client<LinkPage>("/links", { query: params }),
      /** GET /api/links/:id */
      get: (id: string) => client<Link>(`/links/${id}`),
      /** POST /api/links */
      create: (input: CreateLinkInput) =>
        client<Link>("/links", { method: "POST", body: input }),
      /** PATCH /api/links/:id */
      update: (id: string, patch: UpdateLinkInput) =>
        client<Link>(`/links/${id}`, { method: "PATCH", body: patch }),
      /** DELETE /api/links/:id - deactivates the link, does not hard-delete it. */
      deactivate: (id: string) => client<{ ok: true }>(`/links/${id}`, { method: "DELETE" }),
      /** GET /api/links/check-alias */
      checkAlias: (params: { domainId: string; alias: string }) =>
        client<{ available: boolean }>("/links/check-alias", { query: params }),
      /** GET /api/links/:id/clicks */
      listClicks: (id: string, params: { page: number; pageSize: number }) =>
        client<ClickEventPage>(`/links/${id}/clicks`, { query: params }),
    },

    ads: {
      /**
       * GET /api/ads - our API proxies this to a third-party ad service
       * server-side, attaching a private token that never reaches the
       * browser (see apps/api/src/ads). width/height request a
       * specific creative size for the slot calling this.
       */
      get: (params: { width: number; height: number }) =>
        client<Ad>("/ads", { query: params }),
    },
  };
}

export type ApiEndpoints = ReturnType<typeof createApiEndpoints>;
