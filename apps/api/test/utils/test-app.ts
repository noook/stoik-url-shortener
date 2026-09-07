import { Test, type TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import type { App } from "supertest/types";
import { AppModule } from "../../src/app.module.js";

/**
 * Shared e2e test bootstrap. Requires a reachable Postgres (see
 * apps/api/.env / docker-compose.yml) since AppModule wires up the real
 * DatabaseModule - no mocking, these tests exercise the real HTTP + DB
 * stack end to end. Run `docker compose up -d postgres` (or point
 * DATABASE_URL at any Postgres instance) before running this suite.
 */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  // main.ts applies both of these in production - tests need them too since
  // the auth guard/AuthController read req.cookies, and RedirectController's
  // IP-resolution fallback chain (see resolveClientIp) relies on req.ip
  // reading X-Forwarded-For, which Express only does with trust proxy set.
  app.use(cookieParser());
  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  await app.init();
  return app;
}
