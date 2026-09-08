import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BadGatewayException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdsService } from "./ads.service.js";

/**
 * Unit tests for the ad-proxy service - no DB/HTTP server needed, just a
 * mocked global fetch and a stubbed ConfigService. Exercises exactly the
 * behavior the plan called out as worth testing: the token is attached
 * outbound and never leaked back, width/height are forwarded, and a bad
 * upstream response is handled rather than crashing (see plan §4 step 10).
 */
describe("AdsService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function makeService(config: Record<string, string | undefined>) {
    const configService = {
      get: (key: string) => config[key],
    } as unknown as ConfigService;
    return new AdsService(configService);
  }

  it("throws 502 when ADS_API_TOKEN is not configured", async () => {
    const service = makeService({ ADS_API_URL: "https://ads.example.com/api/ads" });
    await expect(service.fetchAd(400, 400)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it("attaches the token as an Authorization: Bearer header and forwards width/height", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "ad-123",
          imageUrl: "https://picsum.photos/400/400",
          link: "https://example.com/ad",
          width: 400,
          height: 400,
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = makeService({
      ADS_API_URL: "https://ads.example.com/api/ads",
      ADS_API_TOKEN: "secret-token",
    });

    const ad = await service.fetchAd(400, 400);

    expect(ad).toEqual({
      id: "ad-123",
      imageUrl: "https://picsum.photos/400/400",
      link: "https://example.com/ad",
      width: 400,
      height: 400,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(calledUrl.toString()).toBe("https://ads.example.com/api/ads?width=400&height=400");
    expect((calledInit.headers as Record<string, string>).Authorization).toBe(
      "Bearer secret-token",
    );
  });

  it("falls back to the default ad-service URL when ADS_API_URL is unset", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "ad-1",
          imageUrl: "https://picsum.photos/800/250",
          link: "https://example.com/ad",
          width: 800,
          height: 250,
        }),
        { status: 200 },
      ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = makeService({ ADS_API_TOKEN: "secret-token" });
    await service.fetchAd(800, 250);

    const [calledUrl] = fetchMock.mock.calls[0] as [URL];
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      "https://stoik-technical-test-js-admin.vercel.app/api/ads",
    );
  });

  it("throws a generic 502 (no upstream body leaked) on a non-2xx upstream response", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
      })) as unknown as typeof fetch;

    const service = makeService({
      ADS_API_URL: "https://ads.example.com/api/ads",
      ADS_API_TOKEN: "bad-token",
    });

    await expect(service.fetchAd(400, 400)).rejects.toMatchObject({
      name: "BadGatewayException",
    });
  });

  it("throws a 502 when the upstream response doesn't match the expected ad shape", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ unexpected: "shape" }), { status: 200 })) as unknown as typeof fetch;

    const service = makeService({
      ADS_API_URL: "https://ads.example.com/api/ads",
      ADS_API_TOKEN: "secret-token",
    });

    await expect(service.fetchAd(400, 400)).rejects.toBeInstanceOf(BadGatewayException);
  });
});
