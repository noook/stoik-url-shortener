import { describe, it, expect } from "vitest";
import { generateApiToken, hashApiToken } from "./token.util.js";

describe("generateApiToken", () => {
  it("generates a url-safe string with no padding/plus/slash characters", () => {
    const token = generateApiToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates a sufficiently long token (32 random bytes, base64url)", () => {
    const token = generateApiToken();
    // 32 bytes base64url-encoded (no padding) is 43 chars.
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it("never generates the same token twice in practice", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateApiToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("hashApiToken", () => {
  it("is deterministic - the same input always hashes the same way", () => {
    const token = generateApiToken();
    expect(hashApiToken(token)).toBe(hashApiToken(token));
  });

  it("produces different hashes for different tokens", () => {
    const a = generateApiToken();
    const b = generateApiToken();
    expect(hashApiToken(a)).not.toBe(hashApiToken(b));
  });

  it("never returns the plaintext token itself - the whole point of hashing it", () => {
    const token = generateApiToken();
    expect(hashApiToken(token)).not.toBe(token);
  });

  it("produces a fixed-length hex string (sha256 digest, 64 hex chars)", () => {
    const hash = hashApiToken(generateApiToken());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
