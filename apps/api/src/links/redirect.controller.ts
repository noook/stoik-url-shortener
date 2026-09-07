import { Controller, Get, GoneException, HttpStatus, Param, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { LinksService } from "./links.service.js";
import { ClickEventsService } from "./click-events.service.js";

/**
 * Where the admin dashboard (the `web` app) is served from on this same
 * domain - see docker-compose.yml's `web` router (PathPrefix(`/admin`)) and
 * apps/web's `vite.config.ts` `base` / `App.tsx` `basename`. Kept as one
 * constant here since this controller is the thing responsible for sending
 * visitors there when they hit the bare domain root.
 */
const ADMIN_PATH = "/admin";

/**
 * Best-effort real visitor IP for click logging. This app can be deployed
 * behind very different edges - a Cloudflare Tunnel + Traefik (this
 * project's own homelab setup, see docs/homelab-deployment-notes.md), a
 * plain reverse proxy with no CDN, or nothing in front at all (a bare
 * `docker run` reachable directly) - so this is a fallback chain, not a
 * single assumption:
 *
 * 1. `Cf-Connecting-Ip` - set by Cloudflare's edge to the actual client IP.
 *    Checked first and independently of Express's `trust proxy`/req.ip
 *    machinery because a Cloudflare Tunnel (`cloudflared`) does NOT set
 *    `X-Forwarded-For` at all - only `CF-*` headers - so no `trust proxy`
 *    configuration on this app, and no `forwardedHeaders.trustedIPs` on
 *    Traefik, can ever recover a real IP from `X-Forwarded-For` in that
 *    specific chain. This is the one header actually available there.
 * 2. `req.ip` (Express `trust proxy`, set in main.ts) - correct for a
 *    plain reverse-proxy deployment with no Cloudflare in front, where
 *    `X-Forwarded-For` (not `Cf-Connecting-Ip`) is the real signal.
 *    `trust proxy` only takes effect when a header is actually present;
 *    with nothing in front at all this still safely resolves to the raw
 *    socket peer, which in that deployment shape IS the real visitor.
 *
 * Neither header is verified against a trusted-source IP allowlist at
 * this layer - `Cf-Connecting-Ip` is only meaningful at all if requests
 * can't reach this app except via the real Cloudflare edge (true for the
 * homelab: the api container has no published host port, only Traefik ->
 * this container over the internal `proxy` network - see
 * docker-compose.homelab.yml), and `X-Forwarded-For` trust is Traefik's
 * job via `forwardedHeaders.trustedIPs`, not this app's.
 */
function resolveClientIp(req: Request): string | null {
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  if (typeof cfConnectingIp === "string" && cfConnectingIp.length > 0) {
    return cfConnectingIp;
  }
  return req.ip ?? null;
}

/**
 * Plain HTML for a visited code that doesn't resolve to anything - shown to
 * a human who followed a typo'd/expired/never-existed short link, as
 * opposed to the framework's default JSON 404 body (still what a
 * non-code-shaped or otherwise-unhandled path gets, via Nest/Express's own
 * fallback - see this controller's doc comment).
 */
const SHORT_LINK_NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Link not found</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; background: #0f172a; color: #e2e8f0; }
  main { text-align: center; padding: 2rem; }
  h1 { font-size: 1.375rem; margin: 0 0 0.5rem; }
  p { color: #94a3b8; margin: 0; }
</style>
</head>
<body>
  <main>
    <h1>This link doesn&rsquo;t exist</h1>
    <p>It may be mistyped, expired, or was never created.</p>
  </main>
</body>
</html>`;

/**
 * Public redirect endpoint - no auth, matches on (Host header, short code).
 *
 * Always responds 302, never 301: a 301 is heuristically cached by browsers
 * even without cache headers, so a cached visitor's browser would stop
 * contacting the server at all - breaking both click logging and link
 * edits/expiry for repeat visitors. See docs/adr/0001-*.md and the plan's
 * redirect-status decision for the full reasoning.
 *
 * This controller also owns the domain's bare root and any code that
 * doesn't resolve, since Traefik forwards this service everything the
 * `/api` and `/admin` routers don't claim (see docker-compose.yml) - so
 * "visitor hit `/` or an unknown code" is this app's problem, not the
 * reverse proxy's, and stays correct regardless of which reverse proxy
 * fronts it (see docs/adding-a-domain.md).
 */
@Controller()
export class RedirectController {
  constructor(
    private readonly linksService: LinksService,
    private readonly clickEventsService: ClickEventsService,
  ) {}

  /** Bare domain root - send visitors to the admin dashboard. */
  @Get()
  redirectRoot(@Res() res: Response) {
    res.redirect(HttpStatus.FOUND, ADMIN_PATH);
  }

  @Get(":code")
  async redirect(@Param("code") code: string, @Req() req: Request, @Res() res: Response) {
    const hostname = (req.hostname || req.headers.host || "").split(":")[0];
    const link = await this.linksService.resolveForRedirect(hostname, code);

    if (!link) {
      res.status(HttpStatus.NOT_FOUND).type("html").send(SHORT_LINK_NOT_FOUND_HTML);
      return;
    }

    const now = new Date();
    if (!link.isActive) {
      throw new GoneException("This link has been deactivated");
    }
    if (link.startAt && now < link.startAt) {
      res.status(HttpStatus.NOT_FOUND).type("html").send(SHORT_LINK_NOT_FOUND_HTML);
      return;
    }
    if (link.endAt && now > link.endAt) {
      throw new GoneException("This link has expired");
    }

    // Fire-and-forget: never let click logging slow down or fail the redirect.
    void this.clickEventsService.record(link.id, {
      ip: resolveClientIp(req),
      userAgent: req.headers["user-agent"] ?? null,
      referrer: (Array.isArray(req.headers.referer) ? req.headers.referer[0] : req.headers.referer) ?? null,
    }).catch(() => {
      // Logging failures should never surface to the visitor - the redirect
      // has already been decided to succeed by this point.
    });

    res.redirect(HttpStatus.FOUND, link.destinationUrl);
  }
}
