export const AUTH_COOKIE_NAME = "auth_token";
/**
 * Browser-side cookie lifetime. The token itself is long-lived server-side
 * (no separate expiry) - this just controls how long the browser holds onto
 * it before the user would need to paste it again. 30 days is a reasonable
 * default for an internal tool used by a small pool of people.
 */
export const AUTH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
