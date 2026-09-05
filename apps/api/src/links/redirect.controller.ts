import { Controller, Get, GoneException, HttpStatus, NotFoundException, Param, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { LinksService } from "./links.service.js";
import { ClickEventsService } from "./click-events.service.js";

/**
 * Public redirect endpoint - no auth, matches on (Host header, short code).
 *
 * Always responds 302, never 301: a 301 is heuristically cached by browsers
 * even without cache headers, so a cached visitor's browser would stop
 * contacting the server at all - breaking both click logging and link
 * edits/expiry for repeat visitors. See docs/adr/0001-*.md and the plan's
 * redirect-status decision for the full reasoning.
 */
@Controller()
export class RedirectController {
  constructor(
    private readonly linksService: LinksService,
    private readonly clickEventsService: ClickEventsService,
  ) {}

  @Get(":code")
  async redirect(@Param("code") code: string, @Req() req: Request, @Res() res: Response) {
    const hostname = (req.hostname || req.headers.host || "").split(":")[0];
    const link = await this.linksService.resolveForRedirect(hostname, code);

    if (!link) {
      throw new NotFoundException("Short link not found");
    }

    const now = new Date();
    if (!link.isActive) {
      throw new GoneException("This link has been deactivated");
    }
    if (link.startAt && now < link.startAt) {
      throw new NotFoundException("This link is not active yet");
    }
    if (link.endAt && now > link.endAt) {
      throw new GoneException("This link has expired");
    }

    // Fire-and-forget: never let click logging slow down or fail the redirect.
    void this.clickEventsService.record(link.id, {
      ip: req.ip ?? null,
      userAgent: req.headers["user-agent"] ?? null,
      referrer: (Array.isArray(req.headers.referer) ? req.headers.referer[0] : req.headers.referer) ?? null,
    }).catch(() => {
      // Logging failures should never surface to the visitor - the redirect
      // has already been decided to succeed by this point.
    });

    res.redirect(HttpStatus.FOUND, link.destinationUrl);
  }
}
