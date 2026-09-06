import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createTestApp } from "./utils/test-app.js";
import { ApiTokensService } from "../src/auth/api-tokens.service.js";
import { AUTH_COOKIE_NAME } from "../src/auth/auth-cookie.constants.js";
import { DATABASE_CONNECTION, type Database } from "../src/database/database.module.js";
import { apiTokens } from "../src/database/schema.js";

/**
 * Exercises the real ApiTokenAuthGuard against a protected route
 * (GET /api/links, chosen since it's a plain @UseGuards(ApiTokenAuthGuard)
 * route with no extra setup needed) - cookie vs. Bearer, missing, invalid,
 * and revoked-token cases. See docs/progress-log.md's "Bearer-token auth
 * requirement reaffirmed" entry - the API must work standalone via Bearer,
 * not just from the cookie-based web client.
 */
describe("ApiTokenAuthGuard (e2e)", () => {
  let app: INestApplication;
  let apiTokensService: ApiTokensService;
  let db: Database;
  let plaintext: string;

  beforeAll(async () => {
    app = await createTestApp();
    apiTokensService = app.get(ApiTokensService);
    db = app.get(DATABASE_CONNECTION);

    const created = await apiTokensService.createToken("auth-guard-e2e-test");
    plaintext = created.plaintext;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects a request with no token at all", async () => {
    const res = await request(app.getHttpServer()).get("/api/links");
    expect(res.status).toBe(401);
  });

  it("rejects an invalid/fabricated token via Bearer", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/links")
      .set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("accepts a valid token via the Authorization Bearer header", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/links")
      .set("Authorization", `Bearer ${plaintext}`);
    expect(res.status).toBe(200);
  });

  it("accepts a valid token via the httpOnly auth cookie", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/links")
      .set("Cookie", `${AUTH_COOKIE_NAME}=${plaintext}`);
    expect(res.status).toBe(200);
  });

  it("still authenticates when both a valid cookie and a valid Bearer header are present", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/links")
      .set("Cookie", `${AUTH_COOKIE_NAME}=${plaintext}`)
      .set("Authorization", `Bearer ${plaintext}`);
    expect(res.status).toBe(200);
  });

  it("rejects a token after it's been revoked", async () => {
    const revoked = await apiTokensService.createToken("to-be-revoked");

    const beforeRevoke = await request(app.getHttpServer())
      .get("/api/links")
      .set("Authorization", `Bearer ${revoked.plaintext}`);
    expect(beforeRevoke.status).toBe(200);

    // No revoke endpoint/CLI command exists yet - set revokedAt directly,
    // the same column a future revoke feature would write.
    await db.update(apiTokens).set({ revokedAt: new Date() }).where(eq(apiTokens.id, revoked.id));

    const afterRevoke = await request(app.getHttpServer())
      .get("/api/links")
      .set("Authorization", `Bearer ${revoked.plaintext}`);
    expect(afterRevoke.status).toBe(401);
  });
});
