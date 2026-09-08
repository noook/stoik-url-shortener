import { BadGatewayException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { adSchema, type Ad } from "@url-shortener/shared";

/**
 * Default target for the third-party ad API - see the .env.example files
 * for how to override it. The token has no default on purpose: without a
 * real ADS_API_TOKEN configured, ad requests simply fail (502, see
 * AdsController) rather than silently working against a hardcoded secret.
 */
const DEFAULT_ADS_API_URL = "https://stoik-technical-test-js-admin.vercel.app/api/ads";

/**
 * Server-side proxy to a third-party ad service. Exists so the ad
 * service's private auth token never reaches the browser - only this
 * service (running on the API) ever holds it, attached as an
 * Authorization: Bearer header on the outbound request. Called by
 * AdsController, which is itself behind the same ApiTokenAuthGuard as
 * every other authenticated route (see plan §3.1 / ADS_API_TOKEN below).
 */
@Injectable()
export class AdsService {
  constructor(private readonly configService: ConfigService) {}

  async fetchAd(width: number, height: number): Promise<Ad> {
    const baseUrl = this.configService.get<string>("ADS_API_URL") ?? DEFAULT_ADS_API_URL;
    const token = this.configService.get<string>("ADS_API_TOKEN");

    if (!token) {
      throw new BadGatewayException("Ad service is not configured (missing ADS_API_TOKEN)");
    }

    let raw: unknown;
    try {
      const url = new URL(baseUrl);
      url.searchParams.set("width", String(width));
      url.searchParams.set("height", String(height));

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error(`Upstream responded ${response.status}`);
      }
      raw = await response.json();
    } catch {
      // Never leak upstream error bodies/headers (could echo the token back
      // in a diagnostic message from a misbehaving third party) - collapse
      // any upstream failure into a generic 502 for the caller.
      throw new BadGatewayException("Failed to fetch ad from upstream service");
    }

    const result = adSchema.safeParse(raw);
    if (!result.success) {
      throw new BadGatewayException("Ad service returned an unexpected response shape");
    }

    return result.data;
  }
}
