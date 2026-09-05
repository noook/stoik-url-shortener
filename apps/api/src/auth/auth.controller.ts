import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UsePipes } from "@nestjs/common";
import type { Request, Response } from "express";
import { createSessionSchema, type SessionInfo } from "@url-shortener/shared";
import { ApiTokensService } from "./api-tokens.service.js";
import { AUTH_COOKIE_NAME, AUTH_COOKIE_MAX_AGE_MS } from "./auth-cookie.constants.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";

@Controller("api/auth")
export class AuthController {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  /**
   * Exchanges the pasted CLI-issued token for an httpOnly cookie holding that
   * same token - no separate session concept. This only requirement here was
   * keeping the token out of reach of page-side JS, which an httpOnly cookie
   * already does; a signed session layer on top would add moving parts
   * without adding real security value for this project (see plan §2.1).
   */
  @Post("session")
  @UsePipes(new ZodValidationPipe(createSessionSchema))
  async login(@Body() body: { token: string }, @Res({ passthrough: true }) res: Response) {
    const token = await this.apiTokensService.findActiveByPlaintext(body.token);
    if (!token) {
      throw new UnauthorizedException("Invalid or revoked token");
    }

    await this.apiTokensService.touchLastUsed(token.id);

    res.cookie(AUTH_COOKIE_NAME, body.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: AUTH_COOKIE_MAX_AGE_MS,
      path: "/",
    });

    return { tokenName: token.name, authenticated: true } satisfies SessionInfo;
  }

  @Post("logout")
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
    return { ok: true };
  }

  /**
   * Frontend calls this on load to check whether it has a valid stored token -
   * never by reading the (httpOnly, unreadable) cookie value itself.
   */
  @Get("session")
  async getSession(@Req() req: Request): Promise<SessionInfo> {
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE_NAME];
    if (!cookieToken) throw new UnauthorizedException("No token stored");

    const token = await this.apiTokensService.findActiveByPlaintext(cookieToken);
    if (!token) throw new UnauthorizedException("Token has been revoked");

    return { tokenName: token.name, authenticated: true };
  }
}
