import { Controller, Get, UseGuards } from "@nestjs/common";
import { adQuerySchema, type Ad, type AdQuery } from "@url-shortener/shared";
import { AdsService } from "./ads.service.js";
import { ApiTokenAuthGuard } from "../auth/api-token-auth.guard.js";
import { ZodQuery } from "../common/zod-validation.pipe.js";

/**
 * Proxies ad requests to a third-party ad service - see AdsService for why
 * this lives server-side (the ad service's auth token must never reach the
 * browser). Behind the same guard as every other dashboard route since the
 * only caller today is the authenticated homepage (LinksListPage) - see
 * plan §3.1/§5.
 */
@Controller("api/ads")
@UseGuards(ApiTokenAuthGuard)
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get()
  async getAd(@ZodQuery(adQuerySchema) query: AdQuery): Promise<Ad> {
    return this.adsService.fetchAd(query.width, query.height);
  }
}
