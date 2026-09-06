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
  // main.ts applies this in production - tests need it too since the auth
  // guard and AuthController both read req.cookies.
  app.use(cookieParser());
  await app.init();
  return app;
}
