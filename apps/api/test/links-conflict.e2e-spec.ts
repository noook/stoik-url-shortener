import { INestApplication } from "@nestjs/common";
import { customAlphabet } from "nanoid";
import { createTestApp } from "./utils/test-app.js";
import { DomainsService } from "../src/domains/domains.service.js";
import { LinksService } from "../src/links/links.service.js";

const runId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8)();

describe("Short-code / domain conflict handling (e2e, ADR 0001)", () => {
  let app: INestApplication;
  let domainsService: DomainsService;
  let linksService: LinksService;

  let domainA: { id: string; hostname: string };
  let domainB: { id: string; hostname: string };

  beforeAll(async () => {
    app = await createTestApp();
    domainsService = app.get(DomainsService);
    linksService = app.get(LinksService);

    const a = await domainsService.add(`conflict-a-${runId}.test`);
    const b = await domainsService.add(`conflict-b-${runId}.test`);
    if (!a || !b) throw new Error("failed to seed test domains");
    domainA = a;
    domainB = b;
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects a custom alias that's already taken on the SAME domain", async () => {
    await linksService.create({
      domainId: domainA.id,
      destinationUrl: "https://example.com/first",
      alias: "taken-alias",
    } as never);

    await expect(
      linksService.create({
        domainId: domainA.id,
        destinationUrl: "https://example.com/second",
        alias: "taken-alias",
      } as never),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it("allows the identical custom alias on a DIFFERENT domain - not a global namespace", async () => {
    await linksService.create({
      domainId: domainA.id,
      destinationUrl: "https://example.com/domain-a-version",
      alias: "cross-domain-alias",
    } as never);

    // Same alias, different domain - must succeed, per ADR 0001.
    const linkOnB = await linksService.create({
      domainId: domainB.id,
      destinationUrl: "https://example.com/domain-b-version",
      alias: "cross-domain-alias",
    } as never);

    expect(linkOnB.shortCode).toBe("cross-domain-alias");
    expect(linkOnB.domainId).toBe(domainB.id);
  });

  it("isAliasAvailable reflects the same per-domain scoping used by the check-alias endpoint", async () => {
    await linksService.create({
      domainId: domainA.id,
      destinationUrl: "https://example.com/availability-check",
      alias: "availability-check-alias",
    } as never);

    const availableOnSameDomain = await linksService.isAliasAvailable(domainA.id, "availability-check-alias");
    const availableOnOtherDomain = await linksService.isAliasAvailable(domainB.id, "availability-check-alias");

    expect(availableOnSameDomain).toBe(false);
    expect(availableOnOtherDomain).toBe(true);
  });

  it("rejects creating a link against a domain that doesn't exist", async () => {
    await expect(
      linksService.create({
        domainId: "00000000-0000-0000-0000-000000000000",
        destinationUrl: "https://example.com/no-such-domain",
        alias: "orphan-alias",
      } as never),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it("auto-generated codes never collide across two links on the same domain", async () => {
    const linkOne = await linksService.create({
      domainId: domainA.id,
      destinationUrl: "https://example.com/auto-one",
    } as never);
    const linkTwo = await linksService.create({
      domainId: domainA.id,
      destinationUrl: "https://example.com/auto-two",
    } as never);

    expect(linkOne.shortCode).not.toBe(linkTwo.shortCode);
  });
});
