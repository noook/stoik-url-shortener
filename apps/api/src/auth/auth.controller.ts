import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UsePipes } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { createSessionSchema, type SessionInfo } from "@url-shortener/shared";
import { ApiTokensService } from "./api-tokens.service.js";
import { SessionCodec } from "./session-codec.js";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "./session.constants.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";

@Controller("api/auth")
export class AuthController {
  constructor(
    private readonly apiTokensService: ApiTokensService,
    private readonly sessionCodec: SessionCodec,
    private readonly configService: ConfigService,
  ) {}

  @Post("session")
  @UsePipes(new ZodValidationPipe(createSessionSchema))
  async createSession(
    @Body() body: { token: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = await this.apiTokensService.findActiveByPlaintext(body.token);
    if (!token) {
      throw new UnauthorizedException("Invalid or revoked token");
    }

    await this.apiTokensService.touchLastUsed(token.id);

    const cookieValue = this.sessionCodec.encode({ tokenId: token.id, issuedAt: Date.now() });
    res.cookie(SESSION_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      domain: this.configService.get<string>("SESSION_COOKIE_DOMAIN"),
      maxAge: SESSION_MAX_AGE_MS,
      path: "/",
    });

    return { tokenName: token.name, authenticated: true } satisfies SessionInfo;
  }

  @Post("logout")
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return { ok: true };
  }

  /**
   * Frontend calls this on load to check whether it has a valid session -
   * never by reading the (httpOnly, unreadable) cookie value itself.
   */
  @Get("session")
  async getSession(@Req() req: Request): Promise<SessionInfo> {
    const cookieValue = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE_NAME];
    const payload = this.sessionCodec.decode(cookieValue);
    if (!payload) throw new UnauthorizedException("No valid session");

    const token = await this.apiTokensService.findActiveById(payload.tokenId);
    if (!token) throw new UnauthorizedException("Session's token has been revoked");

    return { tokenName: token.name, authenticated: true };
  }
}
