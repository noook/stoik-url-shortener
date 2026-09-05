import { ofetch, type FetchOptions } from "ofetch";

export interface ApiClientOptions {
  baseURL: string;
  /** Called when the API responds 401 - e.g. redirect to /login. Optional so the client is usable from CLI/tests too. */
  onUnauthorized?: () => void;
}

/**
 * Shared ofetch instance used by both the React app and any Node-side scripts/tests
 * that need to talk to the API the same way a browser would.
 *
 * Browser usage always passes credentials: 'include' since auth is a session cookie,
 * never a token held in JS-reachable storage (see plan §2.1).
 */
export function createApiClient({ baseURL, onUnauthorized }: ApiClientOptions) {
  return ofetch.create({
    baseURL,
    credentials: "include",
    onResponseError({ response }) {
      if (response.status === 401) {
        onUnauthorized?.();
      }
    },
  } satisfies FetchOptions);
}

export type ApiClient = ReturnType<typeof createApiClient>;
