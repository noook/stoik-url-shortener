import { createHash, randomBytes } from "node:crypto";

/**
 * CLI-issued API tokens: generate a url-safe random token, store only its hash.
 * Plaintext is shown once at creation time and never persisted or logged.
 */
export function generateApiToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
