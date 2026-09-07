import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { customAlphabet } from "nanoid";
import type { CreateLinkInput } from "@url-shortener/shared";
import { createTestApp } from "./utils/test-app.js";
import { DomainsService } from "../src/domains/domains.service.js";
import { LinksService } from "../src/links/links.service.js";

// Random suffix per run so parallel/repeat runs never collide on the
// domains.hostname unique constraint - these tests create real rows against
// a real Postgres, not mocks, and don't tear the domain rows back out.
const runId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8)();

describe("Redirect resolution (e2e)", () => {
  let app: INestApplication;
  let domainsService: DomainsService;
  let linksService: LinksService;

  let domainA: { id: string; hostname: string };
  let domainB: { id: string; hostname: string };

  beforeAll(async () => {
    app = await createTestApp();
    domainsService = app.get(DomainsService);
    linksService = app.get(LinksService);

    const a = await domainsService.add(`redirect-a-${runId}.test`);
    const b = await domainsService.add(`redirect-b-${runId}.test`);
    if (!a || !b) throw new Error("failed to seed test domains");
    domainA = a;
    domainB = b;
  });

  afterAll(async () => {
    await app.close();
  });

  it("302s to the destination for an active link", async () => {
    const link = await linksService.create({
      domainId: domainA.id,
      destinationUrl: "https://example.com/active",
      alias: "active-link",
    } satisfies CreateLinkInput);

    const res = await request(app.getHttpServer())
      .get(`/${link.shortCode}`)
      .set("Host", domainA.hostname);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://example.com/active");
  });

  it("404s for a code that doesn't exist on any domain", async () => {
    const res = await request(app.getHttpServer())
      .get("/this-code-does-not-exist")
      .set("Host", domainA.hostname);

    expect(res.status).toBe(404);
    expect(res.type).toBe("text/html");
  });

  it("404s when the same code exists, but on a different domain - identity is (domain, code)", async () => {
    const link = await linksService.create({
      domainId: domainA.id,
      destinationUrl: "https://example.com/domain-scoped",
      alias: "domain-scoped-link",
    } satisfies CreateLinkInput);

    // Same code, requested against domain B, where it was never created - ADR 0001.
    const res = await request(app.getHttpServer())
      .get(`/${link.shortCode}`)
      .set("Host", domainB.hostname);

    expect(res.status).toBe(404);
  });

  it("redirects the bare domain root to the admin dashboard", async () => {
    const res = await request(app.getHttpServer()).get("/").set("Host", domainA.hostname);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/admin");
  });

  it("allows the identical code to exist on two different domains independently", async () => {
    const shared = "shared-across-domains";
    const linkA = await linksService.create({
      domainId: domainA.id,
      destinationUrl: "https://example.com/on-a",
      alias: shared,
    } satisfies CreateLinkInput);
    const linkB = await linksService.create({
      domainId: domainB.id,
      destinationUrl: "https://example.com/on-b",
      alias: shared,
    } satisfies CreateLinkInput);

    expect(linkA.shortCode).toBe(shared);
    expect(linkB.shortCode).toBe(shared);

    const resA = await request(app.getHttpServer()).get(`/${shared}`).set("Host", domainA.hostname);
    const resB = await request(app.getHttpServer()).get(`/${shared}`).set("Host", domainB.hostname);

    expect(resA.headers.location).toBe("https://example.com/on-a");
    expect(resB.headers.location).toBe("https://example.com/on-b");
  });

  it("returns 410 Gone for a deactivated link", async () => {
    const link = await linksService.create({
      domainId: domainA.id,
      destinationUrl: "https://example.com/deactivated",
      alias: "deactivated-link",
    } satisfies CreateLinkInput);
    await linksService.deactivate(link.id);

    const res = await request(app.getHttpServer())
      .get(`/${link.shortCode}`)
      .set("Host", domainA.hostname);

    expect(res.status).toBe(410);
  });

  it("returns 410 Gone for an expired link (endAt in the past)", async () => {
    const link = await linksService.create({
      domainId: domainA.id,
      destinationUrl: "https://example.com/expired",
      alias: "expired-link",
      endAt: new Date(Date.now() - 60_000),
    } satisfies CreateLinkInput);

    const res = await request(app.getHttpServer())
      .get(`/${link.shortCode}`)
      .set("Host", domainA.hostname);

    expect(res.status).toBe(410);
  });

  it("returns 404 for a link that hasn't started yet (startAt in the future)", async () => {
    const link = await linksService.create({
      domainId: domainA.id,
      destinationUrl: "https://example.com/not-yet-active",
      alias: "not-yet-active-link",
      startAt: new Date(Date.now() + 60_000),
    } satisfies CreateLinkInput);

    const res = await request(app.getHttpServer())
      .get(`/${link.shortCode}`)
      .set("Host", domainA.hostname);

    expect(res.status).toBe(404);
    expect(res.type).toBe("text/html");
  });

  it("logs a click event on a successful redirect", async () => {
    const link = await linksService.create({
      domainId: domainA.id,
      destinationUrl: "https://example.com/click-tracked",
      alias: "click-tracked-link",
    } satisfies CreateLinkInput);

    const before = await linksService.findById(link.id);
    expect(before?.clickCount).toBe(0);

    await request(app.getHttpServer()).get(`/${link.shortCode}`).set("Host", domainA.hostname);

    // Click logging is fire-and-forget from the redirect handler's point of
    // view (see RedirectController) - give it a moment to land before asserting.
    await new Promise((resolve) => setTimeout(resolve, 100));

    const after = await linksService.findById(link.id);
    expect(after?.clickCount).toBe(1);
  });
});
