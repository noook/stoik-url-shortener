import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module.js";

// Requires a reachable Postgres (see .env / docker-compose.yml) since AppModule
// wires up the real DatabaseModule - run `docker compose up -d postgres` first.
describe("AppController (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("/health (GET)", () => {
    return request(app.getHttpServer()).get("/health").expect(200).expect({ status: "ok" });
  });

  afterEach(async () => {
    await app.close();
  });
});
